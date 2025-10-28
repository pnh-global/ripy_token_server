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
 *
 * 변경 이력:
 * - 2025-01-XX: 에러 처리 개선, 트랜잭션 추가, 상수 분리
 * - 2025-01-27: tx_signature 컬럼 제거 (DB 스키마에 맞춤)
 */

import { getConnection, executeQuery } from '../lib/db.util.js';
import { encryptData, decryptData } from '../utils/crypto.js';

// ============================================
// 상수 정의
// ============================================

/**
 * 전송 상태 상수
 * @enum {string}
 */
export const SEND_STATUS = {
    PENDING: 'PENDING',       // 대기 중
    PROCESSING: 'PROCESSING', // 처리 중
    DONE: 'DONE',            // 완료
    ERROR: 'ERROR'           // 오류
};

/**
 * 전송 성공/실패 플래그
 * @enum {string}
 */
export const SENT_FLAG = {
    YES: 'Y',  // 전송 완료
    NO: 'N'    // 전송 미완료 또는 실패
};

/**
 * 재시도 설정
 * @constant {number}
 */
export const MAX_RETRY_COUNT = 3;  // 최대 재시도 횟수

/**
 * Bulk Insert 설정
 * @constant {number}
 */
export const BULK_INSERT_LIMIT = 1000;  // 한 번에 삽입할 최대 행 수

// ============================================
// 사용자 정의 에러 클래스
// ============================================

/**
 * Send Model 관련 에러 클래스
 * @extends Error
 */
export class SendModelError extends Error {
    /**
     * @param {string} message - 에러 메시지
     * @param {string} code - 에러 코드 (예: 'DB_ERROR', 'VALIDATION_ERROR')
     * @param {Error} [originalError] - 원본 에러 객체
     */
    constructor(message, code, originalError = null) {
        super(message);
        this.name = 'SendModelError';
        this.code = code;
        this.originalError = originalError;

        // 스택 트레이스 보존
        if (originalError && originalError.stack) {
            this.stack = originalError.stack;
        }
    }
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 입력값 검증 - request_id
 * @param {string} request_id - 검증할 UUID
 * @throws {SendModelError} 유효하지 않은 UUID인 경우
 */
function validateRequestId(request_id) {
    // UUID v4 정규식
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!request_id || typeof request_id !== 'string') {
        throw new SendModelError(
            'request_id는 필수 문자열입니다.',
            'VALIDATION_ERROR'
        );
    }

    if (!uuidRegex.test(request_id)) {
        throw new SendModelError(
            'request_id는 유효한 UUID 형식이어야 합니다.',
            'VALIDATION_ERROR'
        );
    }
}

/**
 * 입력값 검증 - 상태값
 * @param {string} status - 검증할 상태
 * @throws {SendModelError} 유효하지 않은 상태값인 경우
 */
function validateStatus(status) {
    const validStatuses = Object.values(SEND_STATUS);

    if (!validStatuses.includes(status)) {
        throw new SendModelError(
            `유효하지 않은 상태값입니다. 가능한 값: ${validStatuses.join(', ')}`,
            'VALIDATION_ERROR'
        );
    }
}

/**
 * 입력값 검증 - 지갑 주소
 * @param {string} wallet_address - 검증할 지갑 주소
 * @throws {SendModelError} 유효하지 않은 주소인 경우
 */
function validateWalletAddress(wallet_address) {
    if (!wallet_address || typeof wallet_address !== 'string') {
        throw new SendModelError(
            '지갑 주소는 필수 문자열입니다.',
            'VALIDATION_ERROR'
        );
    }

    // Solana 지갑 주소는 32~44자의 Base58 문자열
    // 정확한 검증은 @solana/web3.js의 PublicKey.isOnCurve() 사용 권장
    if (wallet_address.length < 32 || wallet_address.length > 44) {
        throw new SendModelError(
            '유효하지 않은 Solana 지갑 주소 형식입니다.',
            'VALIDATION_ERROR'
        );
    }
}

/**
 * 입력값 검증 - 금액
 * @param {number} amount - 검증할 금액
 * @throws {SendModelError} 유효하지 않은 금액인 경우
 */
function validateAmount(amount) {
    if (typeof amount !== 'number' || amount <= 0) {
        throw new SendModelError(
            '금액은 0보다 큰 숫자여야 합니다.',
            'VALIDATION_ERROR'
        );
    }

    // RIPY 토큰의 최대 소수점 자리수 확인 (예: 9자리)
    const decimals = amount.toString().split('.')[1]?.length || 0;
    if (decimals > 9) {
        throw new SendModelError(
            'RIPY 토큰은 최대 9자리 소수점까지 지원합니다.',
            'VALIDATION_ERROR'
        );
    }
}

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
 * @throws {SendModelError} 생성 실패 시
 */
export async function createSendRequest({ request_id, cate1, cate2, total_count }) {
    try {
        // 입력값 검증
        validateRequestId(request_id);

        if (!cate1 || typeof cate1 !== 'string') {
            throw new SendModelError('cate1은 필수 문자열입니다.', 'VALIDATION_ERROR');
        }

        if (typeof total_count !== 'number' || total_count < 1) {
            throw new SendModelError('total_count는 1 이상의 숫자여야 합니다.', 'VALIDATION_ERROR');
        }

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
                         :status
                     )
        `;

        await executeQuery(sql, {
            request_id,
            cate1,
            cate2: cate2 || null,  // cate2는 선택적
            total_count,
            status: SEND_STATUS.PENDING  // 상수 사용
        });

        console.log('[SEND MODEL] 일괄 전송 요청 생성:', request_id);

    } catch (error) {
        // 이미 SendModelError인 경우 재throw
        if (error instanceof SendModelError) {
            throw error;
        }

        // DB 에러 처리
        console.error('[SEND MODEL ERROR] 일괄 전송 요청 생성 실패:', error.message);

        // 중복 키 에러 확인 (MySQL errno 1062)
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
            throw new SendModelError(
                '이미 존재하는 request_id입니다.',
                'DUPLICATE_KEY',
                error
            );
        }

        throw new SendModelError(
            '일괄 전송 요청 생성 중 데이터베이스 오류가 발생했습니다.',
            'DB_ERROR',
            error
        );
    }
}

/**
 * 마스터 상태 변경
 *
 * @param {string} request_id - 요청 UUID
 * @param {string} status - 상태 (SEND_STATUS enum 값)
 * @returns {Promise<void>}
 * @throws {SendModelError} 상태 변경 실패 시
 */
export async function setMasterStatus(request_id, status) {
    try {
        // 입력값 검증
        validateRequestId(request_id);
        validateStatus(status);

        const sql = `
            UPDATE r_send_request
            SET status = :status,
                updated_at = CURRENT_TIMESTAMP
            WHERE request_id = :id
        `;

        const [result] = await executeQuery(sql, { status, id: request_id });

        // 업데이트된 행이 없는 경우
        if (result.affectedRows === 0) {
            throw new SendModelError(
                `request_id를 찾을 수 없습니다: ${request_id}`,
                'NOT_FOUND'
            );
        }

        console.log('[SEND MODEL] 상태 변경:', request_id, '->', status);

    } catch (error) {
        if (error instanceof SendModelError) {
            throw error;
        }

        console.error('[SEND MODEL ERROR] 상태 변경 실패:', error.message);
        throw new SendModelError(
            '상태 변경 중 데이터베이스 오류가 발생했습니다.',
            'DB_ERROR',
            error
        );
    }
}

/**
 * 마스터 요청 정보 조회
 *
 * @param {string} request_id - 요청 UUID
 * @returns {Promise<Object|null>} - 요청 정보 또는 null
 * @throws {SendModelError} 조회 실패 시
 */
export async function getRequestStatus(request_id) {
    try {
        // 입력값 검증
        validateRequestId(request_id);

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

        const [rows] = await executeQuery(sql, { id: request_id });

        if (rows.length === 0) {
            return null;
        }

        // DB에서 조회한 숫자 필드를 명시적으로 숫자로 변환
        const result = rows[0];
        return {
            ...result,
            total_count: parseInt(result.total_count, 10) || 0,
            completed_count: parseInt(result.completed_count, 10) || 0,
            failed_count: parseInt(result.failed_count, 10) || 0
        };

    } catch (error) {
        if (error instanceof SendModelError) {
            throw error;
        }

        console.error('[SEND MODEL ERROR] 요청 상태 조회 실패:', error.message);
        throw new SendModelError(
            '요청 상태 조회 중 데이터베이스 오류가 발생했습니다.',
            'DB_ERROR',
            error
        );
    }
}

/**
 * 마스터 통계 갱신
 *
 * @param {string} request_id - 요청 UUID
 * @returns {Promise<Object>} - 갱신된 통계 { total, completed, failed }
 * @throws {SendModelError} 갱신 실패 시
 *
 * 동작:
 * 1. r_send_detail에서 실제 통계를 집계
 * 2. r_send_request의 completed_count, failed_count 업데이트
 */
export async function refreshMasterStats(request_id) {
    try {
        // 입력값 검증
        validateRequestId(request_id);

        // 1. 실제 통계 집계
        const statsSql = `
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN sent = 'Y' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN sent = 'N' AND attempt_count >= :max_retry THEN 1 ELSE 0 END) AS failed
      FROM r_send_detail
      WHERE request_id = :request_id
    `;

        const [statsRows] = await executeQuery(statsSql, {
            request_id,
            max_retry: MAX_RETRY_COUNT
        });

        const stats = statsRows[0];
        const total = parseInt(stats.total, 10) || 0;
        const completed = parseInt(stats.completed, 10) || 0;
        const failed = parseInt(stats.failed, 10) || 0;

        // 2. 마스터 테이블 업데이트
        const updateSql = `
            UPDATE r_send_request
            SET
                completed_count = :completed,
                failed_count = :failed,
                updated_at = CURRENT_TIMESTAMP
            WHERE request_id = :request_id
        `;

        await executeQuery(updateSql, {
            request_id,
            completed,
            failed
        });

        console.log(`[SEND MODEL] 통계 갱신: 완료=${completed}, 실패=${failed}, 전체=${total}`);

        return { total, completed, failed };

    } catch (error) {
        if (error instanceof SendModelError) {
            throw error;
        }

        console.error('[SEND MODEL ERROR] 통계 갱신 실패:', error.message);
        throw new SendModelError(
            '통계 갱신 중 데이터베이스 오류가 발생했습니다.',
            'DB_ERROR',
            error
        );
    }
}

// ============================================
// 상세 테이블 (r_send_detail) 관련 함수
// ============================================

/**
 * 상세 정보 일괄 생성
 *
 * @param {string} request_id - 요청 UUID
 * @param {Array<Object>} recipients - 수신자 배열
 * @param {string} recipients[].wallet_address - 지갑 주소
 * @param {number} recipients[].amount - 금액
 * @returns {Promise<number>} - 생성된 행 수
 * @throws {SendModelError} 생성 실패 시
 *
 * 주의사항:
 * - 지갑 주소는 자동으로 암호화됩니다.
 * - BULK_INSERT_LIMIT을 초과하면 여러 번 나눠서 삽입합니다.
 */
export async function insertSendDetails(request_id, recipients) {
    try {
        // 입력값 검증
        validateRequestId(request_id);

        if (!Array.isArray(recipients) || recipients.length === 0) {
            throw new SendModelError(
                'recipients는 비어있지 않은 배열이어야 합니다.',
                'VALIDATION_ERROR'
            );
        }

        // 각 수신자 검증 및 암호화
        const validatedRecipients = recipients.map((recipient, index) => {
            try {
                validateWalletAddress(recipient.wallet_address);
                validateAmount(recipient.amount);

                return {
                    wallet_address: encryptData(recipient.wallet_address),
                    amount: recipient.amount
                };
            } catch (error) {
                throw new SendModelError(
                    `수신자 #${index + 1} 검증 실패: ${error.message}`,
                    'VALIDATION_ERROR',
                    error
                );
            }
        });

        let totalInserted = 0;

        // Bulk Insert 실행 (BULK_INSERT_LIMIT 단위로 분할)
        for (let i = 0; i < validatedRecipients.length; i += BULK_INSERT_LIMIT) {
            const chunk = validatedRecipients.slice(i, i + BULK_INSERT_LIMIT);

            // VALUES 절 생성
            const valuePlaceholders = chunk.map((_, idx) => {
                const offset = i + idx;
                return `(:request_id, :wallet_${offset}, :amount_${offset})`;
            }).join(', ');

            // 파라미터 객체 생성
            const params = { request_id };
            chunk.forEach((recipient, idx) => {
                const offset = i + idx;
                params[`wallet_${offset}`] = recipient.wallet_address;
                params[`amount_${offset}`] = recipient.amount;
            });

            const sql = `
        INSERT INTO r_send_detail (
          request_id, 
          wallet_address, 
          amount
        ) VALUES ${valuePlaceholders}
      `;

            const [result] = await executeQuery(sql, params);
            totalInserted += result.affectedRows;
        }

        console.log(`[SEND MODEL] ${totalInserted}개 상세 정보 생성 완료`);

        return totalInserted;

    } catch (error) {
        if (error instanceof SendModelError) {
            throw error;
        }

        console.error('[SEND MODEL ERROR] 상세 정보 생성 실패:', error.message);
        throw new SendModelError(
            '상세 정보 생성 중 데이터베이스 오류가 발생했습니다.',
            'DB_ERROR',
            error
        );
    }
}

/**
 * 마스터 + 상세 정보 원자적 생성 (트랜잭션)
 *
 * @param {Object} masterData - 마스터 데이터
 * @param {string} masterData.request_id - UUID
 * @param {string} masterData.cate1 - 분류1
 * @param {string} masterData.cate2 - 분류2
 * @param {Array<Object>} recipients - 수신자 배열
 * @returns {Promise<Object>} - { request_id, inserted_count }
 * @throws {SendModelError} 생성 실패 시
 */
export async function createSendRequestWithDetails(masterData, recipients) {
    const connection = await getConnection();

    try {
        // 트랜잭션 시작
        await connection.beginTransaction();

        // 1. 마스터 생성
        const { request_id, cate1, cate2 } = masterData;
        validateRequestId(request_id);

        if (!Array.isArray(recipients) || recipients.length === 0) {
            throw new SendModelError(
                'recipients는 비어있지 않은 배열이어야 합니다.',
                'VALIDATION_ERROR'
            );
        }

        await createSendRequest({
            request_id,
            cate1,
            cate2,
            total_count: recipients.length
        });

        // 2. 상세 정보 생성
        const insertedCount = await insertSendDetails(request_id, recipients);

        // 트랜잭션 커밋
        await connection.commit();

        console.log(`[SEND MODEL] 트랜잭션 성공: ${insertedCount}개 생성`);

        return {
            request_id,
            inserted_count: insertedCount
        };

    } catch (error) {
        // 롤백
        await connection.rollback();

        console.error('[SEND MODEL ERROR] 트랜잭션 실패:', error.message);

        if (error instanceof SendModelError) {
            throw error;
        }

        throw new SendModelError(
            '마스터 + 상세 정보 생성 중 오류가 발생했습니다.',
            'DB_ERROR',
            error
        );
    } finally {
        connection.release();
    }
}

/**
 * 미전송 항목 조회 (sent = 'N' AND attempt_count = 0)
 *
 * @param {string} request_id - 요청 UUID
 * @param {number} limit - 최대 조회 개수 (기본: 100)
 * @returns {Promise<Array<Object>>} - 미전송 항목 배열 (복호화됨)
 * @throws {SendModelError} 조회 실패 시
 */
export async function listPendingDetails(request_id, limit = 100) {
    try {
        // 입력값 검증
        validateRequestId(request_id);

        if (typeof limit !== 'number' || limit < 1 || limit > 10000) {
            throw new SendModelError(
                'limit은 1~10000 사이의 숫자여야 합니다.',
                'VALIDATION_ERROR'
            );
        }

        const sql = `
            SELECT
                idx,
                wallet_address,
                amount,
                attempt_count,
                created_at
            FROM r_send_detail
            WHERE request_id = :request_id
              AND sent = :sent_no
              AND attempt_count = 0
            ORDER BY idx ASC
                LIMIT :limit
        `;

        const [rows] = await executeQuery(sql, {
            request_id,
            sent_no: SENT_FLAG.NO,
            limit
        });

        // 지갑 주소 복호화
        const decryptedRows = rows.map(row => {
            try {
                return {
                    ...row,
                    wallet_address: decryptData(row.wallet_address)
                };
            } catch (error) {
                console.error(`[SEND MODEL ERROR] 복호화 실패 idx=${row.idx}:`, error.message);
                throw new SendModelError(
                    `지갑 주소 복호화 실패 (idx: ${row.idx})`,
                    'DECRYPTION_ERROR',
                    error
                );
            }
        });

        console.log(`[SEND MODEL] ${decryptedRows.length}개 미전송 항목 조회`);

        return decryptedRows;

    } catch (error) {
        if (error instanceof SendModelError) {
            throw error;
        }

        console.error('[SEND MODEL ERROR] 미전송 항목 조회 실패:', error.message);
        throw new SendModelError(
            '미전송 항목 조회 중 데이터베이스 오류가 발생했습니다.',
            'DB_ERROR',
            error
        );
    }
}

/**
 * 전송 결과 업데이트 (단일 항목)
 *
 * @param {number} idx - r_send_detail.idx
 * @param {Object} result - 결과 정보
 * @param {boolean} result.success - 전송 성공 여부
 * @param {string} result.result_code - 결과 코드 (예: '200', '500')
 * @param {string} [result.error_message] - 에러 메시지 (실패 시)
 * @returns {Promise<void>}
 * @throws {SendModelError} 업데이트 실패 시
 *
 * 동작:
 * - success=true: sent='Y', attempt_count 증가
 * - success=false: sent='N', attempt_count 증가, error_message 저장
 *
 * 주의: tx_signature는 DB에 저장되지 않습니다.
 *       트랜잭션 서명 정보는 r_log 테이블에 별도로 기록하세요.
 */
export async function updateDetailResult(idx, { success, result_code, error_message = null }) {
    try {
        // 입력값 검증
        if (typeof idx !== 'number' || idx < 1) {
            throw new SendModelError(
                'idx는 1 이상의 숫자여야 합니다.',
                'VALIDATION_ERROR'
            );
        }

        if (typeof success !== 'boolean') {
            throw new SendModelError(
                'success는 boolean 타입이어야 합니다.',
                'VALIDATION_ERROR'
            );
        }

        if (!result_code || typeof result_code !== 'string') {
            throw new SendModelError(
                'result_code는 필수 문자열입니다.',
                'VALIDATION_ERROR'
            );
        }

        const sql = `
      UPDATE r_send_detail
      SET 
        sent = :sent,
        attempt_count = attempt_count + 1,
        last_result_code = :result_code,
        last_error_message = :error_message,
        updated_at = CURRENT_TIMESTAMP
      WHERE idx = :idx
    `;

        const [result] = await executeQuery(sql, {
            idx,
            sent: success ? SENT_FLAG.YES : SENT_FLAG.NO,
            result_code,
            error_message: error_message || null
        });

        if (result.affectedRows === 0) {
            throw new SendModelError(
                `idx를 찾을 수 없습니다: ${idx}`,
                'NOT_FOUND'
            );
        }

        console.log(`[SEND MODEL] 결과 업데이트: idx=${idx}, success=${success}`);

    } catch (error) {
        if (error instanceof SendModelError) {
            throw error;
        }

        console.error('[SEND MODEL ERROR] 결과 업데이트 실패:', error.message);
        throw new SendModelError(
            '결과 업데이트 중 데이터베이스 오류가 발생했습니다.',
            'DB_ERROR',
            error
        );
    }
}

/**
 * 전송 결과 배치 업데이트
 *
 * @param {Array<Object>} results - 결과 배열
 * @param {number} results[].idx - r_send_detail.idx
 * @param {boolean} results[].success - 전송 성공 여부
 * @param {string} results[].result_code - 결과 코드
 * @param {string} [results[].error_message] - 에러 메시지
 * @returns {Promise<number>} - 업데이트된 행 수
 * @throws {SendModelError} 업데이트 실패 시
 *
 * 주의: tx_signature는 DB에 저장되지 않습니다.
 */
export async function updateDetailResultsBatch(results) {
    try {
        // 입력값 검증
        if (!Array.isArray(results) || results.length === 0) {
            throw new SendModelError(
                'results는 비어있지 않은 배열이어야 합니다.',
                'VALIDATION_ERROR'
            );
        }

        // CASE 문 생성
        const idxList = results.map(r => r.idx);
        const sentCases = results.map(r =>
            `WHEN ${r.idx} THEN '${r.success ? SENT_FLAG.YES : SENT_FLAG.NO}'`
        ).join(' ');

        const resultCodeCases = results.map(r =>
            `WHEN ${r.idx} THEN '${r.result_code}'`
        ).join(' ');

        const errorMessageCases = results.map(r =>
            `WHEN ${r.idx} THEN ${r.error_message ? `'${r.error_message}'` : 'NULL'}`
        ).join(' ');

        const sql = `
      UPDATE r_send_detail
      SET 
        sent = CASE idx ${sentCases} END,
        attempt_count = attempt_count + 1,
        last_result_code = CASE idx ${resultCodeCases} END,
        last_error_message = CASE idx ${errorMessageCases} END,
        updated_at = CURRENT_TIMESTAMP
      WHERE idx IN (${idxList.join(',')})
    `;

        const [result] = await executeQuery(sql, {});

        console.log(`[SEND MODEL] 배치 업데이트 완료: ${result.affectedRows}개`);

        return result.affectedRows;

    } catch (error) {
        if (error instanceof SendModelError) {
            throw error;
        }

        console.error('[SEND MODEL ERROR] 배치 업데이트 실패:', error.message);
        throw new SendModelError(
            '배치 업데이트 중 데이터베이스 오류가 발생했습니다.',
            'DB_ERROR',
            error
        );
    }
}

/**
 * 전체 상세 정보 조회
 *
 * @param {string} request_id - 요청 UUID
 * @param {Object} options - 조회 옵션
 * @param {boolean} [options.decrypt=false] - 지갑 주소 복호화 여부
 * @param {string} [options.sent_filter] - 전송 상태 필터 ('Y', 'N', null=전체)
 * @param {number} [options.limit] - 최대 조회 개수 (기본: 전체)
 * @param {number} [options.offset=0] - 시작 위치
 * @returns {Promise<Array<Object>>} - 상세 정보 배열
 * @throws {SendModelError} 조회 실패 시
 */
export async function getAllDetails(request_id, options = {}) {
    try {
        // 입력값 검증
        validateRequestId(request_id);

        const {
            decrypt = false,
            sent_filter = null,
            limit = null,
            offset = 0
        } = options;

        // 동적 WHERE 절 구성
        let whereClauses = ['request_id = :request_id'];
        const params = { request_id, offset };

        if (sent_filter) {
            if (![SENT_FLAG.YES, SENT_FLAG.NO].includes(sent_filter)) {
                throw new SendModelError(
                    `유효하지 않은 sent_filter 값입니다: ${sent_filter}`,
                    'VALIDATION_ERROR'
                );
            }
            whereClauses.push('sent = :sent_filter');
            params.sent_filter = sent_filter;
        }

        if (limit !== null) {
            if (typeof limit !== 'number' || limit < 1) {
                throw new SendModelError(
                    'limit은 1 이상의 숫자여야 합니다.',
                    'VALIDATION_ERROR'
                );
            }
            params.limit = limit;
        }

        // SQL 구성 (tx_signature 컬럼 제거)
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
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY idx ASC
                ${limit !== null ? 'LIMIT :limit OFFSET :offset' : ''}
        `;

        const [rows] = await executeQuery(sql, params);

        // 복호화 옵션
        if (decrypt) {
            return rows.map(row => {
                try {
                    return {
                        ...row,
                        wallet_address: decryptData(row.wallet_address)
                    };
                } catch (error) {
                    console.error(`[SEND MODEL ERROR] 복호화 실패 idx=${row.idx}:`, error.message);
                    // 복호화 실패 시에도 나머지 데이터는 반환
                    return {
                        ...row,
                        wallet_address: '[복호화 실패]',
                        decryption_error: true
                    };
                }
            });
        }

        return rows;

    } catch (error) {
        if (error instanceof SendModelError) {
            throw error;
        }

        console.error('[SEND MODEL ERROR] 상세 정보 조회 실패:', error.message);
        throw new SendModelError(
            '상세 정보 조회 중 데이터베이스 오류가 발생했습니다.',
            'DB_ERROR',
            error
        );
    }
}

/**
 * 재시도 대상 조회 (실패했지만 재시도 가능한 항목)
 *
 * @param {string} request_id - 요청 UUID
 * @param {number} limit - 최대 조회 개수 (기본: 100)
 * @returns {Promise<Array<Object>>} - 재시도 대상 배열
 * @throws {SendModelError} 조회 실패 시
 *
 * 조건:
 * - sent = 'N' (전송 실패)
 * - attempt_count < MAX_RETRY_COUNT
 * - updated_at이 오래된 순서 (오래 실패한 것부터 재시도)
 */
export async function listRetryableDetails(request_id, limit = 100) {
    try {
        // 입력값 검증
        validateRequestId(request_id);

        if (typeof limit !== 'number' || limit < 1 || limit > 10000) {
            throw new SendModelError(
                'limit은 1~10000 사이의 숫자여야 합니다.',
                'VALIDATION_ERROR'
            );
        }

        const sql = `
            SELECT
                idx,
                wallet_address,
                amount,
                attempt_count,
                last_result_code,
                last_error_message,
                updated_at
            FROM r_send_detail
            WHERE request_id = :request_id
              AND sent = :sent_no
              AND attempt_count < :max_retry
              AND attempt_count > 0
            ORDER BY updated_at ASC
                LIMIT :limit
        `;

        const [rows] = await executeQuery(sql, {
            request_id,
            sent_no: SENT_FLAG.NO,
            max_retry: MAX_RETRY_COUNT,
            limit
        });

        // 지갑 주소 복호화
        const decryptedRows = rows.map(row => {
            try {
                return {
                    ...row,
                    wallet_address: decryptData(row.wallet_address)
                };
            } catch (error) {
                console.error(`[SEND MODEL ERROR] 복호화 실패 idx=${row.idx}:`, error.message);
                throw new SendModelError(
                    `지갑 주소 복호화 실패 (idx: ${row.idx})`,
                    'DECRYPTION_ERROR',
                    error
                );
            }
        });

        console.log(`[SEND MODEL] ${decryptedRows.length}개 재시도 대상 조회`);

        return decryptedRows;

    } catch (error) {
        if (error instanceof SendModelError) {
            throw error;
        }

        console.error('[SEND MODEL ERROR] 재시도 대상 조회 실패:', error.message);
        throw new SendModelError(
            '재시도 대상 조회 중 데이터베이스 오류가 발생했습니다.',
            'DB_ERROR',
            error
        );
    }
}

/**
 * 전송 요청 통계 조회
 *
 * @param {string} request_id - 요청 UUID
 * @returns {Promise<Object>} - 통계 정보
 * @throws {SendModelError} 조회 실패 시
 *
 * 반환 형식:
 * {
 *   total: number,           // 총 수신자 수
 *   completed: number,       // 성공
 *   failed: number,          // 실패 (재시도 불가)
 *   pending: number,         // 대기 중
 *   retryable: number,       // 재시도 가능
 *   success_rate: number     // 성공률 (%)
 * }
 */
export async function getDetailStats(request_id) {
    try {
        // 입력값 검증
        validateRequestId(request_id);

        const sql = `
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN sent = 'Y' THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN sent = 'N' AND attempt_count >= :max_retry THEN 1 ELSE 0 END) AS failed,
                SUM(CASE WHEN sent = 'N' AND attempt_count = 0 THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN sent = 'N' AND attempt_count > 0 AND attempt_count < :max_retry THEN 1 ELSE 0 END) AS retryable
            FROM r_send_detail
            WHERE request_id = :request_id
        `;

        const [rows] = await executeQuery(sql, {
            request_id,
            max_retry: MAX_RETRY_COUNT
        });

        const stats = rows[0];
        const total = parseInt(stats.total, 10) || 0;
        const completed = parseInt(stats.completed, 10) || 0;
        const failed = parseInt(stats.failed, 10) || 0;
        const pending = parseInt(stats.pending, 10) || 0;
        const retryable = parseInt(stats.retryable, 10) || 0;

        // 성공률 계산
        const success_rate = total > 0
            ? Math.round((completed / total) * 10000) / 100  // 소수점 2자리
            : 0;

        const result = {
            total,
            completed,
            failed,
            pending,
            retryable,
            success_rate
        };

        console.log('[SEND MODEL] 통계 조회:', JSON.stringify(result));

        return result;

    } catch (error) {
        if (error instanceof SendModelError) {
            throw error;
        }

        console.error('[SEND MODEL ERROR] 통계 조회 실패:', error.message);
        throw new SendModelError(
            '통계 조회 중 데이터베이스 오류가 발생했습니다.',
            'DB_ERROR',
            error
        );
    }
}

// ============================================
// Export 정리
// ============================================

export default {
    // 상수
    SEND_STATUS,
    SENT_FLAG,
    MAX_RETRY_COUNT,
    BULK_INSERT_LIMIT,

    // 에러 클래스
    SendModelError,

    // 마스터 테이블 함수
    createSendRequest,
    setMasterStatus,
    getRequestStatus,
    refreshMasterStats,

    // 상세 테이블 함수
    insertSendDetails,
    createSendRequestWithDetails,
    listPendingDetails,
    updateDetailResult,
    updateDetailResultsBatch,
    getAllDetails,
    listRetryableDetails,
    getDetailStats
};