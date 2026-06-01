const express = require('express');
const config = require('./config');
const security = require('./middlewares/securityMiddleware');
const loggerMiddleware = require('./middlewares/loggerMiddleware');
const { errorConverter, errorHandler } = require('./middlewares/errorMiddleware');
const routes = require('./routes');
const cookieParser = require('cookie-parser'); // <-- ADD IMPORT
const app = express();

// ========== SECURITY MIDDLEWARE ==========
app.use(security.helmet);
app.use(security.cors);
app.use(security.rateLimiter);

// ========== PARSER MIDDLEWARE ==========
app.use(express.json({ limit: '10kb' })); // Body limit to prevent oversized payloads
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // <-- ADD THIS LINE

// ========== SANITIZATION MIDDLEWARE ==========
app.use(security.mongoSanitize);
app.use(security.xssSanitize);

// ========== LOGGING MIDDLEWARE ==========
if (config.nodeEnv !== 'test') {
  app.use(loggerMiddleware);
}

// ========== API ROUTES ==========
app.use('/api/v1', routes);

// ========== 404 HANDLER ==========
// If no route is matched
app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
});

// ========== GLOBAL ERROR HANDLERS ==========
app.use(errorConverter);
app.use(errorHandler);

module.exports = app;

