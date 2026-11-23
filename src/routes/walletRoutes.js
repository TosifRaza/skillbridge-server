const express = require('express');
const walletController = require('../controllers/walletController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/me', protect, walletController.getWallet);
router.post('/create-deposit-order', protect, walletController.createDepositOrder);
router.post('/verify-deposit', protect, walletController.verifyDeposit);
router.post('/withdraw', protect, walletController.withdraw);

module.exports = router;
