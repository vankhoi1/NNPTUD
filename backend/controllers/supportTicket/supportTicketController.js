const SupportTicket = require('../../schemas/support/SupportTicket');

// @desc    Get all support tickets with optional filtering
// @route   GET /api/support-tickets
// @access  Private (Admin/Librarian) or User (own tickets)
exports.getAllSupportTickets = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      category,
      userId
    } = req.query;

    const query = {};

    // Filter by status
    if (status) query.status = status;
    
    // Filter by priority
    if (priority) query.priority = priority;
    
    // Filter by category
    if (category) query.category = category;
    
    // Filter by user ID
    if (userId) query.user = userId;

    // If user is not admin/librarian, only show their own tickets
    if (req.user && req.user.role === 'Reader') {
      query.user = req.user._id;
    }

    const tickets = await SupportTicket.find(query)
      .populate('user', 'username email firstName lastName')
      .populate('assignedTo', 'username email firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await SupportTicket.countDocuments(query);

    res.status(200).json({
      success: true,
      count: tickets.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: tickets
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single support ticket by ID
// @route   GET /api/support-tickets/:id
// @access  Private (Admin/Librarian) or User (own ticket)
exports.getSupportTicket = async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('user', 'username email firstName lastName')
      .populate('assignedTo', 'username email firstName lastName');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found'
      });
    }

    // Check if user has permission to view this ticket
    if (req.user.role === 'Reader' && ticket.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this ticket'
      });
    }

    res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new support ticket
// @route   POST /api/support-tickets
// @access  Private (All authenticated users)
exports.createSupportTicket = async (req, res, next) => {
  try {
    // Set the user to the currently authenticated user
    const ticketData = {
      ...req.body,
      user: req.user._id
    };

    const ticket = await SupportTicket.create(ticketData);

    // Populate user details
    const populatedTicket = await SupportTicket.findById(ticket._id)
      .populate('user', 'username email firstName lastName');

    res.status(201).json({
      success: true,
      data: populatedTicket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a support ticket
// @route   PUT /api/support-tickets/:id
// @access  Private (Admin/Librarian) or User (own ticket with limited fields)
exports.updateSupportTicket = async (req, res, next) => {
  try {
    let ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found'
      });
    }

    // Check permissions
    if (req.user.role === 'Reader') {
      // Users can only update their own tickets
      if (ticket.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this ticket'
        });
      }
      
      // Users can only update certain fields (description, title for updates)
      const allowedFields = ['description', 'title'];
      const updateData = {};
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }
      
      // Users cannot change status, priority, category, or assignedTo
      ticket = await SupportTicket.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );
    } else {
      // Admin/Librarian can update all fields
      ticket = await SupportTicket.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
    }

    const populatedTicket = await SupportTicket.findById(ticket._id)
      .populate('user', 'username email firstName lastName')
      .populate('assignedTo', 'username email firstName lastName');

    res.status(200).json({
      success: true,
      data: populatedTicket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a support ticket
// @route   DELETE /api/support-tickets/:id
// @access  Private (Admin/Librarian only)
exports.deleteSupportTicket = async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found'
      });
    }

    // Only admin/librarian can delete tickets
    if (req.user.role === 'Reader') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete support tickets'
      });
    }

    await SupportTicket.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get support tickets statistics
// @route   GET /api/support-tickets/stats/overview
// @access  Private (Admin/Librarian)
exports.getSupportTicketStats = async (req, res, next) => {
  try {
    // Only admin/librarian can view stats
    if (req.user.role === 'Reader') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view support ticket statistics'
      });
    }

    const stats = await SupportTicket.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const priorityStats = await SupportTicket.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    const categoryStats = await SupportTicket.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalTickets = await SupportTicket.countDocuments();
    const openTickets = await SupportTicket.countDocuments({ status: 'Open' });
    const inProgressTickets = await SupportTicket.countDocuments({ status: 'In Progress' });
    const resolvedTickets = await SupportTicket.countDocuments({ status: 'Resolved' });

    res.status(200).json({
      success: true,
      data: {
        totalTickets,
        openTickets,
        inProgressTickets,
        resolvedTickets,
        statusDistribution: stats,
        priorityDistribution: priorityStats,
        categoryDistribution: categoryStats
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update support ticket status
// @route   PATCH /api/support-tickets/:id/status
// @access  Private (Admin/Librarian) or User (own ticket to close)
exports.updateSupportTicketStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found'
      });
    }

    // Check permissions
    if (req.user.role === 'Reader') {
      // Users can only close their own tickets
      if (ticket.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this ticket status'
        });
      }
      
      // Users can only change status to 'Closed'
      if (status !== 'Closed') {
        return res.status(403).json({
          success: false,
          message: 'Users can only close tickets, not change to other statuses'
        });
      }
    }

    ticket.status = status;
    await ticket.save();

    const populatedTicket = await SupportTicket.findById(ticket._id)
      .populate('user', 'username email firstName lastName')
      .populate('assignedTo', 'username email firstName lastName');

    res.status(200).json({
      success: true,
      data: populatedTicket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign support ticket to staff
// @route   PATCH /api/support-tickets/:id/assign
// @access  Private (Admin/Librarian only)
exports.assignSupportTicket = async (req, res, next) => {
  try {
    const { assignedTo } = req.body;
    
    if (!assignedTo) {
      return res.status(400).json({
        success: false,
        message: 'assignedTo is required'
      });
    }

    // Only admin/librarian can assign tickets
    if (req.user.role === 'Reader') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to assign support tickets'
      });
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { assignedTo, status: 'In Progress' },
      { new: true, runValidators: true }
    ).populate('user', 'username email firstName lastName')
     .populate('assignedTo', 'username email firstName lastName');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found'
      });
    }

    res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    next(error);
  }
};