/**
 * transfer.controller.js
 *
 * 웹 서버 전용 토큰 전송 컨트롤러
 */

import {
    createPartialTransaction,
    finalizeAndSendTransaction,
} from '../services/transfer.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { pool } from '../config/db.js';
import {
    SUCCESS,
    BAD_REQUEST,
    NOT_FOUND,
    INTERNAL_SERVER_ERROR
} from '../utils/resultCodes.js';
/*
 * POST /api/transfer/create
 * 부분 서명 트랜잭션 생성 (1단계)
 *
 * @swagger
 * /api/transfer/create:
 *   post:
 *     summary: 부분 서명 트랜잭션 생성
 *     tags:
 *       - Transfer (Web)
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
 *               to_wallet:
 *                 type: string
 *                 description: 수신자 지갑 주소
 *               amount:
 *                 type: number
 *                 description: 전송할 토큰 수량
 *     responses:
 *       200:
 *         description: 트랜잭션 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: "success"
 *                 code:
 *                   type: string
 *                   example: "CODE0000"
 *                 message:
 *                   type: string
 *                   example: "사용자 서명이 필요합니다"
 *                 detail:
 *                   type: object
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: "fail"
 *                 code:
 *                   type: string
 *                   example: "CODE1000"
 *                 message:
 *                   type: string
 *       500:
 *         description: 서버 내부 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: "fail"
 *                 code:
 *                   type: string
 *                   example: "CODE9999"
 *                 message:
 *                   type: string
 */
export async function createTransferSign(req, res) {
    try {
        const { from_wallet, to_wallet, amount } = req.body;
        const req_ip = req.ip || req.connection.remoteAddress;

        // 필수 파라미터 검증
        if (!from_wallet || !to_wallet || !amount) {
            return errorResponse(res, '필수 파라미터가 누락되었습니다', 400, BAD_REQUEST);
        }

        // 부분 서명 트랜잭션 생성
        const result = await createPartialTransaction({
            from_wallet,
            to_wallet,
            amount,
            req_ip
        });

        return successResponse(res, result, 200, SUCCESS, '사용자 서명이 필요합니다');

    } catch (error) {
        console.error('[createTransferSign Error]', error);

        // 트랜잭션 생성 실패
        if (error.message.includes('유효하지 않은') || error.message.includes('검증')) {
            return errorResponse(res, error.message, 400, BAD_REQUEST);
        }

        // 기타 서버 오류
        return errorResponse(res, error.message, 500, INTERNAL_SERVER_ERROR);
    }
}

/**
 * POST /api/transfer/finalize
 * 최종 서명 완료 및 전송
 */
export async function finalizeTransferSign(req, res) {
    try {
        const { contract_id, partial_transaction } = req.body;
        const req_ip = req.ip || req.connection.remoteAddress;

        if (!contract_id) {
            return errorResponse(res, '계약 ID가 필요합니다', 400, BAD_REQUEST);
        }

        if (!partial_transaction) {
            return errorResponse(res, '서명이 완료된 트랜잭션이 필요합니다', 400, BAD_REQUEST);
        }

        const result = await finalizeAndSendTransaction({
            contract_id,
            partial_transaction,
            req_ip
        });

        return successResponse(res, result, 200, SUCCESS, '전송이 완료되었습니다');

    } catch (error) {
        console.error('[finalizeTransferSign Error]', error);

        // 계약 정보를 찾을 수 없음
        if (error.message.includes('계약 정보를 찾을 수 없습니다') || error.message.includes('찾을 수 없')) {
            return errorResponse(res, error.message, 404, NOT_FOUND);
        }

        // 이미 처리된 트랜잭션 또는 서명 검증 오류
        if (error.message.includes('이미 처리된') || error.message.includes('서명')) {
            return errorResponse(res, error.message, 400, BAD_REQUEST);
        }

        // 기타 서버 오류
        return errorResponse(res, error.message, 500, INTERNAL_SERVER_ERROR);
    }
}

/**
 * GET /api/transfer/status/:contract_id
 * 전송 상태 조회
 */
export async function getTransferStatus(req, res) {
    try {
        const { contract_id } = req.params;

        // contract_id 검증
        if (!contract_id) {
            return errorResponse(res, '계약 ID가 필요합니다', 400, BAD_REQUEST);
        }

        // 계약 정보 조회
        const [contracts] = await pool.query(
            'SELECT * FROM r_contract WHERE contract_id = ?',
            [contract_id]
        );

        // 계약 정보가 없는 경우
        if (!contracts || contracts.length === 0) {
            return errorResponse(res, '계약 정보를 찾을 수 없습니다', 404, NOT_FOUND);
        }

        const contract = contracts[0];

        // 응답 데이터 구성
        const result = {
            contract_id: contract.contract_id,
            status: contract.status,
            tx_signature: contract.tx_signature || null,
            created_at: contract.created_at,
            updated_at: contract.updated_at
        };

        return successResponse(res, result, 200, SUCCESS);

    } catch (error) {
        console.error('[getTransferStatus Error]', error);
        return errorResponse(res, error.message, 500, INTERNAL_SERVER_ERROR);
    }
}