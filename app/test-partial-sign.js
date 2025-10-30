/**
 * 부분서명 API 테스트 스크립트 (수정)
 */

import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// Service Key를 AES 키로 변환
function deriveKeyFromServiceKey(serviceKey) {
    return crypto.createHash('sha256').update(serviceKey).digest();
}

// 암호화 함수
function encryptForAPI(data, serviceKey) {
    const ALGORITHM = 'aes-256-gcm';
    const IV_LENGTH = 12;

    const key = deriveKeyFromServiceKey(serviceKey);
    const jsonString = JSON.stringify(data);
    const plaintext = Buffer.from(jsonString, 'utf8');
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();

    const result = Buffer.concat([iv, encrypted, authTag]);
    return result.toString('base64');
}

// 테스트 데이터
const serviceKey = '6abbc9845aef817022e8ff54fd0c546877795e7d722c42e6a230b04b75111eb8';

const requestData = {
    sender_wallet: 'BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh',
    amount: 10.5
};

console.log('\n========================================');
console.log('부분서명 API 테스트 데이터 생성');
console.log('========================================\n');

console.log('원본 요청 데이터:');
console.log(JSON.stringify(requestData, null, 2));
console.log('');

// 데이터 암호화
const encryptedData = encryptForAPI(requestData, serviceKey);

console.log('암호화된 데이터:');
console.log(encryptedData);
console.log('');

console.log('========================================');
console.log('curl 명령어:');
console.log('========================================\n');

console.log(`curl -X POST http://127.0.0.1:4000/api/solana/partial-sign \\
  -H "Content-Type: application/json" \\
  -d '{
    "encrypted_data": "${encryptedData}",
    "service_key": "${serviceKey}"
  }'`);

console.log('\n========================================\n');