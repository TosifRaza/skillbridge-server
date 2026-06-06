const ChatService = require('../services/chatService');
const ApiError = require('../utils/ApiError'); // FIX: Added missing import

// In-memory map to track online users: { userId: Set<socketId> }
const onlineUsers = new Map();

const getSocketId = (userId) => {
  const socketSet = onlineUsers.get(userId.toString());
  return socketSet ? Array.from(socketSet) : [];
};

module.exports = (io) => {
  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();

    // --- ONLINE STATUS ---
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);
    io.emit('user-status', { userId, status: 'online' });

    // --- JOIN CHAT ROOM ---
    socket.on('join-room', (conversationId) => {
      socket.join(conversationId);
      ChatService.markAsRead(conversationId, userId);
    });

    // --- SEND MESSAGE ---
    socket.on('send-message', async (data, callback) => {
      try {
        const { conversationId, text, imageUrl } = data;
        
        if (!conversationId) {
          throw new ApiError(400, 'Conversation ID is required');
        }

        const message = await ChatService.createMessage(conversationId, userId, text, imageUrl);
        io.to(conversationId).emit('receive-message', message);

        if (callback) callback({ status: 'ok', message });
      } catch (error) {
        console.error('❌ Socket Message Error:', error.message);
        if (callback) callback({ status: 'error', message: error.message });
      }
    });

    // --- TYPING INDICATOR ---
    socket.on('typing', (conversationId) => {
      socket.to(conversationId).emit('display-typing', { userId });
    });

    socket.on('stop-typing', (conversationId) => {
      socket.to(conversationId).emit('display-stop-typing', { userId });
    });

    // --- READ RECEIPTS ---
    socket.on('mark-as-read', async (conversationId) => {
      await ChatService.markAsRead(conversationId, userId);
      io.to(conversationId).emit('messages-read', { conversationId, readBy: userId });
    });

    // --- DISCONNECT ---
    socket.on('disconnect', () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit('user-status', { userId, status: 'offline' });
        }
      }
    });
  });
};