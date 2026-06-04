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

// Memory storage configuration (already exists)
const storage = multer.memoryStorage();

// File filter (already exists)
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only images are allowed'), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Existing Job Upload (Expects array of files named 'files')
exports.uploadJobImages = upload.array('files', 5);

// ==========================================
// NEW: Avatar Upload (Expects single file named 'avatar')
// ==========================================
exports.uploadAvatar = upload.single('avatar');