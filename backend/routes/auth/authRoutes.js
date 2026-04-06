const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  register,
  login,
  getMe,
  refreshToken
} = require('../../controllers/auth/authController');
const { authenticate } = require('../../middleware/auth');
const validate = require('../../middleware/validation');

// Validation rules
const registerValidation = [
  body('username')
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters'),
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role')
    .optional()
    .isIn(['Admin', 'Librarian', 'Reader']).withMessage('Invalid role'),
  body('memberId')
    .optional()
    .if(value => value) // Only validate if value is provided
    .isMongoId().withMessage('Invalid member ID - must be a valid MongoDB ID')
];

const loginValidation = [
  body()
    .custom((value) => {
      if (!value.email && !value.username) {
        throw new Error('Email or username is required');
      }
      return true;
    }),
  body('email')
    .optional()
    .isEmail().withMessage('Please provide a valid email'),
  body('username')
    .optional()
    .isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password')
    .notEmpty().withMessage('Password is required')
];

// Routes
router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);
router.get('/me', authenticate, getMe);
router.post('/refresh', authenticate, refreshToken);

module.exports = router;