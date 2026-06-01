const { body, query } = require('express-validator');
const ApiError = require('../utils/ApiError');

const createJobValidator = [
  body('title').notEmpty().withMessage('Title is required').isLength({ max: 100 }),
  body('description').notEmpty().withMessage('Description is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('budget').isNumeric().withMessage('Budget must be a number').notEmpty(),
  body('deadline').isISO8601().withMessage('Invalid deadline date format').notEmpty(),
  body('address').notEmpty().withMessage('Address is required'),
  body('longitude').isNumeric().withMessage('Longitude must be a number').notEmpty(),
  body('latitude').isNumeric().withMessage('Latitude must be a number').notEmpty(),
];

const updateJobValidator = [
  body('title').optional().isLength({ max: 100 }),
  body('description').optional().isLength({ max: 2000 }),
  body('budget').optional().isNumeric(),
  body('deadline').optional().isISO8601(),
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
  createJobValidator,
  updateJobValidator,
  validate,
};