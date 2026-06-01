const Message = require('../models/Message');
const ApiError = require('../utils/ApiError');

class ChatService {
  /**
   * Save a new message to the database
   */
  async createMessage(conversationId, senderId, text, imageUrl = null) {
    if (!text && !imageUrl) {
      throw new ApiError(400, 'Message must contain text or an image');
    }

    const message = await Message.create({
      conversationId,
      sender: senderId,
      text,
      imageUrl,
      readBy: [senderId], // Sender has obviously read it
    });

    // Populate sender details for real-time emission
    await message.populate('sender', 'email role');
    return message;
  }

  /**
   * Fetch chat history for a specific conversation
   */
  async getChatHistory(conversationId, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    
    const messages = await Message.find({ conversationId })
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit)
      .populate('sender', 'email role');

    return messages.reverse(); // Return oldest to newest for UI
  }

  /**
   * Mark messages as read by a specific user
   */
  async markAsRead(conversationId, userId) {
    await Message.updateMany(
      { conversationId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );
  }
}

module.exports = new ChatService();