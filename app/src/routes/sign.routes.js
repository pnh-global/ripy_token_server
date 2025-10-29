/**
 * sign.routes.js
 *
 * /api/sign/* 라우트
 * 서명 관련 엔드포인트
 */

import { Router } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { apiKeyMiddleware } from '../middlewares/apiKeyMiddleware.js';
import { createSign } from '../controllers/createSign.controller.js';
// import { finalizeSign } from '../controllers/finalizeSign.controller.js';  // 다음 단계에서 구현
// import { verifySign } from '../controllers/verifySign.controller.js';      // 선택 사항

const router = Router();

/**
 * 모든 /api/sign/* 라우트에 API Key 인증 미들웨어 적용
 */
router.use(apiKeyMiddleware);

/**
 * POST /api/sign/create
 * 부분 서명 트랜잭션 생성
 */
router.post('/create', asyncHandler(createSign));

/**
 * POST /api/sign/finalize
 * 최종 서명 완료 처리
 * (다음 단계에서 구현)
 */
// router.post('/finalize', asyncHandler(finalizeSign));

/**
 * POST /api/sign/verify
 * 서명 검증 (선택 사항)
 */
// router.post('/verify', asyncHandler(verifySign));

export default router;