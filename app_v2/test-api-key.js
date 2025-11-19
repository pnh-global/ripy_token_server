/**
 * test-api-key.js
 * API Key 검증 테스트 스크립트
 */

import { verifyServiceKey } from './src/models/serviceKeys.model.js';
import crypto from 'crypto';

const apiKey = 'test-api-key-12345';
const keyHash = crypto.createHash('sha256')
    .update(apiKey)
    .digest('hex')
    .toUpperCase();

console.log('='.repeat(60));
console.log('API Key 검증 테스트');
console.log('='.repeat(60));
console.log('원본 API Key:', apiKey);
console.log('계산된 Hash:', keyHash);
console.log('');
console.log('DB에 있어야 할 값:');
console.log('2688F4E126CA5EFD4A60022073E6CD9001762626E56C3F30B194D53E6299EDFE3C');
console.log('');
console.log('일치 여부:', keyHash === '2688F4E126CA5EFD4A60022073E6CD9001762626E56C3F30B194D53E6299EDFE3C');
console.log('='.repeat(60));
console.log('');

// verifyServiceKey 테스트
console.log('verifyServiceKey 함수 테스트 시작...');
verifyServiceKey(keyHash).then(result => {
    console.log('');
    console.log('='.repeat(60));
    console.log('결과:', result ? 'FOUND ✅' : 'NOT FOUND ❌');
    if (result) {
        console.log('키 정보:', JSON.stringify(result, null, 2));
    }
    console.log('='.repeat(60));
    process.exit(0);
}).catch(err => {
    console.error('');
    console.error('='.repeat(60));
    console.error('에러 발생:', err.message);
    console.error('='.repeat(60));
    process.exit(1);
});