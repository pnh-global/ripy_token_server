/**
 * serviceKeys.model.js
 *
 * Service Keys 테이블 모델
 * - 웹서버에서 토큰 서버로 API 호출 시 사용하는 인증 키 관리
 * - VARBINARY 타입 처리: UNHEX() (입력), HEX() (출력)
 * - JSON 타입 처리: JSON.stringify() (입력), JSON.parse() (출력)
 * - IP 주소 처리: INET6_ATON() (입력), INET6_NTOA() (출력)
 */

import { pool } from '../config/db.js';

/**
 * 서비스 키 생성
 *
 * @param {Object} data - 서비스 키 데이터
 * @param {string} data.req_ip_text - 요청 IP 주소 텍스트 (필수, IPv4/IPv6)
 * @param {string} data.req_server - 요청 서버 (필수)
 * @param {string} data.key_hash - 키 해시값 HEX 문자열 (필수, SHA-256)
 * @param {string} data.key_ciphertext - 암호화된 API Key (필수, Base64 또는 Hex)
 * @param {string} [data.key_alg='aes-256-gcm'] - 암호화 알고리즘
 * @param {string} data.key_iv - IV(Initialization Vector) HEX 문자열 (필수)
 * @param {string} [data.key_tag=''] - Auth Tag HEX 문자열 (AES-GCM 모드 사용 시)
 * @param {string} [data.key_kms_id=''] - KMS 키 ID (Naver Cloud Secret Manager용)
 * @param {string} data.key_last4 - 키 마지막 4자리 (필수, 마스킹용)
 * @param {string} [data.status='ACTIVE'] - 상태 (ACTIVE/INACTIVE/REVOKED)
 * @param {Array<string>} [data.scopes=['read']] - 허용된 권한 범위
 * @param {Array<string>} [data.allow_cidrs=[]] - 허용된 IP/CIDR 목록
 * @param {Array<string>} [data.allow_hosts=[]] - 허용된 호스트 목록
 * @returns {Promise<Object>} 생성된 서비스 키 정보
 *
 * @example
 * const newKey = await createServiceKey({
 *   req_ip_text: '192.168.1.100',
 *   req_server: 'web-server-01',
 *   key_hash: 'A1B2C3D4...', // SHA-256 해시 (64자 HEX)
 *   key_ciphertext: 'encrypted_base64_string',
 *   key_iv: '1234567890ABCDEF', // 16바이트 HEX
 *   key_last4: '5678',
 *   scopes: ['read', 'write'],
 *   allow_cidrs: ['192.168.1.0/24']
 * });
 */
export async function createServiceKey(data) {
    // 필수 파라미터 검증
    const requiredFields = [
        'req_ip_text',
        'req_server',
        'key_hash',
        'key_ciphertext',
        'key_iv',
        'key_last4'
    ];

    for (const field of requiredFields) {
        if (!data[field]) {
            throw new Error(`${field}는 필수 항목입니다.`);
        }
    }

    const {
        req_ip_text,
        req_server,
        key_hash,
        key_ciphertext,
        key_alg = 'aes-256-gcm',
        key_iv,
        key_tag = '',
        key_kms_id = '',
        key_last4,
        status = 'ACTIVE',
        scopes = ['read'],
        allow_cidrs = [],
        allow_hosts = []
    } = data;

    try {
        // INSERT:
        // - req_ip: INET6_ATON()으로 텍스트 IP를 VARBINARY로 변환
        // - key_hash: UNHEX()로 HEX 문자열을 VARBINARY로 변환
        // - scopes, allow_cidrs, allow_hosts: JSON.stringify()로 JSON 문자열로 변환
        const [result] = await pool.execute(
            `INSERT INTO service_keys
             (req_ip, req_ip_text, req_server,
              key_hash, key_ciphertext,
              key_alg, key_iv, key_tag, key_kms_id, key_last4,
              status, scopes, allow_cidrs, allow_hosts,
              created_at, updated_at)
             VALUES (
                        INET6_ATON(?), ?, ?,
                        UNHEX(?), ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?,
                        NOW(), NOW()
                    )`,
            [
                req_ip_text, req_ip_text, req_server,
                key_hash, key_ciphertext,
                key_alg, key_iv, key_tag, key_kms_id, key_last4,
                status,
                JSON.stringify(scopes),
                JSON.stringify(allow_cidrs),
                JSON.stringify(allow_hosts)
            ]
        );

        // 생성된 키 조회 후 반환
        const createdKey = await getServiceKeyById(result.insertId);
        return createdKey;

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            throw new Error('이미 존재하는 key_hash입니다.');
        }
        console.error('createServiceKey error:', error);
        throw error;
    }
}

/**
 * ID로 서비스 키 조회
 *
 * @param {number} idx - 서비스 키 ID
 * @returns {Promise<Object|null>} 서비스 키 정보 또는 null
 *
 * @example
 * const key = await getServiceKeyById(1);
 * console.log(key.key_last4); // "5678" (마스킹용)
 * console.log(key.scopes); // ['read', 'write']
 */
export async function getServiceKeyById(idx) {
    const numIdx = Number(idx);
    if (isNaN(numIdx) || numIdx <= 0) {
        throw new Error('유효하지 않은 ID입니다.');
    }

    try {
        // SELECT:
        // - req_ip: INET6_NTOA()로 VARBINARY를 텍스트 IP로 변환
        // - key_hash: HEX()로 VARBINARY를 HEX 문자열로 변환
        // - scopes, allow_cidrs, allow_hosts: JSON 타입 (자동 변환)
        const [rows] = await pool.execute(
            `SELECT
                 idx,
                 INET6_NTOA(req_ip) as req_ip,
                 req_ip_text,
                 req_server,
                 HEX(key_hash) as key_hash,
                 key_ciphertext,
                 key_alg,
                 key_iv,
                 key_tag,
                 key_kms_id,
                 key_last4,
                 status,
                 scopes,
                 allow_cidrs,
                 allow_hosts,
                 created_at,
                 updated_at,
                 last_used_at,
                 last_ip_text,
                 last_server
             FROM service_keys
             WHERE idx = ?`,
            [numIdx]
        );

        if (rows.length === 0) {
            return null;
        }

        // JSON 필드 파싱 (MariaDB 10.11은 자동으로 JSON 문자열 반환)
        const row = rows[0];
        return {
            ...row,
            scopes: typeof row.scopes === 'string' ? JSON.parse(row.scopes) : (row.scopes || []),
            allow_cidrs: typeof row.allow_cidrs === 'string' ? JSON.parse(row.allow_cidrs) : (row.allow_cidrs || []),
            allow_hosts: typeof row.allow_hosts === 'string' ? JSON.parse(row.allow_hosts) : (row.allow_hosts || [])
        };

    } catch (error) {
        console.error('getServiceKeyById error:', error);
        throw error;
    }
}

/**
 * 서비스 키 검증
 *
 * @param {string} keyHash - 검증할 키 해시값 HEX 문자열 (SHA-256, 64자)
 * @returns {Promise<Object|null>} 유효한 키 정보 또는 null
 *
 * @example
 * const keyInfo = await verifyServiceKey('A1B2C3D4...');
 * if (keyInfo && keyInfo.status === 'ACTIVE') {
 *   console.log('유효한 키입니다.');
 * }
 */
export async function verifyServiceKey(keyHash) {
    try {
        // UNHEX()로 HEX 문자열을 VARBINARY로 변환하여 비교
        const [rows] = await pool.execute(
            `SELECT
                 idx,
                 status,
                 scopes,
                 allow_cidrs,
                 allow_hosts
             FROM service_keys
             WHERE key_hash = UNHEX(?)
                 LIMIT 1`,
            [keyHash]
        );

        if (rows.length === 0) {
            return null;
        }

        const key = rows[0];

        // 상태가 ACTIVE가 아니면 null 반환
        if (key.status !== 'ACTIVE') {
            return null;
        }

        // JSON 필드 파싱
        return {
            ...key,
            scopes: typeof key.scopes === 'string' ? JSON.parse(key.scopes) : (key.scopes || []),
            allow_cidrs: typeof key.allow_cidrs === 'string' ? JSON.parse(key.allow_cidrs) : (key.allow_cidrs || []),
            allow_hosts: typeof key.allow_hosts === 'string' ? JSON.parse(key.allow_hosts) : (key.allow_hosts || [])
        };

    } catch (error) {
        console.error('verifyServiceKey error:', error);
        return null;
    }
}

/**
 * 서비스 키 회수 (상태를 REVOKED로 변경)
 *
 * @param {number} idx - 회수할 서비스 키 ID
 * @returns {Promise<boolean>} 성공하면 true, 실패하면 false
 *
 * @example
 * const revoked = await revokeServiceKey(1);
 * if (revoked) {
 *   console.log('키가 회수되었습니다.');
 * }
 */
export async function revokeServiceKey(idx) {
    try {
        // 키 존재 여부 확인
        const key = await getServiceKeyById(idx);

        if (!key) {
            return false;
        }

        // 이미 회수된 키는 다시 회수할 수 없음
        if (key.status === 'REVOKED') {
            return false;
        }

        // 상태를 REVOKED로 변경
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
 * 마지막 사용 시간 및 위치 업데이트
 *
 * @param {number} idx - 서비스 키 ID
 * @param {string} [ipText=''] - 사용 IP 주소 텍스트
 * @param {string} [server=''] - 사용 서버
 * @returns {Promise<boolean>} 성공하면 true, 실패하면 false
 *
 * @example
 * await updateLastUsed(1, '192.168.1.100', 'web-server-01');
 */
export async function updateLastUsed(idx, ipText = '', server = '') {
    try {
        const [result] = await pool.execute(
            `UPDATE service_keys
             SET last_used_at = NOW(),
                 last_ip_text = ?,
                 last_server = ?,
                 updated_at = NOW()
             WHERE idx = ?`,
            [ipText, server, idx]
        );

        return result.affectedRows === 1;

    } catch (error) {
        console.error('updateLastUsed error:', error);
        return false;
    }
}

/**
 * 서비스 키 목록 조회 (관리용)
 *
 * @param {Object} [filters={}] - 필터 조건
 * @param {string} [filters.status] - 상태 필터 (ACTIVE/INACTIVE/REVOKED)
 * @param {string} [filters.req_server] - 서버명 필터 (부분 일치)
 * @param {number} [filters.limit=20] - 조회 개수
 * @param {number} [filters.offset=0] - 오프셋
 * @returns {Promise<Array<Object>>} 서비스 키 목록
 *
 * @example
 * const keys = await listServiceKeys({ status: 'ACTIVE', limit: 10 });
 */
export async function listServiceKeys(filters = {}) {
    const {
        status,
        req_server,
        limit = 20,
        offset = 0
    } = filters;

    try {
        let query = `
            SELECT
                idx,
                req_ip_text,
                req_server,
                HEX(key_hash) as key_hash,
                key_last4,
                status,
                scopes,
                allow_cidrs,
                allow_hosts,
                created_at,
                updated_at,
                last_used_at,
                last_ip_text,
                last_server
            FROM service_keys
            WHERE 1=1
        `;
        const params = [];

        // 상태 필터
        if (status) {
            query += ` AND status = ?`;
            params.push(status);
        }

        // 서버명 필터 (부분 일치)
        if (req_server) {
            query += ` AND req_server LIKE ?`;
            params.push(`%${req_server}%`);
        }

        // 정렬 및 페이징
        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const [rows] = await pool.execute(query, params);

        // JSON 필드 파싱
        return rows.map(row => ({
            ...row,
            scopes: typeof row.scopes === 'string' ? JSON.parse(row.scopes) : (row.scopes || []),
            allow_cidrs: typeof row.allow_cidrs === 'string' ? JSON.parse(row.allow_cidrs) : (row.allow_cidrs || []),
            allow_hosts: typeof row.allow_hosts === 'string' ? JSON.parse(row.allow_hosts) : (row.allow_hosts || [])
        }));

    } catch (error) {
        console.error('listServiceKeys error:', error);
        throw error;
    }
}

// 기본 export
export default {
    createServiceKey,
    getServiceKeyById,
    verifyServiceKey,
    revokeServiceKey,
    updateLastUsed,
    listServiceKeys
};