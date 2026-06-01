// const AuthService = require('../services/authService');
// const ApiResponse = require('../utils/ApiResponse');
// const ApiError = require('../utils/ApiError');

// class AuthController {
//   /**
//    * @route POST /api/v1/auth/register
//    * @desc Register a new user (Customer or Provider)
//    */
//   async register(req, res, next) => {
//     try {
//       const { email, password, role } = req.body;
//       const { user, accessToken, refreshToken } = await AuthService.register(email, password, role);

//       // Set HttpOnly cookie for Refresh Token
//       res.cookie('refreshToken', refreshToken, {
//         httpOnly: true,
//         secure: process.env.NODE_ENV === 'production',
//         maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
//       });

//       res.status(201).json(new ApiResponse(201, { user, accessToken, refreshToken }, 'User registered successfully'));
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * @route POST /api/v1/auth/login
//    * @desc Login user
//    */
//   async login(req, res, next) => {
//     try {
//       const { email, password } = req.body;
//       const { user, accessToken, refreshToken } = await AuthService.login(email, password);

//       res.cookie('refreshToken', refreshToken, {
//         httpOnly: true,
//         secure: process.env.NODE_ENV === 'production',
//         maxAge: 7 * 24 * 60 * 60 * 1000,
//       });

//       res.status(200).json(new ApiResponse(200, { user, accessToken, refreshToken }, 'Logged in successfully'));
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * @route POST /api/v1/auth/refresh
//    * @desc Refresh Access Token
//    */
//   async refreshAccessToken(req, res, next) {
//     try {
//       const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
//       const { newAccessToken, newRefreshToken } = await AuthService.refreshAccessToken(incomingRefreshToken);

//       res.cookie('refreshToken', newRefreshToken, {
//         httpOnly: true,
//         secure: process.env.NODE_ENV === 'production',
//         maxAge: 7 * 24 * 60 * 60 * 1000,
//       });

//       res.status(200).json(new ApiResponse(200, { accessToken: newAccessToken }, 'Token refreshed successfully'));
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * @route POST /api/v1/auth/logout
//    * @desc Logout user & clear cookies
//    */
//   async logout(req, res, next) => {
//     try {
//       await AuthService.logout(req.user.id);

//       res.clearCookie('refreshToken');
//       res.status(200).json(new ApiResponse(200, null, 'Logged out successfully'));
//     } catch (error) {
//       next(error);
//     }
//   }
// }

// module.exports = new AuthController();
const AuthService = require('../services/authService');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');

class AuthController {
  /**
   * @route POST /api/v1/auth/register
   * @desc Register a new user (Customer or Provider)
   */
  async register(req, res, next) {
    try {
      const { email, password, role } = req.body;
      const { user, accessToken, refreshToken } =
        await AuthService.register(email, password, role);

      // Set HttpOnly cookie for Refresh Token
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res
        .status(201)
        .json(
          new ApiResponse(
            201,
            { user, accessToken, refreshToken },
            'User registered successfully'
          )
        );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route POST /api/v1/auth/login
   * @desc Login user
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const { user, accessToken, refreshToken } =
        await AuthService.login(email, password);

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { user, accessToken, refreshToken },
            'Logged in successfully'
          )
        );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route POST /api/v1/auth/refresh
   * @desc Refresh Access Token
   */
  async refreshAccessToken(req, res, next) {
    try {
      const incomingRefreshToken =
        req.cookies.refreshToken || req.body.refreshToken;

      const { newAccessToken, newRefreshToken } =
        await AuthService.refreshAccessToken(incomingRefreshToken);

      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { accessToken: newAccessToken },
            'Token refreshed successfully'
          )
        );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route POST /api/v1/auth/logout
   * @desc Logout user & clear cookies
   */
  async logout(req, res, next) {
    try {
      await AuthService.logout(req.user.id);

      res.clearCookie('refreshToken');
      res
        .status(200)
        .json(new ApiResponse(200, null, 'Logged out successfully'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();