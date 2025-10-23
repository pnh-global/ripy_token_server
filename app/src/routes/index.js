import { Router } from "express";
import healthRouter from "./health.routes.js";
import sendRouter from "./send.routes.js";

const router = Router();

// /health
router.use("/health", healthRouter);
router.use("/api/send", sendRouter);

// 앞으로 여기에 /api/log, /api/sign 등 추가 예정
export default router;
