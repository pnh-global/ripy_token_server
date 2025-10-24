/**
 * ============================================
 * crypto.js - 암호화/복호화 유틸리티
 * ============================================
 *
 * 역할:
 * 1. 지갑 주소, API 파라미터 등 민감 데이터 암호화 (AES-256-GCM)
 * 2. 암호화된 데이터 복호화
 * 3. API Key 해싱 (SHA-256, 단방향)
 * 4. 랜덤 API Key 생성
 */

import crypto from 'crypto';

// 환경변수에서 마스터 암호화 키 가져오기
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'ripy-token-server-master-key-32b';

// 키를 정확히 32바이트로 맞추는 헬퍼 함수
const normalizeKey = (key) => {
    return Buffer.from(key.padEnd(32, '0').slice(0, 32));
};

/**
 * 데이터 암호화
 *
 * @param {string} plainText - 암호화할 평문
 * @returns {string} - JSON 문자열 (iv, content, tag 포함)
 */
export function encryptData(plainText) {
    try {
        // IV(Initialization Vector) 생성 - 매번 랜덤 (16바이트)
        const iv = crypto.randomBytes(16);

        // Cipher 객체 생성 (AES-256-GCM)
        const cipher = crypto.createCipheriv(
            'aes-256-gcm',
            normalizeKey(ENCRYPTION_KEY),
            iv
        );

        // 암호화 수행
        let encrypted = cipher.update(plainText, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        // 인증 태그 가져오기 (무결성 검증용)
        const authTag = cipher.getAuthTag();

        // 결과를 JSON으로 반환
        return JSON.stringify({
            iv: iv.toString('base64'),
            content: encrypted,
            tag: authTag.toString('base64')
        });

    } catch (error) {
        console.error('[CRYPTO ERROR] 암호화 실패:', error.message);
        throw new Error('데이터 암호화 중 오류 발생');
    }
}

/**
 * 데이터 복호화
 *
 * @param {string} encryptedData - 암호화된 JSON 문자열
 * @returns {string} - 복호화된 평문
 */
export function decryptData(encryptedData) {
    try {
        // JSON 파싱
        const { iv, content, tag } = JSON.parse(encryptedData);

        // Decipher 객체 생성
        const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            normalizeKey(ENCRYPTION_KEY),
            Buffer.from(iv, 'base64')
        );

        // 인증 태그 설정
        decipher.setAuthTag(Buffer.from(tag, 'base64'));

        // 복호화 수행
        let decrypted = decipher.update(content, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;

    } catch (error) {
        console.error('[CRYPTO ERROR] 복호화 실패:', error.message);
        throw new Error('데이터 복호화 중 오류 발생 (잘못된 키 또는 손상된 데이터)');
    }
}

/**
 * API Key 해싱 (단방향)
 *
 * @param {string} apiKey - 원본 API Key
 * @returns {Buffer} - SHA-256 해시 (32바이트)
 */
export function hashApiKey(apiKey) {
    return crypto
        .createHash('sha256')
        .update(apiKey)
        .digest();
}

/**
 * 랜덤 API Key 생성
 *
 * @param {string} prefix - 접두사 (기본: 'RIPY_')
 * @returns {string} - 생성된 API Key
 */
export function generateApiKey(prefix = 'RIPY_') {
    const randomPart = crypto.randomBytes(32).toString('hex');
    return `${prefix}${randomPart}`;
}

/**
 * API Key의 마지막 4자리 추출 (관리자 UI용)
 *
 * @param {string} apiKey - 전체 API Key
 * @returns {string} - 마지막 4자리
 */
export function getKeyLast4(apiKey) {
    return apiKey.slice(-4);
}