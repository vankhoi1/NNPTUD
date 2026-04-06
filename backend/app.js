require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const { connectDB } = require('./config/database');
const User = require('./schemas/user/User');
const Member = require('./schemas/member/Member');
const { ok, notFound } = require('./utils/apiResponse');

// Route imports
const bookRoutes = require('./routes/book/bookRoutes');
const memberRoutes = require('./routes/member/memberRoutes');
const loanRoutes = require('./routes/loan/loanRoutes');
const authRoutes = require('./routes/auth/authRoutes');
const userRoutes = require('./routes/user/userRoutes');
const statisticsRoutes = require('./routes/statistics/statisticsRoutes');
const librarianRoutes = require('./routes/librarian/librarianRoutes');
const notificationRoutes = require('./routes/notification/notificationRoutes');
const auditLogRoutes = require('./routes/audit/auditLogRoutes');
const reservationRoutes = require('./routes/reservation/reservationRoutes');
const fineRoutes = require('./routes/fine/fineRoutes');
const finePaymentRoutes = require('./routes/fine/finePaymentRoutes');
const reviewRoutes = require('./routes/review/reviewRoutes');
const chatRoutes = require('./routes/chat/chatRoutes');
const supportTicketRoutes = require('./routes/supportTicket/supportTicketRoutes');
const loanStatusHistoryRoutes = require('./routes/loanStatusHistory/loanStatusHistoryRoutes');

// Middleware imports
const errorHandler = require('./middleware/errorHandler');

// Initialize Express app
const app = express();

// Create default demo accounts if they do not exist
async function createDefaultAccounts() {
  try {
    const defaultAccounts = [
      {
        username: 'admin',
        email: 'admin@library.com',
        password: 'admin123',
        role: 'Admin'
      },
      {
        username: 'librarian',
        email: 'librarian@library.com',
        password: 'librarian123',
        role: 'Librarian'
      },
      {
        username: 'reader',
        email: 'reader@library.com',
        password: 'reader123',
        role: 'Reader'
      }
    ];

    for (const account of defaultAccounts) {
      const exists = await User.findOne({
        $or: [{ username: account.username }, { email: account.email }]
      });

      if (!exists) {
        let memberId = null;
        if (account.role === 'Reader') {
          const member = await Member.create({
            name: account.username,
            email: account.email,
            phone: '0123456789',
            memberType: 'Student',
            membershipStatus: 'Active',
            maxBooksAllowed: 5,
            currentBorrowedCount: 0
          });
          memberId = member._id;
        }

        const created = await User.create({
          ...account,
          member: memberId,
          isActive: true
        });
        console.log(`✅ Default ${account.role} account created:`, created.username);
      } else if (account.role === 'Reader' && !exists.member) {
        // Reader account da ton tai nhung chua co member lien ket
        const member = await Member.create({
          name: account.username,
          email: account.email,
          phone: '0123456789',
          memberType: 'Student',
          membershipStatus: 'Active',
          maxBooksAllowed: 5,
          currentBorrowedCount: 0
        });

        exists.member = member._id;
        await exists.save();
        console.log(`✅ Seed member for Reader account:`, exists.username);
      }
    }
  } catch (error) {
    console.error('Error creating default accounts:', error.message);
  }
}

async function initApp() {
  await connectDB();
  // Wait a bit for DB readiness before seeding demo accounts.
  setTimeout(() => createDefaultAccounts(), 2000);
}

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan('dev')); // Logging
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/users', userRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/librarian', librarianRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/fines', fineRoutes);
app.use('/api/fine-payments', finePaymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/chat-messages', chatRoutes);
app.use('/api/support-tickets', supportTicketRoutes);
app.use('/api/loan-status-history', loanStatusHistoryRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json(ok('Library Management API is running', {
    message: 'Library Management API is running',
    timestamp: new Date().toISOString()
  }));
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json(notFound(`Route ${req.method} ${req.url} not found`));
});

// Error handler middleware
app.use(errorHandler);

module.exports = { app, initApp };
