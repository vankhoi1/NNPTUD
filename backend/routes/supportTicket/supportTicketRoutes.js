const express = require('express');
const router = express.Router();

const { authenticate, authorize } = require('../../middleware/auth');
const supportTicketController = require('../../controllers/supportTicket/supportTicketController');

// All routes require authentication
router.use(authenticate);

// Public routes (for all authenticated users)
router.get('/', supportTicketController.getAllSupportTickets);
router.get('/:id', supportTicketController.getSupportTicket);
router.post('/', supportTicketController.createSupportTicket);
router.patch('/:id/status', supportTicketController.updateSupportTicketStatus);

// Admin/Librarian only routes
router.put('/:id', authorize('Admin', 'Librarian'), supportTicketController.updateSupportTicket);
router.delete('/:id', authorize('Admin', 'Librarian'), supportTicketController.deleteSupportTicket);
router.patch('/:id/assign', authorize('Admin', 'Librarian'), supportTicketController.assignSupportTicket);
router.get('/stats/overview', authorize('Admin', 'Librarian'), supportTicketController.getSupportTicketStats);

module.exports = router;