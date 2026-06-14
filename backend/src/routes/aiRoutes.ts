import { Router } from 'express';
import { aiChat } from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/chat', protect, aiChat);

export default router;
