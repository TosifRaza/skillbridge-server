const { body } = require('express-validator');
const ApiError = require('../utils/ApiError');

const createApplicationValidator = [
  body('job')
    .isMongoId()
    .withMessage('Invalid Job ID format'),
  body('proposalMessage')
    .notEmpty()
    .withMessage('Proposal message is required')
    .isLength({ max: 2000 })
    .withMessage('Proposal cannot exceed 2000 characters'),
  body('bidAmount')
    .isNumeric()
    .withMessage('Bid amount must be a number')
    .isFloat({ min: 0 })
    .withMessage('Bid amount cannot be negative'),
  body('estimatedCompletionTime')
    .notEmpty()
    .withMessage('Estimated completion time is required'),
];

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
  createApplicationValidator,
  validate,
};