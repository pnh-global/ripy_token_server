/**
 * ============================================
 * finalizeSign.controller.js - 최종 서명 완료 컨트롤러
 * ============================================
 *
 * 역할:
 * - 부분 서명된 계약서에 사용자 서명 추가
 * - 최종 트랜잭션 전송
 * - 계약서 상태 업데이트
 *
 * 처리 흐름:
 * 1. contract_id로 계약서 조회
 * 2. 사용자 서명(user_signature) 추가
 * 3. 최종 트랜잭션 생성 (finalizeTransaction)
 * 4. Solana 네트워크에 전송 (sendTransaction)
 * 5. r_contract 상태 업데이트
 * 6. r_log 기록
 *
 * 변경 이력:
 * - 2025-11-04: Phase 1-B 초기 구현
 */

// 모듈 임포트
import { decrypt, encrypt } from '../utils/encryption.js';
import { getContractById, updateContract } from '../models/contract.model.js';
import { insertLog } from '../models/log.model.js';
import { finalizeTransaction, sendTransaction, waitForConfirmation } from '../services/transactionService.js';

/**
 * 입력값 검증 함수
 *
 * @private
 * @param {Object} data - 검증할 데이터
 * @param {number} data.contract_id - 계약서 ID
 * @param {Object} data.user_signature - 사용자 서명 데이터
 * @throws {Error} 필수 필드 누락 시
 * @returns {boolean} 검증 성공 시 true
 */
function validateInput(data) {
    console.log('[VALIDATE DEBUG] finalizeSign 검증 시작:', JSON.stringify(data, null, 2));

    // 1. contract_id 검증
    if (!data.contract_id) {
        throw new Error('필수 필드가 누락되었습니다: contract_id');
    }

    if (typeof data.contract_id !== 'number' || data.contract_id <= 0) {
        throw new Error('contract_id는 양수여야 합니다.');
    }

    // 2. user_signature 검증
    if (!data.user_signature) {
        throw new Error('필수 필드가 누락되었습니다: user_signature');
    }

    if (typeof data.user_signature !== 'object') {
        throw new Error('user_signature는 객체여야 합니다.');
    }

    // user_signature 구조 검증
    if (!data.user_signature.publicKey || !data.user_signature.signature) {
        throw new Error('user_signature에 publicKey와 signature가 필요합니다.');
    }

    console.log('[VALIDATE DEBUG] 모든 검증 통과');
    return true;
}

/**
 * @swagger
 * /api/sign/finalize:
 *   post:
 *     summary: 최종 서명 완료 및 트랜잭션 전송
 *     description: |
 *       부분 서명된 계약서에 사용자의 최종 서명을 추가하고 Solana 네트워크에 전송합니다.
 *
 *       **프로세스:**
 *       1. contract_id로 부분 서명된 계약서 조회
 *       2. 사용자 서명 추가 (user_signature)
 *       3. 최종 트랜잭션 생성 (finalizeTransaction)
 *       4. Solana 네트워크에 전송 (sendTransaction)
 *       5. 트랜잭션 확인 대기 (waitForConfirmation)
 *       6. r_contract 테이블 상태 업데이트 (signed_or_not2='Y')
 *       7. r_log 테이블에 로그 기록
 *
 *       **보안:**
 *       - API Key 인증 필수 (x-api-key 헤더)
 *       - 요청 데이터는 service key로 암호화되어 전송
 *       - 중복 서명 방지 (signed_or_not2 확인)
 *     tags:
 *       - Sign (서명)
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - data
 *             properties:
 *               data:
 *                 type: string
 *                 description: |
 *                   service key로 암호화된 JSON 문자열 (AES-256-CBC)
 *
 *                   **복호화 후 데이터 구조:**
 *                   ```json
 *                   {
 *                     "contract_id": 1234,
 *                     "user_signature": {
 *                       "publicKey": "사용자_지갑_공개키",
 *                       "signature": "사용자_서명_Base64"
 *                     }
 *                   }
 *                   ```
 *                 example: "U2FsdGVkX1+abcdefghijk..."
 *     responses:
 *       200:
 *         description: 최종 서명 및 전송 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     contract_id:
 *                       type: integer
 *                       description: 계약서 ID
 *                       example: 1234
 *                     txid:
 *                       type: string
 *                       description: Solana 트랜잭션 서명 (signature)
 *                       example: "5Kn7W8nX..."
 *                     status:
 *                       type: string
 *                       description: 트랜잭션 상태
 *                       example: "confirmed"
 *                     message:
 *                       type: string
 *                       description: 성공 메시지
 *                       example: "트랜잭션이 성공적으로 전송되었습니다."
 *       400:
 *         description: 잘못된 요청 (필수 필드 누락, 유효하지 않은 서명)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "필수 필드가 누락되었습니다: contract_id"
 *       404:
 *         description: 계약서를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "계약서를 찾을 수 없습니다."
 *       409:
 *         description: 이미 서명 완료된 계약서
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "이미 서명이 완료된 계약서입니다."
 *       500:
 *         description: 서버 내부 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Internal Server Error"
 */

/**
 * 최종 서명 완료 컨트롤러
 *
 * 부분 서명된 계약서에 사용자 서명을 추가하고 Solana 네트워크에 전송합니다.
 *
 * **처리 흐름:**
 * 1. 암호화된 데이터 복호화
 * 2. 입력값 검증 (contract_id, user_signature)
 * 3. 계약서 조회 및 상태 확인
 * 4. 최종 트랜잭션 생성 (사용자 서명 추가)
 * 5. Solana 네트워크에 전송
 * 6. 트랜잭션 확인 대기
 * 7. r_contract 상태 업데이트 (signed_or_not2='Y')
 * 8. r_log 기록
 *
 * @async
 * @function finalizeSign
 * @param {Object} req - Express request 객체
 * @param {Object} req.body - 요청 본문
 * @param {string} req.body.data - service key로 암호화된 JSON 데이터
 * @param {Object} req.serviceKey - API Key 미들웨어에서 주입된 서비스 키 정보
 * @param {number} req.serviceKey.idx - 서비스 키 ID (r_log 기록용)
 * @param {string} req.ip - 요청자 IP 주소
 * @param {string} req.hostname - 요청자 호스트명
 * @param {Object} res - Express response 객체
 * @returns {Promise<void>} JSON 응답 전송
 *
 * @throws {Error} 암호화된 data 필드 누락 시
 * @throws {Error} 복호화 실패 시
 * @throws {Error} 필수 필드 누락 시
 * @throws {Error} 계약서를 찾을 수 없을 때
 * @throws {Error} 이미 서명 완료된 계약서일 때
 * @throws {Error} 트랜잭션 생성 실패 시
 * @throws {Error} 트랜잭션 전송 실패 시
 *
 * @example
 * // 정상 요청
 * POST /api/sign/finalize
 * Headers: { "x-api-key": "your-service-key" }
 * Body: {
 *   "data": "암호화된_JSON_문자열"
 * }
 *
 * // 복호화 후 원본 데이터:
 * {
 *   "contract_id": 1234,
 *   "user_signature": {
 *     "publicKey": "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV",
 *     "signature": "3Bv7wN..."
 *   }
 * }
 *
 * // 응답:
 * {
 *   "ok": true,
 *   "data": {
 *     "contract_id": 1234,
 *     "txid": "5Kn7W8nX...",
 *     "status": "confirmed",
 *     "message": "트랜잭션이 성공적으로 전송되었습니다."
 *   }
 * }
 */
export async function finalizeSign(req, res) {
    const startTime = Date.now();
    let decryptedData = null;
    let contractId = null;

    try {
        // 1. 암호화된 데이터 검증
        if (!req.body || !req.body.data) {
            throw new Error('암호화된 data 필드가 필요합니다.');
        }

        // 2. 데이터 복호화
        const encryptionKey = process.env.ENCRYPTION_KEY;
        if (!encryptionKey) {
            throw new Error('ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.');
        }

        const decryptedString = decrypt(req.body.data, encryptionKey);
        decryptedData = JSON.parse(decryptedString);

        console.log('[CONTROLLER DEBUG] 복호화 완료:', {
            contract_id: decryptedData.contract_id,
            has_user_signature: !!decryptedData.user_signature
        });

        // 3. 입력값 검증
        validateInput(decryptedData);

        contractId = decryptedData.contract_id;

        // 4. 계약서 조회
        console.log('[CONTROLLER DEBUG] 계약서 조회 시작:', contractId);
        const contract = await getContractById(contractId);

        if (!contract) {
            throw new Error('계약서를 찾을 수 없습니다.');
        }

        console.log('[CONTROLLER DEBUG] 계약서 조회 완료:', {
            idx: contract.idx,
            signed_or_not1: contract.signed_or_not1,
            signed_or_not2: contract.signed_or_not2
        });

        // 5. 중복 서명 방지
        if (contract.signed_or_not2 === 'Y') {
            throw new Error('이미 서명이 완료된 계약서입니다.');
        }

        // 6. 부분 서명 트랜잭션 데이터 준비
        // createSign에서 반환된 부분 서명 트랜잭션은 앱에 저장되어 있음
        // 여기서는 contract 정보를 기반으로 다시 구성
        const partialTransaction = {
            serialized: contract.partial_tx_data, // DB에 저장된 부분 서명 트랜잭션
            sender: contract.sender,
            recipient: contract.recipient,
            amount: parseFloat(contract.ripy)
        };

        console.log('[CONTROLLER DEBUG] finalizeTransaction 호출 전');

        // 7. 최종 트랜잭션 생성 (사용자 서명 추가)
        let finalizedTx;
        try {
            finalizedTx = await finalizeTransaction(
                partialTransaction,
                decryptedData.user_signature
            );
            console.log('[CONTROLLER DEBUG] finalizeTransaction 완료');
        } catch (txError) {
            console.error('[CONTROLLER DEBUG] finalizeTransaction 에러:', txError);
            throw new Error(`트랜잭션 생성 실패: ${txError.message}`);
        }

        console.log('[CONTROLLER DEBUG] sendTransaction 호출 전');

        // 8. Solana 네트워크에 전송
        let sendResult;
        try {
            sendResult = await sendTransaction(finalizedTx);
            console.log('[CONTROLLER DEBUG] sendTransaction 완료:', sendResult.signature);
        } catch (sendError) {
            console.error('[CONTROLLER DEBUG] sendTransaction 에러:', sendError);
            throw new Error(`트랜잭션 전송 실패: ${sendError.message}`);
        }

        console.log('[CONTROLLER DEBUG] waitForConfirmation 호출 전');

        // 9. 트랜잭션 확인 대기 (선택사항)
        let confirmResult;
        try {
            confirmResult = await waitForConfirmation(sendResult.signature, {
                timeout: 30000,
                commitment: 'confirmed'
            });
            console.log('[CONTROLLER DEBUG] 트랜잭션 확인 완료:', confirmResult.status);
        } catch (confirmError) {
            console.error('[CONTROLLER DEBUG] 트랜잭션 확인 에러:', confirmError);
            // 확인 실패해도 전송은 성공했으므로 계속 진행
            console.warn('[WARNING] 트랜잭션 확인 실패했지만 전송은 성공');
        }

        // 10. r_contract 상태 업데이트
        console.log('[CONTROLLER DEBUG] updateContract 호출 전');
        await updateContract(contractId, {
            signed_or_not2: 'Y',
            tx_signature: sendResult.signature
        });
        console.log('[CONTROLLER DEBUG] contract 업데이트 완료');

        // 11. 성공 로그 기록
        const latencyMs = Date.now() - startTime;
        await insertLog({
            cate1: decryptedData.cate1 || 'sign',
            cate2: decryptedData.cate2 || 'finalize',
            request_id: `finalize-${contractId}-${Date.now()}`,
            service_key_id: req.serviceKey?.idx || null,
            req_ip_text: req.ip || '0.0.0.0',
            req_server: req.hostname || null,
            req_status: 'Y',
            api_name: '/api/sign/finalize',
            api_parameter: JSON.stringify({
                contract_id: contractId
            }),
            result_code: '200',
            latency_ms: latencyMs,
            error_code: null,
            error_message: null,
            content: JSON.stringify({
                contract_id: contractId,
                txid: sendResult.signature,
                status: confirmResult?.status || 'sent'
            })
        });

        // 12. 응답 데이터 구성
        const responseData = {
            contract_id: contractId,
            txid: sendResult.signature,
            status: confirmResult?.status || 'sent',
            message: '트랜잭션이 성공적으로 전송되었습니다.'
        };

        console.log('[CONTROLLER DEBUG] 응답 데이터 구성 완료');

        // 13. 응답 반환
        res.status(200).json({
            ok: true,
            data: responseData
        });

    } catch (error) {
        // 에러 처리
        console.error('[finalizeSign] 에러:', error.message);

        // 에러 로그 기록
        const latencyMs = Date.now() - startTime;

        try {
            await insertLog({
                cate1: decryptedData?.cate1 || 'sign',
                cate2: decryptedData?.cate2 || 'finalize',
                request_id: 'error-finalize-' + Date.now(),
                service_key_id: req.serviceKey?.idx || null,
                req_ip_text: req.ip || '0.0.0.0',
                req_server: req.hostname || null,
                req_status: 'N',
                api_name: '/api/sign/finalize',
                api_parameter: contractId ? JSON.stringify({ contract_id: contractId }) : null,
                result_code: '400',
                latency_ms: latencyMs,
                error_code: 'FINALIZE_SIGN_ERROR',
                error_message: error.message,
                content: null
            });
        } catch (logError) {
            console.error('[finalizeSign] 로그 기록 실패:', logError.message);
        }

        // HTTP 상태 코드 결정
        let statusCode = 400;
        if (error.message.includes('찾을 수 없습니다')) {
            statusCode = 404;
        } else if (error.message.includes('이미 서명이 완료')) {
            statusCode = 409;
        }

        // 에러 응답
        res.status(statusCode).json({
            ok: false,
            error: error.message
        });
    }
}