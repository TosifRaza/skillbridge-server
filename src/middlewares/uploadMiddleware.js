// const multer = require('multer');

// // Store files in memory as Buffer
// const storage = multer.memoryStorage();

// const fileFilter = (req, file, cb) => {
//   if (file.mimetype.startsWith('image/')) {
//     cb(null, true);
//   } else {
//     cb(new Error('Only image files are allowed!'), false);
//   }
// };

// const upload = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit per file
// });

// // Middleware to handle multiple image uploads for Jobs (max 5 images)
// exports.uploadJobImages = upload.array('images', 5);




const multer = require('multer');
const ApiError = require('../utils/ApiError');

const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only images are allowed'), false);
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

exports.uploadJobImages = upload.array('files', 5);

// NEW: Single file upload for Chat Images
exports.uploadChatImage = upload.single('image'); // Expects field name 'image'

// FIX: Added missing uploadAvatar export for Profile Pictures
exports.uploadAvatar = upload.single('avatar');