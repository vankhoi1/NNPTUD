const express = require('express');
const router = express.Router();

const { authenticate, authorize } = require('../../middleware/auth');
const fineController = require('../../controllers/fine/fineController');

router.get('/', authenticate, authorize('Reader', 'Librarian', 'Admin'), fineController.getAllFines);
router.get('/:id', authenticate, authorize('Reader', 'Librarian', 'Admin'), fineController.getFine);

router.post('/', authenticate, authorize('Admin', 'Librarian'), fineController.createFine);
router.put('/:id', authenticate, authorize('Admin', 'Librarian'), fineController.updateFine);
router.delete('/:id', authenticate, authorize('Admin', 'Librarian'), fineController.deleteFine);

module.exports = router;

