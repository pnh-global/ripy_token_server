/**
 * ============================================
 * send.routes.js
 * ============================================
 *
 * 회사 지갑 다중 전송 API 라우트
 *
 * POST /api/send/company - 다중 전송 요청
 * GET /api/send/company/:request_id - 전송 상태 조회
 *
 * 작성일: 2025-11-07
 */

import { Router } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { apiKeyMiddleware } from '../middlewares/apiKeyMiddleware.js';

// Controller import
import {
    postCompanySend,
    getCompanySend
} from '../controllers/companySend.controller.js';

const router = Router();

// API Key 인증 미들웨어 적용
router.use(apiKeyMiddleware);

// POST /api/send/company - 다중 전송 요청
router.post('/company', asyncHandler(postCompanySend));

// GET /api/send/company/:request_id - 상태 조회
router.get('/company/:request_id', asyncHandler(getCompanySend));

export default router;