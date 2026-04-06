const Fine = require('../../schemas/fine/Fine');
const Loan = require('../../schemas/loan/Loan');
const Member = require('../../schemas/member/Member');
const User = require('../../schemas/user/User');
const Notification = require('../../schemas/notification/Notification');
const AuditLog = require('../../schemas/audit/AuditLog');
const { runInTransaction } = require('../../utils/transaction');

exports.getAllFines = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = {};

    if (req.user?.role === 'Reader') {
      query.member = req.user.member;
    }

    if (status) query.status = status;

    // Sync missing fine records from overdue loans so fines page always reflects overdue data.
    const overdueQuery = { status: 'Overdue', fineAmount: { $gt: 0 } };
    if (req.user?.role === 'Reader') {
      overdueQuery.member = req.user.member;
    }

    const overdueLoans = await Loan.find(overdueQuery).select('_id member fineAmount fineReason');
    for (const loan of overdueLoans) {
      const existingFine = await Fine.findOne({ loan: loan._id });
      if (!existingFine) {
        await Fine.create({
          loan: loan._id,
          member: loan.member,
          amount: loan.fineAmount,
          reason: loan.fineReason || 'Late Return',
          status: 'Unpaid'
        });
      } else if (existingFine.status === 'Unpaid' && existingFine.amount !== loan.fineAmount) {
        existingFine.amount = loan.fineAmount;
        existingFine.reason = loan.fineReason || existingFine.reason || 'Late Return';
        await existingFine.save();
      }
    }

    const fines = await Fine.find(query)
      .populate('loan', 'dueDate status')
      .populate('member', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Fine.countDocuments(query);
    res.status(200).json({
      success: true,
      count: fines.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: fines
    });
  } catch (error) {
    next(error);
  }
};

exports.getFine = async (req, res, next) => {
  try {
    const fine = await Fine.findById(req.params.id).populate('loan', 'status dueDate').populate('member', 'name email');
    if (!fine) return res.status(404).json({ success: false, message: 'Fine not found' });

    if (req.user?.role === 'Reader' && fine.member.toString() !== req.user.member?.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    res.status(200).json({ success: true, data: fine });
  } catch (error) {
    next(error);
  }
};

exports.createFine = async (req, res, next) => {
  try {
    const payload = { ...req.body };
    const result = await runInTransaction(async (session) => {
      const fine = await Fine.create(payload, { session });

      await AuditLog.create(
        {
          actor: req.user._id,
          action: 'FINE_CREATED',
          resourceType: 'Fine',
          resourceId: fine._id,
          details: { fineId: fine._id }
        },
        { session }
      );

      const memberUser = await User.findOne({ member: fine.member }).session(session);
      let notification = null;
      if (memberUser?._id) {
        notification = await Notification.create(
          {
            user: memberUser._id,
            type: 'FINE_CREATED',
            title: 'New fine created',
            message: `A fine was created for your overdue loan. Amount: ${fine.amount}`,
            relatedLoan: fine.loan,
            relatedFine: fine._id
          },
          { session }
        );
      }

      return { fineId: fine._id, notification };
    });

    const fine = await Fine.findById(result.fineId)
      .populate('loan', 'status dueDate')
      .populate('member', 'name email');

    res.status(201).json({ success: true, data: fine });

    const io = req.app.get('io');
    if (io && result?.notification?._id) {
      io.to(`user:${result.notification.user.toString()}`).emit('notification:new', result.notification);
    }
  } catch (error) {
    next(error);
  }
};

exports.updateFine = async (req, res, next) => {
  try {
    const fine = await Fine.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!fine) return res.status(404).json({ success: false, message: 'Fine not found' });
    res.status(200).json({ success: true, data: fine });
  } catch (error) {
    next(error);
  }
};

exports.deleteFine = async (req, res, next) => {
  try {
    const fine = await Fine.findByIdAndDelete(req.params.id);
    if (!fine) return res.status(404).json({ success: false, message: 'Fine not found' });
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

