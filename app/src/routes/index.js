import { Router } from "express";
import healthRouter from "./health.routes.js";
import sendRouter from "./send.routes.js";
import solanaRouter from "./solana.routes.js";  // 추가

const router = Router();

// Health 체크 - 루트에서 직접 처리
router.get("/health", async (req, res) => {
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
});

// 다른 API 라우트
router.use("/api/send", sendRouter);
router.use("/api/solana", solanaRouter);  // 추가

// 앞으로 여기에 /api/log, /api/sign 등 추가 예정

export default router;