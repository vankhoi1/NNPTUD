// Member schema - works with both MongoDB and Mock DB
const { useMock, mockDb } = require('../../config/database');

let Member;

if (!useMock) {
  const mongoose = require('mongoose');

  const memberSchema = new mongoose.Schema({
    name: {
      type: String,
      required: [true, 'Member name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    address: {
      type: String,
      trim: true,
      maxlength: [200, 'Address cannot exceed 200 characters']
    },
    memberType: {
      type: String,
      required: [true, 'Member type is required'],
      enum: {
        values: ['Student', 'Teacher', 'Staff', 'External'],
        message: 'Please select a valid member type'
      },
      default: 'Student'
    },
    membershipStatus: {
      type: String,
      required: true,
      enum: ['Active', 'Inactive', 'Suspended'],
      default: 'Active'
    },
    joinDate: {
      type: Date,
      default: Date.now
    },
    maxBooksAllowed: {
      type: Number,
      required: true,
      min: [1, 'Max books allowed must be at least 1'],
      default: 5
    },
    currentBorrowedCount: {
      type: Number,
      required: true,
      min: [0, 'Current borrowed count cannot be negative'],
      default: 0
    }
  }, {
    timestamps: true
  });

  memberSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
  });

  memberSchema.methods.canBorrow = function() {
    return this.currentBorrowedCount < this.maxBooksAllowed && this.membershipStatus === 'Active';
  };

  memberSchema.methods.incrementBorrowed = function() {
    if (this.canBorrow()) {
      this.currentBorrowedCount += 1;
      return true;
    }
    return false;
  };

  memberSchema.methods.decrementBorrowed = function() {
    if (this.currentBorrowedCount > 0) {
      this.currentBorrowedCount -= 1;
      return true;
    }
    return false;
  };

  Member = mongoose.model('Member', memberSchema);
} else {
  class Member {
    constructor(data) {
      this._id = `member_${mockDb.counters.members++}`;
      this.name = data.name;
      this.email = data.email;
      this.phone = data.phone;
      this.address = data.address || '';
      this.memberType = data.memberType || 'Student';
      this.membershipStatus = data.membershipStatus || 'Active';
      this.joinDate = new Date();
      this.maxBooksAllowed = data.maxBooksAllowed || 5;
      this.currentBorrowedCount = data.currentBorrowedCount || 0;
      this.createdAt = new Date();
      this.updatedAt = new Date();
    }

    save() {
      mockDb.members.push(this);
      return Promise.resolve(this);
    }

    static find(query = {}) {
      return Promise.resolve(mockDb.getMembers(query));
    }

    static findById(id) {
      return Promise.resolve(mockDb.getMemberById(id));
    }

    static findOneAndUpdate(filter, update) {
      const member = mockDb.getMemberById(filter._id || filter.id);
      if (!member) return Promise.resolve(null);
      if (update.$set) {
        Object.assign(member, update.$set, { updatedAt: new Date() });
      } else {
        Object.assign(member, update, { updatedAt: new Date() });
      }
      return Promise.resolve(member);
    }

    static findByIdAndDelete(id) {
      const success = mockDb.deleteMember(id);
      return Promise.resolve(success ? { _id: id } : null);
    }

    static countDocuments(query = {}) {
      return Promise.resolve(mockDb.getMembers(query).length);
    }
  }
}

module.exports = Member;
