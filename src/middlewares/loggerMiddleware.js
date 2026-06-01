const morgan = require('morgan');
const config = require('../config');

const loggerMiddleware = morgan(
  config.nodeEnv === 'development' ? 'dev' : 'combined'
);

module.exports = loggerMiddleware;