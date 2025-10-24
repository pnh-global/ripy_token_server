/**
 * ============================================
 * send.model.js - 회사 지갑 다중 송신 관련 Model
 * ============================================
 *
 * 역할:
 * - r_send_request (마스터): 전체 요청 관리
 * - r_send_detail (상세): 개별 수신자 관리
 *
 * 주요 기능:
 * 1. 일괄 전송 요청 생성
 * 2. 전송 상태 추적
 * 3. 재시도 로직 지원 (최대 3회)
 * 4. 통계 자동 갱신
 */

import { exec } from '../lib/db.util.js';
import { encryptData, decryptData } from '../utils/crypto.js';

// ============================================
// 마스터 테이블 (r_send_request) 관련 함수
// ============================================

/**
 * 새로운 일괄 전송 요청 생성
 *
 * @param {Object} data - 요청 데이터
 * @param {string} data.request_id - UUID (외부에서 생성)
 * @param {string} data.cate1 - 분류1 (예: 'airdrop')
 * @param {string} data.cate2 - 분류2 (예: '2025_event')
 * @param {number} data.total_count - 총 수신자 수
 * @returns {Promise<void>}
 */
export async function createSendRequest({ request_id, cate1, cate2, total_count }) {
    try {
        const sql = `
      INSERT INTO r_send_request (
        request_id, 
        cate1, 
        cate2, 
        total_count, 
        status
      ) VALUES (
        :request_id, 
        :cate1, 
        :cate2, 
        :total_count, 
        'PENDING'
      )
    `;

        await exec(sql, { request_id, cate1, cate2, total_count });

        console.log('[SEND MODEL] 일괄 전송 요청 생성:', request_id);

    } catch (error) {
        console.error('[SEND MODEL ERROR] 일괄 전송 요청 생성 실패:', error.message);
        throw error;
    }
}

/**
 * 마스터 상태 변경
 *
 * @param {string} request_id - 요청 UUID
 * @param {string} status - 상태 (PENDING/PROCESSING/DONE/ERROR)
 * @returns {Promise<void>}
 */
export async function setMasterStatus(request_id, status) {
    try {
        const sql = `
      UPDATE r_send_request 
      SET status = :status, 
          updated_at = CURRENT_TIMESTAMP
      WHERE request_id = :id
    `;

        await exec(sql, { status, id: request_id });

        console.log('[SEND MODEL] 상태 변경:', request_id, '->', status);

    } catch (error) {
        console.error('[SEND MODEL ERROR] 상태 변경 실패:', error.message);
        throw error;
    }
}

/**
 * 마스터 정보 조회
 *
 * @param {string} request_id - 요청 UUID
 * @returns {Promise<Object|null>} - 요청 정보 또는 null
 */
export async function getRequestStatus(request_id) {
    try {
        const sql = `
      SELECT 
        idx,
        request_id,
        cate1,
        cate2,
        total_count,
        completed_count,
        failed_count,
        status,
        created_at,
        updated_at
      FROM r_send_request 
      WHERE request_id = :id
    `;

        const [rows] = await exec(sql, { id: request_id });

        return rows[0] || null;

    } catch (error) {
        console.error('[SEND MODEL ERROR] 요청 정보 조회 실패:', error.message);
        throw error;
    }
}

/**
 * 마스터 통계 자동 갱신
 *
 * @param {string} request_id - 요청 UUID
 * @returns {Promise<void>}
 *
 * 왜 필요한가?
 * - r_send_detail의 실제 결과를 집계해서 마스터에 반영
 * - completed_count, failed_count 정확성 보장
 */
export async function refreshMasterStats(request_id) {
    try {
        // 1. 총 개수 조회
        const [totalRows] = await exec(
            `SELECT COUNT(*) AS total 
       FROM r_send_detail 
       WHERE request_id = :id`,
            { id: request_id }
        );

        // 2. 성공/실패 개수 조회
        const [statsRows] = await exec(
            `SELECT 
         SUM(CASE WHEN sent = 'Y' THEN 1 ELSE 0 END) AS ok,
         SUM(CASE WHEN sent = 'N' THEN 1 ELSE 0 END) AS no
       FROM r_send_detail 
       WHERE request_id = :id`,
            { id: request_id }
        );

        const total = totalRows[0].total || 0;
        const completed = statsRows[0].ok || 0;
        const failed = statsRows[0].no || 0;

        // 3. 마스터 업데이트
        await exec(
            `UPDATE r_send_request 
       SET total_count = :total,
           completed_count = :ok,
           failed_count = :failed,
           updated_at = CURRENT_TIMESTAMP
       WHERE request_id = :id`,
            { total, ok: completed, failed, id: request_id }
        );

        console.log('[SEND MODEL] 통계 갱신 - 완료:', completed, '실패:', failed);

    } catch (error) {
        console.error('[SEND MODEL ERROR] 통계 갱신 실패:', error.message);
        throw error;
    }
}

// ============================================
// 상세 테이블 (r_send_detail) 관련 함수
// ============================================

/**
 * 개별 수신자 상세 정보 일괄 생성 (Bulk Insert)
 *
 * @param {string} request_id - 요청 UUID
 * @param {Array} rows - 수신자 배열
 * @param {string} rows[].wallet_address - 지갑 주소 (평문)
 * @param {number} rows[].amount - RIPY 수량
 * @returns {Promise<void>}
 *
 * 보안:
 * - 지갑 주소는 자동으로 암호화되어 저장됨
 */
export async function insertSendDetails(request_id, rows) {
    try {
        // 1. VALUES 절 동적 생성
        const values = rows
            .map((_, i) => `(:request_id, :w${i}, :a${i})`)
            .join(', ');

        // 2. Named Parameters 객체 생성
        const params = { request_id };

        rows.forEach((r, i) => {
            // 지갑 주소 암호화
            params[`w${i}`] = encryptData(r.wallet_address);
            params[`a${i}`] = r.amount;
        });

        // 3. SQL 실행
        const sql = `
      INSERT INTO r_send_detail (
        request_id, 
        wallet_address, 
        amount
      ) VALUES ${values}
    `;

        await exec(sql, params);

        console.log('[SEND MODEL]', rows.length, '개 수신자 정보 생성 (암호화됨)');

    } catch (error) {
        console.error('[SEND MODEL ERROR] 수신자 정보 생성 실패:', error.message);
        throw error;
    }
}

/**
 * 전송 대상 조회 (미전송 & 3회 미만 시도)
 *
 * @param {string} request_id - 요청 UUID
 * @param {number} limit - 최대 조회 개수 (기본: 100)
 * @returns {Promise<Array>} - 수신자 배열 (지갑 주소 복호화됨)
 */
export async function listPendingDetails(request_id, limit = 100) {
    try {
        const sql = `
      SELECT 
        idx, 
        wallet_address, 
        amount, 
        attempt_count
      FROM r_send_detail
      WHERE request_id = :request_id 
        AND sent = 'N' 
        AND attempt_count < 3
      ORDER BY idx ASC
      LIMIT :limit
    `;

        const [rows] = await exec(sql, { request_id, limit });

        // 지갑 주소 복호화
        const decryptedRows = rows.map(row => ({
            ...row,
            wallet_address: decryptData(row.wallet_address)
        }));

        console.log('[SEND MODEL]', decryptedRows.length, '개 대상 조회 (복호화됨)');

        return decryptedRows;

    } catch (error) {
        console.error('[SEND MODEL ERROR] 전송 대상 조회 실패:', error.message);
        throw error;
    }
}

/**
 * 개별 수신자 전송 결과 업데이트
 *
 * @param {number} idx - r_send_detail.idx
 * @param {Object} result - 전송 결과
 * @param {boolean} result.success - 성공 여부
 * @param {string} result.result_code - 결과 코드 (예: '200', '500')
 * @param {string} result.error_message - 에러 메시지
 * @returns {Promise<void>}
 *
 * 동작:
 * - attempt_count 자동 증가
 * - 성공 시: sent = 'Y'
 * - 실패 시: sent = 'N' (재시도 가능)
 */
export async function updateDetailResult(idx, { success, result_code, error_message }) {
    try {
        const sql = `
      UPDATE r_send_detail
      SET attempt_count = attempt_count + 1,
          sent = :sent,
          last_result_code = :result_code,
          last_error_message = :error_message,
          updated_at = CURRENT_TIMESTAMP
      WHERE idx = :idx
    `;

        await exec(sql, {
            idx,
            sent: success ? 'Y' : 'N',
            result_code: result_code ?? null,
            error_message: error_message ? error_message.substring(0, 255) : null
        });

        const status = success ? '성공' : '실패';
        console.log('[SEND MODEL]', status, '처리 - idx:', idx);

    } catch (error) {
        console.error('[SEND MODEL ERROR] 결과 업데이트 실패:', error.message);
        throw error;
    }
}

/**
 * 특정 요청의 모든 상세 정보 조회 (관리자용)
 *
 * @param {string} request_id - 요청 UUID
 * @param {boolean} decrypt - 지갑 주소 복호화 여부 (기본: false)
 * @returns {Promise<Array>} - 상세 정보 배열
 */
export async function getAllDetails(request_id, decrypt = false) {
    try {
        const sql = `
      SELECT 
        idx,
        request_id,
        wallet_address,
        amount,
        attempt_count,
        sent,
        last_result_code,
        last_error_message,
        created_at,
        updated_at
      FROM r_send_detail
      WHERE request_id = :request_id
      ORDER BY idx ASC
    `;

        const [rows] = await exec(sql, { request_id });

        // 복호화 옵션
        if (decrypt) {
            return rows.map(row => ({
                ...row,
                wallet_address: decryptData(row.wallet_address)
            }));
        }

        return rows;

    } catch (error) {
        console.error('[SEND MODEL ERROR] 상세 정보 조회 실패:', error.message);
        throw error;
    }
}