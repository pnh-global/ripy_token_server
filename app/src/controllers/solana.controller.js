/**
 * Solana Controller
 *
 * 역할:
 * - HTTP 요청(req)과 응답(res)을 처리
 * - 암호화된 요청 데이터를 복호화
 * - 서비스 레이어(solana.service.js) 호출
 * - 응답 데이터를 암호화하여 반환
 * - 에러 핸들링 및 로그 기록
 *
 * 보안 처리:
 * - 요청: 웹서버에서 보낸 암호화된 데이터를 service_key로 복호화
 * - 응답: 결과 데이터를 service_key로 암호화하여 반환
 */

import crypto from 'crypto';
import { Connection } from '@solana/web3.js';
import { getClientIp } from '../utils/ipHelper.js';
import { insertLog } from '../models/log.model.js';
import * as solanaService from '../services/solana.service.js';
import { decryptRequest, encryptResponse } from '../utils/crypto.util.js';


/**
 * 공통 에러 응답 처리 함수
 * @param {Object} res - Express response 객체
 * @param {Error} error - 발생한 에러 객체
 * @param {string} apiName - API 이름
 * @param {Object} req - Express request 객체
 */
const handleError = async (res, error, apiName, req) => {
    // 에러 정보 추출
    const errorCode = error.code || 'UNKNOWN_ERROR';
    const errorMessage = error.message || 'An unknown error occurred';
    const statusCode = error.statusCode || 500;

    // 에러 로그 기록
    try {
        await insertLog({
            cate1: 'solana',
            cate2: 'error',
            request_id: req.requestId || crypto.randomUUID(),
            service_key_id: req.serviceKeyId || null,
            req_ip_text: getClientIp(req),
            req_server: req.headers['x-server-name'] || 'unknown',
            req_status: req.serviceKeyId ? 'Y' : 'N',
            api_name: apiName,
            api_parameter: null, // 보안상 에러 시 파라미터 저장 안함
            result_code: statusCode.toString(),
            latency_ms: req.startTime ? Date.now() - req.startTime : null,
            error_code: errorCode,
            error_message: errorMessage,
            content: JSON.stringify({
                error: errorCode,
                message: errorMessage,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        });
    } catch (logError) {
        console.error('Failed to log error:', logError);
    }

    // 클라이언트에게 에러 응답 (보안을 위해 최소한의 정보만 제공)
    return res.status(statusCode).json({
        success: false,
        error: errorCode,
        message: process.env.NODE_ENV === 'development' ? errorMessage : 'An error occurred'
    });
};

/**
 * 공통 성공 응답 처리 함수
 * @param {Object} res - Express response 객체
 * @param {Object} data - 응답 데이터
 * @param {Object} req - Express request 객체
 * @param {string} apiName - API 이름
 * @param {string} resultCode - 결과 코드
 */
const handleSuccess = async (res, data, req, apiName, resultCode = '200') => {
    try {
        // service_key로 응답 데이터 암호화
        const serviceKey = req.serviceKey; // authMiddleware에서 설정됨
        const encryptedResponse = encryptResponse(data, serviceKey);

        // 성공 로그 기록
        await insertLog({
            cate1: 'solana',
            cate2: 'success',
            request_id: req.requestId || crypto.randomUUID(),
            service_key_id: req.serviceKeyId || null,
            req_ip_text: getClientIp(req),
            req_server: req.headers['x-server-name'] || 'unknown',
            req_status: 'Y',
            api_name: apiName,
            api_parameter: null, // 보안상 파라미터 저장 안함
            result_code: resultCode,
            latency_ms: req.startTime ? Date.now() - req.startTime : null,
            error_code: null,
            error_message: null,
            content: JSON.stringify({
                success: true,
                timestamp: new Date().toISOString()
            })
        });

        // 암호화된 응답 반환
        return res.status(200).json({
            success: true,
            encrypted_data: encryptedResponse
        });
    } catch (error) {
        console.error('Failed to handle success response:', error);
        return handleError(res, error, apiName, req);
    }
};
/**
 * [POST] /api/solana/create-unsigned-transaction
 * 미서명 트랜잭션 생성
 *
 * 요청 데이터 (암호화됨):
 * {
 *   sender: string,           // 발신자 지갑 주소
 *   recipient: string,        // 수신자 지갑 주소
 *   amount: number,           // 전송할 토큰 양
 *   request_id: string        // UUID 형식의 요청 ID
 * }
 *
 * 응답 데이터 (암호화됨):
 * {
 *   unsigned_transaction: string,  // Base64 인코딩된 미서명 트랜잭션
 *   request_id: string,            // 요청 ID
 *   blockhash: string              // 최신 blockhash
 * }
 */
export const createUnsignedTransaction = async (req, res) => {
    const apiName = 'solana/create-unsigned-transaction';
    req.startTime = Date.now();

    try {
        // 1. 암호화된 요청 데이터 복호화
        const serviceKey = req.serviceKey;
        const encryptedData = req.body.encrypted_data;

        if (!encryptedData) {
            throw {
                code: 'MISSING_ENCRYPTED_DATA',
                message: 'encrypted_data is required',
                statusCode: 400
            };
        }

        const decryptedData = decryptRequest(encryptedData, serviceKey);
        const { sender, recipient, amount, request_id } = decryptedData;

        // 2. 입력 검증
        if (!sender || !recipient || !amount || !request_id) {
            throw {
                code: 'INVALID_PARAMETERS',
                message: 'sender, recipient, amount, and request_id are required',
                statusCode: 400
            };
        }

        // request_id를 req 객체에 저장 (로깅용)
        req.requestId = request_id;

        // 3. 서비스 레이어 호출
        const result = await solanaService.createUnsignedTransaction({
            sender,
            recipient,
            amount,
            request_id
        });

        // 4. 성공 응답 반환 (암호화됨)
        return handleSuccess(res, result, req, apiName);

    } catch (error) {
        console.error(`${apiName} error:`, error);
        return handleError(res, error, apiName, req);
    }
};

/**
 * [POST] /api/solana/create-and-partial-sign
 * 부분서명 생성 - 사용자 → 회사 (Fee Payer는 회사)
 *
 * 요청 데이터 (암호화됨):
 * {
 *   sender: string,           // 발신자(사용자) 지갑 주소
 *   amount: number,           // 전송할 토큰 양
 *   request_id: string,       // UUID 형식의 요청 ID
 *   cate1: string,            // 분류1 (예: 'payment')
 *   cate2: string             // 분류2 (예: 'user_to_company')
 * }
 *
 * 응답 데이터 (암호화됨):
 * {
 *   partial_signed_transaction: string,  // Base64 인코딩된 부분서명 트랜잭션
 *   request_id: string,                  // 요청 ID
 *   contract_idx: number,                // 계약서 테이블 인덱스
 *   blockhash: string                    // 최신 blockhash
 * }
 */
export const createAndPartialSignPayment = async (req, res) => {
    const apiName = 'solana/create-and-partial-sign';
    req.startTime = Date.now();

    try {
        // 1. 암호화된 요청 데이터 복호화
        const serviceKey = req.serviceKey;
        const encryptedData = req.body.encrypted_data;

        if (!encryptedData) {
            throw {
                code: 'MISSING_ENCRYPTED_DATA',
                message: 'encrypted_data is required',
                statusCode: 400
            };
        }

        const decryptedData = decryptRequest(encryptedData, serviceKey);
        const { sender, amount, request_id, cate1, cate2 } = decryptedData;

        // 2. 입력 검증
        if (!sender || !amount || !request_id) {
            throw {
                code: 'INVALID_PARAMETERS',
                message: 'sender, amount, and request_id are required',
                statusCode: 400
            };
        }

        // request_id를 req 객체에 저장 (로깅용)
        req.requestId = request_id;

        // 3. 서비스 레이어 호출
        const result = await solanaService.createAndPartialSignPayment({
            sender,
            amount,
            request_id,
            cate1: cate1 || 'payment',
            cate2: cate2 || 'user_to_company'
        });

        // 4. 성공 응답 반환 (암호화됨)
        return handleSuccess(res, result, req, apiName);

    } catch (error) {
        console.error(`${apiName} error:`, error);
        return handleError(res, error, apiName, req);
    }
};

/**
 * [POST] /api/solana/create-and-partial-sign-receive
 * 부분서명 생성 - 사용자 → 사용자 (Fee Payer는 회사)
 *
 * 요청 데이터 (암호화됨):
 * {
 *   sender: string,           // 발신자(사용자) 지갑 주소
 *   recipient: string,        // 수신자(사용자) 지갑 주소
 *   amount: number,           // 전송할 토큰 양
 *   request_id: string,       // UUID 형식의 요청 ID
 *   cate1: string,            // 분류1 (예: 'payment')
 *   cate2: string             // 분류2 (예: 'user_to_user')
 * }
 *
 * 응답 데이터 (암호화됨):
 * {
 *   partial_signed_transaction: string,  // Base64 인코딩된 부분서명 트랜잭션
 *   request_id: string,                  // 요청 ID
 *   contract_idx: number,                // 계약서 테이블 인덱스
 *   blockhash: string                    // 최신 blockhash
 * }
 */
export const createAndPartialSignReceive = async (req, res) => {
    const apiName = 'solana/create-and-partial-sign-receive';
    req.startTime = Date.now();

    try {
        // 1. 암호화된 요청 데이터 복호화
        const serviceKey = req.serviceKey;
        const encryptedData = req.body.encrypted_data;

        if (!encryptedData) {
            throw {
                code: 'MISSING_ENCRYPTED_DATA',
                message: 'encrypted_data is required',
                statusCode: 400
            };
        }

        const decryptedData = decryptRequest(encryptedData, serviceKey);
        const { sender, recipient, amount, request_id, cate1, cate2 } = decryptedData;

        // 2. 입력 검증
        if (!sender || !recipient || !amount || !request_id) {
            throw {
                code: 'INVALID_PARAMETERS',
                message: 'sender, recipient, amount, and request_id are required',
                statusCode: 400
            };
        }

        // request_id를 req 객체에 저장 (로깅용)
        req.requestId = request_id;

        // 3. 서비스 레이어 호출
        const result = await solanaService.createAndPartialSignReceive({
            sender,
            recipient,
            amount,
            request_id,
            cate1: cate1 || 'payment',
            cate2: cate2 || 'user_to_user'
        });

        // 4. 성공 응답 반환 (암호화됨)
        return handleSuccess(res, result, req, apiName);

    } catch (error) {
        console.error(`${apiName} error:`, error);
        return handleError(res, error, apiName, req);
    }
};
/**
 * [POST] /api/solana/send-signed-transaction
 * 최종 서명된 트랜잭션 전송
 *
 * 요청 데이터 (암호화됨):
 * {
 *   signed_transaction: string,  // Base64 인코딩된 최종 서명 트랜잭션
 *   request_id: string,          // UUID 형식의 요청 ID
 *   contract_idx: number         // 계약서 테이블 인덱스 (선택)
 * }
 *
 * 응답 데이터 (암호화됨):
 * {
 *   signature: string,           // 트랜잭션 서명(해시)
 *   request_id: string,          // 요청 ID
 *   status: string               // 'success' 또는 'pending'
 * }
 */
export const sendSignedTransaction = async (req, res) => {
    const apiName = 'solana/send-signed-transaction';
    req.startTime = Date.now();

    try {
        // 1. 암호화된 요청 데이터 복호화
        const serviceKey = req.serviceKey;
        const encryptedData = req.body.encrypted_data;

        if (!encryptedData) {
            throw {
                code: 'MISSING_ENCRYPTED_DATA',
                message: 'encrypted_data is required',
                statusCode: 400
            };
        }

        const decryptedData = decryptRequest(encryptedData, serviceKey);
        const { signed_transaction, request_id, contract_idx } = decryptedData;

        // 2. 입력 검증
        if (!signed_transaction || !request_id) {
            throw {
                code: 'INVALID_PARAMETERS',
                message: 'signed_transaction and request_id are required',
                statusCode: 400
            };
        }

        // request_id를 req 객체에 저장 (로깅용)
        req.requestId = request_id;

        // 3. 서비스 레이어 호출
        const result = await solanaService.sendSignedTransaction({
            signed_transaction,
            request_id,
            contract_idx
        });

        // 4. 성공 응답 반환 (암호화됨)
        return handleSuccess(res, result, req, apiName);

    } catch (error) {
        console.error(`${apiName} error:`, error);
        return handleError(res, error, apiName, req);
    }
};

/**
 * [GET] /api/solana/transaction/:signature
 * 트랜잭션 상태 조회
 *
 * URL 파라미터:
 * - signature: 트랜잭션 서명(해시)
 *
 * 응답 데이터 (암호화됨):
 * {
 *   signature: string,           // 트랜잭션 서명
 *   status: string,              // 'confirmed', 'finalized', 'pending', 'failed'
 *   slot: number,                // 블록 슬롯 번호
 *   blockTime: number,           // 블록 타임스탬프
 *   confirmations: number,       // 확인 수
 *   err: object|null            // 에러 정보 (실패 시)
 * }
 */
export const getTransactionStatus = async (req, res) => {
    const apiName = 'solana/transaction-status';
    req.startTime = Date.now();

    try {
        // 1. URL 파라미터에서 signature 추출
        const { signature } = req.params;

        if (!signature) {
            throw {
                code: 'MISSING_SIGNATURE',
                message: 'Transaction signature is required',
                statusCode: 400
            };
        }

        // 2. 서비스 레이어 호출
        const result = await solanaService.getTransactionStatus(signature);

        // 3. 성공 응답 반환 (암호화됨)
        return handleSuccess(res, result, req, apiName);

    } catch (error) {
        console.error(`${apiName} error:`, error);
        return handleError(res, error, apiName, req);
    }
};

/**
 * [POST] /api/solana/verify-transaction
 * 트랜잭션 검증 (선택적 기능)
 *
 * 요청 데이터 (암호화됨):
 * {
 *   signature: string,           // 검증할 트랜잭션 서명
 *   expected_amount: number,     // 예상 전송 금액
 *   expected_recipient: string   // 예상 수신자 주소
 * }
 *
 * 응답 데이터 (암호화됨):
 * {
 *   is_valid: boolean,           // 검증 결과
 *   actual_amount: number,       // 실제 전송 금액
 *   actual_recipient: string,    // 실제 수신자 주소
 *   status: string               // 트랜잭션 상태
 * }
 */
export const verifyTransaction = async (req, res) => {
    const apiName = 'solana/verify-transaction';
    req.startTime = Date.now();

    try {
        // 1. 암호화된 요청 데이터 복호화
        const serviceKey = req.serviceKey;
        const encryptedData = req.body.encrypted_data;

        if (!encryptedData) {
            throw {
                code: 'MISSING_ENCRYPTED_DATA',
                message: 'encrypted_data is required',
                statusCode: 400
            };
        }

        const decryptedData = decryptRequest(encryptedData, serviceKey);
        const { signature, expected_amount, expected_recipient } = decryptedData;

        // 2. 입력 검증
        if (!signature) {
            throw {
                code: 'INVALID_PARAMETERS',
                message: 'signature is required',
                statusCode: 400
            };
        }

        // 3. 서비스 레이어 호출
        const result = await solanaService.verifyTransaction({
            signature,
            expected_amount,
            expected_recipient
        });

        // 4. 성공 응답 반환 (암호화됨)
        return handleSuccess(res, result, req, apiName);

    } catch (error) {
        console.error(`${apiName} error:`, error);
        return handleError(res, error, apiName, req);
    }
};

/**
 * [GET] /api/solana/balance/:address
 * 지갑 잔액 조회
 *
 * URL 파라미터:
 * - address: 조회할 지갑 주소
 *
 * 응답 데이터 (암호화됨):
 * {
 *   address: string,             // 지갑 주소
 *   sol_balance: number,         // SOL 잔액
 *   token_balance: number,       // RIPY 토큰 잔액
 *   ata_address: string          // Associated Token Account 주소
 * }
 */
export const getWalletBalance = async (req, res) => {
    const apiName = 'solana/balance';
    req.startTime = Date.now();

    try {
        // 1. URL 파라미터에서 address 추출
        const { address } = req.params;

        if (!address) {
            throw {
                code: 'MISSING_ADDRESS',
                message: 'Wallet address is required',
                statusCode: 400
            };
        }

        // 2. 서비스 레이어 호출
        const result = await solanaService.getWalletBalance(address);

        // 3. 성공 응답 반환 (암호화됨)
        return handleSuccess(res, result, req, apiName);

    } catch (error) {
        console.error(`${apiName} error:`, error);
        return handleError(res, error, apiName, req);
    }
};

/**
 * * [GET] /api/solana/health
 *  * Solana RPC 연결 상태 확인
 *  *
 *  * 응답 데이터:
 *  * {
 *  *   status: string,              // 'healthy' 또는 'unhealthy'
 *  *   rpc_url: string,             // 현재 RPC URL
 *  *   network: string,             // 네트워크 (devnet/mainnet)
 *  *   version: object,             // Solana 버전
 *  *   current_slot: number,        // 현재 슬롯
 *  *   block_height: number         // 블록 높이
 *  * }
 */
export const healthCheck = async (req, res) => {
    const apiName = 'solana/health';
    req.startTime = Date.now();

    try {
        // Connection 직접 생성
        const connection = new Connection(
            process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
            'confirmed'
        );

        // RPC 버전 확인
        const version = await connection.getVersion();

        // 현재 슬롯 확인
        const slot = await connection.getSlot();

        // 블록 높이 확인
        const blockHeight = await connection.getBlockHeight();

        // 일반 응답 (암호화 안함 - health check는 공개 API)
        return res.status(200).json({
            success: true,
            status: 'healthy',
            rpc_url: process.env.SOLANA_RPC_URL,
            network: process.env.SOLANA_NETWORK,
            version: version,
            current_slot: slot,
            block_height: blockHeight,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`${apiName} error:`, error);
        return res.status(503).json({
            success: false,
            status: 'unhealthy',
            error: error.message
        });
    }
};