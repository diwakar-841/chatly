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
import { sendMessageValidation } from "../utils/validators.js";
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


router.put("/read/:chatId", protect, markRead);

router.put("/:messageId", protect, editMessage);

router.delete("/chat/:chatId", protect, clearChat);
router.delete("/:messageId", protect, deleteMessage);
router.post("/:messageId/react", protect, reactToMessage);

export default router;
