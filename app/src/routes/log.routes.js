/**
 * log.routes.js
 *
 * 로그 API 라우트
 */

import express from 'express';
import { createLog, getLogs, getLog } from '../controllers/log.controller.js';

const router = express.Router();

/**
 * POST /api/log
 * 로그 생성
 */
router.post('/', createLog);

/**
 * GET /api/log/:id
 * 로그 단건 조회
 * 주의: 이 라우트는 GET / 보다 먼저 선언되어야 합니다
 */
router.get('/:id', getLog);

/**
 * GET /api/log
 * 로그 목록 조회
 */
router.get('/', getLogs);

export default router;