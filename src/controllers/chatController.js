// const ChatService = require('../services/chatService');
// const ApiResponse = require('../utils/ApiResponse');
// const ApiError = require('../utils/ApiError');
// const uploadToCloudinary = require('../utils/cloudinaryUpload');
// const Job = require('../models/Job');
// const Application = require('../models/Application');

// class ChatController {
//   /**
//    * @route GET /api/v1/chat/:conversationId
//    * @desc Get chat history
//    */
//   async getChatHistory(req, res, next) {
//     try {
//       const messages = await ChatService.getChatHistory(req.params.conversationId, req.query.page);
//       res.status(200).json(new ApiResponse(200, messages, 'Chat history fetched successfully'));
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * @route POST /api/v1/chat/upload-image
//    * @desc Upload an image for chat
//    */
//     async uploadChatImage(req, res, next) {
//     try {
//       // FIX: Use req.file (singular) because we now use upload.single()
//       if (!req.file) throw new ApiError(400, 'Please upload an image file');
//       const result = await ChatService.uploadImage(req.file.buffer);
//       res.status(200).json({ status: 'success', data: { url: result.url } });
//       // const result = await uploadToCloudinary(req.file.buffer, 'SkillBridge/Chat');
//       // res.status(200).json(new ApiResponse(200, { url: result.url }, 'Image uploaded successfully'));
//     } catch (error) {
//       next(error);
//     }
//   }
//   /**
//    * @route GET /api/v1/chat/conversations
//    * @desc Get list of chat rooms for the logged-in user
//    */
//   async getConversations(req, res, next) {
//     try {
//       let conversations = [];

//       if (req.user.role === 'customer') {
//         // Customers chat in rooms related to their posted jobs
//         const jobs = await Job.find({ customer: req.user.id }).sort({ updatedAt: -1 });
//         conversations = jobs.map(job => ({
//           _id: job._id,
//           conversationId: `job_${job._id}`,
//           title: job.title,
//           category: job.category,
//           status: job.status
//         }));
//       } else if (req.user.role === 'provider') {
//         // Providers chat in rooms related to jobs they applied to
//         const applications = await Application.find({ worker: req.user.id })
//           .populate('job', 'title category status')
//           .sort({ updatedAt: -1 });
          
//         conversations = applications.map(app => ({
//           _id: app.job._id,
//           conversationId: `job_${app.job._id}`,
//           title: app.job.title,
//           category: app.job.category,
//           status: app.job.status
//         }));
//       }

//       res.status(200).json(new ApiResponse(200, conversations, 'Conversations fetched successfully'));
//     } catch (error) {
//       next(error);
//     }
//   }
// }

// module.exports = new ChatController();



// // import { useEffect, useState } from 'react';
// // import { io } from 'socket.io-client';
// // import { useSelector } from 'react-redux';

// // const SOCKET_SERVER_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// // export const useSocket = () => {
// //   const [socket, setSocket] = useState(null);
// //   const { user, token } = useSelector((state) => state.auth);

// //   useEffect(() => {
// //     if (token && user) {
// //       const newSocket = io(SOCKET_SERVER_URL, {
// //         auth: { token },
// //         transports: ['websocket', 'polling'],
// //       });

// //       newSocket.on('connect', () => console.log('⚡ Socket Connected:', newSocket.id));
// //       newSocket.on('disconnect', () => console.log('🔌 Socket Disconnected'));

// //       setSocket(newSocket);

// //       return () => {
// //         newSocket.close();
// //         setSocket(null);
// //       };
// //     }
// //   }, [token, user]);

// //   return socket;
// // };



const ChatService = require('../services/chatService');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const config = require('../config');
const crypto = require('crypto');

class ChatController {
  async getIceServers(req, res, next) {
    try {
      const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
      if (config.turnUrls.length && config.turnSharedSecret) {
        const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
        const username = `${expiresAt}:${req.user.id}`;
        const credential = crypto.createHmac('sha1', config.turnSharedSecret).update(username).digest('base64');
        iceServers.push({ urls: config.turnUrls, username, credential });
      }
      res.status(200).json(new ApiResponse(200, { iceServers }, 'Call network configuration fetched'));
    } catch (error) {
      next(error);
    }
  }

  async getChatHistory(req, res, next) {
    try {
      await ChatService.requireParticipant(req.params.conversationId, req.user.id);
      await ChatService.markAsRead(req.params.conversationId, req.user.id);
      const messages = await ChatService.getChatHistory(req.params.conversationId, req.query.page);
      res.status(200).json(new ApiResponse(200, messages, 'Chat history fetched successfully'));
    } catch (error) {
      next(error);
    }
  }

  async sendDocument(req, res, next) {
    try {
      const { conversationId } = req.params;
      const message = await ChatService.sendDocument(conversationId, req.user.id, req.file, req.body?.text);
      req.app.get('io')?.to(conversationId).emit('receive-message', message);
      res.status(201).json(new ApiResponse(201, message, 'File sent'));
    } catch (error) {
      next(error);
    }
  }

  async getDocument(req, res, next) {
    try {
      const attachment = await ChatService.getDocument(req.params.conversationId, req.user.id, req.params.messageId);
      res.attachment(attachment.name).type('application/pdf').set('Cache-Control', 'private, no-store').send(attachment.data);
    } catch (error) {
      next(error);
    }
  }

  async uploadChatImage(req, res, next) {
    try {
      if (!req.file) throw new ApiError(400, 'Please upload an image file');
      
      // FIX: Call the newly added service method
      const result = await ChatService.uploadImage(req.file.buffer);
      
      // FIX: Use standardized ApiResponse
      res.status(200).json(new ApiResponse(200, { url: result.url }, 'Image uploaded successfully'));
    } catch (error) {
      next(error);
    }
  }

  async getConversations(req, res, next) {
    try {
      const conversations = await ChatService.getConversations(req.user.id);
      res.status(200).json(new ApiResponse(200, conversations, 'Conversations fetched successfully'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ChatController();
