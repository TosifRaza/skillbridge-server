const { body } = require('express-validator');
const ApiError = require('../utils/ApiError');

const createReviewValidator = [
  body('job')
    .isMongoId()
    .withMessage('Invalid Job ID format'),
  body('worker')
    .isMongoId()
    .withMessage('Invalid Worker ID format'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be an integer between 1 and 5'),
  body('comment')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Comment cannot exceed 1000 characters'),
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
  createReviewValidator,
  validate,
};