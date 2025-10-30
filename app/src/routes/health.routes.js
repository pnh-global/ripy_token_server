/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     description: Returns server status and DB connection time.
 *     responses:
 *       200:
 *         description: ok
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 now:
 *                   type: string
 *                   example: "2025-10-23T12:00:00Z"
 */

import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { healthCheck } from "../controllers/health.controller.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Health
 *   description: 서버 상태 확인 API
 */

// GET /health - 헬스 체크
router.get("/", asyncHandler(healthCheck));

export default router;
