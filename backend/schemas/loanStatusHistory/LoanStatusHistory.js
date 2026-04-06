// LoanStatusHistory schema - works with both MongoDB and Mock DB
const { useMock, mockDb } = require('../../config/database');

let LoanStatusHistory;

if (!useMock) {
  const mongoose = require('mongoose');

  const loanStatusHistorySchema = new mongoose.Schema(
    {
      loan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Loan',
        required: true
      },
      previousStatus: {
        type: String,
        required: true,
        enum: ['Pending', 'Borrowed', 'Returned', 'Overdue', 'Cancelled', 'Rejected']
      },
      newStatus: {
        type: String,
        required: true,
        enum: ['Pending', 'Borrowed', 'Returned', 'Overdue', 'Cancelled', 'Rejected']
      },
      changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      changeReason: {
        type: String,
        trim: true,
        maxlength: [500, 'Change reason cannot exceed 500 characters'],
        default: ''
      },
      metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      }
    },
    { timestamps: true }
  );

  // Index for faster queries
  loanStatusHistorySchema.index({ loan: 1, createdAt: -1 });

  LoanStatusHistory = mongoose.model('LoanStatusHistory', loanStatusHistorySchema);
} else {
  // Mock implementation
  LoanStatusHistory = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    create: () => Promise.resolve({}),
    findOneAndUpdate: () => Promise.resolve({}),
    countDocuments: () => Promise.resolve(0)
  };
}

module.exports = LoanStatusHistory;