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
    socket.join(userId);

    // --- ONLINE STATUS ---
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);
    io.emit('user-status', { userId, status: 'online' });

    // --- JOIN CHAT ROOM ---
    socket.on('join-room', async (conversationId) => {
      try {
        await ChatService.requireParticipant(conversationId, userId);
        if (!socket.connected) return;
        await socket.join(conversationId);
        await ChatService.markAsRead(conversationId, userId);
        socket.to(conversationId).emit('messages-read', { conversationId, readBy: userId });
      } catch (error) {
        console.error('Could not join chat room:', error.message);
      }
    });
    socket.on('leave-room', (conversationId) => {
      if (typeof conversationId === 'string' && conversationId.startsWith('job_')) socket.leave(conversationId);
    });
    socket.on('get-conversation-presence', async (conversationId, acknowledge) => {
      if (typeof acknowledge !== 'function') return;
      try {
        const peerId = await ChatService.requireParticipant(conversationId, userId);
        acknowledge({ online: getSocketId(peerId).length > 0 });
      } catch {
        acknowledge({ online: false });
      }
    });

    // --- SEND MESSAGE ---
    socket.on('send-message', async (data, callback) => {
      try {
        const { conversationId, text, imageUrl, imageUrls } = data;
        
        if (!conversationId) {
          throw new ApiError(400, 'Conversation ID is required');
        }

        await ChatService.requireParticipant(conversationId, userId);
        const message = await ChatService.createMessage(conversationId, userId, text, imageUrl, imageUrls);
        io.to(conversationId).emit('receive-message', message);

        if (callback) callback({ status: 'ok', message });
      } catch (error) {
        console.error('❌ Socket Message Error:', error.message);
        if (callback) callback({ status: 'error', message: error.message });
      }
    });

    // --- TYPING INDICATOR ---
    socket.on('typing', (conversationId) => {
      if (socket.rooms.has(conversationId)) socket.to(conversationId).emit('display-typing', { conversationId, userId });
    });

    socket.on('stop-typing', (conversationId) => {
      if (socket.rooms.has(conversationId)) socket.to(conversationId).emit('display-stop-typing', { conversationId, userId });
    });

    // --- READ RECEIPTS ---
    socket.on('mark-as-read', async (conversationId) => {
      if (!socket.rooms.has(conversationId)) return;
      try {
        await ChatService.markAsRead(conversationId, userId);
        socket.to(conversationId).emit('messages-read', { conversationId, readBy: userId });
      } catch (error) {
        console.error('Could not update chat read status:', error.message);
      }
    });

    const relayCallEvent = async (eventName, data = {}) => {
      try {
        const peerId = await ChatService.getCallParticipant(data.conversationId, userId);
        if (!peerId) return;
        io.to(peerId).emit(eventName, { ...data, fromUserId: userId });
      } catch (error) {
        console.error('Call signaling error:', error.message);
      }
    };

    socket.on('call-initiate', async (data = {}, acknowledge) => {
      if (!['audio', 'video'].includes(data.callType) || !data.offer || !data.callId) return;
      try {
        const peerId = await ChatService.getCallParticipant(data.conversationId, userId);
        if (!peerId) {
          if (typeof acknowledge === 'function') acknowledge({ ok: false, message: 'This conversation has no active call participant.' });
          return;
        }
        const callLog = await ChatService.createCallLog(data.conversationId, userId, data);
        io.to(data.conversationId).emit('receive-message', callLog);
        const delivered = getSocketId(peerId).length > 0;
        io.to(peerId).emit('call-incoming', {
          conversationId: data.conversationId,
          callId: data.callId,
          callType: data.callType,
          offer: data.offer,
          caller: {
            id: userId,
            name: socket.user.fullName || socket.user.email,
            avatar: socket.user.avatar?.url || '',
          },
          fromUserId: userId,
        });
        if (typeof acknowledge === 'function') acknowledge({ ok: true, delivered });
      } catch (error) {
        console.error('Call log create error:', error.message);
        if (typeof acknowledge === 'function') acknowledge({ ok: false, message: 'The call could not be sent. Please try again.' });
        return;
      }
    });

    socket.on('call-answer', async (data = {}) => {
      try {
        const callLog = await ChatService.updateCallLog(data.conversationId, data.callId, userId, 'answer');
        io.to(data.conversationId).emit('call-log-updated', callLog);
        await relayCallEvent('call-answered', data);
      } catch (error) {
        console.error('Call answer error:', error.message);
      }
    });
    socket.on('call-ice-candidate', (data) => relayCallEvent('call-ice-candidate', data));
    socket.on('call-renegotiate', (data = {}) => {
      if (!data.callId || !data.conversationId || !data.description || !['offer', 'answer'].includes(data.description.type)) return;
      if (typeof data.description.sdp !== 'string' || data.description.sdp.length > 100000) return;
      return relayCallEvent('call-renegotiate', data);
    });
    socket.on('call-decline', async (data = {}) => {
      try {
        const callLog = await ChatService.updateCallLog(data.conversationId, data.callId, userId, 'decline');
        io.to(data.conversationId).emit('call-log-updated', callLog);
        await relayCallEvent('call-declined', data);
      } catch (error) {
        console.error('Call decline error:', error.message);
      }
    });
    socket.on('call-end', async (data = {}) => {
      try {
        const callLog = await ChatService.updateCallLog(data.conversationId, data.callId, userId, 'end', data.reason);
        io.to(data.conversationId).emit('call-log-updated', callLog);
        await relayCallEvent('call-ended', data);
      } catch (error) {
        console.error('Call end error:', error.message);
      }
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
