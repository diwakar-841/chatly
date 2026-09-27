import { Router } from "express";
import {
  blockUser,
  unblockUser,
  getBlockedUsers,
  checkBlock,
} from "../controllers/blockController.js";
import { protect } from "../middleware/authMiddleware.js";
import { mongoIdParam } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";

const router = Router();

router.get(
  "/check/:userId",
  protect,
  mongoIdParam("userId"),
  validate,
  checkBlock,
);
router.post("/:userId", protect, mongoIdParam("userId"), validate, blockUser);
router.delete(
  "/:userId",
  protect,
  mongoIdParam("userId"),
  validate,
  unblockUser,
);
router.get("/", protect, getBlockedUsers);

export default router;
