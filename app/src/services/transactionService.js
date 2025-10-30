/**
 * Solana Transaction Service (Mock Version)
 *
 * 설명회용 Mock 구현
 * 실제 Solana 블록체인 연동은 추후 진행
 *
 * @module services/transactionService
 */

// ==========================================
// Mock 설정
// ==========================================

const USE_MOCK = process.env.NODE_ENV === 'test' || process.env.USE_SOLANA_MOCK !== 'false';
console.log('[TRANSACTION SERVICE] USE_MOCK:', USE_MOCK, 'NODE_ENV:', process.env.NODE_ENV);

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
 */
async function mockCreatePartialSignedTransaction(params) {
    const { fromPubkey, toPubkey, amount, tokenMint } = params;

    // 입력값 검증
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

    // Mock 트랜잭션 생성 (이 부분이 return 해야 함!)
    return {
        transaction: 'MOCK_BASE64_TRANSACTION_STRING',
        feepayer: 'CompanyWalletPublicKey',
        sender: fromPubkey,
        recipient: toPubkey,
        amount: amount,
        blockhash: 'MockBlockhash' + Date.now(),
        lastValidBlockHeight: 999999
    };
}

/**
 * Mock: 최종 서명 완료
 */
async function mockFinalizeTransaction(partialTransaction, userSignature) {
    // 입력값 검증
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

    // 트랜잭션 복원
    const transactionStr = Buffer.from(partialTransaction.serialized, 'base64').toString();
    const transaction = JSON.parse(transactionStr);

    // 사용자 서명 추가
    transaction.signatures.push({
        publicKey: userSignature.publicKey,
        signature: userSignature.signature
    });

    // 최종 직렬화
    const signedSerialized = Buffer.from(JSON.stringify(transaction)).toString('base64');

    return {
        signedTransaction: transaction,
        serialized: signedSerialized
    };
}

/**
 * Mock: 트랜잭션 전송
 */
async function mockSendTransaction(signedTransaction) {
    // 입력값 검증
    if (!signedTransaction || !signedTransaction.serialized) {
        throw new TransactionServiceError(
            '서명된 트랜잭션 데이터가 없습니다.',
            'INVALID_SIGNED_TRANSACTION'
        );
    }

    // 네트워크 오류 시뮬레이션
    if (signedTransaction.serialized.includes('networkErrorCase')) {
        throw new TransactionServiceError(
            '네트워크 오류가 발생했습니다.',
            'NETWORK_ERROR'
        );
    }

    // Mock 시그니처 생성
    const signature = 'MockTxSignature' + Date.now() + Math.random().toString(36).substring(7);

    return { signature };
}

/**
 * Mock: 트랜잭션 상태 조회
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
 * @param {Object} params - 트랜잭션 파라미터
 * @param {string} params.fromPubkey - 발신자 주소
 * @param {string} params.toPubkey - 수신자 주소
 * @param {number} params.amount - 전송 금액
 * @param {string} [params.tokenMint] - 토큰 민트 주소
 * @returns {Promise<Object>} { transaction, serialized, blockhash, lastValidBlockHeight }
 */
export async function createPartialSignedTransaction(params) {
    console.log('[TRANSACTION SERVICE] createPartialSignedTransaction 호출됨');
    console.log('[TRANSACTION SERVICE] USE_MOCK:', USE_MOCK);
    console.log('[TRANSACTION SERVICE] params:', params);

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
 * @param {Object} partialTransaction - 부분 서명 트랜잭션
 * @param {Object} userSignature - 사용자 서명
 * @returns {Promise<Object>} { signedTransaction, serialized }
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
 * @param {Object} signedTransaction - 서명 완료된 트랜잭션
 * @returns {Promise<Object>} { signature }
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
 * @param {string} signature - 트랜잭션 시그니처
 * @param {Object} [options] - 옵션
 * @param {number} [options.timeout=60000] - 타임아웃 (ms)
 * @param {string} [options.commitment='confirmed'] - Commitment 레벨
 * @returns {Promise<Object>} { confirmed, signature, status }
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