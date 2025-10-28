import { Router } from "express";
import healthRouter from "./health.routes.js";
import sendRouter from "./send.routes.js"; // 추가

const router = Router();

// /health
router.use("/health", healthRouter);

// /api/send - 일괄 전송 API
router.use("/api/send", sendRouter); // 추가

// 앞으로 여기에 /api/log, /api/sign 등 추가 예정

export default router;