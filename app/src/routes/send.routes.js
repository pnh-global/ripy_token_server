/**
 * send.routes.js
 *
 * 회사 지갑 일괄 전송 API 라우트
 *
 * POST /api/send/company - 일괄 전송 요청
 * GET /api/send/company/:request_id - 전송 상태 조회
 */

import { Router } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { postCompanySend, getCompanySend } from '../controllers/send.controller.js';

const router = Router();

// POST /api/send/company - 일괄 전송 요청
router.post('/company', asyncHandler(postCompanySend));

// GET /api/send/company/:request_id - 상태 조회
router.get('/company/:request_id', asyncHandler(getCompanySend));

export default router;