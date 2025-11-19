/**
 * ============================================
 * 암호화/복호화 유틸리티 (웹서버 ↔ 토큰서버 통신용)
 * ============================================
 *
 * 역할:
 * - 웹서버 → 토큰서버 요청 데이터 복호화
 * - 토큰서버 → 웹서버 응답 데이터 암호화
 * - DB 저장 시 민감 정보 암호화
 * - DB 조회 시 데이터 복호화
 *
 * 암호화 방식:
 * - AES-256-GCM (Galois/Counter Mode)
 * - 키 길이: 32바이트 (256비트)
 * - IV(Initialization Vector): 12바이트 (랜덤 생성)
 * - 인증 태그: 16바이트 (변조 방지)
 *
 * 키의 종류:
 * 1. 공통 암호화 키 (ENCRYPTION_KEY): 서버 내부 데이터 암복호화
 * 2. Service Key: 웹서버 인증용 (별도 관리, 여러 개 가능)
 */

import crypto from 'crypto';
import { SOLANA_CONFIG } from '../config/solana.config.js';

// 암호화 알고리즘 설정
const ALGORITHM = 'aes-256-gcm'; // AES-256-GCM 사용
const IV_LENGTH = 12;             // IV 길이 (GCM 권장: 12바이트)
const AUTH_TAG_LENGTH = 16;       // 인증 태그 길이 (16바이트)
const KEY_LENGTH = 32;            // 키 길이 (32바이트 = 256비트)

/**
 * ============================================
 * 내부 헬퍼 함수
 * ============================================
 */

/**
 * 환경변수에서 공통 암호화 키 가져오기
 *
 * @returns {Buffer} 32바이트 키
 * @throws {Error} 키가 없거나 유효하지 않은 경우
 */
function getMasterEncryptionKey() {
    const keyHex = process.env.ENCRYPTION_KEY;

    if (!keyHex) {
        throw new Error('ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.');
    }

    // Hex 문자열을 Buffer로 변환
    const keyBuffer = Buffer.from(keyHex, 'hex');

    if (keyBuffer.length !== KEY_LENGTH) {
        throw new Error(`암호화 키는 ${KEY_LENGTH}바이트여야 합니다. (현재: ${keyBuffer.length}바이트)`);
    }

    return keyBuffer;
}

/**
 * Service Key를 32바이트 키로 변환
 * (Service Key는 가변 길이일 수 있으므로 SHA-256 해싱)
 *
 * @param {string} serviceKey - Service Key
 * @returns {Buffer} 32바이트 키
 */
function deriveKeyFromServiceKey(serviceKey) {
    if (!serviceKey) {
        throw new Error('Service Key가 제공되지 않았습니다.');
    }

    // SHA-256 해시로 32바이트 키 생성
    return crypto.createHash('sha256').update(serviceKey).digest();
}

/**
 * ============================================
 * 1. 웹서버 → 토큰서버 요청 데이터 복호화
 * ============================================
 *
 * 웹서버에서 암호화하여 보낸 데이터를 복호화
 *
 * @param {string} encryptedData - Base64로 인코딩된 암호화 데이터
 * @param {string} serviceKey - 웹서버의 Service Key
 * @returns {Object} 복호화된 데이터 (JSON 객체)
 *
 * @throws {Error} 복호화 실패 시
 *
 * @example
 * const request = decryptRequest(req.body.encrypted_data, req.body.service_key);
 * console.log('수신자 지갑:', request.sender_public_key_str);
 * console.log('금액:', request.pay_count);
 */
export function decryptRequest(encryptedData, serviceKey) {
    try {
        // Service Key로부터 암호화 키 생성
        const key = deriveKeyFromServiceKey(serviceKey);

        // Base64 디코딩
        const buffer = Buffer.from(encryptedData, 'base64');

        // IV와 암호문 분리
        // 구조: [IV(12바이트)] + [암호문] + [인증태그(16바이트)]
        const iv = buffer.subarray(0, IV_LENGTH);
        const authTag = buffer.subarray(buffer.length - AUTH_TAG_LENGTH);
        const ciphertext = buffer.subarray(IV_LENGTH, buffer.length - AUTH_TAG_LENGTH);

        // 복호화 수행
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        // JSON 파싱하여 반환
        const jsonString = decrypted.toString('utf8');
        return JSON.parse(jsonString);

    } catch (error) {
        console.error('요청 데이터 복호화 실패:', error.message);
        throw new Error(`요청 복호화 실패: ${error.message}`);
    }
}

/**
 * ============================================
 * 2. 토큰서버 → 웹서버 응답 데이터 암호화
 * ============================================
 *
 * 토큰서버의 응답을 암호화하여 웹서버로 전송
 *
 * @param {Object} data - 암호화할 데이터 (JSON 객체)
 * @param {string} serviceKey - 웹서버의 Service Key
 * @returns {string} Base64로 인코딩된 암호화 데이터
 *
 * @throws {Error} 암호화 실패 시
 *
 * @example
 * const response = {
 *   success: true,
 *   transaction_base64: 'ABC123...',
 *   blockhash: 'xyz789...'
 * };
 * const encrypted = encryptResponse(response, serviceKey);
 * res.json({ encrypted_response: encrypted });
 */
export function encryptResponse(data, serviceKey) {
    try {
        // Service Key로부터 암호화 키 생성
        const key = deriveKeyFromServiceKey(serviceKey);

        // 데이터를 JSON 문자열로 변환
        const jsonString = JSON.stringify(data);
        const plaintext = Buffer.from(jsonString, 'utf8');

        // 랜덤 IV 생성 (매번 다른 IV 사용)
        const iv = crypto.randomBytes(IV_LENGTH);

        // 암호화 수행
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        let encrypted = cipher.update(plaintext);
        encrypted = Buffer.concat([encrypted, cipher.final()]);

        // 인증 태그 가져오기
        const authTag = cipher.getAuthTag();

        // 최종 결과: [IV] + [암호문] + [인증태그]
        const result = Buffer.concat([iv, encrypted, authTag]);

        // Base64로 인코딩하여 반환
        return result.toString('base64');

    } catch (error) {
        console.error('응답 데이터 암호화 실패:', error.message);
        throw new Error(`응답 암호화 실패: ${error.message}`);
    }
}

/**
 * ============================================
 * 3. DB 저장용 민감 정보 암호화
 * ============================================
 *
 * 서버 내부 공통 키(ENCRYPTION_KEY)를 사용하여 암호화
 *
 * @param {string} plainText - 암호화할 평문
 * @returns {string} Base64로 인코딩된 암호화 데이터
 *
 * @throws {Error} 암호화 실패 시
 *
 * @example
 * const encryptedWallet = encryptForDB(userWalletAddress);
 * await db.execute('INSERT INTO users (wallet) VALUES (?)', [encryptedWallet]);
 */
export function encryptForDB(plainText) {
    try {
        // 공통 암호화 키 사용
        const key = getMasterEncryptionKey();

        // 평문을 Buffer로 변환
        const plainBuffer = Buffer.from(plainText, 'utf8');

        // 랜덤 IV 생성
        const iv = crypto.randomBytes(IV_LENGTH);

        // 암호화 수행
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        let encrypted = cipher.update(plainBuffer);
        encrypted = Buffer.concat([encrypted, cipher.final()]);

        // 인증 태그 가져오기
        const authTag = cipher.getAuthTag();

        // 최종 결과: [IV] + [암호문] + [인증태그]
        const result = Buffer.concat([iv, encrypted, authTag]);

        // Base64로 인코딩하여 반환
        return result.toString('base64');

    } catch (error) {
        console.error('DB 암호화 실패:', error.message);
        throw new Error(`DB 암호화 실패: ${error.message}`);
    }
}

/**
 * ============================================
 * 4. DB 조회 데이터 복호화
 * ============================================
 *
 * 서버 내부 공통 키(ENCRYPTION_KEY)를 사용하여 복호화
 *
 * @param {string} encryptedText - Base64로 인코딩된 암호화 데이터
 * @returns {string} 복호화된 평문
 *
 * @throws {Error} 복호화 실패 시
 *
 * @example
 * const encryptedWallet = row.wallet;
 * const walletAddress = decryptFromDB(encryptedWallet);
 * console.log('지갑 주소:', walletAddress);
 */
export function decryptFromDB(encryptedText) {
    try {
        // 공통 암호화 키 사용
        const key = getMasterEncryptionKey();

        // Base64 디코딩
        const buffer = Buffer.from(encryptedText, 'base64');

        // IV와 암호문 분리
        const iv = buffer.subarray(0, IV_LENGTH);
        const authTag = buffer.subarray(buffer.length - AUTH_TAG_LENGTH);
        const ciphertext = buffer.subarray(IV_LENGTH, buffer.length - AUTH_TAG_LENGTH);

        // 복호화 수행
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        // UTF-8 문자열로 반환
        return decrypted.toString('utf8');

    } catch (error) {
        console.error('DB 복호화 실패:', error.message);
        throw new Error(`DB 복호화 실패: ${error.message}`);
    }
}

/**
 * ============================================
 * 추가 유틸리티 함수
 * ============================================
 */

/**
 * 랜덤 Service Key 생성 (관리자용)
 *
 * @returns {string} 32바이트 Hex 문자열
 *
 * @example
 * const newServiceKey = generateServiceKey();
 * console.log('새 Service Key:', newServiceKey);
 */
export function generateServiceKey() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * 암호화 키 유효성 검증
 *
 * @param {string} keyHex - Hex 형식의 키
 * @returns {boolean} 유효성 여부
 *
 * @example
 * if (validateEncryptionKey(process.env.ENCRYPTION_KEY)) {
 *   console.log('유효한 키입니다.');
 * }
 */
export function validateEncryptionKey(keyHex) {
    try {
        if (!keyHex) return false;

        const keyBuffer = Buffer.from(keyHex, 'hex');
        return keyBuffer.length === KEY_LENGTH;
    } catch (error) {
        return false;
    }
}

/**
 * 기본 export
 */
export default {
    decryptRequest,
    encryptResponse,
    encryptForDB,
    decryptFromDB,
    generateServiceKey,
    validateEncryptionKey
};