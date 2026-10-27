import { Router, Request, Response, NextFunction } from "express";
import { body } from "express-validator";
import {
  getDM,
  getUserChats,
  getChatById,
  createGroup,
  updateGroup,
  addMembers,
  removeMember,
  getMessages,
  leaveGroup,
  togglePinMessage,
  requestJoinGroup,
  getJoinRequests,
  handleJoinRequest,
  acceptGroupInvite,
  rejectGroupInvite,
  getMyGroupInvites,
  searchGroups,
  hideChatForMe,
  setDisappearingMessages,
} from "../controllers/chatController.js";
import { protect } from "../middleware/authMiddleware.js";
import { imageUpload } from "../middleware/uploadMiddleware.js";
import {
  createGroupValidation,
  updateGroupValidation,
  disappearingMessagesValidation,
  mongoIdParam,
} from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";

const router = Router();

/**
 * `members` arrives in several shapes on a multipart request:
 *  - repeated field, 2+ users  -> array
 *  - repeated field, 1 user    -> plain string (multer only builds an array for 2+)
 *  - JSON string               -> '["id1","id2"]'
 * Normalise all of them to string[] before validation runs.
 */
const normalizeMembers = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const raw = (req.body as { members?: unknown } | undefined)?.members;
  if (raw === undefined || Array.isArray(raw)) {
    return next();
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          (req.body as { members: unknown }).members = parsed;
          return next();
        }
      } catch {
        // fall through: leave the value as-is so validation reports it
      }
      return next();
    }
    (req.body as { members: unknown }).members = trimmed ? [trimmed] : [];
  }
  next();
};

router.get("/", protect, getUserChats);
router.get("/search", protect, searchGroups);
router.get("/dm/:userId", protect, mongoIdParam("userId"), validate, getDM);
router.get("/invites", protect, getMyGroupInvites);
router.post(
  "/group",
  protect,
  imageUpload.single("file"),
  normalizeMembers,
  createGroupValidation,
  validate,
  createGroup,
);
router.get("/:chatId", protect, mongoIdParam("chatId"), validate, getChatById);
router.delete(
  "/:chatId/hide",
  protect,
  mongoIdParam("chatId"),
  validate,
  hideChatForMe,
);
router.put(
  "/:chatId",
  protect,
  mongoIdParam("chatId"),
  validate,
  imageUpload.single("file"),
  updateGroupValidation,
  validate,
  updateGroup,
);
router.post(
  "/:chatId/members",
  protect,
  [
    mongoIdParam("chatId"),
    body("members")
      .isArray({ min: 1 })
      .withMessage("members must be a non-empty array"),
    body("members.*").isMongoId().withMessage("Invalid member id"),
  ],
  validate,
  addMembers,
);
router.delete(
  "/:chatId/members/:memberId",
  protect,
  [mongoIdParam("chatId"), mongoIdParam("memberId")],
  validate,
  removeMember,
);
router.get(
  "/:chatId/messages",
  protect,
  mongoIdParam("chatId"),
  validate,
  getMessages,
);
router.post(
  "/:chatId/leave",
  protect,
  mongoIdParam("chatId"),
  validate,
  leaveGroup,
);
router.patch(
  "/:chatId/pin/:messageId",
  protect,
  [mongoIdParam("chatId"), mongoIdParam("messageId")],
  validate,
  togglePinMessage,
);
router.patch(
  "/:chatId/disappearing",
  protect,
  [mongoIdParam("chatId"), ...disappearingMessagesValidation],
  validate,
  setDisappearingMessages,
);
router.post(
  "/:chatId/join-request",
  protect,
  mongoIdParam("chatId"),
  validate,
  requestJoinGroup,
);
router.get(
  "/:chatId/join-requests",
  protect,
  mongoIdParam("chatId"),
  validate,
  getJoinRequests,
);
router.post(
  "/:chatId/join-requests/:userId",
  protect,
  [
    mongoIdParam("chatId"),
    mongoIdParam("userId"),
    body("action")
      .isIn(["accept", "reject"])
      .withMessage("action must be accept or reject"),
  ],
  validate,
  handleJoinRequest,
);
router.post(
  "/:chatId/invite/accept",
  protect,
  mongoIdParam("chatId"),
  validate,
  acceptGroupInvite,
);
router.post(
  "/:chatId/invite/reject",
  protect,
  mongoIdParam("chatId"),
  validate,
  rejectGroupInvite,
);

export default router;
