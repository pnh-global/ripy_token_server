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
 * - 2025-11-05: Phase 1-B DB 스키마 호환성 개선
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

    // contract_id를 숫자로 변환하여 검증
    const contractId = typeof data.contract_id === 'string'
        ? parseInt(data.contract_id)
        : data.contract_id;

    if (isNaN(contractId) || contractId <= 0) {
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
 *       404:
 *         description: 계약서를 찾을 수 없음
 *       409:
 *         description: 이미 서명 완료된 계약서
 *       500:
 *         description: 서버 내부 오류
 */

/**
 * 최종 서명 완료 컨트롤러
 *
 * @async
 * @function finalizeSign
 * @param {Object} req - Express request 객체
 * @param {Object} res - Express response 객체
 * @returns {Promise<void>} JSON 응답 전송
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

        // contract_id를 숫자로 변환
        contractId = typeof decryptedData.contract_id === 'string'
            ? parseInt(decryptedData.contract_id)
            : decryptedData.contract_id;

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
        // Mock 환경에서는 contract 정보를 기반으로 트랜잭션 재구성
        // 실제 환경에서는 createSign 시 partial_tx를 별도 저장했다가 불러와야 함
        const partialTransaction = {
            serialized: Buffer.from(JSON.stringify({
                from: contract.sender,
                to: contract.recipient,
                amount: parseFloat(contract.ripy),
                feepayer: contract.feepayer,
                signatures: [] // 회사 서명은 이미 추가되어 있다고 가정
            })).toString('base64'),
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
        // Phase 1-B: DB 스키마에 맞게 signed_or_not2만 업데이트
        console.log('[CONTROLLER DEBUG] updateContract 호출 전');
        await updateContract(contractId, {
            signed_or_not2: 'Y'
            // tx_signature 필드는 현재 DB 스키마에 없으므로 제외
        });
        console.log('[CONTROLLER DEBUG] contract 업데이트 완료');

        // 11. 성공 로그 기록
        const latencyMs = Date.now() - startTime;
        await insertLog({
            cate1: decryptedData.cate1 || contract.cate1,
            cate2: decryptedData.cate2 || contract.cate2,
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