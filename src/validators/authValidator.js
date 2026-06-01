const { body } = require('express-validator');
const ApiError = require('../utils/ApiError');

const registerValidator = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/\d/)
    .withMessage('Password must contain a number'),
  body('role')
    .optional()
    .isIn(['customer', 'provider'])
    .withMessage('Invalid role specified. Must be customer or provider'),
];

const loginValidator = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

// Middleware to handle validation errors
const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors.array().map(err => err.msg).join(', ');
    return next(new ApiError(400, message));
  }
  next();
};

module.exports = {
  registerValidator,
  loginValidator,
  validate,
};