const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const uploadToCloudinary = require('../utils/cloudinaryUpload');

class UserService {
  async updateProfile(userId, updateData) {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');

    // Explicitly set fields to ensure Mongoose marks them as modified
    if (updateData.fullName !== undefined) user.fullName = updateData.fullName;
    if (updateData.phone !== undefined) user.phone = updateData.phone;
    
    // Overwrite arrays entirely (this is the safest way to handle CRUD arrays in Mongoose)
    if (updateData.addresses !== undefined) user.addresses = updateData.addresses;
    if (updateData.paymentMethods !== undefined) user.paymentMethods = updateData.paymentMethods;

    await user.save();
    return user;
  }

  async updateAvatar(userId, file) {
    if (!file) throw new ApiError(400, 'Please upload an image file');

    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');

    // Delete old avatar from Cloudinary if it exists
    if (user.avatar && user.avatar.public_id) {
      const cloudinary = require('../config/cloudinary');
      await cloudinary.uploader.destroy(user.avatar.public_id);
    }

    // Upload new avatar
    const result = await uploadToCloudinary(file.buffer, 'SkillBridge/Avatars');
    
    user.avatar = { url: result.url, public_id: result.public_id };
    await user.save();
    return user;
  }
}

module.exports = new UserService();