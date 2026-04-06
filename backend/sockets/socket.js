const jwt = require('jsonwebtoken');
const ChatMessage = require('../schemas/chat/ChatMessage');

function setupSockets(io) {
  // JWT auth for every socket connection
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        null;

      if (!token) {
        return next(new Error('Unauthorized: missing token'));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your-secret-key-change-in-production'
      );

      socket.user = {
        userId: decoded.userId,
        role: decoded.role
      };

      return next();
    } catch (err) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    // Private room per user for notifications
    if (socket.user?.userId) {
      socket.join(`user:${socket.user.userId}`);
    }

    // Join default public room for realtime public chat
    socket.join('room:public');

    socket.on('chat:join', ({ roomId }) => {
      const targetRoom = (roomId || 'public').toString().trim() || 'public';
      socket.join(`room:${targetRoom}`);
      socket.emit('chat:joined', { roomId: targetRoom });
    });

    socket.on('chat:send', async ({ roomId, receiverId, content }) => {
      try {
        if (!content || typeof content !== 'string') {
          socket.emit('chat:error', { message: 'Invalid content' });
          return;
        }

        const finalRoomId = roomId || 'public';

        const message = await ChatMessage.create({
          roomId: finalRoomId,
          sender: socket.user.userId,
          receiver: receiverId || null,
          content: content.trim()
        });

        // Populate sender/receiver so frontend can render names immediately
        await message.populate('sender', 'username email role');
        if (message.receiver) {
          await message.populate('receiver', 'username email role');
        }

        // Broadcast into the room + notify the receiver if provided
        io.to(`room:${finalRoomId}`).emit('chat:new', message);
        if (receiverId) {
          io.to(`user:${receiverId}`).emit('chat:new', message);
        }
      } catch (err) {
        socket.emit('chat:error', { message: err.message || 'Server error' });
      }
    });
  });
}

module.exports = { setupSockets };

