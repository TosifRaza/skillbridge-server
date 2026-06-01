const cloudinary = require('../config/cloudinary');

const uploadToCloudinary = (fileBuffer, folderName = 'SkillBridge/Jobs') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: folderName, resource_type: 'auto' },
      (error, result) => {
        if (error) {
          return reject(new Error('Cloudinary upload failed'));
        }
        resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    uploadStream.end(fileBuffer);
  });
};

module.exports = uploadToCloudinary;