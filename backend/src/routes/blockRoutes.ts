import { Router } from 'express';
import { blockUser, unblockUser, getBlockedUsers, checkBlock } from '../controllers/blockController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/check/:userId', protect, checkBlock);
router.post('/:userId', protect, blockUser);
router.delete('/:userId', protect, unblockUser);
router.get('/', protect, getBlockedUsers);

export default router;
