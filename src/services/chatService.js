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
    const currentUserId = new mongoose.Types.ObjectId(userId);
    const userJobs = await Job.find({
      $or: [{ customer: currentUserId }, { hiredProvider: currentUserId }],
      status: { $in: ['Assigned', 'In-Progress', 'Completed'] },
    })
      .select('title category status customer hiredProvider budget deadline location serviceType updatedAt')
      .populate('customer', 'fullName email avatar')
      .populate('hiredProvider', 'fullName email avatar')
      .sort({ updatedAt: -1 });

    if (!userJobs.length) return [];

    const jobConversationIds = userJobs.map((job) => `job_${job._id}`);
    const messageGroups = await Message.aggregate([
      { $match: { conversationId: { $in: jobConversationIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$sender', currentUserId] },
                    { $eq: [{ $in: [currentUserId, { $ifNull: ['$readBy', []] }] }, false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);
    const messagesByConversation = new Map(messageGroups.map((group) => [group._id, group]));

    return userJobs.map((job) => {
      const conversationId = `job_${job._id}`;
      const messages = messagesByConversation.get(conversationId);
      const isCustomer = job.customer?._id?.toString() === currentUserId.toString();
      const otherParticipant = isCustomer ? job.hiredProvider : job.customer;

      return {
        _id: job._id,
        conversationId,
        title: job.title,
        category: job.category,
        status: job.status,
        budget: job.budget,
        deadline: job.deadline,
        location: job.location,
        serviceType: job.serviceType,
        participant: otherParticipant ? {
          _id: otherParticipant._id,
          fullName: otherParticipant.fullName,
          email: otherParticipant.email,
          avatar: otherParticipant.avatar,
        } : null,
        lastMessage: messages?.lastMessage || null,
        unreadCount: messages?.unreadCount || 0,
      };
    }).sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
  }

  async getCallParticipant(conversationId, userId) {
    const jobId = conversationId?.startsWith('job_') ? conversationId.slice(4) : '';
    if (!mongoose.Types.ObjectId.isValid(jobId)) return null;

    const job = await Job.findById(jobId).select('customer hiredProvider');
    if (!job) return null;

    const currentUserId = userId.toString();
    if (job.customer?.toString() === currentUserId) return job.hiredProvider?.toString() || null;
    if (job.hiredProvider?.toString() === currentUserId) return job.customer?.toString() || null;
    return null;
  }

  async createMessage(conversationId, senderId, text, imageUrl = null, imageUrls = []) {
    const attachments = [...new Set([...(imageUrls || []), ...(imageUrl ? [imageUrl] : [])])];
    if (!text && attachments.length === 0) {
      throw new ApiError(400, 'Message must contain text or an image');
    }

    const message = await Message.create({
      conversationId,
      sender: senderId,
      text,
      imageUrl: attachments[0] || null,
      imageUrls: attachments,
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
