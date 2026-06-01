const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../utils/jwtUtils');
const config = require('../config');

class AuthService {
  async register(email, password, role) {
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ApiError(409, 'Email already in use');
    }

    // Create user (password hashing handled by mongoose pre-save hook)
    const user = await User.create({ email, password, role });

    // Generate tokens
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token to DB
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { user, accessToken, refreshToken };
  }

  async login(email, password) {
    // Fetch user with password explicitly
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      throw new ApiError(401, 'Incorrect email or password');
    }

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token to DB
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    // Remove password from returned object
    user.password = undefined;

    return { user, accessToken, refreshToken };
  }

  async refreshAccessToken(incomingRefreshToken) {
    if (!incomingRefreshToken) {
      throw new ApiError(401, 'Refresh token missing');
    }

    // Verify JWT structure
    const decoded = verifyToken(incomingRefreshToken, config.jwtRefreshSecret);
    
    // Find user with this refresh token (prevents token reuse/theft)
    const user = await User.findOne({ _id: decoded.id, refreshToken: incomingRefreshToken }).select('+refreshToken');
    
    if (!user) {
      throw new ApiError(403, 'Invalid or expired refresh token');
    }

    // Rotate refresh token (Security best practice)
    const newAccessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    return { newAccessToken, newRefreshToken };
  }

  async logout(userId) {
    // Clear refresh token in DB
    await User.findByIdAndUpdate(userId, { refreshToken: null });
  }
}

module.exports = new AuthService();