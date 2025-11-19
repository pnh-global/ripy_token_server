/**
 * ============================================
 * Jest 전역 설정 파일
 * ============================================
 *
 * 역할:
 * - 테스트 실행 전 환경변수 로드
 * - Devnet 설정 초기화
 * - 공통 타임아웃 설정
 *
 * 작성일: 2025-10-30
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ============================================
// ESM 모듈에서 __dirname 구하기
// ============================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================
// .env.test 파일 로드
// ============================================
const result = dotenv.config({
    path: join(__dirname, '.env.test')
});

if (result.error) {
    console.warn('⚠️  .env.test 파일을 찾을 수 없습니다. 기본 환경변수를 사용합니다.');
}

// ============================================
// 환경변수 백업 및 우선순위 처리
// ============================================

// COMPANY_WALLET_PRIVATE_KEY 우선순위 처리
if (!process.env.COMPANY_WALLET_PRIVATE_KEY && process.env.COMPANY_WALLET_PRIVATE_KEY_DEVNET) {
    process.env.COMPANY_WALLET_PRIVATE_KEY = process.env.COMPANY_WALLET_PRIVATE_KEY_DEVNET;
}

// RIPY_TOKEN_MINT_ADDRESS 우선순위 처리
if (!process.env.RIPY_TOKEN_MINT_ADDRESS && process.env.TEST_TOKEN_MINT) {
    process.env.RIPY_TOKEN_MINT_ADDRESS = process.env.TEST_TOKEN_MINT;
}

// RPC_URL 우선순위 처리
if (!process.env.RPC_URL && process.env.SOLANA_RPC_URL) {
    process.env.RPC_URL = process.env.SOLANA_RPC_URL;
}

// ============================================
// 테스트 환경 확인 로그
// ============================================
console.log('');
console.log('='.repeat(60));
console.log('Jest 테스트 환경 설정 완료');
console.log('='.repeat(60));
console.log(`환경: ${process.env.NODE_ENV || 'development'}`);
console.log(`RPC URL: ${process.env.SOLANA_RPC_URL || process.env.RPC_URL || '미설정'}`);
console.log(`네트워크: ${process.env.SOLANA_NETWORK || 'devnet'}`);
console.log(`토큰 Decimals: ${process.env.TOKEN_DECIMALS || '9'}`);
console.log('');
console.log('환경변수 로드 상태:');
console.log(`  - COMPANY_WALLET_PRIVATE_KEY: ${process.env.COMPANY_WALLET_PRIVATE_KEY ? '✅ 로드됨' : '❌ 없음'}`);
console.log(`  - RIPY_TOKEN_MINT_ADDRESS: ${process.env.RIPY_TOKEN_MINT_ADDRESS ? '✅ 로드됨' : '❌ 없음'}`);
console.log(`  - ENCRYPTION_KEY: ${process.env.ENCRYPTION_KEY ? '✅ 로드됨' : '❌ 없음'}`);
console.log('='.repeat(60));
console.log('');

// ============================================
// 전역 타임아웃 설정
// ============================================
// ESM 환경에서는 jest 객체가 전역으로 제공되지 않으므로
// jest.config.js의 testTimeout 설정을 사용합니다.
// 개별 테스트에서 필요 시 timeout 옵션을 명시적으로 지정하세요.