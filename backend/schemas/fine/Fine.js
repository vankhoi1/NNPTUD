// Fine schema - works with both MongoDB and Mock DB
const { useMock, mockDb } = require('../../config/database');

let Fine;

if (!useMock) {
  const mongoose = require('mongoose');

  const fineSchema = new mongoose.Schema(
    {
      loan: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', required: true },
      member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
      amount: { type: Number, required: true, min: 0 },
      reason: {
        type: String,
        required: true,
        enum: ['Late Return', 'Damaged', 'Lost']
      },
      status: {
        type: String,
        required: true,
        enum: ['Unpaid', 'Paid'],
        default: 'Unpaid'
      }
    },
    { timestamps: true }
  );

  Fine = mongoose.model('Fine', fineSchema);
} else {
  // Mock implementation
  Fine = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    create: () => Promise.resolve({}),
    findOneAndUpdate: () => Promise.resolve({}),
    countDocuments: () => Promise.resolve(0)
  };
}

module.exports = Fine;

