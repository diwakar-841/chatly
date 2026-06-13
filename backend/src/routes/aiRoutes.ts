import { Router } from 'express';
import { aiChat } from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/chat', protect as any, aiChat as any);

export default router;
