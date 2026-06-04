const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

const socketAuth = async (socket, next) => {
  try {
    // Client sends token in handshake auth object
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    const decoded = jwt.verify(token, config.jwtAccessSecret);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }
    // ✅ ADD THIS after the user check:
    if (user.isBlocked) {
    return next(new Error('Account is blocked'));
    }

    // Attach user to socket object for use in event handlers
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
};

module.exports = socketAuth;