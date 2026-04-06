const express = require('express');
const router = express.Router();

const { authenticate, authorize } = require('../../middleware/auth');
const reviewController = require('../../controllers/review/reviewController');

router.get('/', authenticate, authorize('Reader', 'Librarian', 'Admin'), reviewController.getAllReviews);
router.get('/:id', authenticate, authorize('Reader', 'Librarian', 'Admin'), reviewController.getReview);

router.post('/', authenticate, authorize('Reader'), reviewController.createReview);

router.put('/:id', authenticate, authorize('Admin', 'Librarian'), reviewController.updateReview);
router.delete('/:id', authenticate, authorize('Admin', 'Librarian'), reviewController.deleteReview);

// Admin/Librarian can also create if needed
router.post('/admin', authenticate, authorize('Admin', 'Librarian'), reviewController.createReview);

module.exports = router;

