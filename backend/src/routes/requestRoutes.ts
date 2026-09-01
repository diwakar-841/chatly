import { Router } from "express";
import {
  sendRequest,
  respondToRequest,
  getPendingRequests,
  getSentRequests,
  withdrawRequest,
  getRequestStatus,
  unfriend,
} from "../controllers/requestController.js";
import { protect } from "../middleware/authMiddleware.js";
import { respondToRequestValidation } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";

const router = Router();

router.post("/send/:userId", protect, sendRequest);
router.put(
  "/respond/:requestId",
  protect,
  respondToRequestValidation,
  validate,
  respondToRequest,
);
router.delete("/withdraw/:requestId", protect, withdrawRequest);
router.delete("/unfriend/:userId", protect, unfriend);
router.get("/status/:userId", protect, getRequestStatus);
router.get("/pending", protect, getPendingRequests);
router.get("/sent", protect, getSentRequests);

export default router;
