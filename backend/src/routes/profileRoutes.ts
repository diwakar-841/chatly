import { Router } from "express";
import {
  getProfile,
  updateProfile,
  updateAvatar,
  searchUsers,
} from "../controllers/profileController.js";
import { protect } from "../middleware/authMiddleware.js";
import { imageUpload } from "../middleware/uploadMiddleware.js";
import {
  updateProfileValidation,
  searchValidation,
  mongoIdParam,
} from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";

const router = Router();

router.get("/search", protect, searchValidation, validate, searchUsers);
router.put("/me", protect, updateProfileValidation, validate, updateProfile);
router.put("/avatar", protect, imageUpload.single("file"), updateAvatar);
router.get("/:userId", protect, mongoIdParam("userId"), validate, getProfile);

export default router;
