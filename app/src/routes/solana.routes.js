/**
 * ============================================
 * Solana Routes (API 엔드포인트 정의)
 * ============================================
 *
 * 역할:
 * - URL 엔드포인트와 Controller 연결
 * - 미들웨어 적용 (Service Key 검증)
 * - API 문서화를 위한 주석
 *
 * 보안:
 * - verifyServiceKey 미들웨어로 모든 요청 검증
 * - 선택적으로 IP 화이트리스트 추가 가능
 */

import express from 'express';
import {
    // 기존 컨트롤러
    createPartialSignedTransactionController,
    sendSignedTransactionController,
    bulkTransferController,
    getTokenBalanceController,
    getTransactionDetailsController,
    getSolBalanceController,

    // 추가 컨트롤러 (전자 서명 로드맵)
    createUnsignedTransactionController,
    createAndPartialSignPaymentController,
    createAndPartialSignReceiveController
} from '../controllers/solana.controller.js';
import { verifyServiceKey } from '../middlewares/auth.middleware.js';

// Router 인스턴스 생성
const router = express.Router();

/**
 * ============================================
 * API 엔드포인트 정의
 * ============================================
 */

/**
 * 0. 미서명 트랜잭션 생성 (신규 추가)
 *
 * POST /api/solana/create-unsigned-transaction
 *
 * 용도: Flutter 앱에서 사용자가 서명할 수 있도록 미서명 트랜잭션을 생성
 *
 * 요청 헤더:
 * - Content-Type: application/json
 *
 * 요청 바디:
 * {
 *   "encrypted_data": "base64_encrypted_json",
 *   "service_key": "service_key_value"
 * }
 *
 * 복호화된 데이터:
 * {
 *   "sender_public_key": "BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh",
 *   "recipient_public_key": "RecipientWalletAddress...",
 *   "amount": 10.5
 * }
 *
 * 응답:
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
router.post(
    '/create-unsigned-transaction',
    verifyServiceKey,
    createUnsignedTransactionController
);

/**
 * 1. 부분서명 트랜잭션 생성 (기존 - 유지)
 *
 * POST /api/solana/partial-sign
 *
 * 용도: 사용자 → 회사 토큰 전송 시 회사 지갑 부분서명
 *
 * 요청 헤더:
 * - Content-Type: application/json
 *
 * 요청 바디:
 * {
 *   "encrypted_data": "base64_encrypted_json",
 *   "service_key": "service_key_value"
 * }
 *
 * 복호화된 데이터:
 * {
 *   "sender_wallet": "BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh",
 *   "amount": 10.5
 * }
 *
 * 응답:
 * {
 *   "encrypted_response": "base64_encrypted_json"
 * }
 *
 * 복호화된 응답:
 * {
 *   "success": true,
 *   "transaction_base64": "ABC123...",
 *   "blockhash": "xyz789...",
 *   "last_valid_block_height": 123456,
 *   "sender_ata": "...",
 *   "company_ata": "...",
 *   "amount": 10.5,
 *   "message": "부분서명된 트랜잭션이 생성되었습니다."
 * }
 */
router.post(
    '/partial-sign',
    verifyServiceKey,
    createPartialSignedTransactionController
);

/**
 * 1-1. 부분서명 생성 - 사용자 → 회사 (신규 추가, 로드맵 표준)
 *
 * POST /api/solana/create-and-partial-sign
 *
 * 용도: 로드맵 표준 엔드포인트 (사용자 → 회사 토큰 전송)
 *
 * 요청 바디:
 * {
 *   "encrypted_data": "base64_encrypted_json",
 *   "service_key": "service_key_value"
 * }
 *
 * 복호화된 데이터:
 * {
 *   "sender_public_key": "UserWalletAddress",
 *   "amount": 50.25,
 *   "request_id": "uuid-v4"
 * }
 *
 * 응답:
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
router.post(
    '/create-and-partial-sign',
    verifyServiceKey,
    createAndPartialSignPaymentController
);

/**
 * 1-2. 부분서명 생성 - 사용자 → 사용자 (신규 추가, 회사가 Fee Payer)
 *
 * POST /api/solana/create-and-partial-sign-receive
 *
 * 용도: 사용자 간 토큰 전송 시 회사가 Fee Payer로 부분서명
 *
 * 요청 바디:
 * {
 *   "encrypted_data": "base64_encrypted_json",
 *   "service_key": "service_key_value"
 * }
 *
 * 복호화된 데이터:
 * {
 *   "sender_public_key": "UserWalletAddress1",
 *   "recipient_public_key": "UserWalletAddress2",
 *   "amount": 25.5,
 *   "request_id": "uuid-v4"
 * }
 *
 * 응답:
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
router.post(
    '/create-and-partial-sign-receive',
    verifyServiceKey,
    createAndPartialSignReceiveController
);

/**
 * 2. 완전 서명된 트랜잭션 전송 (기존 - 유지)
 *
 * POST /api/solana/send-signed
 *
 * 용도: 사용자가 최종 서명한 트랜잭션을 블록체인에 전송
 *
 * 요청 바디:
 * {
 *   "encrypted_data": "base64_encrypted_json",
 *   "service_key": "service_key_value"
 * }
 *
 * 복호화된 데이터:
 * {
 *   "signed_transaction_base64": "ABC123..."
 * }
 *
 * 응답:
 * {
 *   "encrypted_response": "base64_encrypted_json"
 * }
 *
 * 복호화된 응답:
 * {
 *   "success": true,
 *   "signature": "5j7s...",
 *   "explorer_url": "https://explorer.solana.com/tx/...",
 *   "message": "트랜잭션이 성공적으로 전송되었습니다."
 * }
 */
router.post(
    '/send-signed',
    verifyServiceKey,
    sendSignedTransactionController
);

/**
 * 2-1. 최종 서명된 트랜잭션 전송 (신규 추가, 로드맵 표준)
 *
 * POST /api/solana/send-signed-transaction
 *
 * 용도: 로드맵 표준 엔드포인트 (send-signed와 동일 기능)
 *
 * 요청 바디:
 * {
 *   "encrypted_data": "base64_encrypted_json",
 *   "service_key": "service_key_value"
 * }
 *
 * 복호화된 데이터:
 * {
 *   "signed_transaction": "base64_fully_signed_transaction",
 *   "request_id": "uuid-v4"
 * }
 *
 * 응답:
 * {
 *   "encrypted_response": "base64_encrypted_json"
 * }
 *
 * 복호화된 응답:
 * {
 *   "success": true,
 *   "signature": "transaction_signature_hash",
 *   "explorer_url": "https://explorer.solana.com/tx/signature",
 *   "message": "트랜잭션이 성공적으로 전송되었습니다."
 * }
 */
router.post(
    '/send-signed-transaction',
    verifyServiceKey,
    sendSignedTransactionController  // 기존 컨트롤러 재사용
);

/**
 * 3. 회사 지갑 → 다중 수신자 일괄 전송 (기존 - 유지)
 *
 * POST /api/solana/bulk-transfer
 *
 * 용도: 에어드랍, 보상 지급 등
 *
 * 요청 바디:
 * {
 *   "encrypted_data": "base64_encrypted_json",
 *   "service_key": "service_key_value"
 * }
 *
 * 복호화된 데이터:
 * {
 *   "recipients": [
 *     { "wallet_address": "ABC...", "amount": 10 },
 *     { "wallet_address": "DEF...", "amount": 20 }
 *   ]
 * }
 *
 * 응답:
 * {
 *   "encrypted_response": "base64_encrypted_json"
 * }
 *
 * 복호화된 응답:
 * {
 *   "success": true,
 *   "signature": "5j7s...",
 *   "recipients_count": 2,
 *   "total_amount": 30,
 *   "explorer_url": "https://explorer.solana.com/tx/...",
 *   "message": "2명에게 토큰이 성공적으로 전송되었습니다."
 * }
 */
router.post(
    '/bulk-transfer',
    verifyServiceKey,
    bulkTransferController
);

/**
 * 4. 토큰 잔액 조회 (기존 - 유지)
 *
 * GET /api/solana/balance/:wallet_address
 *
 * 용도: 특정 지갑의 RIPY 토큰 잔액 조회
 *
 * URL 파라미터:
 * - wallet_address: Solana 지갑 주소 (Base58)
 *
 * 예시:
 * GET /api/solana/balance/BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh
 *
 * 응답 (암호화하지 않음 - 공개 정보):
 * {
 *   "success": true,
 *   "wallet_address": "BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh",
 *   "ata_address": "...",
 *   "amount": 100.5,
 *   "amount_in_smallest_unit": 100500000000,
 *   "decimals": 9,
 *   "message": "잔액 조회 성공"
 * }
 */
router.get(
    '/balance/:wallet_address',
    verifyServiceKey,
    getTokenBalanceController
);

/**
 * 5. 트랜잭션 상세 정보 조회 (기존 - 유지)
 *
 * GET /api/solana/transaction/:signature
 *
 * 용도: 트랜잭션 서명으로 상세 정보 조회
 *
 * URL 파라미터:
 * - signature: 트랜잭션 서명
 *
 * 예시:
 * GET /api/solana/transaction/5j7s8t9u...
 *
 * 응답 (암호화하지 않음 - 공개 정보):
 * {
 *   "success": true,
 *   "signature": "5j7s8t9u...",
 *   "status": "SUCCESS",
 *   "slot": 123456,
 *   "block_time": 1640000000,
 *   "fee": 5000,
 *   "explorer_url": "https://explorer.solana.com/tx/...",
 *   "message": "트랜잭션 정보 조회 성공"
 * }
 */
router.get(
    '/transaction/:signature',
    verifyServiceKey,
    getTransactionDetailsController
);

/**
 * 6. SOL 잔액 조회 (기존 - 유지)
 *
 * GET /api/solana/sol-balance/:wallet_address
 *
 * 용도: 가스비 확인을 위한 SOL 잔액 조회
 *
 * URL 파라미터:
 * - wallet_address: Solana 지갑 주소 (Base58)
 *
 * 예시:
 * GET /api/solana/sol-balance/BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh
 *
 * 응답 (암호화하지 않음 - 공개 정보):
 * {
 *   "success": true,
 *   "wallet_address": "BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh",
 *   "sol": 1.5,
 *   "lamports": 1500000000,
 *   "message": "SOL 잔액 조회 성공"
 * }
 */
router.get(
    '/sol-balance/:wallet_address',
    verifyServiceKey,
    getSolBalanceController
);

/**
 * ============================================
 * 헬스 체크 엔드포인트 (인증 불필요)
 * ============================================
 *
 * GET /api/solana/health
 *
 * 용도: 서버 상태 확인 (로드밸런서, 모니터링용)
 */
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'RIPY Token Server',
        version: '1.0.0'
    });
});

/**
 * 기본 export
 */
export default router;