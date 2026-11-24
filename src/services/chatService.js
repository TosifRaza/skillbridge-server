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
      .select('title category status customer hiredProvider budget deadline location serviceType workSubmittedAt updatedAt')
      .populate('customer', 'fullName email avatar')
      .populate('hiredProvider', 'fullName email avatar')
      .sort({ updatedAt: -1 });

    if (!userJobs.length) return [];

    const jobConversationIds = userJobs.map((job) => `job_${job._id}`);
    const messageGroups = await Message.aggregate([
      { $match: { conversationId: { $in: jobConversationIds } } },
      { $unset: 'attachment.data' },
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
        workSubmittedAt: job.workSubmittedAt,
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
    const jobId = typeof conversationId === 'string' && conversationId.startsWith('job_') ? conversationId.slice(4) : '';
    if (!mongoose.Types.ObjectId.isValid(jobId)) return null;

    const job = await Job.findById(jobId).select('customer hiredProvider');
    if (!job) return null;

    const currentUserId = userId.toString();
    if (job.customer?.toString() === currentUserId) return job.hiredProvider?.toString() || null;
    if (job.hiredProvider?.toString() === currentUserId) return job.customer?.toString() || null;
    return null;
  }

  async requireParticipant(conversationId, userId) {
    const peerId = await this.getCallParticipant(conversationId, userId);
    if (!peerId) throw new ApiError(403, 'You are not a participant in this project conversation');
    return peerId;
  }

  async sendDocument(conversationId, userId, file, text) {
    await this.requireParticipant(conversationId, userId);
    if (!file?.buffer?.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new ApiError(400, 'Choose a PDF file.');
    }
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/\.pdf$/i, '').trim();
    const message = await Message.create({
      conversationId,
      sender: userId,
      text: typeof text === 'string' ? text.trim() : '',
      attachment: { name: `${cleanName.slice(0, 100) || 'document'}.pdf`, size: file.size, data: file.buffer },
      readBy: [userId],
    });

    const result = message.toObject();
    delete result.attachment.data;
    return result;
  }

  async getDocument(conversationId, userId, messageId) {
    await this.requireParticipant(conversationId, userId);
    if (!mongoose.Types.ObjectId.isValid(messageId)) throw new ApiError(404, 'File not found');
    const message = await Message.findOne({ _id: messageId, conversationId }).select('+attachment.data');
    if (!message?.attachment?.data) throw new ApiError(404, 'File not found');
    return message.attachment;
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

  async createCallLog(conversationId, callerId, { callId, callType }) {
    const peerId = await this.getCallParticipant(conversationId, callerId);
    if (!peerId) throw new ApiError(403, 'You are not a participant in this project conversation');

    const existing = await Message.findOne({ 'call.callId': callId });
    if (existing) return existing.populate('sender', 'email role fullName avatar');

    const message = await Message.create({
      conversationId,
      sender: callerId,
      type: 'call',
      call: {
        callId,
        callType,
        status: 'ringing',
        startedAt: new Date(),
        durationSeconds: 0,
      },
      readBy: [callerId],
    });
    await message.populate('sender', 'email role fullName avatar');
    return message;
  }

  async updateCallLog(conversationId, callId, actorId, action, reason = '') {
    const peerId = await this.getCallParticipant(conversationId, actorId);
    if (!peerId) throw new ApiError(403, 'You are not a participant in this project conversation');

    const message = await Message.findOne({ conversationId, 'call.callId': callId, type: 'call' });
    if (!message) throw new ApiError(404, 'Call record not found');

    const callerId = message.sender.toString();
    const currentStatus = message.call.status;
    if (message.call.endedAt) return message.populate('sender', 'email role fullName avatar');

    if (action === 'answer') {
      if (callerId === actorId.toString()) throw new ApiError(403, 'Only the receiving participant can answer this call');
      if (currentStatus === 'ringing') {
        message.call.answeredAt = new Date();
        message.call.status = 'ongoing';
      }
    } else if (action === 'decline') {
      if (callerId === actorId.toString()) throw new ApiError(403, 'Only the receiving participant can decline this call');
      message.call.endedAt = new Date();
      message.call.status = 'declined';
      message.call.durationSeconds = 0;
    } else if (action === 'end') {
      message.call.endedAt = new Date();
      if (message.call.answeredAt) {
        message.call.status = 'completed';
        message.call.durationSeconds = Math.max(0, Math.floor((message.call.endedAt - message.call.answeredAt) / 1000));
      } else {
        message.call.status = reason === 'cancelled' ? 'cancelled' : 'missed';
        message.call.durationSeconds = 0;
      }
    } else {
      throw new ApiError(400, 'Unknown call update');
    }

    await message.save();
    await message.populate('sender', 'email role fullName avatar');
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
