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
    if (updateData.skills !== undefined && user.role === 'provider') {
      if (!Array.isArray(updateData.skills)) throw new ApiError(400, 'Skills must be an array');
      user.skills = [...new Set(updateData.skills
        .filter((skill) => typeof skill === 'string')
        .map((skill) => skill.trim())
        .filter(Boolean))].slice(0, 12);
    }
    
    // Overwrite arrays entirely (this is the safest way to handle CRUD arrays in Mongoose)
    if (updateData.addresses !== undefined) user.addresses = updateData.addresses;
    if (updateData.paymentMethods !== undefined) user.paymentMethods = updateData.paymentMethods;

    if (updateData.payoutDetails !== undefined) {
      user.payoutDetails = {
        accountHolderName: updateData.payoutDetails.accountHolderName || '',
        bankName: updateData.payoutDetails.bankName || '',
        accountNumber: updateData.payoutDetails.accountNumber || '',
        ifscCode: updateData.payoutDetails.ifscCode || '',
        upiId: updateData.payoutDetails.upiId || '',
      };
      if (updateData.payoutDetails.accountNumber || updateData.payoutDetails.upiId) {
        user.payoutStatus = 'Active';
        if (!user.razorpayLinkedAccountId) {
          user.razorpayLinkedAccountId = `acc_${user._id.toString().slice(-14)}`;
        }
      }
    }

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

  async getWorkers() {
    return await User.find({ role: 'provider' })
      .select('email fullName phone skills avatar addresses averageRating totalReviews verificationStatus createdAt')
      .limit(10);
  }

  async getWorkerProfile(workerId) {
    const worker = await User.findOne({ _id: workerId, role: 'provider' })
      .select('email fullName phone skills avatar addresses averageRating totalReviews verificationStatus createdAt');
    if (!worker) throw new ApiError(404, 'Worker profile not found');
    return worker;
  }
}

module.exports = new UserService();
