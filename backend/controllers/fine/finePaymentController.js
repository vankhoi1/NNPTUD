const FinePayment = require('../../schemas/fine/FinePayment');
const Fine = require('../../schemas/fine/Fine');
const User = require('../../schemas/user/User');
const Notification = require('../../schemas/notification/Notification');
const AuditLog = require('../../schemas/audit/AuditLog');
const { runInTransaction } = require('../../utils/transaction');

exports.getAllFinePayments = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const query = {};

    if (req.user?.role === 'Reader') {
      query.paidBy = req.user._id;
    }

    const payments = await FinePayment.find(query)
      .populate('fine', 'amount status')
      .populate('paidBy', 'username email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await FinePayment.countDocuments(query);
    res.status(200).json({
      success: true,
      count: payments.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: payments
    });
  } catch (error) {
    next(error);
  }
};

exports.getFinePayment = async (req, res, next) => {
  try {
    const payment = await FinePayment.findById(req.params.id)
      .populate('fine', 'amount status')
      .populate('paidBy', 'username email');
    if (!payment) return res.status(404).json({ success: false, message: 'FinePayment not found' });

    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
};

exports.createFinePayment = async (req, res, next) => {
  try {
    const actor = req.user._id;
    const { fineId, amount, method, note } = req.body;

    const result = await runInTransaction(async (session) => {
      const fine = await Fine.findById(fineId).session(session);
      if (!fine) throw new Error('Fine not found');
      if (fine.status !== 'Unpaid') throw new Error('Fine is already paid');

      const payment = await FinePayment.create(
        [
          {
            fine: fine._id,
            paidBy: actor,
            amount,
            method: method || 'Cash',
            note: note || ''
          }
        ],
        { session }
      );

      const paymentDoc = Array.isArray(payment) ? payment[0] : payment;

      fine.status = 'Paid';
      await fine.save({ session });

      const memberUser = await User.findOne({ member: fine.member }).session(session);
      let notification = null;
      if (memberUser?._id) {
        notification = await Notification.create(
          [
            {
              user: memberUser._id,
              type: 'FINE_PAID',
              title: 'Fine paid',
              message: `Your fine (amount: ${fine.amount}) has been paid.`,
              relatedFine: fine._id
            }
          ],
          { session }
        );
        notification = Array.isArray(notification) ? notification[0] : notification;
      }

      await AuditLog.create(
        [
          {
            actor,
            action: 'CREATE_FINE_PAYMENT',
            resourceType: 'FinePayment',
            resourceId: paymentDoc._id,
            details: { fineId: fine._id }
          }
        ],
        { session }
      );

      return { payment: paymentDoc, notification };
    });

    res.status(201).json({ success: true, data: result.payment, message: 'Fine payment recorded' });

    const io = req.app.get('io');
    if (io && result?.notification?.user) {
      io.to(`user:${result.notification.user.toString()}`).emit('notification:new', result.notification);
    }
  } catch (error) {
    next(error);
  }
};

exports.updateFinePayment = async (req, res, next) => {
  try {
    const payment = await FinePayment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!payment) return res.status(404).json({ success: false, message: 'FinePayment not found' });
    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
};

exports.deleteFinePayment = async (req, res, next) => {
  try {
    const payment = await FinePayment.findByIdAndDelete(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'FinePayment not found' });
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

