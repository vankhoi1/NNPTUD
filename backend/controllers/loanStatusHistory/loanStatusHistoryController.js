const LoanStatusHistory = require('../../schemas/loanStatusHistory/LoanStatusHistory');
const Loan = require('../../schemas/loan/Loan');
const User = require('../../schemas/user/User');

// @desc    Get all loan status history entries with optional filtering
// @route   GET /api/loan-status-history
// @access  Private (Admin/Librarian) or User (own loan history)
exports.getAllLoanStatusHistory = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      loanId,
      status,
      startDate,
      endDate,
      userId
    } = req.query;

    const query = {};

    // Filter by loan ID
    if (loanId) query.loan = loanId;
    
    // Filter by status
    if (status) query.newStatus = status;
    
    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    // Filter by user ID (through loan)
    if (userId) {
      const user = await User.findById(userId).select('member');
      if (!user?.member) {
        query.loan = { $in: [] };
      } else {
        const userLoans = await Loan.find({ member: user.member }).select('_id');
        const loanIds = userLoans.map(loan => loan._id);
        query.loan = { $in: loanIds };
      }
    }

    // If user is a reader, only show history for their own loans
    if (req.user && req.user.role === 'Reader') {
      const userLoans = await Loan.find({ member: req.user.member }).select('_id');
      const loanIds = userLoans.map(loan => loan._id);
      query.loan = { $in: loanIds };
    }

    const history = await LoanStatusHistory.find(query)
      .populate({
        path: 'loan',
        populate: [
          { path: 'book', select: 'title author isbn' },
          { path: 'member', select: 'name email' }
        ]
      })
      .populate('changedBy', 'username email firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await LoanStatusHistory.countDocuments(query);

    res.status(200).json({
      success: true,
      count: history.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: history
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single loan status history entry by ID
// @route   GET /api/loan-status-history/:id
// @access  Private (Admin/Librarian) or User (own loan history)
exports.getLoanStatusHistory = async (req, res, next) => {
  try {
    const historyEntry = await LoanStatusHistory.findById(req.params.id)
      .populate({
        path: 'loan',
        populate: [
          { path: 'book', select: 'title author isbn' },
          { path: 'member', select: 'name email' }
        ]
      })
      .populate('changedBy', 'username email firstName lastName');

    if (!historyEntry) {
      return res.status(404).json({
        success: false,
        message: 'Loan status history entry not found'
      });
    }

    // Check if user has permission to view this history entry
    if (req.user.role === 'Reader') {
      // Get the loan to check if it belongs to the user
      const loan = await Loan.findById(historyEntry.loan);
      if (!loan || loan.member.toString() !== req.user.member?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this loan status history'
        });
      }
    }

    res.status(200).json({
      success: true,
      data: historyEntry
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new loan status history entry
// @route   POST /api/loan-status-history
// @access  Private (Admin/Librarian only - automatically created when loan status changes)
exports.createLoanStatusHistory = async (req, res, next) => {
  try {
    // Only admin/librarian can manually create history entries
    if (req.user.role === 'Reader') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to create loan status history entries'
      });
    }

    // Set the user who made the change
    const mappedStatus = req.body.newStatus || req.body.status;
    const mappedReason = req.body.changeReason ?? req.body.notes ?? '';
    const historyData = {
      ...req.body,
      newStatus: mappedStatus,
      changeReason: mappedReason,
      changedBy: req.user._id
    };

    const historyEntry = await LoanStatusHistory.create(historyData);

    // Populate related data
    const populatedEntry = await LoanStatusHistory.findById(historyEntry._id)
      .populate({
        path: 'loan',
        populate: [
          { path: 'book', select: 'title author isbn' },
          { path: 'member', select: 'name email' }
        ]
      })
      .populate('changedBy', 'username email firstName lastName');

    res.status(201).json({
      success: true,
      data: populatedEntry
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a loan status history entry
// @route   PUT /api/loan-status-history/:id
// @access  Private (Admin/Librarian only)
exports.updateLoanStatusHistory = async (req, res, next) => {
  try {
    // Only admin/librarian can update history entries
    if (req.user.role === 'Reader') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update loan status history entries'
      });
    }

    const payload = { ...req.body };
    if (payload.status && !payload.newStatus) payload.newStatus = payload.status;
    if (payload.notes && payload.changeReason === undefined) payload.changeReason = payload.notes;

    const historyEntry = await LoanStatusHistory.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    )
      .populate({
        path: 'loan',
        populate: [
          { path: 'book', select: 'title author isbn' },
          { path: 'member', select: 'name email' }
        ]
      })
      .populate('changedBy', 'username email firstName lastName');

    if (!historyEntry) {
      return res.status(404).json({
        success: false,
        message: 'Loan status history entry not found'
      });
    }

    res.status(200).json({
      success: true,
      data: historyEntry
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a loan status history entry
// @route   DELETE /api/loan-status-history/:id
// @access  Private (Admin/Librarian only)
exports.deleteLoanStatusHistory = async (req, res, next) => {
  try {
    // Only admin/librarian can delete history entries
    if (req.user.role === 'Reader') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete loan status history entries'
      });
    }

    const historyEntry = await LoanStatusHistory.findByIdAndDelete(req.params.id);

    if (!historyEntry) {
      return res.status(404).json({
        success: false,
        message: 'Loan status history entry not found'
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

// @desc    Get loan status history for a specific loan
// @route   GET /api/loans/:loanId/status-history
// @access  Private (Admin/Librarian) or User (own loan)
exports.getLoanStatusHistoryByLoan = async (req, res, next) => {
  try {
    const loanId = req.params.loanId;
    
    // Check if loan exists
    const loan = await Loan.findById(loanId);
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    // Check if user has permission to view this loan's history
    if (req.user.role === 'Reader' && loan.member.toString() !== req.user.member?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this loan\'s status history'
      });
    }

    const history = await LoanStatusHistory.find({ loan: loanId })
      .populate('changedBy', 'username email firstName lastName')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get loan status transition statistics
// @route   GET /api/loan-status-history/stats/transitions
// @access  Private (Admin/Librarian only)
exports.getLoanStatusTransitionStats = async (req, res, next) => {
  try {
    // Only admin/librarian can view stats
    if (req.user.role === 'Reader') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view loan status transition statistics'
      });
    }

    const { startDate, endDate } = req.query;
    
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get status transition counts
    const transitionStats = await LoanStatusHistory.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            fromStatus: '$previousStatus',
            toStatus: '$newStatus'
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get most common status changes
    const mostCommonTransitions = transitionStats.slice(0, 10);

    // Get daily status change counts
    const dailyStats = await LoanStatusHistory.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      },
      {
        $limit: 30
      }
    ]);

    // Get user who made most changes
    const topChangers = await LoanStatusHistory.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$changedBy',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          userId: '$_id',
          username: '$user.username',
          email: '$user.email',
          count: 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalTransitions: transitionStats.reduce((sum, stat) => sum + stat.count, 0),
        transitionStats,
        mostCommonTransitions,
        dailyStats,
        topChangers
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create loan status history entry when loan status changes (helper function)
// @route   INTERNAL USE ONLY
// @access  Private
exports.createStatusChangeHistory = async (loanId, previousStatus, newStatus, changedBy, notes = '') => {
  try {
    const historyEntry = await LoanStatusHistory.create({
      loan: loanId,
      previousStatus,
      newStatus,
      changedBy,
      changeReason: notes,
      metadata: {}
    });

    return historyEntry;
  } catch (error) {
    console.error('Error creating loan status history:', error);
    return null;
  }
};