/**
 * ============================================
 * Solana 유틸리티 함수 (개선 버전)
 * ============================================
 *
 * 역할:
 * - Solana RPC 연결 생성
 * - 회사 지갑 키페어 로드
 * - ATA(Associated Token Account) 주소 계산
 * - ATA 생성 instruction 생성
 * - 최신 blockhash 조회
 *
 * 전자 서명 로드맵에서 요구하는 5개 핵심 함수 구현
 */

import {
    Connection,
    Keypair,
    PublicKey
} from '@solana/web3.js';
import {
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import bs58 from 'bs58';
import { SOLANA_CONFIG } from '../config/solana.config.js';

/**
 * ============================================
 * 1. Solana RPC Connection 생성
 * ============================================
 *
 * Solana 블록체인과 통신하기 위한 Connection 객체 생성
 *
 * @returns {Connection} Solana Connection 객체
 *
 * @example
 * const connection = createConnection();
 * const latestBlockhash = await connection.getLatestBlockhash();
 */
export function createConnection() {
    try {
        // Connection 옵션 설정
        const connectionConfig = {
            commitment: SOLANA_CONFIG.COMMITMENT, // 'confirmed'
            confirmTransactionInitialTimeout: SOLANA_CONFIG.TIMEOUT // 30000ms
        };

        // Connection 객체 생성
        const connection = new Connection(
            SOLANA_CONFIG.RPC_URL,
            connectionConfig
        );

        return connection;

    } catch (error) {
        console.error('Solana Connection 생성 실패:', error);
        throw new Error(`Solana RPC 연결 실패: ${error.message}`);
    }
}

/**
 * ============================================
 * 2. 회사 지갑 키페어 로드 (보안 강화 버전)
 * ============================================
 *
 * Base58로 인코딩된 시크릿 키를 디코딩하여 Keypair 객체 생성
 *
 * FastAPI(Python)와의 차이점:
 * - Python: Keypair.from_base58_string(secret_key)
 * - Node.js: Keypair.fromSecretKey(bs58.decode(secret_key))
 *
 * @param {string} [secretKeyBase58] - Base58 인코딩된 시크릿 키 (선택, 없으면 환경변수 사용)
 * @returns {Keypair} Solana Keypair 객체
 *
 * @throws {Error} 시크릿 키가 없거나 유효하지 않은 경우
 *
 * @example
 * const companyWallet = loadCompanyWallet();
 * console.log('회사 지갑 주소:', companyWallet.publicKey.toBase58());
 */
export function loadCompanyWallet(secretKeyBase58 = null) {
    try {
        // 시크릿 키 가져오기 (파라미터 또는 환경변수)
        const secretKey = secretKeyBase58 || SOLANA_CONFIG.COMPANY_WALLET_PRIVATE_KEY;

        if (!secretKey) {
            throw new Error('회사 지갑 시크릿 키가 설정되지 않았습니다. (COMPANY_WALLET_PRIVATE_KEY)');
        }

        // 보안: 시크릿 키 최소 길이 검증
        if (secretKey.length < 32) {
            throw new Error('유효하지 않은 시크릿 키 형식입니다.');
        }

        // Base58 디코딩하여 Uint8Array로 변환
        const secretKeyBytes = bs58.decode(secretKey);

        // 보안: 디코딩된 바이트 길이 검증 (Solana 키는 64바이트)
        if (secretKeyBytes.length !== 64) {
            throw new Error(`유효하지 않은 시크릿 키 길이입니다. (실제: ${secretKeyBytes.length}바이트, 예상: 64바이트)`);
        }

        // Keypair 생성
        const keypair = Keypair.fromSecretKey(secretKeyBytes);

        // 보안: 로그에는 공개키만 출력
        console.log('[Security] 회사 지갑 로드 성공:', keypair.publicKey.toBase58());

        return keypair;

    } catch (error) {
        // 보안: 에러 메시지에 시크릿 키 포함 방지
        console.error('[Security] 회사 지갑 로드 실패 (시크릿 키 정보 숨김)');

        // 개발 환경에서는 상세 에러, 운영 환경에서는 간략한 에러
        if (process.env.NODE_ENV === 'development') {
            throw new Error(`회사 지갑 로드 실패: ${error.message}`);
        } else {
            throw new Error('회사 지갑 로드 실패: 시크릿 키를 확인하세요.');
        }
    }
}

/**
 * ============================================
 * 3. ATA(Associated Token Account) 주소 계산
 * ============================================
 *
 * 특정 지갑 주소의 특정 토큰에 대한 ATA 주소를 계산
 *
 * ATA란?
 * - SPL 토큰을 보유하기 위한 계정
 * - 각 지갑마다 각 토큰별로 하나의 ATA만 존재
 * - 결정론적으로 계산 가능 (PDA - Program Derived Address)
 *
 * @param {PublicKey|string} ownerPublicKey - 지갑 주소 (소유자)
 * @param {PublicKey|string} tokenMintAddress - 토큰 민트 주소
 * @returns {Promise<PublicKey>} ATA 주소
 *
 * @example
 * const userWallet = new PublicKey('사용자지갑주소...');
 * const tokenMint = new PublicKey('토큰민트주소...');
 * const ataAddress = await getATAAddress(userWallet, tokenMint);
 * console.log('ATA 주소:', ataAddress.toBase58());
 */
export async function getATAAddress(ownerPublicKey, tokenMintAddress) {
    try {
        // 문자열이면 PublicKey 객체로 변환
        const owner = typeof ownerPublicKey === 'string'
            ? new PublicKey(ownerPublicKey)
            : ownerPublicKey;

        const mint = typeof tokenMintAddress === 'string'
            ? new PublicKey(tokenMintAddress)
            : tokenMintAddress;

        // ATA 주소 계산
        const ataAddress = await getAssociatedTokenAddress(
            mint,           // 토큰 민트 주소
            owner,          // 소유자 지갑 주소
            false,          // allowOwnerOffCurve (일반적으로 false)
            TOKEN_PROGRAM_ID,              // 토큰 프로그램 ID
            ASSOCIATED_TOKEN_PROGRAM_ID    // ATA 프로그램 ID
        );

        return ataAddress;

    } catch (error) {
        console.error('ATA 주소 계산 실패:', error);
        throw new Error(`ATA 주소 계산 실패: ${error.message}`);
    }
}

/**
 * ============================================
 * 4. ATA 생성 Instruction 생성
 * ============================================
 *
 * ATA가 존재하지 않을 경우, 생성하는 instruction 생성
 *
 * 주의사항:
 * - ATA가 이미 존재하면 트랜잭션 실패
 * - 실제 사용 전에 ATA 존재 여부 확인 필요
 *
 * FastAPI(Python)와의 차이점:
 * - Python: spl_token.create_associated_token_account(payer, owner, mint)
 * - Node.js: createAssociatedTokenAccountInstruction(payer, ata, owner, mint)
 *
 * @param {PublicKey} payerPublicKey - 수수료를 지불할 지갑 (보통 회사 지갑)
 * @param {PublicKey} ownerPublicKey - ATA 소유자 지갑
 * @param {PublicKey} ataAddress - 생성할 ATA 주소
 * @param {PublicKey} tokenMintAddress - 토큰 민트 주소
 * @returns {TransactionInstruction} ATA 생성 instruction
 *
 * @example
 * const payer = companyWallet.publicKey;
 * const owner = new PublicKey('사용자지갑주소...');
 * const ata = await getATAAddress(owner, tokenMint);
 * const instruction = createATAInstruction(payer, owner, ata, tokenMint);
 */
export function createATAInstruction(payerPublicKey, ownerPublicKey, ataAddress, tokenMintAddress) {
    try {
        // ATA 생성 instruction 생성
        const instruction = createAssociatedTokenAccountInstruction(
            payerPublicKey,      // payer: 수수료 지불자
            ataAddress,          // associatedToken: 생성할 ATA 주소
            ownerPublicKey,      // owner: ATA 소유자
            tokenMintAddress,    // mint: 토큰 민트 주소
            TOKEN_PROGRAM_ID,              // 토큰 프로그램 ID
            ASSOCIATED_TOKEN_PROGRAM_ID    // ATA 프로그램 ID
        );

        return instruction;

    } catch (error) {
        console.error('ATA 생성 instruction 생성 실패:', error);
        throw new Error(`ATA 생성 instruction 생성 실패: ${error.message}`);
    }
}

/**
 * ============================================
 * 5. 최신 Blockhash 조회
 * ============================================
 *
 * 트랜잭션에 필요한 최신 blockhash 조회
 *
 * Blockhash란?
 * - 트랜잭션의 유효성을 보장하는 최근 블록의 해시값
 * - 트랜잭션은 반드시 최신 blockhash를 포함해야 함
 * - 일정 시간(약 60초) 후 만료됨
 *
 * @param {Connection} connection - Solana Connection 객체
 * @returns {Promise<Object>} { blockhash: string, lastValidBlockHeight: number }
 *
 * @example
 * const connection = createConnection();
 * const { blockhash, lastValidBlockHeight } = await getLatestBlockhash(connection);
 * console.log('Blockhash:', blockhash);
 * console.log('유효 블록 높이:', lastValidBlockHeight);
 */
export async function getLatestBlockhash(connection) {
    try {
        // 최신 blockhash 조회
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(
            SOLANA_CONFIG.COMMITMENT
        );

        return {
            blockhash,
            lastValidBlockHeight
        };

    } catch (error) {
        console.error('Blockhash 조회 실패:', error);
        throw new Error(`Blockhash 조회 실패: ${error.message}`);
    }
}

/**
 * ============================================
 * 추가 유틸리티 함수들
 * ============================================
 */

/**
 * ATA 존재 여부 확인 (개선 버전)
 *
 * @param {Connection} connection - Solana Connection 객체
 * @param {PublicKey} ataAddress - 확인할 ATA 주소
 * @returns {Promise<boolean>} ATA 존재 여부
 *
 * @example
 * const exists = await checkATAExists(connection, ataAddress);
 * if (!exists) {
 *   // ATA 생성 필요
 * }
 */
export async function checkATAExists(connection, ataAddress) {
    try {
        const accountInfo = await connection.getAccountInfo(ataAddress);
        return accountInfo !== null;
    } catch (error) {
        // 네트워크 에러 vs 계정 없음을 구분
        const errorMessage = error.message || '';

        if (errorMessage.includes('could not find account') ||
            errorMessage.includes('Invalid param')) {
            // 계정이 존재하지 않음 (정상)
            return false;
        }

        // 다른 에러는 throw (네트워크 문제 등)
        console.error('ATA 존재 여부 확인 중 에러:', error);
        throw new Error(`ATA 확인 실패: ${error.message}`);
    }
}

/**
 * 지갑 주소 유효성 검증
 *
 * @param {string} address - 검증할 지갑 주소 (Base58)
 * @returns {boolean} 유효성 여부
 *
 * @example
 * if (isValidSolanaAddress('ABC123...')) {
 *   console.log('유효한 주소입니다.');
 * }
 */
export function isValidSolanaAddress(address) {
    try {
        // 빈 문자열 체크
        if (!address || typeof address !== 'string') {
            return false;
        }

        // PublicKey 생성 시도
        new PublicKey(address);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * 기본 export
 */
export default {
    createConnection,
    loadCompanyWallet,
    getATAAddress,
    createATAInstruction,
    getLatestBlockhash,
    checkATAExists,
    isValidSolanaAddress
};