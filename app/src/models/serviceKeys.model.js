/**
 * serviceKeys.model.js
 *
 * VARBINARY 타입 처리:
 * - INSERT: UNHEX() 사용 (HEX 문자열 → BINARY)
 * - SELECT: HEX() 사용 (BINARY → HEX 문자열)
 */

import { pool } from '../config/db.js';

/**
 * 서비스 키 생성
 *
 * @param {Object} data - 서비스 키 데이터
 * @param {string} data.req_server - 요청 서버 (필수)
 * @param {string} data.key_hash - 키 해시값, HEX 문자열 (필수)
 * @param {string} [data.key_ciphertext] - 암호화된 키
 * @param {string} [data.status='ACTIVE'] - 상태
 * @returns {Promise<Object>} 생성된 서비스 키 정보
 */
export async function createServiceKey(data) {
    if (!data.req_server || !data.key_hash) {
        throw new Error('req_server와 key_hash는 필수 항목입니다.');
    }

    const {
        req_server,
        key_hash,
        key_ciphertext = '',
        status = 'ACTIVE'
    } = data;

    try {
        // UNHEX()로 HEX 문자열을 BINARY로 변환하여 저장
        const [result] = await pool.execute(
            `INSERT INTO service_keys
                 (req_server, key_hash, key_ciphertext, status, created_at, updated_at)
             VALUES (?, UNHEX(?), ?, ?, NOW(), NOW())`,
            [req_server, key_hash, key_ciphertext, status]
        );

        // 생성된 키 조회 후 반환
        const createdKey = await getServiceKeyById(result.insertId);
        return createdKey;

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            throw new Error('이미 존재하는 key_hash입니다.');
        }
        throw error;
    }
}

/**
 * ID로 서비스 키 조회
 *
 * @param {number} idx - 서비스 키 ID
 * @returns {Promise<Object|null>} 서비스 키 정보 또는 null
 */
export async function getServiceKeyById(idx) {
    const numIdx = Number(idx);
    if (isNaN(numIdx) || numIdx <= 0) {
        throw new Error('유효하지 않은 ID입니다.');
    }

    try {
        // HEX()로 BINARY를 HEX 문자열로 변환하여 조회
        const [rows] = await pool.execute(
            `SELECT
                 idx,
                 req_server,
                 HEX(key_hash) as key_hash,
                 key_ciphertext,
                 allow_cidrs,
                 status,
                 last_used_at,
                 created_at,
                 updated_at
             FROM service_keys
             WHERE idx = ?`,
            [numIdx]
        );

        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('getServiceKeyById error:', error);
        throw error;
    }
}

/**
 * 서비스 키 검증
 *
 * @param {string} keyHash - 검증할 키 해시값 (HEX 문자열)
 * @returns {Promise<boolean>} 유효하면 true
 */
export async function verifyServiceKey(keyHash) {
    try {
        // UNHEX()로 HEX 문자열을 BINARY로 변환하여 비교
        const [rows] = await pool.execute(
            `SELECT idx, status
             FROM service_keys
             WHERE key_hash = UNHEX(?)
                 LIMIT 1`,
            [keyHash]
        );

        if (rows.length === 0) {
            return false;
        }

        const key = rows[0];
        if (key.status !== 'ACTIVE') {
            return false;
        }

        return true;
    } catch (error) {
        console.error('verifyServiceKey error:', error);
        return false;
    }
}

/**
 * 서비스 키 회수
 *
 * @param {number} idx - 회수할 서비스 키 ID
 * @returns {Promise<boolean>} 성공하면 true
 */
export async function revokeServiceKey(idx) {
    try {
        const key = await getServiceKeyById(idx);

        if (!key) {
            return false;
        }

        if (key.status === 'REVOKED') {
            return false;
        }

        const [result] = await pool.execute(
            `UPDATE service_keys
             SET status = 'REVOKED',
                 updated_at = NOW()
             WHERE idx = ?`,
            [idx]
        );

        return result.affectedRows === 1;
    } catch (error) {
        console.error('revokeServiceKey error:', error);
        return false;
    }
}

/**
 * 마지막 사용 시간 업데이트
 *
 * @param {number} idx - 서비스 키 ID
 * @returns {Promise<boolean>} 성공하면 true
 */
export async function updateLastUsed(idx) {
    try {
        const [result] = await pool.execute(
            `UPDATE service_keys
             SET last_used_at = NOW(),
                 updated_at = NOW()
             WHERE idx = ?`,
            [idx]
        );

        return result.affectedRows === 1;
    } catch (error) {
        console.error('updateLastUsed error:', error);
        return false;
    }
}

export default {
    createServiceKey,
    getServiceKeyById,
    verifyServiceKey,
    revokeServiceKey,
    updateLastUsed
};