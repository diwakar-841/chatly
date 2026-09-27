import { Router } from "express";
import { aiChat } from "../controllers/aiController.js";
import { protect } from "../middleware/authMiddleware.js";
import { aiLimiter } from "../middleware/rateLimitMiddleware.js";

const router = Router();

router.post("/chat", protect as any, aiLimiter, aiChat as any);

export default router;
