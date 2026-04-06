// SupportTicket schema - works with both MongoDB and Mock DB
const { useMock, mockDb } = require('../../config/database');

let SupportTicket;

if (!useMock) {
  const mongoose = require('mongoose');

  const supportTicketSchema = new mongoose.Schema(
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
      },
      description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        maxlength: [2000, 'Description cannot exceed 2000 characters']
      },
      category: {
        type: String,
        required: [true, 'Category is required'],
        trim: true,
        enum: {
          values: ['Technical', 'Account', 'Billing', 'Content', 'Other'],
          message: 'Please select a valid category'
        }
      },
      status: {
        type: String,
        required: true,
        enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
        default: 'Open'
      },
      priority: {
        type: String,
        required: true,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium'
      },
      assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      resolutionNotes: {
        type: String,
        trim: true,
        maxlength: [1000, 'Resolution notes cannot exceed 1000 characters'],
        default: ''
      },
      attachments: [
        {
          filename: String,
          path: String,
          uploadedAt: { type: Date, default: Date.now }
        }
      ]
    },
    { timestamps: true }
  );

  SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
} else {
  // Mock implementation
  SupportTicket = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    create: () => Promise.resolve({}),
    findOneAndUpdate: () => Promise.resolve({}),
    countDocuments: () => Promise.resolve(0)
  };
}

module.exports = SupportTicket;