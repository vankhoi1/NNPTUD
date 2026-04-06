const express = require('express');
const router = express.Router();

const { authenticate, authorize } = require('../../middleware/auth');
const finePaymentController = require('../../controllers/fine/finePaymentController');

router.get('/', authenticate, authorize('Reader', 'Librarian', 'Admin'), finePaymentController.getAllFinePayments);
router.get('/:id', authenticate, authorize('Reader', 'Librarian', 'Admin'), finePaymentController.getFinePayment);

router.post('/', authenticate, authorize('Admin', 'Librarian'), finePaymentController.createFinePayment);
router.put('/:id', authenticate, authorize('Admin', 'Librarian'), finePaymentController.updateFinePayment);
router.delete('/:id', authenticate, authorize('Admin', 'Librarian'), finePaymentController.deleteFinePayment);

module.exports = router;

