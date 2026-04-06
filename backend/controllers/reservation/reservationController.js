const Reservation = require('../../schemas/reservation/Reservation');
const Book = require('../../schemas/book/Book');
const Member = require('../../schemas/member/Member');
const Loan = require('../../schemas/loan/Loan');
const User = require('../../schemas/user/User');
const Notification = require('../../schemas/notification/Notification');
const AuditLog = require('../../schemas/audit/AuditLog');
const { runInTransaction, BusinessError } = require('../../utils/transaction');

function defaultDueDate() {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
}

exports.getAllReservations = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, bookId } = req.query;
    const query = {};
    if (req.user?.role === 'Reader') query.member = req.user.member;
    if (status) query.status = status;
    if (bookId) query.book = bookId;

    const reservations = await Reservation.find(query)
      .populate('book', 'title author isbn')
      .populate('member', 'name email membershipStatus')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Reservation.countDocuments(query);

    res.status(200).json({
      success: true,
      count: reservations.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: reservations
    });
  } catch (error) {
    next(error);
  }
};

exports.getReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('book', 'title author isbn')
      .populate('member', 'name email membershipStatus');

    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Reservation not found' });
    }

    if (req.user?.role === 'Reader' && reservation.member?._id?.toString() !== req.user.member?.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    res.status(200).json({ success: true, data: reservation });
  } catch (error) {
    next(error);
  }
};

exports.createReservation = async (req, res, next) => {
  try {
    const { bookId, notes } = req.body;
    const memberId = req.user.member;

    if (!memberId) {
      return res.status(400).json({ success: false, message: 'No member linked to your account' });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    // Reservation is only allowed when all copies are unavailable.
    if (book.availableCopies > 0) {
      return res.status(400).json({
        success: false,
        message: `Book is still available (${book.availableCopies} copies left). Reservation is only allowed when out of stock.`
      });
    }

    const member = await Member.findById(memberId);
    if (!member || member.membershipStatus !== 'Active') {
      return res.status(400).json({ success: false, message: 'Member is not active' });
    }

    const existing = await Reservation.findOne({
      book: bookId,
      member: memberId,
      status: { $in: ['Pending'] }
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'You already have a pending reservation for this book' });
    }

    const reservation = await Reservation.create({
      book: bookId,
      member: memberId,
      requestedBy: req.user._id,
      notes: notes || '',
      status: 'Pending'
    });

    await AuditLog.create({
      actor: req.user._id,
      action: 'BORROW_REQUEST',
      resourceType: 'Reservation',
      resourceId: reservation._id,
      details: { bookId }
    });

    res.status(201).json({ success: true, data: reservation });
  } catch (error) {
    next(error);
  }
};

exports.approveReservation = async (req, res, next) => {
  try {
    const reservationId = req.params.id;
    const actor = req.user._id;

    const result = await runInTransaction(async (session) => {
      const reservation = await Reservation.findById(reservationId).session(session);
      if (!reservation) throw new BusinessError('Reservation not found', 404);
      if (reservation.status !== 'Pending') throw new BusinessError(`Cannot approve reservation in status: ${reservation.status}`, 400);

      const book = await Book.findById(reservation.book).session(session);
      if (!book) throw new BusinessError('Book not found', 404);

      const member = await Member.findById(reservation.member).session(session);
      if (!member) throw new BusinessError('Member not found', 404);
      if (member.membershipStatus !== 'Active') {
        throw new BusinessError('Member account is not active', 400);
      }
      if (member.currentBorrowedCount >= member.maxBooksAllowed) {
        throw new BusinessError(`Member has reached borrow limit (${member.currentBorrowedCount}/${member.maxBooksAllowed})`, 400);
      }

      const loan = new Loan({
        book: reservation.book,
        member: reservation.member,
        dueDate: reservation.dueDate || defaultDueDate(),
        loanDate: new Date(),
        status: 'Borrowed'
      });
      await loan.save({ session });

      // Decrease availableCopies only if > 0 (reservation was made when out of stock,
      // librarian approves when a copy becomes physically available)
      if (book.availableCopies > 0) {
        book.availableCopies -= 1;
      }
      if (book.holdsCount > 0) book.holdsCount -= 1;
      await book.save({ session });

      member.currentBorrowedCount += 1;
      await member.save({ session });

      reservation.status = 'Approved';
      reservation.decisionAt = new Date();
      await reservation.save({ session });

      const memberUser = await User.findOne({ member: reservation.member }).session(session);
      let notifDoc = null;
      if (memberUser?._id) {
        const notification = await Notification.create(
          [
            {
              user: memberUser._id,
              type: 'RESERVATION_APPROVED',
              title: 'Reservation approved',
              message: `Your reservation for "${book.title}" has been approved.`,
              relatedLoan: loan._id,
              relatedReservation: reservation._id
            }
          ],
          { session }
        );
        notifDoc = Array.isArray(notification) ? notification[0] : null;
      }

      await AuditLog.create(
        [
          {
            actor,
            action: 'RESERVATION_APPROVED',
            resourceType: 'Reservation',
            resourceId: reservation._id,
            details: { reservationId: reservation._id, loanId: loan._id }
          }
        ],
        { session }
      );

      return { reservationId: reservation._id, loanId: loan._id, notification: notifDoc };
    });

    res.status(200).json({ success: true, data: result, message: 'Reservation approved successfully' });

    const io = req.app.get('io');
    if (io && result?.notification?.user) {
      io.to(`user:${result.notification.user.toString()}`).emit('notification:new', result.notification);
    }
  } catch (error) {
    next(error);
  }
};

exports.rejectReservation = async (req, res, next) => {
  try {
    const reservationId = req.params.id;
    const { reason } = req.body;
    const actor = req.user._id;

    await runInTransaction(async (session) => {
      const reservation = await Reservation.findById(reservationId).session(session);
      if (!reservation) throw new Error('Reservation not found');
      if (reservation.status !== 'Pending') throw new Error(`Cannot reject reservation in status: ${reservation.status}`);

      reservation.status = 'Rejected';
      reservation.decisionAt = new Date();
      reservation.notes = reason ? `Rejected: ${reason}` : reservation.notes;
      await reservation.save({ session });

      await AuditLog.create(
        [
          {
            actor,
            action: 'RESERVATION_REJECTED',
            resourceType: 'Reservation',
            resourceId: reservation._id,
            details: { status: 'Rejected', reason: reason || '' }
          }
        ],
        { session }
      );
    });

    res.status(200).json({ success: true, message: 'Reservation rejected successfully', data: {} });
  } catch (error) {
    next(error);
  }
};

exports.cancelReservation = async (req, res, next) => {
  try {
    const reservationId = req.params.id;
    const actorMemberId = req.user.member;
    const result = await runInTransaction(async (session) => {
      const reservation = await Reservation.findById(reservationId).session(session);
      if (!reservation) {
        const err = new Error('Reservation not found');
        err.statusCode = 404;
        throw err;
      }
      if (reservation.member.toString() !== actorMemberId?.toString()) {
        const err = new Error('Forbidden');
        err.statusCode = 403;
        throw err;
      }
      if (reservation.status !== 'Pending') {
        const err = new Error(`Cannot cancel reservation in status: ${reservation.status}`);
        err.statusCode = 400;
        throw err;
      }

      reservation.status = 'Cancelled';
      reservation.decisionAt = new Date();
      await reservation.save({ session });

      await AuditLog.create(
        {
          actor: req.user._id,
          action: 'BORROW_REQUEST',
          resourceType: 'Reservation',
          resourceId: reservation._id,
          details: { status: 'Cancelled' }
        },
        { session }
      );

      return { reservationId: reservation._id };
    });

    const reservation = await Reservation.findById(result.reservationId)
      .populate('book', 'title author isbn')
      .populate('member', 'name email membershipStatus');

    res.status(200).json({ success: true, message: 'Reservation cancelled', data: reservation });
  } catch (error) {
    next(error);
  }
};

