import { Router } from 'express';
import {
  getNotifications, markAllRead, markOneRead, getUnreadCount,
  deleteOne, deleteAll,
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', protect, getNotifications);
router.get('/unread-count', protect, getUnreadCount);
router.put('/read-all', protect, markAllRead);
router.put('/read/:id', protect, markOneRead);
router.delete('/clear-all', protect, deleteAll);
router.delete('/:id', protect, deleteOne);

export default router;
