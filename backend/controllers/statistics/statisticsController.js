const Book = require('../../schemas/book/Book');
const Member = require('../../schemas/member/Member');
const Loan = require('../../schemas/loan/Loan');
const User = require('../../schemas/user/User');

// @desc    Get monthly statistics
// @route   GET /api/statistics/monthly
// @access  Private (Admin only)
exports.getMonthlyStatistics = async (req, res, next) => {
  try {
    const { year, month } = req.query;
    
    const currentDate = new Date();
    const targetYear = parseInt(year) || currentDate.getFullYear();
    const targetMonth = parseInt(month) || currentDate.getMonth() + 1;
    
    // Create date range for the month
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);
    
    // Get total books
    const totalBooks = await Book.countDocuments();
    
    // Get total members
    const totalMembers = await Member.countDocuments();
    
    // Get active members (Active status)
    const activeMembers = await Member.countDocuments({ membershipStatus: 'Active' });
    
    // Get total users
    const totalUsers = await User.countDocuments();
    
    // Get librarians count
    const librarianCount = await User.countDocuments({ role: 'Librarian' });
    
    // Get loans created this month
    const loansThisMonth = await Loan.countDocuments({
      loanDate: { $gte: startDate, $lte: endDate }
    });
    
    // Get returns this month
    const returnsThisMonth = await Loan.countDocuments({
      returnDate: { $gte: startDate, $lte: endDate }
    });
    
    // Get average loans per member
    const avgLoansPerMember = totalMembers > 0 
      ? (await Loan.countDocuments()) / totalMembers 
      : 0;
    
    // Get currently borrowed books (Borrowed or Overdue)
    const borrowedBooks = await Loan.countDocuments({
      status: { $in: ['Borrowed', 'Overdue'] }
    });
    
    // Get available books
    const availableBooks = await Loan.aggregate([
      {
        $match: { status: 'Returned' }
      },
      {
        $group: {
          _id: '$book',
          count: { $sum: 1 }
        }
      },
      {
        $count: 'total'
      }
    ]);
    
    // Get top borrowed books
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
          title: '$bookInfo.title',
          author: '$bookInfo.author',
          borrowCount: 1
        }
      }
    ]);
    
    // Get top members (who borrowed most)
    const topMembers = await Loan.aggregate([
      {
        $match: {
          loanDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$member',
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
          name: '$memberInfo.name',
          email: '$memberInfo.email',
          borrowCount: 1
        }
      }
    ]);
    
    // Get overdue loans (either already marked Overdue or still Borrowed but dueDate passed)
    const now = new Date();
    const overdueLoans = await Loan.countDocuments({
      $or: [
        { status: 'Overdue' },
        { status: 'Borrowed', dueDate: { $lt: now } }
      ]
    });
    
    res.status(200).json({
      success: true,
      data: {
        month: targetMonth,
        year: targetYear,
        overview: {
          totalBooks,
          totalMembers,
          activeMembers,
          totalUsers,
          librarianCount,
          borrowedBooks,
          overdueLoans,
          avgLoansPerMember: parseFloat(avgLoansPerMember.toFixed(2))
        },
        thisMonth: {
          loansCreated: loansThisMonth,
          booksReturned: returnsThisMonth
        },
        topBooks: topBooks.length > 0 ? topBooks : [],
        topMembers: topMembers.length > 0 ? topMembers : []
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard summary
// @route   GET /api/statistics/dashboard
// @access  Private (Admin only)
exports.getDashboardSummary = async (req, res, next) => {
  try {
    const totalBooks = await Book.countDocuments();
    const totalMembers = await Member.countDocuments();
    const totalLoans = await Loan.countDocuments();
    const activeLoans = await Loan.countDocuments({
      status: { $in: ['Borrowed', 'Overdue'] }
    });
    
    const now = new Date();
    const overdueLoans = await Loan.countDocuments({
      $or: [
        { status: 'Overdue' },
        { status: 'Borrowed', dueDate: { $lt: now } }
      ]
    });
    
    res.status(200).json({
      success: true,
      data: {
        totalBooks,
        totalMembers,
        totalLoans,
        activeLoans,
        overdueLoans,
        returnRate: totalLoans > 0 ? ((totalLoans - activeLoans) / totalLoans * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    next(error);
  }
};

