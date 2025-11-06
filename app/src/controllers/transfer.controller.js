/**
 * transfer.controller.js
 *
 * 웹 서버 전용 토큰 전송 컨트롤러
 * - API Key 검증 없음
 * - 사용자 서명 기반 전송
 */

import * as TransferService from '../services/transfer.service.js';
import { getClientIp } from '../utils/ipHelper.js';

/**
 * POST /api/transfer/create
 * 부분 서명 트랜잭션 생성
 *
 * @param {Object} req - Express request 객체
 * @param {Object} res - Express response 객체
 */
export async function createTransferSign(req, res) {
    try {
        // 1. 요청 데이터 추출
        const { from_wallet, to_wallet, amount } = req.body;

        // 2. 클라이언트 IP 주소 가져오기
        const reqIp = getClientIp(req);

        // 3. 서비스 호출 - 부분 서명 트랜잭션 생성
        const result = await TransferService.createPartialTransaction({
            from_wallet,
            to_wallet,
            amount,
            req_ip: reqIp
        });

        // 4. 성공 응답
        return res.status(200).json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        // 5. 에러 처리
        console.error('[createTransferSign Error]', error.message);

        // 에러 타입에 따른 상태 코드 결정
        let statusCode = 500;

        if (error.message.includes('필요합니다') ||
            error.message.includes('형식') ||
            error.message.includes('0보다 커야')) {
            statusCode = 400; // Bad Request
        }

        return res.status(statusCode).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * POST /api/transfer/finalize
 * 최종 서명 완료 및 전송
 *
 * @param {Object} req - Express request 객체
 * @param {Object} res - Express response 객체
 */
export async function finalizeTransferSign(req, res) {
    try {
        // 1. 요청 데이터 추출
        const { contract_id, user_signature } = req.body;

        // 2. 클라이언트 IP 주소 가져오기
        const reqIp = getClientIp(req);

        // 3. 서비스 호출 - 최종 서명 및 전송
        const result = await TransferService.finalizeAndSendTransaction({
            contract_id,
            user_signature,
            req_ip: reqIp
        });

        // 4. 성공 응답
        return res.status(200).json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        // 5. 에러 처리
        console.error('[finalizeTransferSign Error]', error.message);

        // 에러 타입에 따른 상태 코드 결정
        let statusCode = 500;

        if (error.message.includes('필요합니다')) {
            statusCode = 400; // Bad Request
        } else if (error.message.includes('찾을 수 없습니다')) {
            statusCode = 404; // Not Found
        } else if (error.message.includes('이미 처리된')) {
            statusCode = 409; // Conflict
        }

        return res.status(statusCode).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * GET /api/transfer/status/:contract_id
 * 전송 상태 조회 (선택사항)
 *
 * @param {Object} req - Express request 객체
 * @param {Object} res - Express response 객체
 */
export async function getTransferStatus(req, res) {
    try {
        // 1. 계약 ID 추출
        const { contract_id } = req.params;

        if (!contract_id) {
            return res.status(400).json({
                success: false,
                error: '계약 ID가 필요합니다',
                timestamp: new Date().toISOString()
            });
        }

        // 2. DB에서 계약 정보 조회
        const { pool } = await import('../config/db.js');
        const [contracts] = await pool.query(
            'SELECT contract_id, status, created_at, updated_at, tx_signature FROM r_contract WHERE contract_id = ?',
            [contract_id]
        );

        if (contracts.length === 0) {
            return res.status(404).json({
                success: false,
                error: '계약 정보를 찾을 수 없습니다',
                timestamp: new Date().toISOString()
            });
        }

        const contract = contracts[0];

        // 3. 성공 응답
        return res.status(200).json({
            success: true,
            data: {
                contract_id: contract.contract_id,
                status: contract.status,
                tx_signature: contract.tx_signature,
                created_at: contract.created_at,
                updated_at: contract.updated_at
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        // 4. 에러 처리
        console.error('[getTransferStatus Error]', error.message);

        return res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}