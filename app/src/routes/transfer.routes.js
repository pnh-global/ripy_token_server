/**
 * transfer.routes.js
 *
 * 웹 서버 전용 토큰 전송 라우트
 * - API Key 검증 없음
 * - 사용자 서명 기반 전송
 */

import { Router } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import {
    createTransferSign,
    finalizeTransferSign,
    getTransferStatus
} from '../controllers/transfer.controller.js';

const router = Router();

/**
 * POST /api/transfer/create
 * 부분 서명 트랜잭션 생성
 *
 * Request Body:
 * {
 *   "from_wallet": "발신자 지갑 주소",
 *   "to_wallet": "수신자 지갑 주소",
 *   "amount": "전송 금액 (RIPY 단위)"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "contract_id": "계약 ID (UUID)",
 *     "partial_transaction": "부분 서명된 트랜잭션 (Base64)",
 *     "status": "pending",
 *     "message": "사용자 서명이 필요합니다"
 *   },
 *   "timestamp": "2025-11-06T12:34:56.789Z"
 * }
 */
router.post('/create', asyncHandler(createTransferSign));

/**
 * POST /api/transfer/finalize
 * 최종 서명 완료 및 전송
 *
 * Request Body:
 * {
 *   "contract_id": "계약 ID (UUID)",
 *   "user_signature": "사용자 서명 (Base64)"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "success": true,
 *     "signature": "트랜잭션 해시",
 *     "status": "completed",
 *     "message": "전송이 완료되었습니다"
 *   },
 *   "timestamp": "2025-11-06T12:34:56.789Z"
 * }
 */
router.post('/finalize', asyncHandler(finalizeTransferSign));

/**
 * GET /api/transfer/status/:contract_id
 * 전송 상태 조회
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "contract_id": "계약 ID",
 *     "status": "pending|completed|failed",
 *     "tx_signature": "트랜잭션 해시 (완료 시)",
 *     "created_at": "생성 시각",
 *     "updated_at": "업데이트 시각"
 *   },
 *   "timestamp": "2025-11-06T12:34:56.789Z"
 * }
 */
router.get('/status/:contract_id', asyncHandler(getTransferStatus));

export default router;