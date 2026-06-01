// const jwt = require('jsonwebtoken');
// const User = require('../models/User');
// const ApiError = require('../utils/ApiError');
// const config = require('../config');

// // Verifies Access Token
// exports.protect = async (req, res, next) => {
//   try {
//     let token;
//     if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
//       token = req.headers.authorization.split(' ')[1];
//     }

//     if (!token) {
//       return next(new ApiError(401, 'Not authorized to access this route'));
//     }

//     const decoded = jwt.verify(token, config.jwtAccessSecret);
//     const user = await User.findById(decoded.id);

//     if (!user) {
//       return next(new ApiError(401, 'User belonging to this token no longer exists'));
//     }

//     req.user = user;
//     next();
//   } catch (error) {
//     return next(new ApiError(401, 'Not authorized to access this route'));
//   }
// };

// // Role-Based Access Control
// exports.authorize = (...roles) => {
//   return (req, res, next) => {
//     if (!roles.includes(req.user.role)) {
//       return next(new ApiError(403, `User role '${req.user.role}' is not authorized to access this route`));
//     }
//     next();
//   };
// };


const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const config = require('../config');

// ============================================
// Protect Routes - Verify JWT Access Token
// ============================================
exports.protect = async (req, res, next) => {
   console.log("AUTH HEADER RECEIVED:", req.headers.authorization);
  try {
    let token;

    // Get token from Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return next(
        new ApiError(401, 'Not authorized to access this route')
      );
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwtAccessSecret);

    // Find user from token payload
    const user = await User.findById(decoded.id);

    // Check if user still exists
    if (!user) {
      return next(
        new ApiError(
          401,
          'User belonging to this token no longer exists'
        )
      );
    }

    // ============================================
    // NEW CODE ADDED
    // Check if user account is blocked
    // ============================================
    if (user.isBlocked) {
      return next(
        new ApiError(
          403,
          'Your account has been suspended. Please contact support.'
        )
      );
    }

    // Attach user to request object
    req.user = user;

    next();
    } catch (error) {
    // Debug mode: Show us the REAL reason the token failed
    return next(new ApiError(401, `Not authorized: ${error.message}`));
  }
};

// ============================================
// Role-Based Access Control
// ============================================
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `User role '${req.user.role}' is not authorized to access this route`
        )
      );
    }

    next();
  };
};