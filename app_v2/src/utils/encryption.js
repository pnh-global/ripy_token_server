/**
 * encryption.js
 *
 * AES-256-GCM 방식의 암호화/복호화 유틸리티
 *
 * 주요 기능:
 * - encrypt: 평문을 암호화하여 base64 문자열로 반환
 * - decrypt: 암호화된 base64 문자열을 복호화하여 평문 반환
 * - generateKey: 32바이트(256bit) 암호화 키를 hex 문자열로 생성
 *
 * 보안 특징:
 * - AES-256-GCM: 인증된 암호화 방식 (AEAD)
 * - IV(Initialization Vector): 매번 랜덤 생성으로 같은 평문도 다른 암호문 생성
 * - Auth Tag: 데이터 무결성 검증
 */

import crypto from 'crypto';

// 암호화 알고리즘 상수
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM 권장 IV 길이 (96 bits)
const AUTH_TAG_LENGTH = 16; // GCM 인증 태그 길이 (128 bits)
const KEY_LENGTH = 32; // AES-256 키 길이 (256 bits = 32 bytes)

/**
 * 암호화 키 검증 함수
 *
 * @param {string} key - 검증할 암호화 키 (hex 문자열)
 * @throws {Error} 키가 유효하지 않을 경우
 */
function validateKey(key) {
    // 키가 존재하는지 확인
    if (!key) {
        throw new Error('암호화 키가 제공되지 않았습니다.');
    }

    // 키가 문자열인지 확인
    if (typeof key !== 'string') {
        throw new Error('암호화 키는 문자열이어야 합니다.');
    }

    // 키 길이 확인 (32바이트 = 64자 hex)
    if (key.length !== KEY_LENGTH * 2) {
        throw new Error(`암호화 키는 ${KEY_LENGTH * 2}자의 hex 문자열이어야 합니다. (현재: ${key.length}자)`);
    }

    // 유효한 hex 문자열인지 확인
    if (!/^[0-9a-fA-F]+$/.test(key)) {
        throw new Error('암호화 키는 유효한 hex 문자열이어야 합니다.');
    }
}

/**
 * 평문을 암호화합니다.
 *
 * @param {string} plaintext - 암호화할 평문
 * @param {string} keyHex - 암호화 키 (64자 hex 문자열)
 * @returns {string} base64로 인코딩된 암호문 (IV + AuthTag + Ciphertext)
 *
 * @example
 * const key = generateKey();
 * const encrypted = encrypt('Hello World', key);
 * console.log(encrypted); // 'base64_encoded_string...'
 */
export function encrypt(plaintext, keyHex) {
    try {
        // 키 검증
        validateKey(keyHex);

        // hex 문자열을 Buffer로 변환
        const key = Buffer.from(keyHex, 'hex');

        // 랜덤 IV 생성 (매번 다른 암호문 생성을 위해)
        const iv = crypto.randomBytes(IV_LENGTH);

        // 암호화 객체 생성
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        // 평문 암호화
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // 인증 태그 추출 (GCM 모드에서 데이터 무결성 검증용)
        const authTag = cipher.getAuthTag();

        // IV + AuthTag + Ciphertext를 결합하여 base64로 인코딩
        // 복호화 시 필요한 모든 정보를 함께 전송
        const combined = Buffer.concat([
            iv,
            authTag,
            Buffer.from(encrypted, 'hex')
        ]);

        return combined.toString('base64');
    } catch (error) {
        throw new Error(`암호화 실패: ${error.message}`);
    }
}

/**
 * 암호문을 복호화합니다.
 *
 * @param {string} encryptedData - base64로 인코딩된 암호문
 * @param {string} keyHex - 복호화 키 (64자 hex 문자열)
 * @returns {string} 복호화된 평문
 *
 * @example
 * const key = generateKey();
 * const encrypted = encrypt('Hello World', key);
 * const decrypted = decrypt(encrypted, key);
 * console.log(decrypted); // 'Hello World'
 */
export function decrypt(encryptedData, keyHex) {
    try {
        // 키 검증
        validateKey(keyHex);

        // hex 문자열을 Buffer로 변환
        const key = Buffer.from(keyHex, 'hex');

        // base64 암호문을 Buffer로 변환
        const combined = Buffer.from(encryptedData, 'base64');

        // IV, AuthTag, Ciphertext 분리
        const iv = combined.subarray(0, IV_LENGTH);
        const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

        // 복호화 객체 생성
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

        // 인증 태그 설정 (데이터 무결성 검증)
        decipher.setAuthTag(authTag);

        // 암호문 복호화
        let decrypted = decipher.update(ciphertext, undefined, 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        // 복호화 실패 시 더 명확한 에러 메시지 제공
        if (error.message.includes('Unsupported state') ||
            error.message.includes('bad decrypt') ||
            error.message.includes('auth')) {
            throw new Error('복호화 실패: 잘못된 키이거나 데이터가 손상되었습니다.');
        }
        throw new Error(`복호화 실패: ${error.message}`);
    }
}

/**
 * 32바이트(256bit) 암호화 키를 생성합니다.
 *
 * @returns {string} 64자 hex 문자열로 된 암호화 키
 *
 * @example
 * const key = generateKey();
 * console.log(key); // 'a1b2c3d4e5f6...' (64자)
 *
 * // 생성된 키로 암호화/복호화
 * const encrypted = encrypt('test', key);
 * const decrypted = decrypt(encrypted, key);
 */
export function generateKey() {
    // 32바이트 랜덤 키 생성
    const key = crypto.randomBytes(KEY_LENGTH);

    // hex 문자열로 변환하여 반환
    return key.toString('hex');
}

/**
 * 기본 export (선택적)
 */
export default {
    encrypt,
    decrypt,
    generateKey
};