const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { xss } = require('express-xss-sanitizer');
const config = require('../config');

// Custom MongoDB Sanitizer to replace the buggy express-mongo-sanitize
const customMongoSanitize = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    for (const key in obj) {
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key]; // Remove NoSQL injection operators
      } else if (typeof obj[key] === 'object') {
        sanitize(obj[key]); // Recursively check nested objects
      }
    }
  };
  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);
  next();
};

const securityMiddleware = {
  // Sets HTTP headers for security
  helmet: helmet(),

  // Cross-Origin Resource Sharing
  cors: cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (Postman, curl, server-to-server)
      if (!origin) return callback(null, true);
      // Allow the configured app, local development, and Render hosted frontends.
      if (
        origin.startsWith('http://localhost:') ||
        origin.startsWith('https://localhost:') ||
        origin.endsWith('.onrender.com') ||
        origin === config.clientUrl
      ) {
        return callback(null, true);
      }
      return callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: true,
  }),

  // Rate limiting to prevent brute force/DDoS attacks
  rateLimiter: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    // The app uses several authenticated reads and cross-portal status refreshes.
    // Keep a generous general limit; brute-force protection is scoped below to auth.
    limit: 600,
    message: {
      success: false,
      message: 'This device has made too many requests. Please slow down and try again shortly.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  authRateLimiter: rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    skipSuccessfulRequests: true,
    message: {
      success: false,
      message: 'Too many sign-in attempts. Please wait before trying again.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Data sanitization against NoSQL query injection (Custom)
  mongoSanitize: customMongoSanitize,

  // Data sanitization against XSS
  xssSanitize: xss(),
};

module.exports = securityMiddleware;
