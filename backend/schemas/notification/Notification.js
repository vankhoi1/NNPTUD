const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      required: true,
      enum: [
        'LOAN_APPROVED',
        'LOAN_RETURNED',
        'LOAN_REJECTED',
        'BORROW_REQUEST_CREATED',
        'RESERVATION_APPROVED',
        'RENEWAL_REQUESTED',
        'RENEWAL_CANCELLED',
        'RENEWAL_APPROVED',
        'RENEWAL_REJECTED',
        'FINE_CREATED',
        'FINE_PAID',
        'CHAT_MESSAGE'
      ]
    },
    title: { type: String, trim: true, default: '' },
    message: { type: String, trim: true, default: '' },
    isRead: { type: Boolean, default: false },

    relatedLoan: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan' },
    relatedFine: { type: mongoose.Schema.Types.ObjectId, ref: 'Fine' },
    relatedReservation: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation' },
    payload: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);

