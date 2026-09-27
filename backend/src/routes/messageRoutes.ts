import { Router } from "express";
import {
  sendMessage,
  editMessage,
  deleteMessage,
  reactToMessage,
  markRead,
  clearChat,
} from "../controllers/messageController.js";
import { protect } from "../middleware/authMiddleware.js";
import { mediaUpload } from "../middleware/uploadMiddleware.js";
import {
  sendMessageValidation,
  editMessageValidation,
  mongoIdParam,
} from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";

const router = Router();

router.post(
  "/",
  protect,
  mediaUpload.single("file"),
  sendMessageValidation,
  validate,
  sendMessage,
);

router.put(
  "/read/:chatId",
  protect,
  mongoIdParam("chatId"),
  validate,
  markRead,
);

router.put(
  "/:messageId",
  protect,
  [mongoIdParam("messageId"), ...editMessageValidation],
  validate,
  editMessage,
);

router.delete(
  "/chat/:chatId",
  protect,
  mongoIdParam("chatId"),
  validate,
  clearChat,
);
router.delete(
  "/:messageId",
  protect,
  mongoIdParam("messageId"),
  validate,
  deleteMessage,
);
router.post(
  "/:messageId/react",
  protect,
  mongoIdParam("messageId"),
  validate,
  reactToMessage,
);

export default router;
