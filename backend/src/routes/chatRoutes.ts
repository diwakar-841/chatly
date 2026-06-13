import { Router } from 'express';
import { body } from 'express-validator';
import {
  getDM, getUserChats, getChatById, createGroup, updateGroup,
  addMembers, removeMember, getMessages,
  leaveGroup, togglePinMessage,
  requestJoinGroup, getJoinRequests, handleJoinRequest,
  acceptGroupInvite, rejectGroupInvite, getMyGroupInvites,
  searchGroups, hideChatForMe,
} from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js';
import { imageUpload } from '../middleware/uploadMiddleware.js';
import { createGroupValidation } from '../utils/validators.js';
import validate from '../middleware/validateMiddleware.js';

const router = Router();

router.get('/', protect, getUserChats);
router.get('/search', protect, searchGroups);
router.get('/dm/:userId', protect, getDM);
router.get('/invites', protect, getMyGroupInvites);
router.post('/group', protect, imageUpload.single('file'), createGroupValidation, validate, createGroup);
router.get('/:chatId', protect, getChatById);
router.delete('/:chatId/hide', protect, hideChatForMe);
router.put('/:chatId', protect, imageUpload.single('file'), updateGroup);
router.post(
  '/:chatId/members',
  protect,
  [
    body('members').isArray({ min: 1 }).withMessage('members must be a non-empty array'),
    body('members.*').isMongoId().withMessage('Invalid member id'),
  ],
  validate,
  addMembers
);
router.delete('/:chatId/members/:memberId', protect, removeMember);
router.get('/:chatId/messages', protect, getMessages);
router.post('/:chatId/leave', protect, leaveGroup);
router.patch('/:chatId/pin/:messageId', protect, togglePinMessage);
router.post('/:chatId/join-request', protect, requestJoinGroup);
router.get('/:chatId/join-requests', protect, getJoinRequests);
router.post(
  '/:chatId/join-requests/:userId',
  protect,
  [body('action').isIn(['accept', 'reject']).withMessage('action must be accept or reject')],
  validate,
  handleJoinRequest
);
router.post('/:chatId/invite/accept', protect, acceptGroupInvite);
router.post('/:chatId/invite/reject', protect, rejectGroupInvite);

export default router;
