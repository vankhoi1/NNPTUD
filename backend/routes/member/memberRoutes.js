const express = require('express');
const router = express.Router();
const {
  getAllMembers,
  getMember,
  createMember,
  updateMember,
  deleteMember,
  getMemberLoans,
  updateMemberStatus
} = require('../../controllers/member/memberController');
const { authenticate, authorize } = require('../../middleware/auth');
const validate = require('../../middleware/validation');

// Validation middleware
const { body, param, query } = require('express-validator');

// Validation rules
const memberCreateValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('memberType')
    .isIn(['Student', 'Teacher', 'Staff', 'External'])
    .withMessage('Invalid member type')
];

// For updates, allow partial payloads (PUT used as update in this project/tests)
const memberUpdateValidation = [
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('phone').optional().notEmpty().withMessage('Phone number cannot be empty'),
  body('memberType')
    .optional()
    .isIn(['Student', 'Teacher', 'Staff', 'External'])
    .withMessage('Invalid member type')
];

const idValidation = [
  param('id').isMongoId().withMessage('Invalid member ID')
];

const searchValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
];

const statusValidation = [
  body('membershipStatus').isIn(['Active', 'Inactive', 'Suspended']).withMessage('Invalid membership status')
];

// Routes
router.get('/', searchValidation, validate, getAllMembers);
router.get('/:id', idValidation, validate, getMember);
router.get('/:id/loans', idValidation, validate, getMemberLoans);

// Auth should run before validation to return 401/403 for unauthorized callers
router.post('/', authenticate, authorize('Admin', 'Librarian'), memberCreateValidation, validate, createMember);
router.put('/:id', authenticate, authorize('Admin', 'Librarian'), idValidation, memberUpdateValidation, validate, updateMember);
router.patch('/:id/status', authenticate, authorize('Admin', 'Librarian'), idValidation, statusValidation, validate, updateMemberStatus);
router.delete('/:id', authenticate, authorize('Admin', 'Librarian'), idValidation, validate, deleteMember);

module.exports = router;