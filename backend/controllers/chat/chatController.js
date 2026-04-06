const ChatMessage = require('../../schemas/chat/ChatMessage');

exports.getAllChatMessages = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, roomId } = req.query;
    const query = {};

    if (roomId) query.roomId = roomId;

    if (req.user?.role === 'Reader') {
      // Readers can see all messages in public room.
      // For non-public rooms, only show messages they sent/received.
      if (roomId === 'public') {
        query.roomId = 'public';
      } else {
        query.$or = [{ sender: req.user._id }, { receiver: req.user._id }];
      }
    }

    const messages = await ChatMessage.find(query)
      .populate('sender', 'username email role')
      .populate('receiver', 'username email role')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ChatMessage.countDocuments(query);
    res.status(200).json({
      success: true,
      count: messages.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: messages
    });
  } catch (error) {
    next(error);
  }
};

exports.getChatMessage = async (req, res, next) => {
  try {
    const message = await ChatMessage.findById(req.params.id)
      .populate('sender', 'username email role')
      .populate('receiver', 'username email role');
    if (!message) return res.status(404).json({ success: false, message: 'ChatMessage not found' });
    res.status(200).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};

exports.createChatMessage = async (req, res, next) => {
  try {
    const { roomId, receiverId, content } = req.body;
    const msg = await ChatMessage.create({
      roomId: roomId || 'public',
      sender: req.user._id,
      receiver: receiverId || null,
      content
    });
    res.status(201).json({ success: true, data: msg });
  } catch (error) {
    next(error);
  }
};

exports.deleteChatMessage = async (req, res, next) => {
  try {
    const deleted = await ChatMessage.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'ChatMessage not found' });
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

