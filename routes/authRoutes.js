const express = require('express');
const router = express.Router();
const {
  registerUser,
  createProfile,
  loginUser,
  logoutUser,
  // logoutAllDevices,
  getSessionStatus,
  forgotPassword,
  verifyOTP,
  resetPassword,
  resendOTP,
  verifyEmailOTP,
  resendEmailVerification,
  changePassword,
  getUserProfile,
  updateUserProfile
} = require('../controllers/authController');
const protect = require('../middleware/authMiddleware');

router.post('/user/register', registerUser);
router.post('/user/create-profile', protect, createProfile);
router.post('/user/login', loginUser);
router.post('/user/logout', protect, logoutUser);
// router.post('/user/logout-all-devices', protect, logoutAllDevices);
router.get('/user/session-status', protect, getSessionStatus);
router.post('/user/forgot-password', forgotPassword);
router.post('/user/verify-otp', verifyOTP);
router.post('/user/reset-password', resetPassword);
router.post('/user/resend-otp', resendOTP);
router.post('/user/verify-email', verifyEmailOTP);
router.post('/user/resend-email-verification', resendEmailVerification);
router.put('/user/change-password', protect, changePassword);
router.get('/user/profile', protect, getUserProfile);
router.put('/user/update-profile', protect, updateUserProfile);

module.exports = router;
