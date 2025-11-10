/**
 * ============================================
 * 회사 지갑 다중 전송 Controller
 * ============================================
 *
 * 역할:
 * - 웹서버로부터 다중 전송 요청 수신
 * - API Key 검증 (미들웨어에서 처리됨)
 * - 요청 데이터 검증
 * - Service Layer 호출
 * - 응답 생성
 *
 * 엔드포인트:
 * - POST /api/companysend - 다중 전송 요청
 * - GET /api/companysend/:request_id - 전송 상태 조회
 *
 * 작성일: 2025-11-07
 */

import crypto from 'crypto';
import {
    createCompanySendRequest,
    processCompanySend,
    getCompanySendStatus
} from '../services/companySend.service.js';
import { insertLog } from '../models/log.model.js';

/**
 * ============================================
 * 입력값 검증 함수
 * ============================================
 */

/**
 * Solana 주소 형식 검증
 * @param {string} address - 검증할 주소
 * @returns {boolean} 유효 여부
 */
function isValidSolanaAddress(address) {
    if (typeof address !== 'string') return false;

    // Solana 주소는 Base58 형식, 32-44자
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address);
}

/**
 * 금액 검증 (RIPY 토큰, decimal 값)
 * @param {number} amount - 검증할 금액
 * @returns {boolean} 유효 여부
 */
function isValidAmount(amount) {
    if (typeof amount !== 'number') return false;
    if (amount <= 0) return false;
    if (isNaN(amount)) return false;

    // 소수점 9자리 이하인지 확인
    const decimalPlaces = (amount.toString().split('.')[1] || '').length;
    if (decimalPlaces > 9) return false;

    return true;
}

/**
 * 수신자 배열 검증
 * @param {Array} recipients - 수신자 배열
 * @returns {Object} { valid: boolean, error: string|null }
 */
function validateRecipients(recipients) {
    // 배열 타입 검증
    if (!Array.isArray(recipients)) {
        return { valid: false, error: 'recipients는 배열이어야 합니다.' };
    }

    // 빈 배열 검증
    if (recipients.length === 0) {
        return { valid: false, error: 'recipients는 최소 1명 이상이어야 합니다.' };
    }

    // 최대 개수 검증 (설명회용: 100명)
    if (recipients.length > 100) {
        return { valid: false, error: 'recipients는 최대 100명까지 가능합니다.' };
    }

    // 각 수신자 검증
    for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];

        // 필수 필드 검증
        if (!recipient.wallet_address || !recipient.amount) {
            return {
                valid: false,
                error: `recipients[${i}]: wallet_address와 amount는 필수입니다.`
            };
        }

        // 지갑 주소 형식 검증
        if (!isValidSolanaAddress(recipient.wallet_address)) {
            return {
                valid: false,
                error: `recipients[${i}]: 유효하지 않은 지갑 주소입니다.`
            };
        }

        // 금액 검증
        if (!isValidAmount(recipient.amount)) {
            return {
                valid: false,
                error: `recipients[${i}]: 유효하지 않은 금액입니다. (양수, 소수점 9자리 이하)`
            };
        }
    }

    // 중복 주소 검증
    const uniqueAddresses = new Set(recipients.map(r => r.wallet_address));
    if (uniqueAddresses.size !== recipients.length) {
        return { valid: false, error: '중복된 지갑 주소가 있습니다.' };
    }

    return { valid: true, error: null };
}

/**
 * @swagger
 * /api/companysend:
 *   post:
 *     summary: 회사 지갑 다중 전송
 *     description: |
 *       회사 지갑에서 여러 수신자에게 RIPY 토큰을 일괄 전송합니다.
 *
 *       **주요 특징:**
 *       - 회사 지갑이 발신자이자 Fee Payer (수수료 대납)
 *       - 비동기 백그라운드 처리 (즉시 request_id 반환)
 *       - 최대 100명까지 동시 전송 가능
 *       - 실패 시 자동 재시도 (최대 3회)
 *
 *       **프로세스:**
 *       1. 요청 접수 및 검증
 *       2. DB에 요청 정보 저장 (r_send_request, r_send_detail)
 *       3. 즉시 request_id 반환
 *       4. 백그라운드에서 순차적으로 전송 처리
 *       5. 진행 상태는 GET /api/companysend/:request_id로 확인
 *
 *       **사용 사례:**
 *       - 설명회 참석자 에어드랍
 *       - 이벤트 보상 일괄 지급
 *       - 프로모션 토큰 배포
 *     tags:
 *       - Company Send
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cate1
 *               - cate2
 *               - recipients
 *             properties:
 *               cate1:
 *                 type: string
 *                 description: 카테고리 1 (분류용)
 *                 example: "company_send"
 *               cate2:
 *                 type: string
 *                 description: 카테고리 2 (세부 분류)
 *                 example: "batch_20251107"
 *               recipients:
 *                 type: array
 *                 description: 수신자 목록 (최소 1명, 최대 100명)
 *                 minItems: 1
 *                 maxItems: 100
 *                 items:
 *                   type: object
 *                   required:
 *                     - wallet_address
 *                     - amount
 *                   properties:
 *                     wallet_address:
 *                       type: string
 *                       description: 수신자 Solana 지갑 주소 (Base58 형식, 32-44자)
 *                       example: "AiF7NdJKaDxHsfnRzKKH2SR1GJ2u8upvnnVSsrPEikgw"
 *                     amount:
 *                       type: number
 *                       format: double
 *                       description: 전송할 RIPY 토큰 수량 (decimal 값, 소수점 9자리 이하)
 *                       minimum: 0.000000001
 *                       example: 100.5
 *           examples:
 *             example1:
 *               summary: 2명에게 전송
 *               value:
 *                 cate1: "company_send"
 *                 cate2: "batch_20251107"
 *                 recipients:
 *                   - wallet_address: "AiF7NdJKaDxHsfnRzKKH2SR1GJ2u8upvnnVSsrPEikgw"
 *                     amount: 100.5
 *                   - wallet_address: "BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh"
 *                     amount: 50.25
 *             example2:
 *               summary: 설명회용 (50명)
 *               value:
 *                 cate1: "company_send"
 *                 cate2: "presentation_airdrop"
 *                 recipients:
 *                   - wallet_address: "7ZTPH4FY43jiEy1fGDhyz8a1dLw7yTjxQUbU2PdGQd8H"
 *                     amount: 10.0
 *     responses:
 *       200:
 *         description: 전송 요청 접수 완료 (비동기 처리 시작)
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
 *                   example: "200"
 *                 detail:
 *                   type: object
 *                   properties:
 *                     request_id:
 *                       type: string
 *                       format: uuid
 *                       description: 전송 요청 ID (상태 조회용)
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     total_count:
 *                       type: integer
 *                       description: 총 수신자 수
 *                       example: 50
 *                     status:
 *                       type: string
 *                       description: 초기 상태 (PROCESSING)
 *                       example: "PROCESSING"
 *                     message:
 *                       type: string
 *                       description: 안내 메시지
 *                       example: "다중 전송이 시작되었습니다. 상태 조회 API로 진행 상황을 확인하세요."
 *       400:
 *         description: 잘못된 요청 (검증 실패)
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
 *                   example: "400"
 *                 detail:
 *                   type: object
 *                   properties:
 *                     error:
 *                       type: string
 *                       example: "recipients는 최소 1명 이상이어야 합니다."
 *       401:
 *         description: API Key 인증 실패
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
 *                   example: "401"
 *                 detail:
 *                   type: object
 *                   properties:
 *                     error:
 *                       type: string
 *                       example: "유효하지 않은 API Key입니다."
 *       500:
 *         description: 서버 오류
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
 *                   example: "500"
 *                 detail:
 *                   type: object
 *                   properties:
 *                     error:
 *                       type: string
 *                       example: "서버 내부 오류가 발생했습니다."
 */
export async function postCompanySend(req, res, next) {
    const startTime = Date.now();

    try {
        console.log('[COMPANY SEND] 다중 전송 요청 수신');

        // 1. 요청 메타 정보 추출
        const reqMeta = {
            ip: req.ip || req.connection.remoteAddress || '0.0.0.0',
            server: req.headers.host || null,
            service_key_id: req.serviceKeyId || null // 미들웨어에서 설정
        };

        // 2. 요청 바디 검증
        const { cate1, cate2, recipients } = req.body;

        if (!cate1 || !cate2) {
            throw new Error('cate1과 cate2는 필수입니다.');
        }

        // 3. 수신자 배열 검증
        const validation = validateRecipients(recipients);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        console.log(`[COMPANY SEND] 수신자 ${recipients.length}명 검증 완료`);

        // 4. Service Layer 호출: 요청 생성 + 상세 저장
        const { request_id } = await createCompanySendRequest({
            cate1,
            cate2,
            recipients
        });

        console.log(`[COMPANY SEND] 요청 생성 완료: ${request_id}`);

        // 5. 비동기로 전송 처리 시작 (백그라운드)
        // Promise를 await하지 않음 → 즉시 응답 반환
        processCompanySend(request_id, reqMeta).catch(error => {
            console.error(`[COMPANY SEND] 백그라운드 처리 오류: ${request_id}`, error);
        });

        // 6. 로그 기록
        const latency = Date.now() - startTime;
        await insertLog({
            cate1: 'company_send',
            cate2: 'request',
            request_id,
            service_key_id: reqMeta.service_key_id,
            req_ip_text: reqMeta.ip,
            req_server: reqMeta.server,
            req_status: 'Y',
            api_name: 'POST /api/companysend',
            api_parameter: null, // 민감 정보 제외
            result_code: '200',
            latency_ms: latency,
            error_code: null,
            error_message: null,
            content: `total_count=${recipients.length}`
        });

        // 7. 성공 응답
        res.status(200).json({
            result: 'success',
            code: '200',
            detail: {
                request_id,
                total_count: recipients.length,
                status: 'PROCESSING',
                message: '다중 전송이 시작되었습니다. 상태 조회 API로 진행 상황을 확인하세요.'
            }
        });

    } catch (error) {
        console.error('[COMPANY SEND] 요청 처리 오류:', error);

        // 로그 기록 (실패)
        const latency = Date.now() - startTime;
        await insertLog({
            cate1: 'company_send',
            cate2: 'request',
            request_id: null,
            service_key_id: req.serviceKeyId || null,
            req_ip_text: req.ip || '0.0.0.0',
            req_server: req.headers.host || null,
            req_status: 'Y',
            api_name: 'POST /api/companysend',
            api_parameter: null,
            result_code: '500',
            latency_ms: latency,
            error_code: 'REQUEST_FAILED',
            error_message: error.message,
            content: null
        });

        // 에러 응답
        res.status(500).json({
            result: 'fail',
            code: '500',
            detail: {
                error: error.message
            }
        });
    }
}

/**
 * @swagger
 * /api/companysend/{request_id}:
 *   get:
 *     summary: 다중 전송 상태 조회
 *     description: |
 *       회사 지갑 다중 전송의 진행 상태를 조회합니다.
 *
 *       **조회 가능 정보:**
 *       - 전체 상태 (PENDING, PROCESSING, DONE, ERROR)
 *       - 총 수신자 수
 *       - 완료된 전송 수
 *       - 실패한 전송 수
 *       - 생성 및 업데이트 시간
 *
 *       **상태 설명:**
 *       - PENDING: 전송 대기 중
 *       - PROCESSING: 전송 진행 중
 *       - DONE: 전송 완료
 *       - ERROR: 전송 중 오류 발생
 *     tags:
 *       - Company Send
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: request_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 전송 요청 ID (POST /api/companysend에서 반환받은 값)
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: 상태 조회 성공
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
 *                   example: "200"
 *                 detail:
 *                   type: object
 *                   properties:
 *                     request_id:
 *                       type: string
 *                       format: uuid
 *                       description: 요청 ID
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     cate1:
 *                       type: string
 *                       description: 카테고리 1
 *                       example: "company_send"
 *                     cate2:
 *                       type: string
 *                       description: 카테고리 2
 *                       example: "batch_20251107"
 *                     status:
 *                       type: string
 *                       enum: [PENDING, PROCESSING, DONE, ERROR]
 *                       description: 현재 상태
 *                       example: "DONE"
 *                     total_count:
 *                       type: integer
 *                       description: 총 수신자 수
 *                       example: 50
 *                     completed_count:
 *                       type: integer
 *                       description: 완료된 전송 수
 *                       example: 48
 *                     failed_count:
 *                       type: integer
 *                       description: 실패한 전송 수
 *                       example: 2
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       description: 요청 생성 시간
 *                       example: "2025-11-07T10:00:00Z"
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       description: 마지막 업데이트 시간
 *                       example: "2025-11-07T10:05:00Z"
 *       404:
 *         description: 요청을 찾을 수 없음
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
 *                   example: "404"
 *                 detail:
 *                   type: object
 *                   properties:
 *                     error:
 *                       type: string
 *                       example: "요청을 찾을 수 없습니다."
 *       401:
 *         description: API Key 인증 실패
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
 *                   example: "401"
 *                 detail:
 *                   type: object
 *                   properties:
 *                     error:
 *                       type: string
 *                       example: "유효하지 않은 API Key입니다."
 *       500:
 *         description: 서버 오류
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
 *                   example: "500"
 *                 detail:
 *                   type: object
 *                   properties:
 *                     error:
 *                       type: string
 *                       example: "서버 내부 오류가 발생했습니다."
 */
export async function getCompanySend(req, res, next) {
    const startTime = Date.now();

    try {
        console.log('[COMPANY SEND] 상태 조회 요청 수신');

        // 1. request_id 추출
        const { request_id } = req.params;

        if (!request_id) {
            throw new Error('request_id는 필수입니다.');
        }

        // 2. Service Layer 호출
        const status = await getCompanySendStatus(request_id);

        if (!status) {
            throw new Error('요청을 찾을 수 없습니다.');
        }

        // 3. 로그 기록
        const latency = Date.now() - startTime;
        await insertLog({
            cate1: 'company_send',
            cate2: 'status',
            request_id,
            service_key_id: req.serviceKeyId || null,
            req_ip_text: req.ip || '0.0.0.0',
            req_server: req.headers.host || null,
            req_status: 'Y',
            api_name: 'GET /api/companysend/:request_id',
            api_parameter: null,
            result_code: '200',
            latency_ms: latency,
            error_code: null,
            error_message: null,
            content: `status=${status.status}`
        });

        // 4. 성공 응답
        res.status(200).json({
            result: 'success',
            code: '200',
            detail: status
        });

    } catch (error) {
        console.error('[COMPANY SEND] 상태 조회 오류:', error);

        // 로그 기록 (실패)
        const latency = Date.now() - startTime;
        await insertLog({
            cate1: 'company_send',
            cate2: 'status',
            request_id: req.params.request_id || null,
            service_key_id: req.serviceKeyId || null,
            req_ip_text: req.ip || '0.0.0.0',
            req_server: req.headers.host || null,
            req_status: 'Y',
            api_name: 'GET /api/companysend/:request_id',
            api_parameter: null,
            result_code: '404',
            latency_ms: latency,
            error_code: 'NOT_FOUND',
            error_message: error.message,
            content: null
        });

        // 에러 응답
        res.status(404).json({
            result: 'fail',
            code: '404',
            detail: {
                error: error.message
            }
        });
    }
}

/**
 * Export
 */
export default {
    postCompanySend,
    getCompanySend
};