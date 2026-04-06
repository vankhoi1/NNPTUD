// User schema - handles authentication and authorization
const { useMock, mockDb } = require('../../config/database');

let User;

if (!useMock) {
  const mongoose = require('mongoose');
  const bcrypt = require('bcryptjs');

  const userSchema = new mongoose.Schema({
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [50, 'Username cannot exceed 50 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: {
        values: ['Admin', 'Librarian', 'Reader'],
        message: 'Please select a valid role'
      },
      default: 'Reader'
    },
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLogin: {
      type: Date
    }
  }, {
    timestamps: true
  });

  userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();

    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
      next();
    } catch (error) {
      next(error);
    }
  });

  userSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
  };

  User = mongoose.model('User', userSchema);
} else {
  class User {
    constructor(data) {
      this._id = `user_${mockDb.counters.users++}`;
      this.username = data.username;
      this.email = data.email;
      this.password = data.password;
      this.role = data.role || 'Reader';
      this.member = data.member || null;
      this.isActive = data.isActive !== undefined ? data.isActive : true;
      this.lastLogin = data.lastLogin || null;
      this.createdAt = new Date();
      this.updatedAt = new Date();
    }
  }

  User.findById = async function(id) {
    return mockDb.getUserById(id);
  };

  User.findOne = async function(query) {
    const users = mockDb.getUsers();
    return users.find((u) => {
      let match = true;
      for (const key in query) {
        if (query[key] instanceof RegExp) {
          match = match && new RegExp(query[key].source, query[key].flags).test(u[key] || '');
        } else {
          match = match && u[key] === query[key];
        }
      }
      return match;
    });
  };

  User.create = async function(data) {
    return mockDb.addUser(data);
  };
}

module.exports = User;
