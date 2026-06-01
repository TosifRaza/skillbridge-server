const ChatService = require('../services/chatService');

// In-memory map to track online users: { userId: Set<socketId> }
const onlineUsers = new Map();

const getSocketId = (userId) => {
  const socketSet = onlineUsers.get(userId.toString());
  return socketSet ? Array.from(socketSet) : []; // Return array of socket ids (user might have multiple tabs)
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
    // Client emits 'join-room' with the conversationId (e.g., job_123)
    socket.on('join-room', (conversationId) => {
      socket.join(conversationId);
      // Mark messages as read when user joins the room
      ChatService.markAsRead(conversationId, userId);
    });

    // --- SEND MESSAGE ---
    socket.on('send-message', async (data, callback) => {
      try {
        const { conversationId, text, imageUrl } = data;
        
        // Save to DB
        const message = await ChatService.createMessage(conversationId, userId, text, imageUrl);
        
        // Broadcast to everyone in the room
        io.to(conversationId).emit('receive-message', message);

        // Acknowledge success to sender
        if (callback) callback({ status: 'ok', message });
      } catch (error) {
        if (callback) callback({ status: 'error', message: error.message });
      }
    });

    // --- TYPING INDICATOR ---
    socket.on('typing', (conversationId) => {
      // Broadcast to others in the room
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