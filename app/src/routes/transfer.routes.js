/**
 * transfer.routes.js
 *
 * 웹 서버 전용 토큰 전송 라우트
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
 * @swagger
 * tags:
 *   name: Transfer
 *   description: 웹 서버 전용 토큰 전송 API
 */

/**
 * @swagger
 * /api/transfer/create:
 *   post:
 *     tags:
 *       - Transfer
 *     summary: 부분 서명 트랜잭션 생성 (1단계)
 *     description: |
 *       웹서버가 토큰 전송을 시작하는 API입니다.
 *
 *       **처리 과정:**
 *       1. 발신자, 수신자, 금액을 받음
 *       2. Feepayer(회사 지갑)가 부분 서명한 트랜잭션 생성
 *       3. contract_id와 partial_transaction 반환
 *
 *       **다음 단계:**
 *       앱에서 사용자(발신자)가 Phantom 지갑으로 서명
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - from_wallet
 *               - to_wallet
 *               - amount
 *             properties:
 *               from_wallet:
 *                 type: string
 *                 description: 발신자 지갑 주소
 *                 example: "BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh"
 *               to_wallet:
 *                 type: string
 *                 description: 수신자 지갑 주소
 *                 example: "AiF7NdJKaDxHsfnRzKKH2SR1GJ2u8upvnnVSsrPEikgw"
 *               amount:
 *                 type: string
 *                 description: 전송 금액 (RIPY 단위)
 *                 example: "10"
 *     responses:
 *       200:
 *         description: 부분 서명 트랜잭션 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: success
 *                 code:
 *                   type: string
 *                   example: "0000"
 *                 message:
 *                   type: string
 *                   example: "사용자 서명이 필요합니다"
 *                 detail:
 *                   type: object
 *                   properties:
 *                     contract_id:
 *                       type: string
 *                       description: 계약 ID (UUID)
 *                       example: "8e436674-e6ee-43ee-8d72-7149da50a8f1"
 *                     partial_transaction:
 *                       type: string
 *                       description: 부분 서명된 트랜잭션 (Base64)
 *                       example: "AQAAAAAAAAAAAAo=..."
 *                     status:
 *                       type: string
 *                       example: "pending"
 *                     message:
 *                       type: string
 *                       example: "사용자 서명이 필요합니다"
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: fail
 *                 code:
 *                   type: string
 *                   example: "9800"
 *                 message:
 *                   type: string
 *                   example: "필수 파라미터가 누락되었습니다"
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: fail
 *                 code:
 *                   type: string
 *                   example: "9900"
 *                 message:
 *                   type: string
 *                   example: "서버 내부 오류"
 */
router.post('/create', asyncHandler(createTransferSign));

/**
 * @swagger
 * /api/transfer/finalize:
 *   post:
 *     tags:
 *       - Transfer
 *     summary: 최종 서명 완료 및 전송 (2단계)
 *     description: |
 *       앱에서 사용자 서명이 완료된 트랜잭션을 받아 Solana 네트워크로 전송합니다.
 *
 *       **처리 과정:**
 *       1. contract_id와 partial_transaction(완전 서명) 받음
 *       2. 서명 검증 (Feepayer ✓, 사용자 ✓)
 *       3. Solana 네트워크로 전송
 *       4. 트랜잭션 시그니처 반환
 *
 *       **중요:**
 *       partial_transaction은 Create에서 받은 값에 앱에서 사용자 서명을 추가한 완전한 트랜잭션입니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contract_id
 *               - partial_transaction
 *             properties:
 *               contract_id:
 *                 type: string
 *                 description: Create API에서 받은 계약 ID
 *                 example: "8e436674-e6ee-43ee-8d72-7149da50a8f1"
 *               partial_transaction:
 *                 type: string
 *                 description: 사용자 서명이 완료된 트랜잭션 (Base64)
 *                 example: "AgMfARmNTU2hKY+b/m/LZecmyXG37jZSo/5DjEKR..."
 *     responses:
 *       200:
 *         description: 전송 완료
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: success
 *                 code:
 *                   type: string
 *                   example: "0000"
 *                 message:
 *                   type: string
 *                   example: "전송이 완료되었습니다"
 *                 detail:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     signature:
 *                       type: string
 *                       example: "LyXbE4dgi4kFfKdhqfmiD6ESgAXFox8NY6Q7mMmcMK1BSNLb4qxoDDxPRb4LcTKpVNnAyvWZntNZyfEu2DfdiRU"
 *                     status:
 *                       type: string
 *                       example: "completed"
 *                     message:
 *                       type: string
 *                       example: "전송이 완료되었습니다"
 *                     explorer_url:
 *                       type: string
 *                       example: "https://explorer.solana.com/tx/LyXbE4dgi4kFfKdhqfmiD6ESgAXFox8NY6Q7mMmcMK1BSNLb4qxoDDxPRb4LcTKpVNnAyvWZntNZyfEu2DfdiRU?cluster=devnet"
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: fail
 *                 code:
 *                   type: string
 *                   example: "9800"
 *                 message:
 *                   type: string
 *                   example: "서명이 완료된 트랜잭션이 필요합니다"
 *       404:
 *         description: 계약을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: fail
 *                 code:
 *                   type: string
 *                   example: "0502"
 *                 message:
 *                   type: string
 *                   example: "계약 정보를 찾을 수 없습니다"
 */
router.post('/finalize', asyncHandler(finalizeTransferSign));

/**
 * @swagger
 * /api/transfer/status/{contract_id}:
 *   get:
 *     tags:
 *       - Transfer
 *     summary: 전송 상태 조회
 *     description: 계약 ID로 전송 상태를 조회합니다.
 *     parameters:
 *       - in: path
 *         name: contract_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 계약 ID
 *         example: "8e436674-e6ee-43ee-8d72-7149da50a8f1"
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: success
 *                 code:
 *                   type: string
 *                   example: "0000"
 *                 detail:
 *                   type: object
 *                   properties:
 *                     contract_id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: "completed"
 *                     tx_signature:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                     updated_at:
 *                       type: string
 *       404:
 *         description: 계약을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: fail
 *                 code:
 *                   type: string
 *                   example: "0502"
 *                 message:
 *                   type: string
 *                   example: "계약 정보를 찾을 수 없습니다"
 */
router.get('/status/:contract_id', asyncHandler(getTransferStatus));

export default router;