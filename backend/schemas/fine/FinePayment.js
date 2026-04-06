// FinePayment schema - works with both MongoDB and Mock DB
const { useMock, mockDb } = require('../../config/database');

let FinePayment;

if (!useMock) {
  const mongoose = require('mongoose');

  const finePaymentSchema = new mongoose.Schema(
    {
      fine: { type: mongoose.Schema.Types.ObjectId, ref: 'Fine', required: true },
      paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      amount: { type: Number, required: true, min: 0 },
      method: {
        type: String,
        default: 'Cash',
        enum: ['Cash', 'Transfer', 'Card', 'Other']
      },
      note: { type: String, trim: true, maxlength: 500 }
    },
    { timestamps: true }
  );

  FinePayment = mongoose.model('FinePayment', finePaymentSchema);
} else {
  // Mock implementation
  FinePayment = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    create: () => Promise.resolve({}),
    findOneAndUpdate: () => Promise.resolve({}),
    countDocuments: () => Promise.resolve(0)
  };
}

module.exports = FinePayment;

