/**
 * ============================================
 * Solana 설정 파일 (최종 완성 버전)
 * ============================================
 *
 * 역할:
 * - Solana RPC 연결 정보 중앙 관리
 * - 회사 지갑 정보 관리
 * - 토큰 정보 관리
 * - 설정값 검증
 *
 * 사용 예시:
 * import { SOLANA_CONFIG, connection } from '../config/solana.config.js';
 * console.log(SOLANA_CONFIG.RPC_URL);
 * const blockhash = await connection.getLatestBlockhash();
 */

import dotenv from 'dotenv';
import { Connection, PublicKey } from '@solana/web3.js';

// 환경변수 로드
dotenv.config();

// 디버깅: 환경변수 확인
console.log('[DEBUG] SOLANA_RPC_URL:', process.env.SOLANA_RPC_URL);
console.log('[DEBUG] SOLANA_NETWORK:', process.env.SOLANA_NETWORK);
console.log('[DEBUG] Current Directory:', process.cwd());

/**
 * 필수 환경변수 검증 함수
 * 운영 환경에서 누락된 환경변수가 있으면 에러 발생
 *
 * @param {string} key - 환경변수 키
 * @param {string} defaultValue - 기본값 (선택사항)
 * @returns {string} 환경변수 값
 */
function getEnvVariable(key, defaultValue = null) {
    const value = process.env[key];

    // 개발/테스트 환경에서는 기본값 허용
    if (!value && defaultValue !== null) {
        return defaultValue;
    }

    // 운영 환경에서 필수 환경변수 누락 시 경고
    if (!value && process.env.NODE_ENV === 'production') {
        console.warn(`[WARNING] 환경변수 ${key}가 설정되지 않았습니다.`);
    }

    return value || defaultValue;
}

/**
 * Solana 네트워크 환경 결정
 * - devnet: 개발/테스트용
 * - testnet: 테스트넷 (선택적)
 * - mainnet-beta: 실제 운영용
 */
const NETWORK = getEnvVariable('SOLANA_NETWORK', 'devnet');

/**
 * 네트워크별 RPC URL 매핑
 * 환경변수로 직접 지정하거나, 네트워크명으로 자동 매핑
 */
const RPC_ENDPOINTS = {
    'devnet': 'https://api.devnet.solana.com',
    'testnet': 'https://api.testnet.solana.com',
    'mainnet-beta': 'https://api.mainnet-beta.solana.com',
};

/**
 * Solana 설정 객체
 * 모든 Solana 관련 설정을 여기서 관리
 */
export const SOLANA_CONFIG = {
    // RPC 엔드포인트
    // 환경변수로 직접 지정하거나, 네트워크명으로 자동 결정
    RPC_URL: getEnvVariable('SOLANA_RPC_URL') || RPC_ENDPOINTS[NETWORK],

    // 네트워크 환경 (devnet/testnet/mainnet-beta)
    NETWORK: NETWORK,

    // 회사 지갑 시크릿 키 (Base58 형식)
    // 실제 운영 시에는 NCLOUD Secret Manager에서 가져와야 함
    COMPANY_WALLET_PRIVATE_KEY: getEnvVariable('COMPANY_WALLET_PRIVATE_KEY'),

    // ✅ 수정: 회사 지갑 공개키 주소 (환경변수에서 로드)
    COMPANY_WALLET_ADDRESS: getEnvVariable(
        'COMPANY_WALLET_ADDRESS',
        'BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh' // 기본값 (개발용)
    ),

    // RIPY 토큰 민트 주소
    RIPY_TOKEN_MINT_ADDRESS: getEnvVariable('RIPY_TOKEN_MINT_ADDRESS'),

    // 토큰 소수점 자리수 (일반적으로 9)
    TOKEN_DECIMALS: parseInt(getEnvVariable('TOKEN_DECIMALS', '9'), 10),

    // 트랜잭션 컨펌 설정
    COMMITMENT: 'confirmed', // 'processed', 'confirmed', 'finalized'

    // 타임아웃 설정 (밀리초)
    TIMEOUT: 30000, // 30초

    // 최대 재시도 횟수
    MAX_RETRIES: 3,

    // 재시도 간격 (밀리초)
    RETRY_DELAY: 1000, // 1초
};

/**
 * ============================================
 * Solana Connection 객체 생성
 * ============================================
 *
 * Solana 블록체인과의 연결을 관리하는 Connection 객체
 * 모든 RPC 호출에 사용됩니다.
 *
 * 사용 예시:
 * import { connection } from '../config/solana.config.js';
 * const balance = await connection.getBalance(publicKey);
 */
export const connection = new Connection(
    SOLANA_CONFIG.RPC_URL,
    {
        commitment: SOLANA_CONFIG.COMMITMENT,
        confirmTransactionInitialTimeout: SOLANA_CONFIG.TIMEOUT,
    }
);

/**
 * ============================================
 * PublicKey 객체들
 * ============================================
 *
 * 자주 사용되는 주소들을 PublicKey 객체로 미리 생성
 * 매번 new PublicKey()를 호출하는 것보다 효율적입니다.
 */

/**
 * 회사 지갑 공개키 객체
 * 부분서명 시 Fee Payer로 사용됩니다.
 */
export const COMPANY_WALLET_PUBLIC_KEY = new PublicKey(
    SOLANA_CONFIG.COMPANY_WALLET_ADDRESS
);

/**
 * RIPY 토큰 민트 공개키 객체
 * 토큰 전송 시 사용됩니다.
 *
 * 주의: RIPY_TOKEN_MINT_ADDRESS가 설정되지 않으면 null
 */
export const TOKEN_MINT_PUBLIC_KEY = SOLANA_CONFIG.RIPY_TOKEN_MINT_ADDRESS
    ? new PublicKey(SOLANA_CONFIG.RIPY_TOKEN_MINT_ADDRESS)
    : null;

/**
 * 설정값 검증 함수
 * 서버 시작 시 호출하여 필수 설정값 확인
 *
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateSolanaConfig() {
    const errors = [];

    // RPC URL 검증
    if (!SOLANA_CONFIG.RPC_URL) {
        errors.push('SOLANA_RPC_URL이 설정되지 않았습니다.');
    }

    // 네트워크 검증
    const validNetworks = ['devnet', 'testnet', 'mainnet-beta'];
    if (!validNetworks.includes(SOLANA_CONFIG.NETWORK)) {
        errors.push(`유효하지 않은 네트워크: ${SOLANA_CONFIG.NETWORK}. (허용: ${validNetworks.join(', ')})`);
    }

    // 회사 지갑 주소 검증
    try {
        new PublicKey(SOLANA_CONFIG.COMPANY_WALLET_ADDRESS);
    } catch (error) {
        errors.push('COMPANY_WALLET_ADDRESS가 유효한 Solana 주소가 아닙니다.');
    }

    // 운영 환경에서 필수 항목 검증
    if (process.env.NODE_ENV === 'production') {
        if (!SOLANA_CONFIG.COMPANY_WALLET_PRIVATE_KEY) {
            errors.push('COMPANY_WALLET_PRIVATE_KEY가 설정되지 않았습니다. (운영 환경 필수)');
        }

        if (!SOLANA_CONFIG.RIPY_TOKEN_MINT_ADDRESS) {
            errors.push('RIPY_TOKEN_MINT_ADDRESS가 설정되지 않았습니다. (운영 환경 필수)');
        }

        if (SOLANA_CONFIG.NETWORK !== 'mainnet-beta') {
            errors.push('운영 환경에서는 mainnet-beta를 사용해야 합니다.');
        }
    }

    // RIPY_TOKEN_MINT_ADDRESS 형식 검증 (설정된 경우)
    if (SOLANA_CONFIG.RIPY_TOKEN_MINT_ADDRESS) {
        try {
            new PublicKey(SOLANA_CONFIG.RIPY_TOKEN_MINT_ADDRESS);
        } catch (error) {
            errors.push('RIPY_TOKEN_MINT_ADDRESS가 유효한 Solana 주소가 아닙니다.');
        }
    }

    // TOKEN_DECIMALS 검증
    if (isNaN(SOLANA_CONFIG.TOKEN_DECIMALS) || SOLANA_CONFIG.TOKEN_DECIMALS < 0) {
        errors.push('TOKEN_DECIMALS는 0 이상의 숫자여야 합니다.');
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * 설정 정보 출력 함수 (디버깅용)
 * 민감한 정보는 마스킹 처리
 */
export function logSolanaConfig() {
    console.log('\n========================================');
    console.log('Solana 설정 정보');
    console.log('========================================');
    console.log(`RPC URL: ${SOLANA_CONFIG.RPC_URL}`);
    console.log(`Network: ${SOLANA_CONFIG.NETWORK}`);
    console.log(`Company Wallet: ${SOLANA_CONFIG.COMPANY_WALLET_ADDRESS}`);
    console.log(`Token Mint: ${SOLANA_CONFIG.RIPY_TOKEN_MINT_ADDRESS || '(미설정)'}`);
    console.log(`Token Decimals: ${SOLANA_CONFIG.TOKEN_DECIMALS}`);
    console.log(`Commitment: ${SOLANA_CONFIG.COMMITMENT}`);
    console.log(`Timeout: ${SOLANA_CONFIG.TIMEOUT}ms`);
    console.log(`Max Retries: ${SOLANA_CONFIG.MAX_RETRIES}`);
    console.log(`Retry Delay: ${SOLANA_CONFIG.RETRY_DELAY}ms`);

    // 시크릿 키는 마스킹 처리
    if (SOLANA_CONFIG.COMPANY_WALLET_PRIVATE_KEY) {
        const masked = SOLANA_CONFIG.COMPANY_WALLET_PRIVATE_KEY.substring(0, 8) + '...' +
            SOLANA_CONFIG.COMPANY_WALLET_PRIVATE_KEY.slice(-4);
        console.log(`Service Wallet Key: ${masked}`);
    } else {
        console.log(`Service Wallet Key: (미설정)`);
    }

    console.log('========================================\n');
}

/**
 * Connection 연결 테스트 함수
 * 서버 시작 시 RPC 연결이 정상적으로 작동하는지 확인
 *
 * @returns {Promise<boolean>} 연결 성공 여부
 */
export async function testSolanaConnection() {
    try {
        console.log('[Solana] RPC 연결 테스트 중...');

        // 최신 blockhash 조회로 연결 테스트
        const { blockhash } = await connection.getLatestBlockhash();

        console.log(`[Solana] RPC 연결 성공! (blockhash: ${blockhash.substring(0, 8)}...)`);
        return true;
    } catch (error) {
        console.error('[Solana] RPC 연결 실패:', error.message);
        return false;
    }
}

/**
 * 기본 export
 */
export default SOLANA_CONFIG;