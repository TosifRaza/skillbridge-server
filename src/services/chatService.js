// const Message = require('../models/Message');
// const ApiError = require('../utils/ApiError');
// const uploadToCloudinary = require('../utils/cloudinaryUpload'); // FIX: Added import

// class ChatService {
//   async createMessage(conversationId, senderId, text, imageUrl = null) {
//     if (!text && !imageUrl) {
//       throw new ApiError(400, 'Message must contain text or an image');
//     }

//     const message = await Message.create({
//       conversationId,
//       sender: senderId,
//       text,
//       imageUrl,
//       readBy: [senderId],
//     });

//     await message.populate('sender', 'email role');
//     return message;
//   }

//   // FIX: Added missing uploadImage method
//   async uploadImage(fileBuffer) {
//     const result = await uploadToCloudinary(fileBuffer, 'SkillBridge/Chat');
//     return result;
//   }

//   async getChatHistory(conversationId, page = 1, limit = 50) {
//     const skip = (page - 1) * limit;
    
//     const messages = await Message.find({ conversationId })
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit)
//       .populate('sender', 'email role');

//     return messages.reverse();
//   }

//   async markAsRead(conversationId, userId) {
//     await Message.updateMany(
//       { conversationId, readBy: { $ne: userId } },
//       { $addToSet: { readBy: userId } }
//     );
//   }
// }

// module.exports = new ChatService();
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Job = require('../models/Job');
const ApiError = require('../utils/ApiError');
const uploadToCloudinary = require('../utils/cloudinaryUpload');

class ChatService {
  /**
   * Get all conversations for a user
   */
  async getConversations(userId) {
    // 1. Find all jobs where user is customer or hiredProvider
    const userJobs = await Job.find({
      $or: [{ customer: userId }, { hiredProvider: userId }]
    }).select('_id');

    const jobConversationIds = userJobs.map(job => `job_${job._id}`);

    // 2. Aggregate messages for these conversations
    const conversations = await Message.aggregate([
      { $match: { conversationId: { $in: jobConversationIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [{ $ne: ['$readBy', mongoose.Types.ObjectId(userId)] }, 1, 0]
            }
          }
        }
      },
      { $sort: { 'lastMessage.createdAt': -1 } }
    ]);

    // 3. Fetch Job details for each conversation
    const formattedConversations = await Promise.all(conversations.map(async (convo) => {
      const jobId = convo._id.replace('job_', '');
      const job = await Job.findById(jobId).select('title category status');
      return {
        conversationId: convo._id,
        lastMessage: convo.lastMessage,
        unreadCount: convo.unreadCount,
        title: job?.title || 'Unknown Job',
        category: job?.category || '',
        status: job?.status || '',
        _id: jobId 
      };
    }));

    return formattedConversations;
  }

  async createMessage(conversationId, senderId, text, imageUrl = null) {
    if (!text && !imageUrl) {
      throw new ApiError(400, 'Message must contain text or an image');
    }

    const message = await Message.create({
      conversationId,
      sender: senderId,
      text,
      imageUrl,
      readBy: [senderId],
    });

    await message.populate('sender', 'email role');
    return message;
  }

  async uploadImage(fileBuffer) {
    const result = await uploadToCloudinary(fileBuffer, 'SkillBridge/Chat');
    return result;
  }

  async getChatHistory(conversationId, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    
    const messages = await Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'email role');

    return messages.reverse();
  }

  async markAsRead(conversationId, userId) {
    await Message.updateMany(
      { conversationId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );
  }
}

module.exports = new ChatService();