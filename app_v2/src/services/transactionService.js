/**
 * ============================================
 * Solana Transaction Service (Mock Version)
 * ============================================
 *
 * 설명회용 Mock 구현
 * 실제 Solana 블록체인 연동은 추후 진행
 *
 * Phase 1-A 보안 개선사항:
 * - Fee Payer를 환경변수에서 로드
 * - 회사 지갑 주소 하드코딩 제거
 * - 반환 데이터에서 feepayer 필드 제외 (보안 강화)
 *
 * 변경 이력:
 * - 2025-11-05: Phase 1-A 보안 아키텍처 개선 완료
 *
 * @module services/transactionService
 */

// ==========================================
// Mock 설정
// ==========================================

const USE_MOCK = process.env.NODE_ENV === 'test' || process.env.USE_SOLANA_MOCK === 'true';
console.log('[TRANSACTION SERVICE] USE_MOCK:', USE_MOCK, 'NODE_ENV:', process.env.NODE_ENV);

// ==========================================
// 환경변수 로드 및 검증
// ==========================================

/**
 * 필수 환경변수 로드 함수
 * Phase 1-A: 보안 강화를 위해 추가
 *
 * @private
 * @throws {Error} 필수 환경변수 누락 시
 * @returns {Object} 검증된 환경변수 객체
 */
function loadEnvironmentVariables() {
    const required = {
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
            `[TRANSACTION SERVICE] 필수 환경변수가 설정되지 않았습니다: ${missing.join(', ')}`
        );
    }

    return required;
}

// ==========================================
// 에러 클래스
// ==========================================

/**
 * Transaction Service 에러 클래스
 */
class TransactionServiceError extends Error {
    constructor(message, code = 'TRANSACTION_ERROR', details = null) {
        super(message);
        this.name = 'TransactionServiceError';
        this.code = code;
        this.details = details;
    }
}

// ==========================================
// 헬퍼 함수
// ==========================================

/**
 * Solana 주소 형식 간단 검증 (Mock용)
 * 실제로는 @solana/web3.js의 PublicKey 사용
 *
 * @private
 * @param {string} address - 검증할 Solana 주소
 * @returns {boolean} 유효한 주소인지 여부
 */
function isValidSolanaAddress(address) {
    if (typeof address !== 'string') return false;
    if (address === 'invalid') return false; // 테스트용 명시적 거부

    // 테스트 환경에서 TEST로 시작하는 주소는 항상 유효
    if (process.env.NODE_ENV === 'test' && address.startsWith('TEST')) {
        return true;
    }

    // 길이 검증: Solana 주소는 32-44자
    if (address.length < 32 || address.length > 44) return false;

    // Base58 문자 집합 검증 (0, O, I, l 제외)
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    if (!base58Regex.test(address)) return false;

    return true;
}

// ==========================================
// Mock 구현
// ==========================================

/**
 * Mock: 부분 서명 트랜잭션 생성
 *
 * Phase 1-A 개선:
 * - feepayer를 환경변수에서 자동 로드
 * - 반환 데이터에서 feepayer 제외 (보안)
 *
 * @private
 * @param {Object} params - 트랜잭션 파라미터
 * @param {string} params.fromPubkey - 발신자 주소
 * @param {string} params.toPubkey - 수신자 주소
 * @param {number} params.amount - 전송 금액
 * @param {string} [params.tokenMint] - 토큰 민트 주소
 * @returns {Promise<Object>} 부분 서명 트랜잭션 (feepayer 제외)
 */
async function mockCreatePartialSignedTransaction(params) {
    const { fromPubkey, toPubkey, amount, tokenMint } = params;

    // 1. 환경변수 로드 (Phase 1-A: 추가)
    let env;
    try {
        env = loadEnvironmentVariables();
    } catch (error) {
        throw new TransactionServiceError(
            error.message,
            'ENV_ERROR'
        );
    }

    // 2. 입력값 검증
    if (!fromPubkey || !isValidSolanaAddress(fromPubkey)) {
        throw new TransactionServiceError(
            '유효하지 않은 발신자 주소입니다.',
            'INVALID_FROM_ADDRESS'
        );
    }

    if (!toPubkey || !isValidSolanaAddress(toPubkey)) {
        throw new TransactionServiceError(
            '유효하지 않은 수신자 주소입니다.',
            'INVALID_TO_ADDRESS'
        );
    }

    if (!amount || amount <= 0) {
        throw new TransactionServiceError(
            '전송 금액은 0보다 커야 합니다.',
            'INVALID_AMOUNT'
        );
    }

    // 3. 회사 지갑 주소 로드 (Phase 1-A: 환경변수에서)
    const feepayer = env.COMPANY_WALLET_ADDRESS;

    console.log('[TRANSACTION SERVICE] Fee Payer 환경변수에서 로드 완료');
    console.log('[TRANSACTION SERVICE] 트랜잭션 생성:', {
        from: fromPubkey.substring(0, 8) + '...',
        to: toPubkey.substring(0, 8) + '...',
        amount,
        // feepayer는 로그에도 출력하지 않음 (보안)
    });

    // 4. Mock 트랜잭션 생성
    // 내부적으로는 feepayer를 사용하지만, 반환 시에는 제외
    const internalTransaction = {
        transaction: 'MOCK_BASE64_TRANSACTION_STRING',
        feepayer: feepayer,  // 내부 처리용
        sender: fromPubkey,
        recipient: toPubkey,
        amount: amount,
        blockhash: 'MockBlockhash' + Date.now(),
        lastValidBlockHeight: 999999
    };

    // 5. Phase 1-A: 반환 데이터에서 feepayer 제거 (보안)
    const { feepayer: _, ...sanitizedTransaction } = internalTransaction;

    console.log('[TRANSACTION SERVICE] 트랜잭션 생성 완료 (feepayer 제외)');

    return sanitizedTransaction;
}

/**
 * Mock: 최종 서명 완료
 *
 * @private
 * @param {Object} partialTransaction - 부분 서명 트랜잭션
 * @param {string} partialTransaction.serialized - 직렬화된 트랜잭션
 * @param {Object} userSignature - 사용자 서명
 * @param {string} userSignature.publicKey - 사용자 공개키
 * @param {string} userSignature.signature - 사용자 서명값
 * @returns {Promise<Object>} 완전히 서명된 트랜잭션
 */
async function mockFinalizeTransaction(partialTransaction, userSignature) {
    console.log('[TRANSACTION SERVICE] finalizeTransaction 호출');

    // 1. 입력값 검증
    if (!partialTransaction || !partialTransaction.serialized) {
        throw new TransactionServiceError(
            '부분 서명 트랜잭션 데이터가 없습니다.',
            'INVALID_PARTIAL_TRANSACTION'
        );
    }

    if (!userSignature || !userSignature.publicKey || !userSignature.signature) {
        throw new TransactionServiceError(
            '사용자 서명 데이터가 유효하지 않습니다.',
            'INVALID_USER_SIGNATURE'
        );
    }

    // 2. 트랜잭션 복원
    const transactionStr = Buffer.from(partialTransaction.serialized, 'base64').toString();
    const transaction = JSON.parse(transactionStr);

    // 3. 사용자 서명 추가
    transaction.signatures.push({
        publicKey: userSignature.publicKey,
        signature: userSignature.signature
    });

    // 4. 최종 직렬화
    const signedSerialized = Buffer.from(JSON.stringify(transaction)).toString('base64');

    console.log('[TRANSACTION SERVICE] 사용자 서명 추가 완료');

    return {
        signedTransaction: transaction,
        serialized: signedSerialized
    };
}

/**
 * Mock: 트랜잭션 전송
 *
 * @private
 * @param {Object} signedTransaction - 서명 완료된 트랜잭션
 * @param {string} signedTransaction.serialized - 직렬화된 트랜잭션
 * @returns {Promise<Object>} { signature }
 */
async function mockSendTransaction(signedTransaction) {
    console.log('[TRANSACTION SERVICE] sendTransaction 호출');

    // 1. 입력값 검증
    if (!signedTransaction || !signedTransaction.serialized) {
        throw new TransactionServiceError(
            '서명된 트랜잭션 데이터가 없습니다.',
            'INVALID_SIGNED_TRANSACTION'
        );
    }

    // 2. 네트워크 오류 시뮬레이션
    if (signedTransaction.serialized.includes('networkErrorCase')) {
        throw new TransactionServiceError(
            '네트워크 오류가 발생했습니다.',
            'NETWORK_ERROR'
        );
    }

    // 3. Mock 시그니처 생성
    const signature = 'MockTxSignature' + Date.now() + Math.random().toString(36).substring(7);

    console.log('[TRANSACTION SERVICE] 트랜잭션 전송 완료:', signature);

    return { signature };
}

/**
 * Mock: 트랜잭션 상태 조회
 *
 * @private
 * @param {string} signature - 트랜잭션 시그니처
 * @returns {Promise<Object>} { status, confirmations, err }
 */
async function mockGetTransactionStatus(signature) {
    // 입력값 검증
    if (!signature || typeof signature !== 'string' || signature.length === 0) {
        throw new TransactionServiceError(
            '유효하지 않은 트랜잭션 시그니처입니다.',
            'INVALID_SIGNATURE'
        );
    }

    if (signature === 'invalid') {
        throw new TransactionServiceError(
            '트랜잭션을 찾을 수 없습니다.',
            'TRANSACTION_NOT_FOUND'
        );
    }

    // Mock 상태 반환
    return {
        status: 'confirmed',
        confirmations: 32,
        err: null
    };
}

/**
 * Mock: 컨펌 대기
 *
 * @private
 * @param {string} signature - 트랜잭션 시그니처
 * @param {Object} [options={}] - 옵션
 * @param {number} [options.timeout=60000] - 타임아웃 (ms)
 * @param {string} [options.commitment='confirmed'] - Commitment 레벨
 * @returns {Promise<Object>} { confirmed, signature, status }
 */
async function mockWaitForConfirmation(signature, options = {}) {
    const { timeout = 60000, commitment = 'confirmed' } = options;

    // 입력값 검증
    if (!signature || typeof signature !== 'string') {
        throw new TransactionServiceError(
            '유효하지 않은 트랜잭션 시그니처입니다.',
            'INVALID_SIGNATURE'
        );
    }

    // 타임아웃 시뮬레이션
    if (signature === 'timeoutCase') {
        throw new TransactionServiceError(
            `트랜잭션 컨펌 타임아웃 (${timeout}ms)`,
            'CONFIRMATION_TIMEOUT'
        );
    }

    // 짧은 대기 후 성공 반환
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
        confirmed: true,
        signature,
        status: 'finalized'
    };
}

// ==========================================
// 실제 Solana 구현 (추후 작업)
// ==========================================

/**
 * 실제 Solana 라이브러리를 사용한 구현
 * 현재는 주석 처리
 */
/*
import {
    Connection,
    PublicKey,
    Transaction,
    Keypair
} from '@solana/web3.js';
import {
    createTransferInstruction,
    getAssociatedTokenAddress,
    TOKEN_PROGRAM_ID
} from '@solana/spl-token';

// 실제 구현 함수들...
*/

// ==========================================
// Export Functions
// ==========================================

/**
 * 부분 서명 트랜잭션 생성
 *
 * Phase 1-A 개선:
 * - feepayer는 환경변수에서 자동 로드
 * - 반환값에 feepayer 필드 제외 (보안 강화)
 *
 * @param {Object} params - 트랜잭션 파라미터
 * @param {string} params.fromPubkey - 발신자 주소
 * @param {string} params.toPubkey - 수신자 주소
 * @param {number} params.amount - 전송 금액
 * @param {string} [params.tokenMint] - 토큰 민트 주소
 * @returns {Promise<Object>} 부분 서명 트랜잭션 (feepayer 제외)
 *
 * @example
 * const tx = await createPartialSignedTransaction({
 *   fromPubkey: 'SenderAddress...',
 *   toPubkey: 'RecipientAddress...',
 *   amount: 100.5,
 *   tokenMint: 'TokenMintAddress...'
 * });
 * // 반환값: { transaction, sender, recipient, amount, blockhash, lastValidBlockHeight }
 * // 주의: feepayer는 포함되지 않음 (보안)
 */
export async function createPartialSignedTransaction(params) {
    console.log('[TRANSACTION SERVICE] createPartialSignedTransaction 호출됨');
    console.log('[TRANSACTION SERVICE] USE_MOCK:', USE_MOCK);
    console.log('[TRANSACTION SERVICE] params:', {
        fromPubkey: params.fromPubkey?.substring(0, 8) + '...',
        toPubkey: params.toPubkey?.substring(0, 8) + '...',
        amount: params.amount
    });

    if (USE_MOCK) {
        console.log('[TRANSACTION SERVICE] Mock 함수 호출 시작');
        return mockCreatePartialSignedTransaction(params);
    }

    // TODO: 실제 Solana 구현
    throw new TransactionServiceError('실제 Solana 구현 필요', 'NOT_IMPLEMENTED');
}

/**
 * 최종 서명 완료
 *
 * 부분 서명된 트랜잭션에 사용자 서명을 추가하여 완전한 트랜잭션을 생성합니다.
 *
 * @param {Object} partialTransaction - 부분 서명 트랜잭션
 * @param {string} partialTransaction.serialized - 직렬화된 트랜잭션
 * @param {Object} userSignature - 사용자 서명
 * @param {string} userSignature.publicKey - 사용자 공개키
 * @param {string} userSignature.signature - 사용자 서명값
 * @returns {Promise<Object>} { signedTransaction, serialized }
 *
 * @example
 * const finalized = await finalizeTransaction(
 *   partialTx,
 *   { publicKey: 'UserPublicKey...', signature: 'UserSignature...' }
 * );
 */
export async function finalizeTransaction(partialTransaction, userSignature) {
    if (USE_MOCK) {
        return mockFinalizeTransaction(partialTransaction, userSignature);
    }

    // TODO: 실제 Solana 구현
    throw new TransactionServiceError('실제 Solana 구현 필요', 'NOT_IMPLEMENTED');
}

/**
 * 트랜잭션 전송
 *
 * 완전히 서명된 트랜잭션을 Solana 네트워크에 전송합니다.
 *
 * @param {Object} signedTransaction - 서명 완료된 트랜잭션
 * @param {string} signedTransaction.serialized - 직렬화된 트랜잭션
 * @returns {Promise<Object>} { signature }
 *
 * @example
 * const result = await sendTransaction(signedTx);
 * console.log('Transaction signature:', result.signature);
 */
export async function sendTransaction(signedTransaction) {
    if (USE_MOCK) {
        return mockSendTransaction(signedTransaction);
    }

    // TODO: 실제 Solana 구현
    throw new TransactionServiceError('실제 Solana 구현 필요', 'NOT_IMPLEMENTED');
}

/**
 * 트랜잭션 상태 조회
 *
 * @param {string} signature - 트랜잭션 시그니처
 * @returns {Promise<Object>} { status, confirmations, err }
 *
 * @example
 * const status = await getTransactionStatus('TxSignature...');
 * console.log('Status:', status.status);
 */
export async function getTransactionStatus(signature) {
    if (USE_MOCK) {
        return mockGetTransactionStatus(signature);
    }

    // TODO: 실제 Solana 구현
    throw new TransactionServiceError('실제 Solana 구현 필요', 'NOT_IMPLEMENTED');
}

/**
 * 컨펌 대기
 *
 * 트랜잭션이 컨펌될 때까지 대기합니다.
 *
 * @param {string} signature - 트랜잭션 시그니처
 * @param {Object} [options] - 옵션
 * @param {number} [options.timeout=60000] - 타임아웃 (ms)
 * @param {string} [options.commitment='confirmed'] - Commitment 레벨
 * @returns {Promise<Object>} { confirmed, signature, status }
 *
 * @example
 * const result = await waitForConfirmation('TxSignature...', {
 *   timeout: 30000,
 *   commitment: 'finalized'
 * });
 */
export async function waitForConfirmation(signature, options = {}) {
    if (USE_MOCK) {
        return mockWaitForConfirmation(signature, options);
    }

    // TODO: 실제 Solana 구현
    throw new TransactionServiceError('실제 Solana 구현 필요', 'NOT_IMPLEMENTED');
}

// Default Export
export default {
    createPartialSignedTransaction,
    finalizeTransaction,
    sendTransaction,
    getTransactionStatus,
    waitForConfirmation
};