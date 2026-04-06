const express = require('express');
const router = express.Router();

const { authenticate, authorize } = require('../../middleware/auth');
const loanStatusHistoryController = require('../../controllers/loanStatusHistory/loanStatusHistoryController');

// All routes require authentication
router.use(authenticate);

// Routes accessible to all authenticated users (with permission checks in controller)
router.get('/', loanStatusHistoryController.getAllLoanStatusHistory);
router.get('/:id', loanStatusHistoryController.getLoanStatusHistory);
router.get('/loans/:loanId/status-history', loanStatusHistoryController.getLoanStatusHistoryByLoan);

// Admin/Librarian only routes
router.post('/', authorize('Admin', 'Librarian'), loanStatusHistoryController.createLoanStatusHistory);
router.put('/:id', authorize('Admin', 'Librarian'), loanStatusHistoryController.updateLoanStatusHistory);
router.delete('/:id', authorize('Admin', 'Librarian'), loanStatusHistoryController.deleteLoanStatusHistory);
router.get('/stats/transitions', authorize('Admin', 'Librarian'), loanStatusHistoryController.getLoanStatusTransitionStats);

module.exports = router;