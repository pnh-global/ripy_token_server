import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { postCompanySend, getCompanySend } from "../controllers/send.controller.js";

const router = Router();

/**
 * @swagger
 * /api/send/company:
 *   post:
 *     summary: Send RIPY from company wallet to multiple recipients
 *     tags: [Send]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cate1: { type: string, example: "company_send" }
 *               cate2: { type: string, example: "batch_20251023" }
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     wallet_address_encrypted: { type: string, example: "BASE64_CIPHER" }
 *                     amount: { type: string, example: "12.345678" }
 *             required: [recipients]
 *     responses:
 *       202:
 *         description: Accepted (processing started)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 request_id: { type: string, example: "uuid-v4" }
 */
router.post("/company", asyncHandler(postCompanySend));

/**
 * @swagger
 * /api/send/company/{request_id}:
 *   get:
 *     summary: Get send request status
 *     tags: [Send]
 *     parameters:
 *       - in: path
 *         name: request_id
 *         required: true
 *         schema: { type: string, example: "uuid-v4" }
 *     responses:
 *       200:
 *         description: ok
 */
router.get("/company/:request_id", asyncHandler(getCompanySend));

export default router;
