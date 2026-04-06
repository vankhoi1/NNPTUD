const Loan = require('../../schemas/loan/Loan');
const Book = require('../../schemas/book/Book');
const Member = require('../../schemas/member/Member');
const User = require('../../schemas/user/User');
const Notification = require('../../schemas/notification/Notification');
const AuditLog = require('../../schemas/audit/AuditLog');
const Fine = require('../../schemas/fine/Fine');
const LoanStatusHistory = require('../../schemas/loanStatusHistory/LoanStatusHistory');
const { validationResult } = require('express-validator');
const { runInTransaction } = require('../../utils/transaction');

function calculateOverdueFine(dueDate) {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const lateDays = Math.ceil((now - due) / msPerDay);
  if (lateDays <= 0) return 0;
  return Number((lateDays * 0.5).toFixed(2));
}

async function createLoanStatusHistory(session, {
  loanId,
  previousStatus,
  newStatus,
  changedBy,
  reason = '',
  metadata = {}
}) {
  await LoanStatusHistory.create(
    [
      {
        loan: loanId,
        previousStatus,
        newStatus,
        changedBy,
        changeReason: reason,
        metadata
      }
    ],
    session ? { session } : undefined
  );
}

// @desc    Get all loans with optional filtering
// @route   GET /api/loans
// @access  Public
exports.getAllLoans = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      member,
      book,
      overdue
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (member) query.member = member;
    if (book) query.book = book;
    if (overdue === 'true') query.status = 'Overdue';

    const loans = await Loan.find(query)
      .populate('book', 'title author')
      .populate('member', 'name email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ loanDate: -1 });

    const total = await Loan.countDocuments(query);

    res.status(200).json({
      success: true,
      count: loans.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: loans
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single loan by ID
// @route   GET /api/loans/:id
// @access  Public
exports.getLoan = async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('book', 'title author isbn')
      .populate('member', 'name email');

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: `Loan not found with id of ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: loan
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new loan (borrow a book)
// @route   POST /api/loans
// @access  Private/Admin
exports.createLoan = async (req, res, next) => {
  try {
    const { bookId, memberId, dueDate, notes } = req.body;

    // Check if book exists
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: `Book not found with id of ${bookId}`
      });
    }

    // Check if member exists
    const member = await Member.findById(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: `Member not found with id of ${memberId}`
      });
    }

    // Check if member is active
    if (member.membershipStatus !== 'Active') {
      return res.status(400).json({
        success: false,
        message: `Member is not active. Current status: ${member.membershipStatus}`
      });
    }

    // Check if member can borrow more books
    if (!member.canBorrow()) {
      return res.status(400).json({
        success: false,
        message: `Member has reached maximum borrowing limit (${member.currentBorrowedCount}/${member.maxBooksAllowed})`
      });
    }

    // Check if book is available
    if (!book.isAvailable()) {
      return res.status(400).json({
        success: false,
        message: `Book is not available. Available copies: ${book.availableCopies}`
      });
    }

    // Check if member already has this book
    const existingLoan = await Loan.findOne({
      book: bookId,
      member: memberId,
      status: { $in: ['Borrowed', 'Overdue'] }
    });

    if (existingLoan) {
      return res.status(400).json({
        success: false,
        message: 'Member already has an active loan for this book'
      });
    }

    const result = await runInTransaction(async (session) => {
      const loan = new Loan({
        book: bookId,
        member: memberId,
        dueDate,
        notes,
        loanDate: new Date(),
        status: 'Borrowed'
      });
      await loan.save({ session });
      await createLoanStatusHistory(session, {
        loanId: loan._id,
        previousStatus: 'Pending',
        newStatus: 'Borrowed',
        changedBy: req.user._id,
        reason: 'Loan created by staff',
        metadata: { source: 'createLoan' }
      });

      // Update book available copies
      book.decreaseAvailable();
      await book.save({ session });

      // Update member borrowed count
      member.incrementBorrowed();
      await member.save({ session });

      // Create audit + notification for the member
      const memberUser = await User.findOne({ member: memberId }).session(session);
      let notification = null;
      if (memberUser?._id) {
        notification = await Notification.create({
          user: memberUser._id,
          type: 'LOAN_APPROVED',
          title: 'Loan created',
          message: 'Your loan has been approved and the book is ready.',
          relatedLoan: loan._id
        }, { session });
      }

      // Use array form so mongoose won't treat options as another doc
      await AuditLog.create(
        [
          {
            actor: req.user._id,
            action: 'LOAN_APPROVED',
            resourceType: 'Loan',
            resourceId: loan._id,
            details: { bookId, memberId }
          }
        ],
        { session }
      );

      return { loan, notification };
    });

    await result.loan.populate('book', 'title author isbn');
    await result.loan.populate('member', 'name email');

    res.status(201).json({
      success: true,
      data: result.loan
    });

    // Emit socket event after commit
    const io = req.app.get('io');
    if (io && result?.notification?._id) {
      io.to(`user:${result.notification.user.toString()}`).emit('notification:new', result.notification);
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update a loan
// @route   PUT /api/loans/:id
// @access  Private/Admin
exports.updateLoan = async (req, res, next) => {
  try {
    const payload = { ...req.body };
    if (payload.status === 'Overdue') {
      const fine = calculateOverdueFine(payload.dueDate);
      payload.fineAmount = fine;
      payload.fineReason = fine > 0 ? 'Late Return' : payload.fineReason;
    }

    const loan = await Loan.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    )
      .populate('book', 'title author')
      .populate('member', 'name email');

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: `Loan not found with id of ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: loan
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a loan
// @route   DELETE /api/loans/:id
// @access  Private/Admin
exports.deleteLoan = async (req, res, next) => {
  try {
    const loan = await Loan.findByIdAndDelete(req.params.id);

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: `Loan not found with id of ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get overdue loans
// @route   GET /api/loans/overdue
// @access  Public
exports.getOverdueLoans = async (req, res, next) => {
  try {
    const loans = await Loan.find({ status: 'Overdue' })
      .populate('book', 'title author isbn')
      .populate('member', 'name email phone')
      .sort({ dueDate: 1 });

    // Backfill missing fine values for existing overdue loans.
    for (const loan of loans) {
      const computedFine = calculateOverdueFine(loan.dueDate);
      if ((loan.fineAmount || 0) !== computedFine) {
        loan.fineAmount = computedFine;
        loan.fineReason = computedFine > 0 ? 'Late Return' : loan.fineReason;
        await loan.save();
      }
    }

    res.status(200).json({
      success: true,
      count: loans.length,
      data: loans
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Renew a loan (extend due date)
// @route   PUT /api/loans/:id/renew
// @access  Private/Admin
exports.renewLoan = async (req, res, next) => {
  try {
    const { newDueDate } = req.body;
    if (!newDueDate) {
      const err = new Error('Please provide a new due date');
      err.statusCode = 400;
      throw err;
    }

    const result = await runInTransaction(async (session) => {
      const loan = await Loan.findById(req.params.id).session(session);
      if (!loan) {
        const err = new Error(`Loan not found with id of ${req.params.id}`);
        err.statusCode = 404;
        throw err;
      }

      if (loan.status === 'Returned') {
        const err = new Error('Cannot renew a returned loan');
        err.statusCode = 400;
        throw err;
      }

      const previousStatus = loan.status;
      loan.dueDate = new Date(newDueDate);
      if (loan.status === 'Overdue') {
        loan.status = 'Borrowed';
        loan.fineAmount = 0;
        loan.fineReason = null;
      }
      await loan.save({ session });
      if (previousStatus !== loan.status) {
        await createLoanStatusHistory(session, {
          loanId: loan._id,
          previousStatus,
          newStatus: loan.status,
          changedBy: req.user._id,
          reason: 'Loan renewed',
          metadata: { source: 'renewLoan' }
        });
      }

      // Use array form so mongoose won't treat options as another doc
      await AuditLog.create(
        [
          {
            actor: req.user._id,
            action: 'RENEWAL_APPROVED',
            resourceType: 'Loan',
            resourceId: loan._id,
            details: { loanId: loan._id }
          }
        ],
        { session }
      );

      const memberUser = await User.findOne({ member: loan.member }).session(session);
      let notification = null;
      if (memberUser?._id) {
        notification = await Notification.create(
          {
            user: memberUser._id,
            type: 'RENEWAL_APPROVED',
            title: 'Loan renewed',
            message: `Your loan due date has been renewed to ${new Date(newDueDate).toISOString()}.`,
            relatedLoan: loan._id
          },
          { session }
        );
      }

      return { loanId: loan._id, notification };
    });

    const loan = await Loan.findById(result.loanId)
      .populate('book', 'title author isbn')
      .populate('member', 'name email');

    res.status(200).json({
      success: true,
      data: loan,
      message: 'Loan renewed successfully'
    });

    const io = req.app.get('io');
    if (io && result?.notification?._id) {
      io.to(`user:${result.notification.user.toString()}`).emit('notification:new', result.notification);
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user's loans (for readers)
// @route   GET /api/loans/me
// @access  Private
exports.getMyLoans = async (req, res, next) => {
  try {
    // Get the member ID from the authenticated user
    const memberId = req.user.member;

    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: 'No associated member record found. Please contact administrator.'
      });
    }

    const { page = 1, limit = 10, status } = req.query;

    const query = { member: memberId };

    if (status) query.status = status;

    const loans = await Loan.find(query)
      .populate('book', 'title author isbn category')
      .populate('member', 'name email phone memberType membershipStatus')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ loanDate: -1 });

    const total = await Loan.countDocuments(query);

    res.status(200).json({
      success: true,
      count: loans.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: loans
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Borrow a book (for readers - self service) - Creates Pending request
// @route   POST /api/loans/borrow
// @access  Private (Reader, Librarian, Admin)
exports.borrowBook = async (req, res, next) => {
  try {
    const { bookId, dueDate } = req.body;
    const memberId = req.user.member;
    const result = await runInTransaction(async (session) => {
      // 1. Kiểm tra sách tồn tại
      const book = await Book.findById(bookId).session(session);
      if (!book) {
        const err = new Error('Sách không tồn tại');
        err.statusCode = 400;
        throw err;
      }

      // 2. Kiểm tra Member
      const member = await Member.findById(memberId).session(session);
      if (!member || !member.canBorrow()) {
        const err = new Error('Thành viên không đủ điều kiện mượn');
        err.statusCode = 400;
        throw err;
      }

      // 3. Kiểm tra đã có pending loan cho sách này chưa
      const existingPending = await Loan.findOne({
        book: bookId,
        member: memberId,
        status: 'Pending'
      }).session(session);

      if (existingPending) {
        const err = new Error('Bạn đã có yêu cầu mượn sách này đang chờ duyệt');
        err.statusCode = 400;
        throw err;
      }

      // 4. Kiểm tra đã có active loan (Borrowed/Overdue) cho sách này chưa
      const existingActive = await Loan.findOne({
        book: bookId,
        member: memberId,
        status: { $in: ['Borrowed', 'Overdue'] }
      }).session(session);

      if (existingActive) {
        const err = new Error('Bạn đã mượn sách này rồi');
        err.statusCode = 400;
        throw err;
      }

      // 5. Tạo Loan với status Pending - KHÔNG trừ availableCopies
      const loan = new Loan({
        book: bookId,
        member: memberId,
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Default 14 days
        loanDate: new Date(),
        status: 'Pending'
      });
      await loan.save({ session });
      await createLoanStatusHistory(session, {
        loanId: loan._id,
        previousStatus: 'Pending',
        newStatus: 'Pending',
        changedBy: req.user._id,
        reason: 'Borrow request submitted',
        metadata: { source: 'borrowBook' }
      });

      // Use array form so mongoose won't treat options as another doc
      await AuditLog.create(
        [
          {
            actor: req.user._id,
            action: 'BORROW_REQUEST_CREATED',
            resourceType: 'Loan',
            resourceId: loan._id,
            details: { bookId, memberId }
          }
        ],
        { session }
      );

      // Notify librarian/admin
      const staffUsers = await User.find({
        role: { $in: ['Librarian', 'Admin'] },
        isActive: true
      }).session(session);

      let notifications = [];
      if (staffUsers.length > 0) {
        const payload = staffUsers.map((u) => ({
          user: u._id,
          type: 'BORROW_REQUEST_CREATED',
          title: 'New borrow request',
          message: 'A reader requested to borrow a book. Please review it.',
          relatedLoan: loan._id
        }));

        notifications = await Notification.create(payload, { session });
      }

      return { loanId: loan._id, notifications };
    });

    const loan = await Loan.findById(result.loanId)
      .populate('book', 'title author isbn')
      .populate('member', 'name email');

    res.status(201).json({
      success: true,
      data: loan,
      message: 'Yêu cầu mượn sách đã được gửi, chờ thủ thư duyệt'
    });

    const io = req.app.get('io');
    if (io && Array.isArray(result.notifications)) {
      result.notifications.forEach((n) => {
        io.to(`user:${n.user.toString()}`).emit('notification:new', n);
      });
    }

  } catch (error) {
    res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
};
// @desc    Return a book (for readers - self service)
// @route   PUT /api/loans/:id/return
// @access  Private (Reader, Librarian, Admin)
exports.returnBook = async (req, res, next) => {
  try {
    const result = await runInTransaction(async (session) => {
      const loan = await Loan.findById(req.params.id).session(session);

      if (!loan) {
        throw new Error(`Loan not found with id of ${req.params.id}`);
      }

      // Check if this loan belongs to the authenticated user (if they are a reader)
      const loanMemberId = loan.member?.toString?.() || loan.member;
      const userMemberId = req.user.member?.toString?.() || req.user.member;
      if (req.user.role === 'Reader' && loanMemberId !== userMemberId) {
        const err = new Error('Bạn chỉ có thể trả sách cho phiếu mượn của chính mình');
        err.statusCode = 403;
        throw err;
      }

      if (loan.status === 'Returned') {
        const err = new Error('Book has already been returned');
        err.statusCode = 400;
        throw err;
      }

      const book = await Book.findById(loan.book).session(session);
      const member = await Member.findById(loan.member).session(session);

      if (!book || !member) {
        const err = new Error('Related book/member not found');
        err.statusCode = 404;
        throw err;
      }

      // Update loan
      const previousStatus = loan.status;
      loan.returnDate = new Date();
      loan.notes = req.body.notes || loan.notes;

      // Calculate overdue/fine while loan.status is not yet set to "Returned"
      loan.updateStatus();
      if (loan.status === 'Overdue') {
        loan.fineReason = loan.fineReason || 'Late Return';
      }

      loan.status = 'Returned';
      await loan.save({ session });
      await createLoanStatusHistory(session, {
        loanId: loan._id,
        previousStatus,
        newStatus: 'Returned',
        changedBy: req.user._id,
        reason: req.body.notes || 'Book returned',
        metadata: { source: 'returnBook' }
      });

      // Update book available copies
      book.increaseAvailable();
      await book.save({ session });

      // Update member borrowed count
      member.decrementBorrowed();
      await member.save({ session });

      // Create Fine + Notifications if overdue
      let fine = null;
      if (loan.status === 'Returned' && loan.fineAmount > 0) {
        fine = await Fine.create(
          {
            loan: loan._id,
            member: member._id,
            amount: loan.fineAmount,
            reason: loan.fineReason || 'Late Return',
            status: 'Unpaid'
          },
          { session }
        );
      }

      const memberUser = await User.findOne({ member: member._id }).session(session);
      let notificationReturn = null;
      let notificationFine = null;

      if (memberUser?._id) {
        try {
          notificationReturn = await Notification.create(
            {
              user: memberUser._id,
              type: 'LOAN_RETURNED',
              title: 'Book returned',
              message: 'Your book has been returned successfully.',
              relatedLoan: loan._id
            },
            { session }
          );
        } catch (error) {
          console.error('Failed to create return notification:', error.message);
          // Continue without notification
        }

        if (fine) {
          try {
            notificationFine = await Notification.create(
              {
                user: memberUser._id,
                type: 'FINE_CREATED',
                title: 'New fine created',
                message: `A fine was created for a late return. Amount: ${fine.amount}`,
                relatedLoan: loan._id,
                relatedFine: fine._id
              },
              { session }
            );
          } catch (error) {
            console.error('Failed to create fine notification:', error.message);
            // Continue without notification
          }
        }
      }

      await AuditLog.create(
        [
          {
            actor: req.user._id,
            action: 'LOAN_RETURNED',
            resourceType: 'Loan',
            resourceId: loan._id,
            details: { fineCreated: !!fine }
          }
        ],
        { session }
      );

      return { loanId: loan._id, fine, notificationReturn, notificationFine };
    });

    const loan = await Loan.findById(result.loanId)
      .populate('book', 'title author isbn')
      .populate('member', 'name email');

    res.status(200).json({
      success: true,
      data: loan,
      message: 'Book returned successfully'
    });

    const io = req.app.get('io');
    if (io && result?.notificationReturn?._id) {
      io.to(`user:${result.notificationReturn.user.toString()}`).emit('notification:new', result.notificationReturn);
    }
    if (io && result?.notificationFine?._id) {
      io.to(`user:${result.notificationFine.user.toString()}`).emit('notification:new', result.notificationFine);
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get all pending loans (for librarians)
// @route   GET /api/loans/pending
// @access  Private (Librarian, Admin)
exports.getPendingLoans = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const loans = await Loan.find({ status: 'Pending' })
      .populate('book', 'title author isbn')
      .populate('member', 'name email phone')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Loan.countDocuments({ status: 'Pending' });

    res.status(200).json({
      success: true,
      count: loans.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: loans
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve a pending loan (librarian confirms book pickup)
// @route   PUT /api/loans/:id/approve
// @access  Private (Librarian, Admin)
exports.approveLoan = async (req, res, next) => {
  try {
    const result = await runInTransaction(async (session) => {
      const loan = await Loan.findById(req.params.id).session(session);
      if (!loan) {
        const err = new Error(`Loan not found with id of ${req.params.id}`);
        err.statusCode = 404;
        throw err;
      }

      if (loan.status !== 'Pending') {
        const err = new Error(`Only pending loans can be approved. Current status: ${loan.status}`);
        err.statusCode = 400;
        throw err;
      }

      const book = await Book.findById(loan.book).session(session);
      const member = await Member.findById(loan.member).session(session);

      if (!book || !member) throw new Error('Related book/member not found');
      if (!book.isAvailable || !book.isAvailable()) {
        const err = new Error('Book is no longer available. Cannot approve loan.');
        err.statusCode = 400;
        throw err;
      }

      const previousStatus = loan.status;
      loan.status = 'Borrowed';
      loan.loanDate = new Date();
      await loan.save({ session });
      await createLoanStatusHistory(session, {
        loanId: loan._id,
        previousStatus,
        newStatus: 'Borrowed',
        changedBy: req.user._id,
        reason: 'Borrow request approved',
        metadata: { source: 'approveLoan' }
      });

      // Decrease available copies (only now when book is actually taken)
      book.decreaseAvailable();
      await book.save({ session });

      // Increment member's borrowed count
      member.incrementBorrowed();
      await member.save({ session });

      const memberUser = await User.findOne({ member: member._id }).session(session);
      let notification = null;

      if (memberUser?._id) {
        try {
          notification = await Notification.create(
            {
              user: memberUser._id,
              type: 'LOAN_APPROVED',
              title: 'Loan approved',
              message: `Your loan is approved. Please pick up the book.`,
              relatedLoan: loan._id
            },
            { session }
          );
        } catch (error) {
          console.error('Failed to create notification:', error.message);
          // Continue without notification
        }
      }

      await AuditLog.create(
        [
          {
            actor: req.user._id,
            action: 'LOAN_APPROVED',
            resourceType: 'Loan',
            resourceId: loan._id,
            details: { loanId: loan._id }
          }
        ],
        { session }
      );

      return { loanId: loan._id, notification };
    });

    const loan = await Loan.findById(result.loanId)
      .populate('book', 'title author isbn')
      .populate('member', 'name email');

    res.status(200).json({
      success: true,
      data: loan,
      message: 'Loan approved successfully. Book has been checked out.'
    });

    const io = req.app.get('io');
    if (io && result?.notification?._id) {
      io.to(`user:${result.notification.user.toString()}`).emit('notification:new', result.notification);
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Reject a pending loan (librarian denies request)
// @route   PUT /api/loans/:id/reject
// @access  Private (Librarian, Admin)
exports.rejectLoan = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await runInTransaction(async (session) => {
      const loan = await Loan.findById(req.params.id).session(session);
      if (!loan) {
        const err = new Error(`Loan not found with id of ${req.params.id}`);
        err.statusCode = 404;
        throw err;
      }

      if (loan.status !== 'Pending') {
        const err = new Error(`Only pending loans can be rejected. Current status: ${loan.status}`);
        err.statusCode = 400;
        throw err;
      }

      const previousStatus = loan.status;
      loan.status = 'Rejected';
      loan.notes = reason ? `Rejected: ${reason}` : loan.notes;
      await loan.save({ session });
      await createLoanStatusHistory(session, {
        loanId: loan._id,
        previousStatus,
        newStatus: 'Rejected',
        changedBy: req.user._id,
        reason: reason || 'Borrow request rejected',
        metadata: { source: 'rejectLoan' }
      });

      // Use array form so mongoose won't treat options as another doc
      await AuditLog.create(
        [
          {
            actor: req.user._id,
            action: 'LOAN_REJECTED',
            resourceType: 'Loan',
            resourceId: loan._id,
            details: { loanId: loan._id }
          }
        ],
        { session }
      );

      const memberUser = await User.findOne({ member: loan.member }).session(session);
      let notification = null;
      if (memberUser?._id) {
        notification = await Notification.create(
          {
            user: memberUser._id,
            type: 'LOAN_REJECTED',
            title: 'Loan rejected',
            message: reason ? `Your loan request was rejected: ${reason}` : 'Your loan request was rejected.',
            relatedLoan: loan._id
          },
          { session }
        );
      }

      return { loanId: loan._id, notification };
    });

    const loan = await Loan.findById(result.loanId)
      .populate('book', 'title author isbn')
      .populate('member', 'name email');

    res.status(200).json({
      success: true,
      data: loan,
      message: 'Loan rejected successfully'
    });

    const io = req.app.get('io');
    if (io && result?.notification?._id) {
      io.to(`user:${result.notification.user.toString()}`).emit('notification:new', result.notification);
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Request renewal (for readers) - Just creates a request
// @route   PUT /api/loans/:id/renew-request
// @access  Private (Reader)
exports.requestRenewal = async (req, res, next) => {
  try {
    const memberId = req.user.member;
    const result = await runInTransaction(async (session) => {
      const loan = await Loan.findById(req.params.id).session(session);
      if (!loan) {
        const err = new Error(`Loan not found with id of ${req.params.id}`);
        err.statusCode = 404;
        throw err;
      }

      // Check ownership
      const requestedMemberId = memberId?.toString?.() || memberId;
      const loanMemberId = loan.member?.toString?.() || loan.member;
      if (loanMemberId !== requestedMemberId) {
        const err = new Error('Bạn chỉ có thể yêu cầu gia hạn cho phiếu mượn của chính mình');
        err.statusCode = 403;
        throw err;
      }

      // Check loan status
      if (loan.status === 'Returned') {
        const err = new Error('Cannot renew a returned loan');
        err.statusCode = 400;
        throw err;
      }

      if (loan.status === 'Pending') {
        const err = new Error('Cannot renew a pending loan');
        err.statusCode = 400;
        throw err;
      }

      // Check if already has a pending renewal request
      if (loan.renewalRequested) {
        const err = new Error('You already have a renewal request pending for this loan');
        err.statusCode = 400;
        throw err;
      }

      // Check renewal limits
      if (loan.renewalCount >= loan.maxRenewalsAllowed) {
        const err = new Error(`Maximum renewal limit (${loan.maxRenewalsAllowed}) reached for this book`);
        err.statusCode = 400;
        throw err;
      }

      // Check if book has holds/waiting list
      const book = await Book.findById(loan.book).session(session);
      if (!book) {
        const err = new Error('Book not found');
        err.statusCode = 404;
        throw err;
      }

      if (book.holdsCount > 0) {
        const err = new Error('Cannot renew this book because there are other users waiting for it');
        err.statusCode = 400;
        throw err;
      }

      // Just mark as requested - DON'T change due date yet
      loan.renewalRequested = true;
      await loan.save({ session });

      await AuditLog.create(
        {
          actor: req.user._id,
          action: 'RENEWAL_REQUESTED',
          resourceType: 'Loan',
          resourceId: loan._id,
          details: { loanId: loan._id }
        },
        { session }
      );

      // Notify staff
      const staffUsers = await User.find({
        role: { $in: ['Librarian', 'Admin'] },
        isActive: true
      }).session(session);

      let notifications = [];
      if (staffUsers.length > 0) {
        const payload = staffUsers.map((u) => ({
          user: u._id,
          type: 'RENEWAL_REQUESTED',
          title: 'Renewal requested',
          message: 'A reader requested a loan renewal. Please review it.',
          relatedLoan: loan._id
        }));

        notifications = await Notification.create(payload, { session });
      }

      return { loanId: loan._id, notifications };
    });

    const loan = await Loan.findById(result.loanId)
      .populate('book', 'title author isbn')
      .populate('member', 'name email');

    res.status(200).json({
      success: true,
      data: loan,
      message: 'Renewal request submitted. Please wait for librarian approval.'
    });

    const io = req.app.get('io');
    if (io && Array.isArray(result.notifications)) {
      result.notifications.forEach((n) => {
        io.to(`user:${n.user.toString()}`).emit('notification:new', n);
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel renewal request (for readers)
// @route   PUT /api/loans/:id/cancel-renewal
// @access  Private (Reader)
exports.cancelRenewalRequest = async (req, res, next) => {
  try {
    const memberId = req.user.member;
    const result = await runInTransaction(async (session) => {
      const loan = await Loan.findById(req.params.id).session(session);
      if (!loan) {
        const err = new Error(`Loan not found with id of ${req.params.id}`);
        err.statusCode = 404;
        throw err;
      }

      const loanMemberId = loan.member?.toString?.() || loan.member;
      const requestedMemberId = memberId?.toString?.() || memberId;
      if (loanMemberId !== requestedMemberId) {
        const err = new Error('Bạn chỉ có thể hủy yêu cầu gia hạn cho phiếu mượn của chính mình');
        err.statusCode = 403;
        throw err;
      }

      if (!loan.renewalRequested) {
        const err = new Error('No renewal request to cancel');
        err.statusCode = 400;
        throw err;
      }

      // For simplicity, just mark as not requested
      loan.renewalRequested = false;
      await loan.save({ session });

      await AuditLog.create(
        {
          actor: req.user._id,
          action: 'RENEWAL_CANCELLED',
          resourceType: 'Loan',
          resourceId: loan._id,
          details: { loanId: loan._id }
        },
        { session }
      );

      // Notify staff
      const staffUsers = await User.find({
        role: { $in: ['Librarian', 'Admin'] },
        isActive: true
      }).session(session);

      let notifications = [];
      if (staffUsers.length > 0) {
        const payload = staffUsers.map((u) => ({
          user: u._id,
          type: 'RENEWAL_CANCELLED',
          title: 'Renewal cancelled',
          message: 'A renewal request was cancelled by the reader.',
          relatedLoan: loan._id
        }));
        notifications = await Notification.create(payload, { session });
      }

      return { loanId: loan._id, notifications };
    });

    const loan = await Loan.findById(result.loanId)
      .populate('book', 'title author isbn')
      .populate('member', 'name email');

    res.status(200).json({
      success: true,
      data: loan,
      message: 'Renewal request cancelled'
    });

    const io = req.app.get('io');
    if (io && Array.isArray(result.notifications)) {
      result.notifications.forEach((n) => {
        io.to(`user:${n.user.toString()}`).emit('notification:new', n);
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Approve renewal request (for librarians)
// @route   PUT /api/loans/:id/approve-renewal
// @access  Private (Librarian, Admin)
exports.approveRenewal = async (req, res, next) => {
  try {
    const { newDueDate } = req.body;

    const result = await runInTransaction(async (session) => {
      const loan = await Loan.findById(req.params.id).session(session);
      if (!loan) {
        const err = new Error(`Loan not found with id of ${req.params.id}`);
        err.statusCode = 404;
        throw err;
      }

      if (loan.status === 'Returned') {
        const err = new Error('Cannot renew a returned loan');
        err.statusCode = 400;
        throw err;
      }

      if (!loan.renewalRequested) {
        const err = new Error('No renewal request to approve');
        err.statusCode = 400;
        throw err;
      }

      // Check renewal limits
      if (loan.renewalCount >= loan.maxRenewalsAllowed) {
        const err = new Error(`Maximum renewal limit (${loan.maxRenewalsAllowed}) reached for this book`);
        err.statusCode = 400;
        throw err;
      }

      // Check if book has holds/waiting list
      const book = await Book.findById(loan.book).session(session);
      if (!book) {
        const err = new Error('Book not found');
        err.statusCode = 404;
        throw err;
      }
      if (book.holdsCount > 0) {
        const err = new Error('Cannot renew this book because there are other users waiting for it');
        err.statusCode = 400;
        throw err;
      }

      // Set new due date
      const extendedDueDate = newDueDate
        ? new Date(newDueDate)
        : new Date(loan.dueDate.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Update loan
      const previousStatus = loan.status;
      loan.dueDate = extendedDueDate;
      loan.renewalCount += 1;
      loan.renewalRequested = false;
      if (loan.status === 'Overdue') {
        loan.status = 'Borrowed';
        loan.fineAmount = 0;
        loan.fineReason = null;
      }
      await loan.save({ session });
      if (previousStatus !== loan.status) {
        await createLoanStatusHistory(session, {
          loanId: loan._id,
          previousStatus,
          newStatus: loan.status,
          changedBy: req.user._id,
          reason: 'Renewal approved',
          metadata: { source: 'approveRenewal' }
        });
      }

      // Audit log + notify member
      await AuditLog.create(
        {
          actor: req.user._id,
          action: 'RENEWAL_APPROVED',
          resourceType: 'Loan',
          resourceId: loan._id,
          details: { loanId: loan._id }
        },
        { session }
      );

      const memberUser = await User.findOne({ member: loan.member }).session(session);
      let notification = null;
      if (memberUser?._id) {
        notification = await Notification.create(
          {
            user: memberUser._id,
            type: 'RENEWAL_APPROVED',
            title: 'Renewal approved',
            message: `Your loan has been renewed. Due date: ${extendedDueDate.toISOString()}.`,
            relatedLoan: loan._id
          },
          { session }
        );
      }

      return { loanId: loan._id, notification, extendedDueDate };
    });

    const loan = await Loan.findById(result.loanId)
      .populate('book', 'title author isbn')
      .populate('member', 'name email');

    res.status(200).json({
      success: true,
      data: loan,
      message: `Renewal approved. Due date extended to ${result.extendedDueDate.toLocaleDateString('vi-VN')}.`
    });

    const io = req.app.get('io');
    if (io && result?.notification?._id) {
      io.to(`user:${result.notification.user.toString()}`).emit('notification:new', result.notification);
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Reject renewal request (for librarians)
// @route   PUT /api/loans/:id/reject-renewal
// @access  Private (Librarian, Admin)
exports.rejectRenewal = async (req, res, next) => {
  try {
    const { reason } = req.body;

    const result = await runInTransaction(async (session) => {
      const loan = await Loan.findById(req.params.id).session(session);
      if (!loan) {
        const err = new Error(`Loan not found with id of ${req.params.id}`);
        err.statusCode = 404;
        throw err;
      }

      if (!loan.renewalRequested) {
        const err = new Error('No renewal request to reject');
        err.statusCode = 400;
        throw err;
      }

      // Simply mark renewal as not requested (due date remains unchanged)
      loan.renewalRequested = false;
      loan.notes = reason ? `${loan.notes || ''}\nRenewal rejected: ${reason}` : loan.notes;
      await loan.save({ session });

      await AuditLog.create(
        {
          actor: req.user._id,
          action: 'RENEWAL_REJECTED',
          resourceType: 'Loan',
          resourceId: loan._id,
          details: { loanId: loan._id }
        },
        { session }
      );

      const memberUser = await User.findOne({ member: loan.member }).session(session);
      let notification = null;
      if (memberUser?._id) {
        notification = await Notification.create(
          {
            user: memberUser._id,
            type: 'RENEWAL_REJECTED',
            title: 'Renewal rejected',
            message: reason ? `Your renewal was rejected: ${reason}` : 'Your renewal was rejected.',
            relatedLoan: loan._id
          },
          { session }
        );
      }

      return { loanId: loan._id, notification };
    });

    const loan = await Loan.findById(result.loanId)
      .populate('book', 'title author isbn')
      .populate('member', 'name email');

    res.status(200).json({
      success: true,
      data: loan,
      message: 'Renewal request rejected'
    });

    const io = req.app.get('io');
    if (io && result?.notification?._id) {
      io.to(`user:${result.notification.user.toString()}`).emit('notification:new', result.notification);
    }
  } catch (error) {
    next(error);
  }
};
