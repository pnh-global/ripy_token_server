/**
 * ============================================
 * createSign.controller.js - 부분 서명 계약서 생성 컨트롤러
 * ============================================
 *
 * 역할:
 * - 토큰 전송을 위한 계약서 생성 (부분 서명)
 * - 회사 지갑(feepayer)이 트랜잭션에 부분 서명
 * - 사용자(recipient)가 최종 서명 필요
 *
 * 보안 개선사항 (Phase 1-A):
 * - feepayer는 환경변수에서 자동 로드 (클라이언트 요청에서 제거)
 * - 회사 지갑 주소는 응답에 포함하지 않음
 * - 입력값 검증 강화
 * - 환경변수 누락 시 명확한 에러 메시지
 *
 * 변경 이력:
 * - 2025-11-04: Phase 1-A 보안 아키텍처 개선 완료
 */

// 모듈 임포트
import { decrypt, encrypt } from '../utils/encryption.js';
import { isSolanaAddress, isValidAmount } from '../utils/validator.js';
import { createContract } from '../models/contract.model.js';
import { insertLog } from '../models/log.model.js';
import { createPartialSignedTransaction } from '../services/transactionService.js';

/**
 * 입력값 검증 함수
 *
 * 필수 필드와 데이터 형식을 검증합니다.
 * Phase 1-A: feepayer 필드 제거 (환경변수에서 자동 처리)
 *
 * @private
 * @param {Object} data - 검증할 데이터
 * @param {string} data.cate1 - 카테고리 1 (예: 'reward', 'payment')
 * @param {string} data.cate2 - 카테고리 2 (예: 'event', 'subscription')
 * @param {string} data.sender - 발신자 Solana 지갑 주소 (Base58, 32-44자)
 * @param {string} data.recipient - 수신자 Solana 지갑 주소 (Base58, 32-44자)
 * @param {string|number} data.ripy - 전송할 RIPY 토큰 수량 (양수, 최대 소수점 9자리)
 * @throws {Error} 필수 필드 누락 시
 * @throws {Error} 유효하지 않은 Solana 주소 시
 * @throws {Error} 유효하지 않은 금액 시
 * @returns {boolean} 검증 성공 시 true
 *
 * @example
 * validateInput({
 *   cate1: 'reward',
 *   cate2: 'event',
 *   sender: 'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy',
 *   recipient: '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
 *   ripy: '100.5'
 * });
 * // Returns: true
 */
function validateInput(data) {
    console.log('[VALIDATE DEBUG] 검증 시작:', JSON.stringify(data, null, 2));

    // 1. 필수 필드 검증 (feepayer 제외)
    const requiredFields = ['cate1', 'cate2', 'sender', 'recipient', 'ripy'];

    for (const field of requiredFields) {
        if (!data[field]) {
            console.log('[VALIDATE DEBUG] 필드 누락:', field, '값:', data[field]);
            throw new Error(`필수 필드가 누락되었습니다: ${field}`);
        }
    }

    // 2. Solana 주소 검증
    console.log('[VALIDATE DEBUG] sender 검증 시작:', data.sender);
    if (!isSolanaAddress(data.sender)) {
        console.log('[VALIDATE DEBUG] sender 검증 실패');
        throw new Error('유효하지 않은 발신자 주소입니다.');
    }
    console.log('[VALIDATE DEBUG] sender 검증 통과');

    console.log('[VALIDATE DEBUG] recipient 검증 시작:', data.recipient);
    if (!isSolanaAddress(data.recipient)) {
        console.log('[VALIDATE DEBUG] recipient 검증 실패');
        throw new Error('유효하지 않은 수신자 주소입니다.');
    }
    console.log('[VALIDATE DEBUG] recipient 검증 통과');

    // 3. 금액 검증
    if (!isValidAmount(data.ripy)) {
        throw new Error('유효하지 않은 금액입니다. (0보다 큰 숫자여야 하며, 최대 소수점 9자리)');
    }

    console.log('[VALIDATE DEBUG] 모든 검증 통과');
    return true;
}

/**
 * 환경변수 검증 함수
 *
 * 필수 환경변수가 설정되어 있는지 확인합니다.
 * Phase 1-A: 보안 강화를 위해 추가
 *
 * @private
 * @throws {Error} 필수 환경변수 누락 시
 * @returns {Object} 검증된 환경변수 객체
 */
function validateEnvironment() {
    const required = {
        ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
        COMPANY_WALLET_ADDRESS: process.env.COMPANY_WALLET_ADDRESS,
        RIPY_TOKEN_MINT_ADDRESS: process.env.RIPY_TOKEN_MINT_ADDRESS
    };

    const missing = [];
    for (const [key, value] of Object.entries(required)) {
        if (!value) {
            missing.push(key);
        }
    }

    if (missing.length > 0) {
        throw new Error(
            `필수 환경변수가 설정되지 않았습니다: ${missing.join(', ')}`
        );
    }

    return required;
}

/**
 * @swagger
 * /api/sign/create:
 *   post:
 *     summary: 부분 서명 트랜잭션 생성
 *     description: |
 *       RIPY 토큰 전송을 위한 부분 서명 트랜잭션을 생성합니다.
 *
 *       **프로세스:**
 *       1. 웹서버가 service key로 암호화한 데이터 수신
 *       2. 데이터 복호화 및 검증
 *       3. r_contract 테이블에 계약서 생성
 *       4. 회사 지갑으로 feepayer 부분 서명 (환경변수에서 자동 로드)
 *       5. 부분 서명된 트랜잭션을 Base64로 반환
 *       6. 앱에서 사용자 서명 추가 후 최종 제출
 *
 *       **보안 (Phase 1-A 개선):**
 *       - API Key 인증 필수 (x-api-key 헤더)
 *       - 요청 데이터는 service key로 암호화되어 전송
 *       - feepayer(회사 지갑)는 서버 환경변수에서 자동 설정 (클라이언트 전송 불가)
 *       - 회사 지갑 주소는 응답에 포함되지 않음
 *       - IP 기반 접근 제어 가능
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
 *                     "cate1": "reward",
 *                     "cate2": "event",
 *                     "sender": "발신자_지갑_주소",
 *                     "recipient": "수신자_지갑_주소",
 *                     "ripy": "100.5"
 *                   }
 *                   ```
 *
 *                   **주의: feepayer는 서버에서 자동 설정되므로 포함하지 않습니다.**
 *                 example: "U2FsdGVkX1+abcdefghijk..."
 *     responses:
 *       200:
 *         description: 부분 서명 트랜잭션 생성 성공
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
 *                     contract_idx:
 *                       type: integer
 *                       description: 생성된 계약서 ID (r_contract.idx)
 *                       example: 1234
 *                     partial_signed_transaction:
 *                       type: object
 *                       description: 부분 서명된 트랜잭션 정보 (보안상 feepayer 주소 미포함)
 *                       properties:
 *                         transaction:
 *                           type: string
 *                           description: Base64로 인코딩된 부분 서명 트랜잭션
 *                           example: "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo="
 *                         sender:
 *                           type: string
 *                           description: 발신자 주소
 *                           example: "SenderWalletAddress123456789012345"
 *                         recipient:
 *                           type: string
 *                           description: 수신자 주소
 *                           example: "RecipientWalletAddress12345678901"
 *                         amount:
 *                           type: number
 *                           description: RIPY 토큰 수량
 *                           example: 100.5
 *                         blockhash:
 *                           type: string
 *                           description: Solana 최근 blockhash
 *                           example: "9sHcv6xwn9YkB62fdy7vwfYfpq5yUzAZ8z2eCd"
 *                         lastValidBlockHeight:
 *                           type: integer
 *                           description: 트랜잭션 유효 마지막 블록 높이
 *                           example: 123456789
 *       400:
 *         description: 잘못된 요청 (필수 필드 누락, 유효하지 않은 주소/금액)
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
 *                   example: "필수 필드가 누락되었습니다: sender"
 *       401:
 *         description: 인증 실패 (유효하지 않은 API Key)
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
 *                   example: "Unauthorized"
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
 * 부분 서명 트랜잭션 생성 컨트롤러
 *
 * RIPY 토큰 전송을 위한 부분 서명 트랜잭션을 생성합니다.
 * 회사 지갑이 feepayer로 부분 서명하고, 사용자는 나중에 추가 서명합니다.
 *
 * **처리 흐름 (Phase 1-A 개선):**
 * 1. 환경변수 검증 (ENCRYPTION_KEY, COMPANY_WALLET_ADDRESS 등)
 * 2. 웹서버로부터 암호화된 데이터 수신 (req.body.data)
 * 3. service key로 데이터 복호화
 * 4. 입력값 검증 (필수 필드, Solana 주소, 금액) - feepayer 제외
 * 5. 환경변수에서 회사 지갑 주소(feepayer) 자동 로드
 * 6. r_contract 테이블에 계약서 생성 (signed_or_not1='N', signed_or_not2='N')
 * 7. Solana 부분 서명 트랜잭션 생성 (회사 지갑으로 feepayer 서명)
 * 8. r_log 테이블에 API 호출 로그 기록
 * 9. 부분 서명된 트랜잭션 정보 반환 (feepayer 주소 제외)
 *
 * **데이터 흐름:**
 * ```
 * 웹서버 → [암호화된 데이터] → 토큰 서버 → [복호화] → 검증
 *   ↓
 * 환경변수에서 feepayer 로드 → r_contract 생성 → Solana 부분 서명 → r_log 기록
 *   ↓
 * [응답 데이터 (feepayer 제외)] → 웹서버 → 앱 (사용자 서명 대기)
 * ```
 *
 * @async
 * @function createSign
 * @param {Object} req - Express request 객체
 * @param {Object} req.body - 요청 본문
 * @param {string} req.body.data - service key로 암호화된 JSON 데이터 (AES-256-CBC)
 * @param {Object} req.serviceKey - API Key 미들웨어에서 주입된 서비스 키 정보
 * @param {number} req.serviceKey.idx - 서비스 키 ID (r_log 기록용)
 * @param {string} req.serviceKey.service_name - 서비스 이름
 * @param {string} req.ip - 요청자 IP 주소
 * @param {string} req.hostname - 요청자 호스트명
 * @param {Object} res - Express response 객체
 * @returns {Promise<void>} JSON 응답 전송
 *
 * @throws {Error} 환경변수 누락 시
 * @throws {Error} 암호화된 data 필드 누락 시
 * @throws {Error} 복호화 실패 시
 * @throws {Error} 필수 필드 누락 시
 * @throws {Error} 유효하지 않은 Solana 주소 시
 * @throws {Error} 유효하지 않은 금액 시
 * @throws {Error} DB 오류 시
 * @throws {Error} Solana 트랜잭션 생성 실패 시
 *
 * @example
 * // 정상 요청
 * POST /api/sign/create
 * Headers: { "x-api-key": "your-service-key" }
 * Body: {
 *   "data": "암호화된_JSON_문자열"
 * }
 *
 * // 복호화 후 원본 데이터:
 * {
 *   "cate1": "reward",
 *   "cate2": "event",
 *   "sender": "DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy",
 *   "recipient": "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV",
 *   "ripy": "100.5"
 * }
 *
 * // 응답 (feepayer 주소 미포함):
 * {
 *   "ok": true,
 *   "data": {
 *     "contract_idx": 1234,
 *     "partial_signed_transaction": {
 *       "transaction": "AQAAAAAAAAAAAAAAAAAAAAAAAAo=",
 *       "sender": "DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy",
 *       "recipient": "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV",
 *       "amount": 100.5,
 *       "blockhash": "9sHcv6xwn9YkB62fdy7vwfYfpq5yUzAZ8z2eCd",
 *       "lastValidBlockHeight": 123456789
 *     }
 *   }
 * }
 */
export async function createSign(req, res) {
    const startTime = Date.now();
    let decryptedData = null;
    let contractIdx = null;

    try {
        // 1. 환경변수 검증 (Phase 1-A 추가)
        // 필수 환경변수가 설정되어 있는지 확인
        const env = validateEnvironment();
        console.log('[CONTROLLER DEBUG] 환경변수 검증 완료');

        // 2. 암호화된 데이터 검증
        if (!req.body || !req.body.data) {
            console.log('암호화된 data 필드가 필요합니다.');
            throw new Error('암호화된 data 필드가 필요합니다.');
        }

        // 3. 데이터 복호화
        // 웹서버가 service key로 암호화한 데이터를 복호화
        // 주의: 현재는 ENCRYPTION_KEY(마스터 키)로 복호화
        // 향후 service key별로 다른 키를 사용할 경우 수정 필요
        if (process.env.NODE_ENV === 'development' && req.body.cate1) {
            console.log('[CONTROLLER DEBUG] 개발 모드 - 암호화 건너뛰기');
            decryptedData = req.body;
        } else {
            // 프로덕션: 암호화된 데이터 복호화
            const decryptedString = decrypt(req.body.data, encryptionKey);
            decryptedData = JSON.parse(decryptedString);
        }

        console.log('[CONTROLLER DEBUG] 복호화 완료, 데이터:', {
            cate1: decryptedData.cate1,
            cate2: decryptedData.cate2,
            sender: decryptedData.sender,
            recipient: decryptedData.recipient,
            ripy: decryptedData.ripy
        });

        // 4. 입력값 검증 (Phase 1-A: feepayer 필드 제외)
        // - 필수 필드: cate1, cate2, sender, recipient, ripy
        // - Solana 주소 형식 검증 (Base58, 32-44자)
        // - 금액 양수 및 소수점 9자리 이하 검증
        validateInput(decryptedData);

        // 5. feepayer 주소 설정 (Phase 1-A: 환경변수에서 자동 로드)
        // 회사 지갑이 수수료를 대납하므로 환경변수에서 가져옴
        // 클라이언트에서 feepayer를 받지 않음 (보안 강화)
        const feepayer = env.COMPANY_WALLET_ADDRESS;
        console.log('[CONTROLLER DEBUG] feepayer 환경변수에서 로드 완료');
        console.log('[CONTROLLER DEBUG] validation 통과, contract 생성 시작');

        // 6. r_contract 테이블에 계약서 생성
        // - signed_or_not1='N': 발신자 아직 서명 안함
        // - signed_or_not2='N': 수신자 아직 서명 안함
        console.log('[CONTROLLER DEBUG] createContract 호출 전 - 파라미터:', {
            sender: decryptedData.sender,
            recipient: decryptedData.recipient,
            feepayer: feepayer
        });

        const contract = await createContract({
            cate1: decryptedData.cate1,
            cate2: decryptedData.cate2,
            sender: decryptedData.sender,
            recipient: decryptedData.recipient,
            feepayer: feepayer,
            ripy: decryptedData.ripy,
            signed_or_not1: 'N',
            signed_or_not2: 'N'
        });

        console.log('[CONTROLLER DEBUG] contract 생성 완료:', contract.idx);

        contractIdx = contract.idx;

        console.log('[CONTROLLER DEBUG] createPartialSignedTransaction 호출 전');
        console.log('[CONTROLLER DEBUG] 파라미터:', {
            fromPubkey: decryptedData.sender,
            toPubkey: decryptedData.recipient,
            amount: parseFloat(decryptedData.ripy),
            tokenMint: env.RIPY_TOKEN_MINT_ADDRESS
        });

        // 7. Solana 부분 서명 트랜잭션 생성
        let partialSignedTx;
        try {
            partialSignedTx = await createPartialSignedTransaction({
                fromPubkey: decryptedData.sender,
                toPubkey: decryptedData.recipient,
                amount: parseFloat(decryptedData.ripy),
                tokenMint: env.RIPY_TOKEN_MINT_ADDRESS
            });
            console.log('[CONTROLLER DEBUG] createPartialSignedTransaction 완료');
        } catch (txError) {
            console.error('[CONTROLLER DEBUG] createPartialSignedTransaction 에러:', txError);
            console.error('[CONTROLLER DEBUG] 에러 메시지:', txError.message);
            console.error('[CONTROLLER DEBUG] 에러 스택:', txError.stack);
            throw txError; // 에러를 다시 던져서 외부 catch에서 처리
        }

        // 8. 성공 로그 기록
        const latencyMs = Date.now() - startTime;
        await insertLog({
            cate1: decryptedData.cate1,
            cate2: decryptedData.cate2,
            request_id: `sign-${contractIdx}-${Date.now()}`,  // 고유한 request_id 생성
            service_key_id: req.serviceKey?.idx || null,
            req_ip_text: req.ip || '0.0.0.0',
            req_server: req.hostname || null,
            req_status: 'Y',  // 성공
            api_name: '/api/sign/create',
            api_parameter: JSON.stringify({
                sender: decryptedData.sender,
                recipient: decryptedData.recipient,
                amount: decryptedData.ripy
            }),
            result_code: '200',
            latency_ms: latencyMs,
            error_code: null,
            error_message: null,
            content: JSON.stringify({ contract_idx: contractIdx })
        });

        // 9. 응답 데이터 구성 (Phase 1-A: feepayer 주소 제외)
        // 보안상 회사 지갑 주소를 응답에 포함하지 않음
        // partialSignedTx에서 feepayer 필드 제거
        const { feepayer: _, ...sanitizedTx } = partialSignedTx;

        const responseData = {
            contract_idx: contractIdx,
            partial_signed_transaction: sanitizedTx
        };

        console.log('[CONTROLLER DEBUG] 응답 데이터 구성 완료 (feepayer 제외)');

        // 10. 응답 반환
        // 필요시 암호화하여 반환할 수도 있음
        res.status(200).json({
            ok: true,
            data: responseData
        });

    } catch (error) {
        // 에러 처리
        console.error('[createSign] 에러:', error.message);

        // 에러 로그 기록
        const latencyMs = Date.now() - startTime;

        try {
            await insertLog({
                cate1: decryptedData?.cate1 || 'UNKNOWN',
                cate2: decryptedData?.cate2 || 'UNKNOWN',
                request_id: 'error-' + Date.now(),  // request_id를 null 대신 고유값 생성
                service_key_id: req.serviceKey?.idx || null,
                req_ip_text: req.ip || '0.0.0.0',
                req_server: req.hostname || null,
                req_status: 'N',  // 실패
                api_name: '/api/sign/create',
                api_parameter: null,
                result_code: '400',
                latency_ms: latencyMs,
                error_code: 'CREATE_SIGN_ERROR',
                error_message: error.message,
                content: null
            });
        } catch (logError) {
            // 로그 기록 실패는 무시 (원본 에러를 반환하는 것이 우선)
            console.error('[createSign] 로그 기록 실패:', logError.message);
        }

        // 에러 응답
        res.status(400).json({
            ok: false,
            error: error.message
        });
    }
}