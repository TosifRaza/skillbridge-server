const walletService = require('../services/walletService');
const ApiResponse = require('../utils/ApiResponse');

class WalletController {
  async getWallet(req, res, next) {
    try {
      const data = await walletService.getWallet(req.user.id);
      res.status(200).json(new ApiResponse(200, data, 'Wallet details fetched successfully'));
    } catch (error) {
      next(error);
    }
  }

  async createDepositOrder(req, res, next) {
    try {
      const data = await walletService.createDepositOrder(req.user.id, req.body);
      res.status(201).json(new ApiResponse(201, data, 'Deposit order created successfully'));
    } catch (error) {
      next(error);
    }
  }

  async verifyDeposit(req, res, next) {
    try {
      const data = await walletService.verifyDeposit(req.user.id, req.body);
      res.status(200).json(new ApiResponse(200, data, 'Deposit verified and credited to wallet'));
    } catch (error) {
      next(error);
    }
  }

  async withdraw(req, res, next) {
    try {
      const data = await walletService.withdraw(req.user.id, req.body);
      res.status(200).json(new ApiResponse(200, data, 'Withdrawal completed successfully'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WalletController();
