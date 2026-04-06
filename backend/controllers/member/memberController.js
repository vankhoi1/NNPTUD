const Member = require('../../schemas/member/Member');
const Loan = require('../../schemas/loan/Loan');

// @desc    Get all members with optional filtering
// @route   GET /api/members
// @access  Public
exports.getAllMembers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      name,
      email,
      memberType,
      membershipStatus
    } = req.query;

    const query = {};

    if (name) query.name = { $regex: name, $options: 'i' };
    if (email) query.email = { $regex: email, $options: 'i' };
    if (memberType) query.memberType = memberType;
    if (membershipStatus) query.membershipStatus = membershipStatus;

    const members = await Member.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Member.countDocuments(query);

    res.status(200).json({
      success: true,
      count: members.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: members
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single member by ID
// @route   GET /api/members/:id
// @access  Public
exports.getMember = async (req, res, next) => {
  try {
    const member = await Member.findById(req.params.id);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: `Member not found with id of ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: member
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new member
// @route   POST /api/members
// @access  Private/Admin
exports.createMember = async (req, res, next) => {
  try {
    const member = await Member.create(req.body);

    res.status(201).json({
      success: true,
      data: member
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a member
// @route   PUT /api/members/:id
// @access  Private/Admin
exports.updateMember = async (req, res, next) => {
  try {
    const member = await Member.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: `Member not found with id of ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: member
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a member
// @route   DELETE /api/members/:id
// @access  Private/Admin
exports.deleteMember = async (req, res, next) => {
  try {
    const member = await Member.findByIdAndDelete(req.params.id);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: `Member not found with id of ${req.params.id}`
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

// @desc    Get member's borrowing history
// @route   GET /api/members/:id/loans
// @access  Public
exports.getMemberLoans = async (req, res, next) => {
  try {
    const member = await Member.findById(req.params.id);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: `Member not found with id of ${req.params.id}`
      });
    }

    const loans = await Loan.find({ member: member._id })
      .populate('book', 'title author')
      .sort({ loanDate: -1 });

    res.status(200).json({
      success: true,
      count: loans.length,
      data: loans
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update member's membership status
// @route   PATCH /api/members/:id/status
// @access  Private/Admin
exports.updateMemberStatus = async (req, res, next) => {
  try {
    const { membershipStatus } = req.body;

    if (!membershipStatus) {
      return res.status(400).json({
        success: false,
        message: 'Please provide membership status'
      });
    }

    const member = await Member.findByIdAndUpdate(
      req.params.id,
      { membershipStatus },
      { new: true, runValidators: true }
    );

    if (!member) {
      return res.status(404).json({
        success: false,
        message: `Member not found with id of ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: member
    });
  } catch (error) {
    next(error);
  }
};
