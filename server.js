const config = require('./src/config');
const connectDB = require('./src/config/db');
const app = require('./src/app');
const http = require('http');
const initializeSocket = require('./src/sockets');

// Handle Uncaught Exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

// Connect Database
connectDB();

// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.io
const io = initializeSocket(server);

// Make io available throughout the app
app.set('io', io);

// Start Server
const PORT = config.port;

server.listen(PORT, () => {
  console.log(`
============================================
  SkillBridge Server Running
  Environment: ${config.nodeEnv}
  Port: ${PORT}
  API: http://localhost:${PORT}/api/v1
  Socket.io: Ready for connections
============================================
`);
});

// Handle Unhandled Promise Rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! Shutting down...');
  console.error(err);

  server.close(() => {
    process.exit(1);
  });
});