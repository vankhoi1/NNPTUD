const express = require('express');
const router = express.Router();

const { authenticate, authorize } = require('../../middleware/auth');
const chatController = require('../../controllers/chat/chatController');

router.get('/', authenticate, authorize('Reader', 'Librarian', 'Admin'), chatController.getAllChatMessages);
router.get('/:id', authenticate, authorize('Reader', 'Librarian', 'Admin'), chatController.getChatMessage);

router.post('/', authenticate, authorize('Reader', 'Librarian', 'Admin'), chatController.createChatMessage);

router.delete('/:id', authenticate, authorize('Admin', 'Librarian'), chatController.deleteChatMessage);

module.exports = router;

