/**
 * contract.routes.js
 *
 * 계약서 조회 API 라우트
 */

import express from 'express';
import { getContract, getContractList } from '../controllers/contract.controller.js';

const router = express.Router();

/**
 * GET /api/contract/:id
 * 계약서 단건 조회
 */
router.get('/:id', getContract);

/**
 * GET /api/contract
 * 계약서 목록 조회
 */
router.get('/', getContractList);

export default router;