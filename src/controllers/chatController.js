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
const Job = require('../models/Job');
const Application = require('../models/Application');

class ChatController {
  async getChatHistory(req, res, next) {
    try {
      const messages = await ChatService.getChatHistory(req.params.conversationId, req.query.page);
      res.status(200).json(new ApiResponse(200, messages, 'Chat history fetched successfully'));
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
      let conversations = [];

      if (req.user.role === 'customer') {
        // Customers chat in rooms related to their posted jobs
        const jobs = await Job.find({ customer: req.user.id }).sort({ updatedAt: -1 });
        conversations = jobs.map(job => ({
          _id: job._id,
          conversationId: `job_${job._id}`,
          title: job.title,
          category: job.category,
          status: job.status
        }));
      } else if (req.user.role === 'provider') {
        // FIX: Only fetch ACCEPTED applications. Workers shouldn't chat about rejected jobs.
        const applications = await Application.find({ 
          worker: req.user.id, 
          status: 'Accepted' // <--- FIX: Filter by accepted applications only
        })
          .populate('job', 'title category status')
          .sort({ updatedAt: -1 });
          
        conversations = applications.map(app => ({
          _id: app._id,
          conversationId: `job_${app.job?._id}`, // FIX: Safe navigation in case job was deleted
          title: app.job?.title || 'Deleted Job', // FIX: Safe navigation
          category: app.job?.category || 'N/A',
          status: app.job?.status || 'N/A'
        })).filter(convo => convo.conversationId); // FIX: Filter out any nulls if job was deleted
      }

      res.status(200).json(new ApiResponse(200, conversations, 'Conversations fetched successfully'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ChatController();