/**
 * ============================================
 * crypto.test.js - 암호화 유틸리티 테스트
 * ============================================
 *
 * 실행 방법:
 * node src/utils/__tests__/crypto.test.js
 */

import { encryptData, decryptData, hashApiKey, generateApiKey } from '../crypto.js';

console.log('암호화 유틸리티 테스트 시작\n');

// 테스트 1: 암호화 & 복호화
console.log('[TEST 1] 암호화 & 복호화');
const originalText = 'my-solana-wallet-address-123';
console.log('원본:', originalText);

const encrypted = encryptData(originalText);
console.log('암호문:', encrypted.substring(0, 50) + '...');

const decrypted = decryptData(encrypted);
console.log('복호화:', decrypted);
console.log('일치:', originalText === decrypted);
console.log('');

// 테스트 2: API Key 생성 & 해싱
console.log('[TEST 2] API Key 생성 & 해싱');
const apiKey = generateApiKey('RIPY_test_');
console.log('생성된 API Key:', apiKey);

const hash1 = hashApiKey(apiKey);
const hash2 = hashApiKey(apiKey);
console.log('해시 1:', hash1.toString('hex').substring(0, 32) + '...');
console.log('해시 2:', hash2.toString('hex').substring(0, 32) + '...');
console.log('같은 입력 = 같은 해시:', hash1.equals(hash2));
console.log('');

// 테스트 3: 다른 입력 = 다른 해시
console.log('[TEST 3] 다른 입력 = 다른 해시');
const hash3 = hashApiKey('different-key');
console.log('다른 해시:', !hash1.equals(hash3));
console.log('');

console.log('모든 테스트 완료!');