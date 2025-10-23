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
import { health } from "../controllers/health.controller.js";

const router = Router();

router.get("/", asyncHandler(health));

export default router;
