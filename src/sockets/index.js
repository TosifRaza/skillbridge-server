const { Server } = require('socket.io');
const socketAuth = require('./socketAuth');
const socketHandler = require('./socketHandler');
const config = require('../config');
const isAllowedClientOrigin = require('../utils/isAllowedClientOrigin');

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        const isAllowed = isAllowedClientOrigin(origin, config.clientUrl);
        return callback(
          isAllowed ? null : new Error('Origin is not allowed by CORS'),
          isAllowed
        );
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Apply JWT authentication middleware
  io.use(socketAuth);

  // Register event handlers
  socketHandler(io);

  return io;
};

module.exports = initializeSocket;
