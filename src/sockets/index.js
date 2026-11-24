const { Server } = require('socket.io');
const socketAuth = require('./socketAuth');
const socketHandler = require('./socketHandler');

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (origin.startsWith('http://localhost:') || origin.endsWith('.onrender.com')) {
          return callback(null, true);
        }
        return callback(null, true);
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