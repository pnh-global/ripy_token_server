/**
 * ============================================
 * companySend.routes.js - 회사 지갑 다중 전송 Routes
 * ============================================
 *
 * 역할:
 * - 회사 지갑 다중 전송 API 라우팅
 * - 미들웨어 적용 (API Key 검증, 비동기 에러 처리)
 *
 * 엔드포인트:
 * - POST /api/companysend - 다중 전송 요청
 * - GET /api/companysend/:request_id - 전송 상태 조회
 *
 * 작성일: 2025-11-07
 */

import { Router } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { apiKeyMiddleware } from '../middlewares/apiKeyMiddleware.js';
import { postCompanySend, getCompanySend } from '../controllers/companySend.controller.js';

const router = Router();

/**
 * ============================================
 * 미들웨어 적용
 * ============================================
 *
 * 모든 /api/companysend/* 라우트에 API Key 인증 미들웨어 적용
 */
router.use(apiKeyMiddleware);

/**
 * ============================================
 * POST /api/companysend
 * 회사 지갑에서 다중 수신자에게 RIPY 전송
 * ============================================
 *
 * Request Body:
 * {
 *   "cate1": "company_send",
 *   "cate2": "batch_20251107",
 *   "recipients": [
 *     {
 *       "wallet_address": "AiF7NdJKaDxHsfnRzKKH2SR1GJ2u8upvnnVSsrPEikgw",
 *       "amount": 100.5
 *     }
 *   ]
 * }
 *
 * Response:
 * {
 *   "result": "success",
 *   "code": "200",
 *   "detail": {
 *     "request_id": "uuid",
 *     "total_count": 50,
 *     "status": "PROCESSING",
 *     "message": "다중 전송이 시작되었습니다."
 *   }
 * }
 */
router.post('/', asyncHandler(postCompanySend));

/**
 * ============================================
 * GET /api/companysend/:request_id
 * 다중 전송 상태 조회
 * ============================================
 *
 * Response:
 * {
 *   "result": "success",
 *   "code": "200",
 *   "detail": {
 *     "request_id": "uuid",
 *     "cate1": "company_send",
 *     "cate2": "batch_20251107",
 *     "status": "DONE",
 *     "total_count": 50,
 *     "completed_count": 48,
 *     "failed_count": 2,
 *     "created_at": "2025-11-07T10:00:00Z",
 *     "updated_at": "2025-11-07T10:05:00Z"
 *   }
 * }
 */
router.get('/:request_id', asyncHandler(getCompanySend));

/**
 * Export
 */
export default router;