const express = require('express');
const router = express.Router();
const librarianController = require('../../controllers/librarian/librarianController');
const { authenticate, authorize } = require('../../middleware/auth');

// All routes require authentication and Librarian or Admin role
router.use(authenticate);
router.use(authorize('Librarian', 'Admin'));

// Dashboard and Statistics
router.get('/dashboard', librarianController.getDashboard);
router.get('/statistics/monthly', librarianController.getMonthlyStatistics);
router.get('/daily-report', librarianController.getDailyReport);

// Overdue Management
router.get('/overdue-loans', librarianController.getOverdueLoans);

// Loan Operations
router.post('/return-book/:loanId', librarianController.returnBook);
router.put('/extend-loan/:loanId', librarianController.extendLoan);

// Member Management
router.get('/members', librarianController.getMembers);
router.put('/members/:memberId/status', librarianController.updateMemberStatus);
router.get('/members/:memberId/history', librarianController.getMemberHistory);

// Book Inventory
router.get('/books', librarianController.getBooks);
router.get('/books/:bookId/history', librarianController.getBookHistory);

module.exports = router;
