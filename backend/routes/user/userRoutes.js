const express = require('express');
const router = express.Router();

const {
  getAllUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus
} = require('../../controllers/user/userController');

const { authenticate, authorize } = require('../../middleware/auth');
const { body, param, query, validationResult } = require('express-validator');

// Middleware for validation
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
};

// Validation rules
const userValidation = [
  body('username').optional().trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['Admin', 'Librarian', 'Reader']).withMessage('Invalid role')
];

const updateValidation = [
  body('username').optional().trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('role').optional().isIn(['Admin', 'Librarian', 'Reader']).withMessage('Invalid role'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
];

const idValidation = [
  param('id').matches(/^[0-9a-f]{24}$/i).withMessage('Invalid user ID')
];

// Protect all routes with Admin authorization
router.use(authenticate, authorize('Admin'));

// Get all users
router.get('/', getAllUsers);

// Get single user
router.get('/:id', idValidation, validate, getUser);

// Create user
router.post('/', userValidation, validate, createUser);

// Update user
router.put('/:id', idValidation, updateValidation, validate, updateUser);

// Delete user
router.delete('/:id', idValidation, validate, deleteUser);

// Toggle user status
router.patch('/:id/status', idValidation, validate, toggleUserStatus);

module.exports = router;
