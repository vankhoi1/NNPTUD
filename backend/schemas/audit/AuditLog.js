const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    action: {
      type: String,
      required: true,
      enum: [
        'CREATE_BOOK',
        'UPDATE_BOOK',
        'DELETE_BOOK',
        'BORROW_REQUEST',
        'BORROW_REQUEST_CREATED',
        'LOAN_APPROVED',
        'LOAN_REJECTED',
        'LOAN_RETURNED',
        'RESERVATION_APPROVED',
        'RESERVATION_REJECTED',
        'FINE_CREATED',
        'CREATE_FINE_PAYMENT',
        'RENEWAL_REQUESTED',
        'RENEWAL_CANCELLED',
        'RENEWAL_APPROVED',
        'RENEWAL_REJECTED',
        'CREATE_CHAT_MESSAGE',
        'CREATE_REVIEW'
      ]
    },
    resourceType: { type: String, required: true, trim: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId },
    details: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);

