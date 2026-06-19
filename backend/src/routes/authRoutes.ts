import { Router } from 'express';
import {
  register, login, refreshToken, logout, logoutAll,
  forgotPassword, resetPassword, getMe, verifyEmail, resendVerification,
} from '../controllers/authController.js';
import { updatePublicKey, getUserPublicKey } from '../controllers/e2eController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimitMiddleware.js';
import { registerValidation, loginValidation } from '../utils/validators.js';
import validate from '../middleware/validateMiddleware.js';

const router = Router();

router.post('/register', authLimiter, registerValidation, validate, register);
router.post('/login', authLimiter, loginValidation, validate, login);
router.post('/refresh-token', authLimiter, refreshToken);
router.post('/logout', protect, logout);
router.post('/logout-all', protect, logoutAll);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password/:token', authLimiter, resetPassword);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', protect, resendVerification);
router.get('/me', protect, getMe);

/** E2E encryption key management */
router.put('/public-key', protect, updatePublicKey);
router.get('/public-key/:userId', protect, getUserPublicKey);

export default router;
