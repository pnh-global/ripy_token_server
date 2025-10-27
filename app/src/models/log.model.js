import { pool } from '../config/db.js';

/**
 * IP 주소 유효성을 검증하는 함수
 * IPv4와 IPv6 형식을 모두 지원합니다
 * @param {string} ip - 검증할 IP 주소
 * @returns {boolean} - 유효하면 true, 아니면 false
 */
function isValidIP(ip) {
    // IPv4 정규식 패턴
    const ipv4Pattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

    // IPv6 정규식 패턴
    const ipv6Pattern = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::1|::)$/;

    return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
}

/**
 * r_log 테이블에 로그를 삽입하는 함수
 *
 * 필수 필드 (NOT NULL 제약 조건):
 * - cate1: 대분류 (예: 'sign', 'contract', 'solana')
 * - cate2: 중분류 (예: 'create', 'finalize', 'send')
 * - request_id: 요청 고유 식별자 (UUID)
 * - req_ip_text: 요청 IP 주소 문자열
 * - req_status: 등록된 서비스 여부 ('Y' 또는 'N')
 * - api_name: 호출한 API 이름
 *
 * @param {Object} data - 로그 데이터 객체
 * @param {string} data.cate1 - 대분류 (필수)
 * @param {string} data.cate2 - 중분류 (필수)
 * @param {string} data.request_id - 요청 고유 식별자 UUID (필수)
 * @param {string} data.req_ip_text - 요청 IP 텍스트 (필수)
 * @param {string} data.req_status - 등록된 서비스 여부 (필수, 'Y' 또는 'N')
 * @param {string} data.api_name - 호출한 API 이름 (필수)
 * @param {number} [data.service_key_id] - 서비스 키 ID (FK)
 * @param {string} [data.req_ip] - 요청 IP (VARBINARY) - 없으면 자동 생성
 * @param {string} [data.req_server] - 요청 서버 정보
 * @param {string} [data.api_parameter] - API 파라미터 (암호화된)
 * @param {string} [data.result_code] - 결과 코드 (HTTP 상태 등)
 * @param {number} [data.latency_ms] - 응답 처리 시간 (ms)
 * @param {string} [data.error_code] - 내부 오류 코드
 * @param {string} [data.error_message] - 에러 메시지
 * @param {string} [data.content] - 전체 상세 로그
 * @returns {Promise<number>} - 삽입된 로그의 idx
 * @throws {Error} - 유효성 검증 실패 시 에러 발생
 */
export async function insertLog(data) {
    try {
        // ========== 필수 필드 검증 ==========
        if (!data.cate1) {
            throw new Error('cate1 is required');
        }

        if (!data.cate2) {
            throw new Error('cate2 is required');
        }

        if (!data.request_id) {
            throw new Error('request_id is required');
        }

        if (!data.req_ip_text) {
            throw new Error('req_ip_text is required');
        }

        if (!data.req_status) {
            throw new Error('req_status is required');
        }

        if (!data.api_name) {
            throw new Error('api_name is required');
        }

        // ========== req_status 값 검증 ==========
        if (!['Y', 'N'].includes(data.req_status)) {
            throw new Error('req_status must be either "Y" or "N"');
        }

        // ========== IP 주소 형식 검증 ==========
        if (!isValidIP(data.req_ip_text)) {
            throw new Error('Invalid IP address');
        }

        // ========== req_ip 자동 생성 여부 확인 ==========
        // req_ip가 제공되지 않았으면 SQL에서 INET6_ATON() 함수 사용
        const useInetAton = !data.req_ip;

        // ========== SQL INSERT 문 작성 ==========
        const sql = useInetAton ? `
      INSERT INTO r_log (
        cate1, cate2, request_id, service_key_id, req_ip,
        req_ip_text, req_server, req_status, api_name, api_parameter,
        result_code, latency_ms, error_code, error_message, content
      )
      VALUES (
        :cate1, :cate2, :request_id, :service_key_id, INET6_ATON(:req_ip_text),
        :req_ip_text, :req_server, :req_status, :api_name, :api_parameter,
        :result_code, :latency_ms, :error_code, :error_message, :content
      )
    ` : `
      INSERT INTO r_log (
        cate1, cate2, request_id, service_key_id, req_ip,
        req_ip_text, req_server, req_status, api_name, api_parameter,
        result_code, latency_ms, error_code, error_message, content
      )
      VALUES (
        :cate1, :cate2, :request_id, :service_key_id, :req_ip,
        :req_ip_text, :req_server, :req_status, :api_name, :api_parameter,
        :result_code, :latency_ms, :error_code, :error_message, :content
      )
    `;

        // ========== 파라미터 객체 생성 ==========
        const params = {
            // 필수 필드 (NOT NULL)
            cate1: data.cate1,
            cate2: data.cate2,
            request_id: data.request_id,
            req_ip_text: data.req_ip_text,
            req_status: data.req_status,
            api_name: data.api_name,

            // 선택 필드 (NULL 허용)
            service_key_id: data.service_key_id || null,
            req_ip: data.req_ip || null,
            req_server: data.req_server || null,
            api_parameter: data.api_parameter || null,
            result_code: data.result_code || null,
            latency_ms: data.latency_ms || null,
            error_code: data.error_code || null,
            error_message: data.error_message || null,
            content: data.content || null
        };

        // ========== DB에 쿼리 실행 ==========
        const [result] = await pool.execute(sql, params);

        // 삽입된 로그의 ID 반환
        return result.insertId;

    } catch (error) {
        // 개발 환경에서만 로그 출력
        if (process.env.NODE_ENV !== 'test') {
            console.error('Error in insertLog:', error);
            console.error('Parameters:', data);
        }
        throw error;
    }
}

/**
 * 로그 목록을 조회하는 함수 (최신순)
 * @param {number} [limit=10] - 조회할 로그 개수
 * @returns {Promise<Array>} - 로그 배열
 */
export async function listLogs(limit = 10) {
    try {
        const sql = `
            SELECT *
            FROM r_log
            ORDER BY idx DESC
                LIMIT :limit
        `;

        const [rows] = await pool.execute(sql, { limit });
        return rows;

    } catch (error) {
        if (process.env.NODE_ENV !== 'test') {
            console.error('Error in listLogs:', error);
        }
        throw error;
    }
}

/**
 * ID로 특정 로그를 조회하는 함수
 * @param {number} idx - 로그 ID
 * @returns {Promise<Object|null>} - 로그 객체 또는 null
 */
export async function getLogById(idx) {
    try {
        const sql = `
            SELECT *
            FROM r_log
            WHERE idx = :idx
        `;

        const [rows] = await pool.execute(sql, { idx });
        return rows.length > 0 ? rows[0] : null;

    } catch (error) {
        if (process.env.NODE_ENV !== 'test') {
            console.error('Error in getLogById:', error);
        }
        throw error;
    }
}

/**
 * request_id로 로그 목록을 조회하는 함수
 * @param {string} requestId - 요청 ID (UUID)
 * @returns {Promise<Array>} - 로그 배열
 */
export async function getLogsByRequestId(requestId) {
    try {
        const sql = `
            SELECT *
            FROM r_log
            WHERE request_id = :requestId
            ORDER BY idx ASC
        `;

        const [rows] = await pool.execute(sql, { requestId });
        return rows;

    } catch (error) {
        if (process.env.NODE_ENV !== 'test') {
            console.error('Error in getLogsByRequestId:', error);
            console.error('Parameters:', { requestId });
        }
        throw error;
    }
}