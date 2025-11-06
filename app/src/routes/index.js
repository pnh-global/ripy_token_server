import { Router } from "express";
import healthRouter from "./health.routes.js";
import sendRouter from "./send.routes.js";
import solanaRouter from "./solana.routes.js";
import signRouter from "./sign.routes.js";
import contractRouter from "./contract.routes.js";
import logRouter from "./log.routes.js";
import transferRouter from "./transfer.routes.js";

const router = Router();

// Health 체크 - 루트에서 직접 처리
/*router.get("/health", async (req, res) => {
    try {
        // DB 연결 체크 (선택사항)
        // const [rows] = await pool.query("SELECT 1");

        res.json({
            success: true,
            status: "healthy",
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || "unknown"
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            status: "unhealthy",
            error: error.message
        });
    }
});*/

// 다른 API 라우트
router.use("/health", healthRouter);
router.use("/send", sendRouter);
router.use("/solana", solanaRouter);
router.use("/sign", signRouter);
router.use("/contract", contractRouter);
router.use("/log", logRouter);
router.use("/transfer", transferRouter);

export default router;