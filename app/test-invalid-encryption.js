/**
 * 잘못된 암호화 데이터 테스트
 */

import crypto from 'crypto';

const serviceKey = '6abbc9845aef817022e8ff54fd0c546877795e7d722c42e6a230b04b75111eb8';

console.log('\n========================================');
console.log('에러 케이스 테스트');
console.log('========================================\n');

// 테스트 1: 잘못된 Base64 데이터
console.log('테스트 1: 잘못된 암호화 데이터');
console.log('----------------------------------------');

const invalidEncryptedData = 'INVALID_BASE64_DATA!!!';

console.log(`curl -X POST http://localhost:4000/api/solana/partial-sign \\
  -H "Content-Type: application/json" \\
  -d '{
    "encrypted_data": "${invalidEncryptedData}",
    "service_key": "${serviceKey}"
  }'`);

console.log('\n');

// 테스트 2: 빈 암호화 데이터
console.log('테스트 2: 빈 암호화 데이터');
console.log('----------------------------------------');

console.log(`curl -X POST http://localhost:4000/api/solana/partial-sign \\
  -H "Content-Type: application/json" \\
  -d '{
    "encrypted_data": "",
    "service_key": "${serviceKey}"
  }'`);

console.log('\n');

// 테스트 3: 필수 필드 누락
console.log('테스트 3: encrypted_data 필드 누락');
console.log('----------------------------------------');

console.log(`curl -X POST http://localhost:4000/api/solana/partial-sign \\
  -H "Content-Type: application/json" \\
  -d '{
    "service_key": "${serviceKey}"
  }'`);

console.log('\n========================================\n');