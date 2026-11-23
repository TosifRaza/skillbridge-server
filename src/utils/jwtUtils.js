const jwt = require('jsonwebtoken');
const config = require('../config');

const generateAccessToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, config.jwtAccessSecret, {
    expiresIn: config.jwtAccessExpiry,
  });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, config.jwtRefreshSecret, {
    expiresIn: config.jwtRefreshExpiry,
  });
};

const verifyToken = (token, secret) => {
  return jwt.verify(token, secret);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
};