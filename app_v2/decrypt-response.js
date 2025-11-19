/**
 * 응답 복호화 스크립트
 */

import crypto from 'crypto';

function deriveKeyFromServiceKey(serviceKey) {
    return crypto.createHash('sha256').update(serviceKey).digest();
}

function decryptResponse(encryptedData, serviceKey) {
    const ALGORITHM = 'aes-256-gcm';
    const IV_LENGTH = 12;
    const AUTH_TAG_LENGTH = 16;

    const key = deriveKeyFromServiceKey(serviceKey);
    const buffer = Buffer.from(encryptedData, 'base64');

    const iv = buffer.subarray(0, IV_LENGTH);
    const authTag = buffer.subarray(buffer.length - AUTH_TAG_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH, buffer.length - AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return JSON.parse(decrypted.toString('utf8'));
}

// 명령행 인자로 암호화된 응답 받기
const encryptedResponse = process.argv[2];
const serviceKey = '6abbc9845aef817022e8ff54fd0c546877795e7d722c42e6a230b04b75111eb8';

if (!encryptedResponse) {
    console.error('\n사용법: node decrypt-response.js <encrypted_response>\n');
    console.error('예시:');
    console.error('node decrypt-response.js "ABC123..."\n');
    process.exit(1);
}

console.log('\n========================================');
console.log('응답 복호화');
console.log('========================================\n');

try {
    const decrypted = decryptResponse(encryptedResponse, serviceKey);
    console.log('복호화된 응답:');
    console.log(JSON.stringify(decrypted, null, 2));
    console.log('\n========================================\n');

    if (decrypted.transaction_base64) {
        console.log('✅ 부분서명된 트랜잭션 생성 성공!');
        console.log('');
        console.log('다음 단계:');
        console.log('1. transaction_base64를 클라이언트(팬텀 지갑)로 전달');
        console.log('2. 클라이언트가 최종 서명');
        console.log('3. 블록체인에 전송');
        console.log('');
    }
} catch (error) {
    console.error('❌ 복호화 실패:', error.message);
    console.error('\n암호화된 데이터가 올바른지 확인하세요.\n');
}