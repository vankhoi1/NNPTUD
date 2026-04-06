const Book = require('../../schemas/book/Book');
const Member = require('../../schemas/member/Member');
const Loan = require('../../schemas/loan/Loan');
const User = require('../../schemas/user/User');

// @desc    Get librarian dashboard (statistics for librarian)
// @route   GET /api/librarian/dashboard
// @access  Private (Librarian, Admin)
exports.getDashboard = async (req, res, next) => {
  try {
    // Total books
    const totalBooks = await Book.countDocuments();
    
    // Overdue loans
    const overdueLoan = await Loan.countDocuments({
      status: 'Active',
      dueDate: { $lt: new Date() }
    });
    
    // Active loans
    const activeLoans = await Loan.countDocuments({ status: 'Active' });
    
    // Total members
    const totalMembers = await Member.countDocuments();
    
    // Active members
    const activeMembers = await Member.countDocuments({ membershipStatus: 'Active' });

    // Books borrowed today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const borrowedToday = await Loan.countDocuments({
      loanDate: { $gte: today },
      status: 'Active'
    });

    // Books returned today
    const returnedToday = await Loan.countDocuments({
      returnDate: { $gte: today },
      status: 'Returned'
    });

    res.status(200).json({
      success: true,
      data: {
        totalBooks,
        activeLoans,
        overdueLoan,
        totalMembers,
        activeMembers,
        borrowedToday,
        returnedToday
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get monthly statistics for librarian
// @route   GET /api/librarian/statistics/monthly
// @access  Private (Librarian, Admin)
exports.getMonthlyStatistics = async (req, res, next) => {
  try {
    const { year, month } = req.query;
    
    const currentDate = new Date();
    const targetYear = parseInt(year) || currentDate.getFullYear();
    const targetMonth = parseInt(month) || currentDate.getMonth() + 1;
    
    // Create date range for the month
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);
    
    // Books borrowed this month
    const borrowedThisMonth = await Loan.countDocuments({
      loanDate: { $gte: startDate, $lte: endDate }
    });
    
    // Books returned this month
    const returnedThisMonth = await Loan.countDocuments({
      returnDate: { $gte: startDate, $lte: endDate }
    });
    
    // New members this month
    const newMembers = await Member.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    // Overdue loans this month
    const overdueThisMonth = await Loan.countDocuments({
      status: 'Active',
      dueDate: { $gte: startDate, $lte: endDate, $lt: new Date() }
    });

    // Top 5 borrowed books
    const topBooks = await Loan.aggregate([
      {
        $match: {
          loanDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$book',
          borrowCount: { $sum: 1 }
        }
      },
      {
        $sort: { borrowCount: -1 }
      },
      {
        $limit: 5
      },
      {
        $lookup: {
          from: 'books',
          localField: '_id',
          foreignField: '_id',
          as: 'bookInfo'
        }
      },
      {
        $unwind: '$bookInfo'
      },
      {
        $project: {
          _id: 0,
          bookId: '$_id',
          title: '$bookInfo.title',
          author: '$bookInfo.author',
          borrowCount: 1
        }
      }
    ]);

    // Top 5 active members
    const activeMembers = await Loan.aggregate([
      {
        $match: {
          loanDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$member',
          loanCount: { $sum: 1 }
        }
      },
      {
        $sort: { loanCount: -1 }
      },
      {
        $limit: 5
      },
      {
        $lookup: {
          from: 'members',
          localField: '_id',
          foreignField: '_id',
          as: 'memberInfo'
        }
      },
      {
        $unwind: '$memberInfo'
      },
      {
        $project: {
          _id: 0,
          memberId: '$_id',
          name: '$memberInfo.name',
          email: '$memberInfo.email',
          loanCount: 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        month: targetMonth,
        year: targetYear,
        borrowedThisMonth,
        returnedThisMonth,
        newMembers,
        overdueThisMonth,
        topBooks,
        activeMembers
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get overdue loans
// @route   GET /api/librarian/overdue-loans
// @access  Private (Librarian, Admin)
exports.getOverdueLoans = async (req, res, next) => {
  try {
    const overdueLoans = await Loan.find({
      status: 'Active',
      dueDate: { $lt: new Date() }
    })
      .populate('member', 'name email phone')
      .populate('book', 'title author isbn')
      .sort({ dueDate: 1 });

    res.status(200).json({
      success: true,
      count: overdueLoans.length,
      data: overdueLoans
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Process return book
// @route   POST /api/librarian/return-book/:loanId
// @access  Private (Librarian, Admin)
exports.returnBook = async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.loanId);

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan record not found'
      });
    }

    if (loan.status === 'Returned') {
      return res.status(400).json({
        success: false,
        message: 'This book has already been returned'
      });
    }

    // Update loan status
    loan.status = 'Returned';
    loan.returnDate = new Date();
    await loan.save();

    // Update member's borrowed count
    const member = await Member.findById(loan.member);
    if (member) {
      member.currentBorrowedCount = Math.max(0, member.currentBorrowedCount - 1);
      await member.save();
    }

    res.status(200).json({
      success: true,
      message: 'Book returned successfully',
      data: loan
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Extend loan due date
// @route   PUT /api/librarian/extend-loan/:loanId
// @access  Private (Librarian, Admin)
exports.extendLoan = async (req, res, next) => {
  try {
    const { days = 7 } = req.body;

    const loan = await Loan.findById(req.params.loanId);

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan record not found'
      });
    }

    if (loan.status === 'Returned') {
      return res.status(400).json({
        success: false,
        message: 'Cannot extend a returned book'
      });
    }

    // Extend due date
    const newDueDate = new Date(loan.dueDate);
    newDueDate.setDate(newDueDate.getDate() + days);
    loan.dueDate = newDueDate;
    await loan.save();

    res.status(200).json({
      success: true,
      message: `Loan extended by ${days} days`,
      data: loan
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all members with borrowing status
// @route   GET /api/librarian/members
// @access  Private (Librarian, Admin)
exports.getMembers = async (req, res, next) => {
  try {
    const { status, search, type } = req.query;
    
    let query = {};
    
    if (status) {
      query.membershipStatus = status;
    }
    
    if (type) {
      query.memberType = type;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { memberId: { $regex: search, $options: 'i' } }
      ];
    }

    const members = await Member.find(query).sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: members.length,
      data: members
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update member status (suspend/reactivate)
// @route   PUT /api/librarian/members/:memberId/status
// @access  Private (Librarian, Admin)
exports.updateMemberStatus = async (req, res, next) => {
  try {
    const { status, reason } = req.body;

    if (!['Active', 'Inactive', 'Suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be Active, Inactive, or Suspended'
      });
    }

    const member = await Member.findById(req.params.memberId);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    const previousStatus = member.membershipStatus;
    member.membershipStatus = status;
    if (reason) {
      member.suspensionReason = reason;
    }
    await member.save();

    res.status(200).json({
      success: true,
      message: `Member status updated from ${previousStatus} to ${status}`,
      data: member
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get member borrowing history
// @route   GET /api/librarian/members/:memberId/history
// @access  Private (Librarian, Admin)
exports.getMemberHistory = async (req, res, next) => {
  try {
    const loans = await Loan.find({ member: req.params.memberId })
      .populate('book', 'title author isbn')
      .sort({ loanDate: -1 });

    const member = await Member.findById(req.params.memberId);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    res.status(200).json({
      success: true,
      member: {
        memberId: member._id,
        name: member.name,
        email: member.email,
        memberType: member.memberType
      },
      count: loans.length,
      data: loans
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get books inventory
// @route   GET /api/librarian/books
// @access  Private (Librarian, Admin)
exports.getBooks = async (req, res, next) => {
  try {
    const { search, category, status } = req.query;
    
    let query = {};
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
        { isbn: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) {
      query.category = category;
    }

    const books = await Book.find(query).sort({ title: 1 });

    // Enhance with borrowing info
    const booksWithBorrowInfo = await Promise.all(
      books.map(async (book) => {
        const borrowCount = await Loan.countDocuments({
          book: book._id,
          status: 'Active'
        });
        return {
          ...book.toObject(),
          currentlyBorrowed: borrowCount
        };
      })
    );

    res.status(200).json({
      success: true,
      count: booksWithBorrowInfo.length,
      data: booksWithBorrowInfo
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get book borrowing history
// @route   GET /api/librarian/books/:bookId/history
// @access  Private (Librarian, Admin)
exports.getBookHistory = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.bookId);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    const loans = await Loan.find({ book: req.params.bookId })
      .populate('member', 'name email memberId')
      .sort({ loanDate: -1 });

    res.status(200).json({
      success: true,
      book: {
        bookId: book._id,
        title: book.title,
        author: book.author,
        isbn: book.isbn
      },
      count: loans.length,
      data: loans
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get daily report
// @route   GET /api/librarian/daily-report
// @access  Private (Librarian, Admin)
exports.getDailyReport = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const borrowedToday = await Loan.countDocuments({
      loanDate: { $gte: today, $lt: tomorrow },
      status: 'Active'
    });

    const returnedToday = await Loan.countDocuments({
      returnDate: { $gte: today, $lt: tomorrow },
      status: 'Returned'
    });

    const overdueCount = await Loan.countDocuments({
      status: 'Active',
      dueDate: { $lt: today }
    });

    const totalActiveLoans = await Loan.countDocuments({
      status: 'Active'
    });

    res.status(200).json({
      success: true,
      date: today.toISOString().split('T')[0],
      data: {
        borrowedToday,
        returnedToday,
        overdueCount,
        totalActiveLoans
      }
    });
  } catch (error) {
    next(error);
  }
};

