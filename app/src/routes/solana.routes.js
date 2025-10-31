/**
 * ============================================
 * Solana Routes - Solana API 라우트
 * ============================================
 */

import { Router } from 'express';
import {
    healthCheck,
    createUnsignedTransaction,
    createAndPartialSignPayment,
    createAndPartialSignReceive,
    sendSignedTransaction,
    getTransactionStatus,
    verifyTransaction,
    getWalletBalance
} from '../controllers/solana.controller.js';
import { apiKeyMiddleware } from '../middlewares/apiKeyMiddleware.js';

const router = Router();

// ============================================
// Public Routes (인증 불필요)
// ============================================

/**
 * @route   GET /api/solana/health
 * @desc    Solana RPC 연결 상태 확인
 * @access  Public
 */
router.get('/health', healthCheck);

// ============================================
// Protected Routes (Service Key 인증 필요)
// ============================================

/**
 * @route   POST /api/solana/create-unsigned-transaction
 * @desc    서명되지 않은 트랜잭션 생성
 * @access  Protected
 */
router.post('/create-unsigned-transaction', apiKeyMiddleware, createUnsignedTransaction);

/**
 * @route   POST /api/solana/create-and-partial-sign
 * @desc    부분 서명된 트랜잭션 생성 (사용자 → 회사)
 * @access  Protected
 */
router.post('/create-and-partial-sign', apiKeyMiddleware, createAndPartialSignPayment);

/**
 * @route   POST /api/solana/create-and-partial-sign-receive
 * @desc    부분 서명된 트랜잭션 생성 (사용자 → 사용자)
 * @access  Protected
 */
router.post('/create-and-partial-sign-receive', apiKeyMiddleware, createAndPartialSignReceive);

/**
 * @route   POST /api/solana/send-signed-transaction
 * @desc    완전히 서명된 트랜잭션 전송
 * @access  Protected
 */
router.post('/send-signed-transaction', apiKeyMiddleware, sendSignedTransaction);

/**
 * @route   GET /api/solana/transaction/:signature
 * @desc    트랜잭션 상세 정보 조회
 * @access  Protected
 */
router.get('/transaction/:signature', apiKeyMiddleware, getTransactionStatus);

/**
 * @route   POST /api/solana/verify-transaction
 * @desc    트랜잭션 검증 및 상태 확인
 * @access  Protected
 */
router.post('/verify-transaction', apiKeyMiddleware, verifyTransaction);

/**
 * @route   GET /api/solana/balance/:address
 * @desc    지갑 잔액 조회
 * @access  Protected
 */
router.get('/balance/:address', apiKeyMiddleware, getWalletBalance);

export default router;