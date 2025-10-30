/**
 * ============================================
 * Solana Controller (HTTP API 처리)
 * ============================================
 *
 * 역할:
 * - HTTP 요청 수신 및 파싱
 * - 요청 데이터 복호화 (웹서버 → 토큰서버)
 * - Service Layer 호출
 * - 응답 데이터 암호화 (토큰서버 → 웹서버)
 * - 에러 핸들링
 *
 * 보안:
 * - Service Key 검증 (미들웨어에서 처리)
 * - 요청/응답 암호화
 * - 민감한 정보 로깅 방지
 */

import {
    // 기존 서비스
    createPartialSignedTransaction,
    sendSignedTransaction,
    bulkTransfer,
    getTokenBalance,
    getTransactionDetails,
    getSolBalance,

    // 추가 서비스 (전자 서명 로드맵)
    createUnsignedTransaction,
    createAndPartialSignPayment,
    createAndPartialSignReceive
} from '../services/solana.service.js';
import {
    decryptRequest,
    encryptResponse
} from '../utils/crypto.util.js';

/**
 * ============================================
 * 0. 미서명 트랜잭션 생성 API (신규 추가)
 * ============================================
 *
 * POST /api/solana/create-unsigned-transaction
 *
 * 요청 (암호화):
 * {
 *   "encrypted_data": "base64_encrypted_json",
 *   "service_key": "service_key_value"
 * }
 *
 * 복호화된 요청:
 * {
 *   "sender_public_key": "BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh",
 *   "recipient_public_key": "RecipientWalletAddress...",
 *   "amount": 10.5
 * }
 *
 * 응답 (암호화):
 * {
 *   "encrypted_response": "base64_encrypted_json"
 * }
 *
 * 복호화된 응답:
 * {
 *   "success": true,
 *   "unsigned_transaction": "base64_serialized_transaction",
 *   "blockhash": "latest_blockhash",
 *   "last_valid_block_height": 123456,
 *   "message": "미서명 트랜잭션이 생성되었습니다."
 * }
 */
export async function createUnsignedTransactionController(req, res) {
    try {
        // 1. 요청 데이터 추출
        const { encrypted_data, service_key } = req.body;

        if (!encrypted_data || !service_key) {
            return res.status(400).json({
                success: false,
                error: 'BAD_REQUEST',
                message: 'encrypted_data와 service_key는 필수입니다.'
            });
        }

        // 2. 요청 데이터 복호화
        let decryptedData;
        try {
            decryptedData = decryptRequest(encrypted_data, service_key);
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: 'DECRYPTION_FAILED',
                message: '요청 데이터 복호화에 실패했습니다.'
            });
        }

        // 3. 필수 필드 검증
        const { sender_public_key, recipient_public_key, amount } = decryptedData;

        if (!sender_public_key || !recipient_public_key || !amount) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                message: 'sender_public_key, recipient_public_key, amount는 필수입니다.'
            });
        }

        // 4. Service Layer 호출
        const result = await createUnsignedTransaction(
            sender_public_key,
            recipient_public_key,
            amount
        );

        // 5. 응답 데이터 암호화
        const encryptedResponse = encryptResponse(result, service_key);

        // 6. 응답 반환
        return res.status(200).json({
            encrypted_response: encryptedResponse
        });

    } catch (error) {
        console.error('미서명 트랜잭션 생성 오류:', error);
        return res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message || '서버 내부 오류가 발생했습니다.'
        });
    }
}

/**
 * ============================================
 * 1. 부분서명 트랜잭션 생성 API (기존 - 유지)
 * ============================================
 *
 * POST /api/solana/partial-sign
 *
 * 요청 (암호화):
 * {
 *   "encrypted_data": "base64_encrypted_json",
 *   "service_key": "service_key_value"
 * }
 *
 * 복호화된 요청:
 * {
 *   "sender_wallet": "BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh",
 *   "amount": 10.5
 * }
 *
 * 응답 (암호화):
 * {
 *   "encrypted_response": "base64_encrypted_json"
 * }
 *
 * 복호화된 응답:
 * {
 *   "success": true,
 *   "transaction_base64": "ABC123...",
 *   "blockhash": "xyz789...",
 *   ...
 * }
 */
export async function createPartialSignedTransactionController(req, res) {
    try {
        // 1. 요청 데이터 추출
        const { encrypted_data, service_key } = req.body;

        if (!encrypted_data || !service_key) {
            return res.status(400).json({
                success: false,
                error: 'BAD_REQUEST',
                message: 'encrypted_data와 service_key는 필수입니다.'
            });
        }

        // 2. 요청 데이터 복호화
        let decryptedData;
        try {
            decryptedData = decryptRequest(encrypted_data, service_key);
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: 'DECRYPTION_FAILED',
                message: '요청 데이터 복호화에 실패했습니다.'
            });
        }

        // 3. 필수 필드 검증
        const { sender_wallet, amount } = decryptedData;

        if (!sender_wallet || !amount) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                message: 'sender_wallet과 amount는 필수입니다.'
            });
        }

        // 4. Service Layer 호출
        const result = await createPartialSignedTransaction(sender_wallet, amount);

        // 5. 응답 데이터 암호화
        const encryptedResponse = encryptResponse(result, service_key);

        // 6. 응답 반환
        return res.status(200).json({
            encrypted_response: encryptedResponse
        });

    } catch (error) {
        console.error('부분서명 트랜잭션 생성 오류:', error);
        return res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message || '서버 내부 오류가 발생했습니다.'
        });
    }
}

/**
 * ============================================
 * 1-1. 부분서명 생성 - 사용자 → 회사 (신규 추가)
 * ============================================
 *
 * POST /api/solana/create-and-partial-sign
 *
 * 요청 (암호화):
 * {
 *   "encrypted_data": "base64_encrypted_json",
 *   "service_key": "service_key_value"
 * }
 *
 * 복호화된 요청:
 * {
 *   "sender_public_key": "UserWalletAddress",
 *   "amount": 50.25,
 *   "request_id": "uuid-v4"
 * }
 *
 * 응답 (암호화):
 * {
 *   "encrypted_response": "base64_encrypted_json"
 * }
 *
 * 복호화된 응답:
 * {
 *   "success": true,
 *   "partial_signed_transaction": "base64_partial_signed_transaction",
 *   "blockhash": "latest_blockhash",
 *   "last_valid_block_height": 123456,
 *   "message": "부분서명된 트랜잭션이 생성되었습니다."
 * }
 */
export async function createAndPartialSignPaymentController(req, res) {
    try {
        // 1. 요청 데이터 추출
        const { encrypted_data, service_key } = req.body;

        if (!encrypted_data || !service_key) {
            return res.status(400).json({
                success: false,
                error: 'BAD_REQUEST',
                message: 'encrypted_data와 service_key는 필수입니다.'
            });
        }

        // 2. 요청 데이터 복호화
        let decryptedData;
        try {
            decryptedData = decryptRequest(encrypted_data, service_key);
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: 'DECRYPTION_FAILED',
                message: '요청 데이터 복호화에 실패했습니다.'
            });
        }

        // 3. 필수 필드 검증
        const { sender_public_key, amount, request_id } = decryptedData;

        if (!sender_public_key || !amount || !request_id) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                message: 'sender_public_key, amount, request_id는 필수입니다.'
            });
        }

        // 4. Service Layer 호출
        const result = await createAndPartialSignPayment(
            sender_public_key,
            amount,
            request_id
        );

        // 5. 응답 데이터 암호화
        const encryptedResponse = encryptResponse(result, service_key);

        // 6. 응답 반환
        return res.status(200).json({
            encrypted_response: encryptedResponse
        });

    } catch (error) {
        console.error('부분서명 생성 오류 (사용자→회사):', error);
        return res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message || '서버 내부 오류가 발생했습니다.'
        });
    }
}

/**
 * ============================================
 * 1-2. 부분서명 생성 - 사용자 → 사용자 (신규 추가)
 * ============================================
 *
 * POST /api/solana/create-and-partial-sign-receive
 *
 * 요청 (암호화):
 * {
 *   "encrypted_data": "base64_encrypted_json",
 *   "service_key": "service_key_value"
 * }
 *
 * 복호화된 요청:
 * {
 *   "sender_public_key": "UserWalletAddress1",
 *   "recipient_public_key": "UserWalletAddress2",
 *   "amount": 25.5,
 *   "request_id": "uuid-v4"
 * }
 *
 * 응답 (암호화):
 * {
 *   "encrypted_response": "base64_encrypted_json"
 * }
 *
 * 복호화된 응답:
 * {
 *   "success": true,
 *   "partial_signed_transaction": "base64_partial_signed_transaction",
 *   "blockhash": "latest_blockhash",
 *   "last_valid_block_height": 123456,
 *   "message": "부분서명된 트랜잭션이 생성되었습니다."
 * }
 */
export async function createAndPartialSignReceiveController(req, res) {
    try {
        // 1. 요청 데이터 추출
        const { encrypted_data, service_key } = req.body;

        if (!encrypted_data || !service_key) {
            return res.status(400).json({
                success: false,
                error: 'BAD_REQUEST',
                message: 'encrypted_data와 service_key는 필수입니다.'
            });
        }

        // 2. 요청 데이터 복호화
        let decryptedData;
        try {
            decryptedData = decryptRequest(encrypted_data, service_key);
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: 'DECRYPTION_FAILED',
                message: '요청 데이터 복호화에 실패했습니다.'
            });
        }

        // 3. 필수 필드 검증
        const { sender_public_key, recipient_public_key, amount, request_id } = decryptedData;

        if (!sender_public_key || !recipient_public_key || !amount || !request_id) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                message: 'sender_public_key, recipient_public_key, amount, request_id는 필수입니다.'
            });
        }

        // 4. Service Layer 호출
        const result = await createAndPartialSignReceive(
            sender_public_key,
            recipient_public_key,
            amount,
            request_id
        );

        // 5. 응답 데이터 암호화
        const encryptedResponse = encryptResponse(result, service_key);

        // 6. 응답 반환
        return res.status(200).json({
            encrypted_response: encryptedResponse
        });

    } catch (error) {
        console.error('부분서명 생성 오류 (사용자→사용자):', error);
        return res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message || '서버 내부 오류가 발생했습니다.'
        });
    }
}

/**
 * ============================================
 * 2. 완전 서명된 트랜잭션 전송 API (기존 - 유지)
 * ============================================
 *
 * POST /api/solana/send-signed
 *
 * 요청 (암호화):
 * {
 *   "encrypted_data": "base64_encrypted_json",
 *   "service_key": "service_key_value"
 * }
 *
 * 복호화된 요청:
 * {
 *   "signed_transaction_base64": "ABC123..."
 * }
 */
export async function sendSignedTransactionController(req, res) {
    try {
        // 1. 요청 데이터 추출
        const { encrypted_data, service_key } = req.body;

        if (!encrypted_data || !service_key) {
            return res.status(400).json({
                success: false,
                error: 'BAD_REQUEST',
                message: 'encrypted_data와 service_key는 필수입니다.'
            });
        }

        // 2. 요청 데이터 복호화
        let decryptedData;
        try {
            decryptedData = decryptRequest(encrypted_data, service_key);
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: 'DECRYPTION_FAILED',
                message: '요청 데이터 복호화에 실패했습니다.'
            });
        }

        // 3. 필수 필드 검증
        // signed_transaction_base64 또는 signed_transaction 둘 다 지원
        const { signed_transaction_base64, signed_transaction } = decryptedData;
        const transactionBase64 = signed_transaction_base64 || signed_transaction;

        if (!transactionBase64) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                message: 'signed_transaction_base64 또는 signed_transaction은 필수입니다.'
            });
        }

        // 4. Service Layer 호출
        const result = await sendSignedTransaction(transactionBase64);

        // 5. 응답 데이터 암호화
        const encryptedResponse = encryptResponse(result, service_key);

        // 6. 응답 반환
        return res.status(200).json({
            encrypted_response: encryptedResponse
        });

    } catch (error) {
        console.error('트랜잭션 전송 오류:', error);
        return res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message || '서버 내부 오류가 발생했습니다.'
        });
    }
}

/**
 * ============================================
 * 3. 회사 → 다중 수신자 일괄 전송 API (기존 - 유지)
 * ============================================
 *
 * POST /api/solana/bulk-transfer
 *
 * 요청 (암호화):
 * {
 *   "encrypted_data": "base64_encrypted_json",
 *   "service_key": "service_key_value"
 * }
 *
 * 복호화된 요청:
 * {
 *   "recipients": [
 *     { "wallet_address": "ABC...", "amount": 10 },
 *     { "wallet_address": "DEF...", "amount": 20 }
 *   ]
 * }
 */
export async function bulkTransferController(req, res) {
    try {
        // 1. 요청 데이터 추출
        const { encrypted_data, service_key } = req.body;

        if (!encrypted_data || !service_key) {
            return res.status(400).json({
                success: false,
                error: 'BAD_REQUEST',
                message: 'encrypted_data와 service_key는 필수입니다.'
            });
        }

        // 2. 요청 데이터 복호화
        let decryptedData;
        try {
            decryptedData = decryptRequest(encrypted_data, service_key);
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: 'DECRYPTION_FAILED',
                message: '요청 데이터 복호화에 실패했습니다.'
            });
        }

        // 3. 필수 필드 검증
        const { recipients } = decryptedData;

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                message: 'recipients는 필수 배열입니다.'
            });
        }

        // 4. Service Layer 호출
        const result = await bulkTransfer(decryptedData.recipients);

        // 5. 응답 데이터 암호화
        const encryptedResponse = encryptResponse(result, service_key);

        // 6. 응답 반환
        return res.status(200).json({
            encrypted_response: encryptedResponse
        });

    } catch (error) {
        console.error('일괄 전송 오류:', error);
        return res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message || '서버 내부 오류가 발생했습니다.'
        });
    }
}

/**
 * ============================================
 * 4. 토큰 잔액 조회 API (기존 - 유지)
 * ============================================
 *
 * GET /api/solana/balance/:wallet_address
 *
 * 응답 (암호화하지 않음 - 공개 정보):
 * {
 *   "success": true,
 *   "amount": 100.5,
 *   ...
 * }
 */
export async function getTokenBalanceController(req, res) {
    try {
        // 1. 지갑 주소 추출
        const { wallet_address } = req.params;

        if (!wallet_address) {
            return res.status(400).json({
                success: false,
                error: 'BAD_REQUEST',
                message: 'wallet_address는 필수입니다.'
            });
        }

        // 2. Service Layer 호출
        const result = await getTokenBalance(wallet_address);

        // 3. 응답 반환 (잔액은 공개 정보이므로 암호화 안 함)
        return res.status(200).json(result);

    } catch (error) {
        console.error('잔액 조회 오류:', error);
        return res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message || '서버 내부 오류가 발생했습니다.'
        });
    }
}

/**
 * ============================================
 * 5. 트랜잭션 상세 정보 조회 API (기존 - 유지)
 * ============================================
 *
 * GET /api/solana/transaction/:signature
 *
 * 응답 (암호화하지 않음 - 공개 정보):
 * {
 *   "success": true,
 *   "status": "SUCCESS",
 *   ...
 * }
 */
export async function getTransactionDetailsController(req, res) {
    try {
        // 1. 트랜잭션 서명 추출
        const { signature } = req.params;

        if (!signature) {
            return res.status(400).json({
                success: false,
                error: 'BAD_REQUEST',
                message: 'signature는 필수입니다.'
            });
        }

        // 2. Service Layer 호출
        const result = await getTransactionDetails(signature);

        // 3. 응답 반환
        return res.status(200).json(result);

    } catch (error) {
        console.error('트랜잭션 조회 오류:', error);
        return res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message || '서버 내부 오류가 발생했습니다.'
        });
    }
}

/**
 * ============================================
 * 6. SOL 잔액 조회 API (기존 - 유지)
 * ============================================
 *
 * GET /api/solana/sol-balance/:wallet_address
 *
 * 응답 (암호화하지 않음 - 공개 정보):
 * {
 *   "success": true,
 *   "sol": 1.5,
 *   ...
 * }
 */
export async function getSolBalanceController(req, res) {
    try {
        // 1. 지갑 주소 추출
        const { wallet_address } = req.params;

        if (!wallet_address) {
            return res.status(400).json({
                success: false,
                error: 'BAD_REQUEST',
                message: 'wallet_address는 필수입니다.'
            });
        }

        // 2. Service Layer 호출
        const result = await getSolBalance(wallet_address);

        // 3. 응답 반환
        return res.status(200).json(result);

    } catch (error) {
        console.error('SOL 잔액 조회 오류:', error);
        return res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message || '서버 내부 오류가 발생했습니다.'
        });
    }
}

/**
 * 기본 export
 */
export default {
    // 신규 추가 (전자 서명 로드맵)
    createUnsignedTransactionController,
    createAndPartialSignPaymentController,
    createAndPartialSignReceiveController,

    // 기존 컨트롤러
    createPartialSignedTransactionController,
    sendSignedTransactionController,
    bulkTransferController,
    getTokenBalanceController,
    getTransactionDetailsController,
    getSolBalanceController
};