/**
 * 회사 → 팬텀 부분서명 테스트 (반대 방향)
 */

import crypto from 'crypto';

function deriveKeyFromServiceKey(serviceKey) {
    return crypto.createHash('sha256').update(serviceKey).digest();
}

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

const serviceKey = '6abbc9845aef817022e8ff54fd0c546877795e7d722c42e6a230b04b75111eb8';

// 반대 방향: 회사 → 팬텀
const requestData = {
    receiver_wallet: 'BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh', // 팬텀
    amount: 5
};

console.log('\n========================================');
console.log('회사 → 팬텀 전송 테스트');
console.log('========================================\n');

console.log('요청 데이터:');
console.log(JSON.stringify(requestData, null, 2));
console.log('');

const encryptedData = encryptForAPI(requestData, serviceKey);

console.log('암호화된 데이터:');
console.log(encryptedData);
console.log('');

console.log('========================================');
console.log('이 테스트는 회사가 owner이므로 부분서명 가능');
console.log('하지만 API 엔드포인트는 아직 없음');
console.log('========================================\n');