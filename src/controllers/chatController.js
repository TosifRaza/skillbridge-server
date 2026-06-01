const ChatService = require('../services/chatService');
const ApiResponse = require('../utils/ApiResponse');
const uploadToCloudinary = require('../utils/cloudinaryUpload');

class ChatController {
  /**
   * @route GET /api/v1/chat/:conversationId
   * @desc Get chat history
   */
  async getChatHistory(req, res, next) {
    try {
      const messages = await ChatService.getChatHistory(req.params.conversationId, req.query.page);
      res.status(200).json(new ApiResponse(200, messages, 'Chat history fetched successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route POST /api/v1/chat/upload-image
   * @desc Upload an image for chat
   */
  async uploadChatImage(req, res, next) {
    try {
      if (!req.file) throw new ApiError(400, 'Please upload an image file');
      
      const result = await uploadToCloudinary(req.file.buffer, 'SkillBridge/Chat');
      res.status(200).json(new ApiResponse(200, { url: result.url }, 'Image uploaded successfully'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ChatController();