const express = require('express');
const router = express.Router();
const {
  getAllLoans,
  getLoan,
  createLoan,
  updateLoan,
  deleteLoan,
  returnBook,
  getOverdueLoans,
  renewLoan,
  getMyLoans,
  borrowBook,
  getPendingLoans,
  approveLoan,
  rejectLoan,
  requestRenewal,
  cancelRenewalRequest,
  approveRenewal,
  rejectRenewal
} = require('../../controllers/loan/loanController');
const { authenticate, authorize } = require('../../middleware/auth');
const validate = require('../../middleware/validation');

// Validation middleware
const { body, param, query } = require('express-validator');

// Validation rules
const loanValidation = [
  body('bookId').notEmpty().withMessage('Book ID is required'),
  body('memberId').notEmpty().withMessage('Member ID is required'),
  body('dueDate').isDate().withMessage('Valid due date is required')
];

const borrowValidation = [
  body('bookId').notEmpty().withMessage('Book ID is required'),
  body('dueDate').isDate().withMessage('Valid due date is required'),
  body('notes').optional().isString()
];

const idValidation = [
  param('id').isMongoId().withMessage('Invalid loan ID')
];

const searchValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
];

const renewValidation = [
  body('newDueDate').isDate().withMessage('Valid new due date is required')
];

// Public routes (optional auth)
router.get('/', searchValidation, validate, getAllLoans);
router.get('/overdue', getOverdueLoans);
router.get('/me/loans', authenticate, authorize('Reader', 'Librarian', 'Admin'), searchValidation, validate, getMyLoans);
router.get('/pending', authenticate, authorize('Librarian', 'Admin'), searchValidation, validate, getPendingLoans);
router.get('/:id', idValidation, validate, getLoan);

// Admin/Librarian only routes - require memberId in body
router.post('/', authenticate, authorize('Admin', 'Librarian'), loanValidation, validate, createLoan);
router.post('/borrow', authenticate, authorize('Reader', 'Librarian', 'Admin'), borrowValidation, validate, borrowBook);
router.put('/:id', authenticate, authorize('Admin', 'Librarian'), idValidation, loanValidation, validate, updateLoan);
router.put('/:id/return', authenticate, authorize('Admin', 'Librarian'), idValidation, validate, returnBook);
router.put('/:id/renew', authenticate, authorize('Admin', 'Librarian'), idValidation, renewValidation, validate, renewLoan);
router.put('/:id/approve', authenticate, authorize('Librarian', 'Admin'), idValidation, validate, approveLoan);
router.put('/:id/reject', authenticate, authorize('Librarian', 'Admin'), idValidation, validate, rejectLoan);
router.put('/:id/renew-request', authenticate, authorize('Reader'), idValidation, validate, requestRenewal);
router.put('/:id/cancel-renewal', authenticate, authorize('Reader'), idValidation, validate, cancelRenewalRequest);
router.put('/:id/approve-renewal', authenticate, authorize('Librarian', 'Admin'), idValidation, validate, approveRenewal);
router.put('/:id/reject-renewal', authenticate, authorize('Librarian', 'Admin'), idValidation, validate, rejectRenewal);
router.delete('/:id', authenticate, authorize('Admin', 'Librarian'), idValidation, validate, deleteLoan);

module.exports = router;