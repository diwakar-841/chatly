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
import { respondToRequestValidation, mongoIdParam } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";

const router = Router();

router.post(
  "/send/:userId",
  protect,
  mongoIdParam("userId"),
  validate,
  sendRequest,
);
router.put(
  "/respond/:requestId",
  protect,
  [mongoIdParam("requestId"), ...respondToRequestValidation],
  validate,
  respondToRequest,
);
router.delete(
  "/withdraw/:requestId",
  protect,
  mongoIdParam("requestId"),
  validate,
  withdrawRequest,
);
router.delete(
  "/unfriend/:userId",
  protect,
  mongoIdParam("userId"),
  validate,
  unfriend,
);
router.get(
  "/status/:userId",
  protect,
  mongoIdParam("userId"),
  validate,
  getRequestStatus,
);
router.get("/pending", protect, getPendingRequests);
router.get("/sent", protect, getSentRequests);

export default router;
