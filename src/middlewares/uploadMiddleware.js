const multer = require('multer');

// Store files in memory as Buffer
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit per file
});

// Middleware to handle multiple image uploads for Jobs (max 5 images)
exports.uploadJobImages = upload.array('images', 5);