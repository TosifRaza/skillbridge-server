const UserService = require('../services/userService');
const ApiResponse = require('../utils/ApiResponse');

class UserController {
  async updateProfile(req, res, next) {
    try {
      const user = await UserService.updateProfile(req.user.id, req.body);
      res.status(200).json(new ApiResponse(200, user, 'Profile updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  async updateAvatar(req, res, next) {
    try {
      // FIX: Changed from req.files to req.file because we use upload.single()
      const user = await UserService.updateAvatar(req.user.id, req.file);
      res.status(200).json(new ApiResponse(200, user, 'Avatar updated successfully'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();