const express = require('express');
const router = express.Router();

const { authenticate, authorize } = require('../../middleware/auth');
const notificationController = require('../../controllers/notification/notificationController');

// Reader: only view own notifications
// Admin/Librarian: full CRUD
router.get('/', authenticate, authorize('Reader', 'Librarian', 'Admin'), notificationController.getAllNotifications);
router.get('/:id', authenticate, authorize('Reader', 'Librarian', 'Admin'), notificationController.getNotification);
router.post('/', authenticate, authorize('Admin', 'Librarian'), notificationController.createNotification);
router.put('/:id', authenticate, authorize('Admin', 'Librarian'), notificationController.updateNotification);
router.delete('/:id', authenticate, authorize('Admin', 'Librarian'), notificationController.deleteNotification);

router.patch('/:id/read', authenticate, authorize('Reader', 'Librarian', 'Admin'), notificationController.markRead);

module.exports = router;

