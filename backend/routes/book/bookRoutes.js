const express = require('express');
const router = express.Router();
const {
  getAllBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook,
  searchBooks
} = require('../../controllers/book/bookController');
const { authenticate, authorize } = require('../../middleware/auth');
const validate = require('../../middleware/validation');

// Validation middleware
const { body, param, query } = require('express-validator');

// Validation rules
const bookCreateValidation = [
  body('title').notEmpty().withMessage('Title is required'),
  body('author').notEmpty().withMessage('Author is required'),
  body('isbn').notEmpty().withMessage('ISBN is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('totalCopies').isInt({ min: 1 }).withMessage('Total copies must be at least 1')
];

// For updates, allow partial payloads (PUT used as update in this project/tests)
const bookUpdateValidation = [
  body('title').optional().notEmpty().withMessage('Title cannot be empty'),
  body('author').optional().notEmpty().withMessage('Author cannot be empty'),
  body('isbn').optional().notEmpty().withMessage('ISBN cannot be empty'),
  body('category').optional().notEmpty().withMessage('Category cannot be empty'),
  body('totalCopies').optional().isInt({ min: 1 }).withMessage('Total copies must be at least 1')
];

const idValidation = [
  param('id').isMongoId().withMessage('Invalid book ID')
];

const searchValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
];

// Routes
router.get('/', searchValidation, validate, getAllBooks);
router.get('/search', searchValidation, validate, searchBooks);
router.get('/:id', idValidation, validate, getBook);

// Auth should run before validation to return 401/403 for unauthorized callers
router.post('/', authenticate, authorize('Admin', 'Librarian'), bookCreateValidation, validate, createBook);
router.put('/:id', authenticate, authorize('Admin', 'Librarian'), idValidation, bookUpdateValidation, validate, updateBook);
router.delete('/:id', authenticate, authorize('Admin', 'Librarian'), idValidation, validate, deleteBook);

module.exports = router;