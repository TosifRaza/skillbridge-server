const { Server } = require('socket.io');
const socketAuth = require('./socketAuth');
const socketHandler = require('./socketHandler');

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
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