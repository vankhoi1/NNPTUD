// Loan schema - works with both MongoDB and Mock DB
const { useMock, mockDb } = require('../../config/database');

let Loan;

if (!useMock) {
  const mongoose = require('mongoose');

  const loanSchema = new mongoose.Schema({
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: [true, 'Book is required']
    },
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: [true, 'Member is required']
    },
    loanDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required']
    },
    returnDate: {
      type: Date
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ['Pending', 'Borrowed', 'Returned', 'Overdue', 'Rejected'],
        message: 'Please select a valid loan status'
      },
      default: 'Borrowed'
    },
    fineAmount: {
      type: Number,
      default: 0,
      min: [0, 'Fine amount cannot be negative']
    },
    fineReason: {
      type: String,
      enum: ['Late Return', 'Damaged', 'Lost'],
      trim: true
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    renewalCount: {
      type: Number,
      required: true,
      min: [0, 'Renewal count cannot be negative'],
      default: 0
    },
    maxRenewalsAllowed: {
      type: Number,
      required: true,
      min: [0, 'Max renewals allowed cannot be negative'],
      default: 2
    },
    renewalRequested: {
      type: Boolean,
      default: false
    }
  }, {
    timestamps: true
  });

  loanSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
  });

  loanSchema.methods.isOverdue = function() {
    if (this.status === 'Returned') return false;
    const today = new Date();
    return this.dueDate && today > this.dueDate;
  };

  loanSchema.methods.calculateFine = function() {
    if (this.status === 'Returned' || !this.isOverdue()) {
      return 0;
    }
    const finePerDay = 0.50;
    const diffTime = new Date() - this.dueDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays * finePerDay : 0;
  };

  loanSchema.methods.updateStatus = function() {
    if (this.status === 'Returned') return;
    if (this.isOverdue()) {
      this.status = 'Overdue';
      this.fineAmount = this.calculateFine();
    }
    return this.status;
  };

  Loan = mongoose.model('Loan', loanSchema);
} else {
  class Loan {
    constructor(data) {
      this._id = `loan_${mockDb.counters.loans++}`;
      this.book = data.book;
      this.member = data.member;
      this.loanDate = data.loanDate || new Date();
      this.dueDate = data.dueDate;
      this.returnDate = data.returnDate || null;
      this.status = data.status || 'Borrowed';
      this.fineAmount = data.fineAmount || 0;
      this.fineReason = data.fineReason || null;
      this.notes = data.notes || '';
      this.renewalCount = data.renewalCount || 0;
      this.maxRenewalsAllowed = data.maxRenewalsAllowed || 2;
      this.renewalRequested = data.renewalRequested || false;
      this.createdAt = new Date();
      this.updatedAt = new Date();
    }

    save() {
      mockDb.loans.push(this);
      return Promise.resolve(this);
    }

    static find(query = {}) {
      return Promise.resolve(mockDb.getLoans(query));
    }

    static findById(id) {
      return Promise.resolve(mockDb.getLoanById(id));
    }

    static findOneAndUpdate(filter, update) {
      const loan = mockDb.getLoanById(filter._id || filter.id);
      if (!loan) return Promise.resolve(null);
      if (update.$set) {
        Object.assign(loan, update.$set, { updatedAt: new Date() });
      } else {
        Object.assign(loan, update, { updatedAt: new Date() });
      }
      return Promise.resolve(loan);
    }

    static findByIdAndDelete(id) {
      const success = mockDb.deleteLoan(id);
      return Promise.resolve(success ? { _id: id } : null);
    }

    static countDocuments(query = {}) {
      return Promise.resolve(mockDb.getLoans(query).length);
    }
  }
}

module.exports = Loan;
