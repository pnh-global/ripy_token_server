// r_log 테이블 전용 "모델" 계층
// - 역할: 오직 DB 질의만 담당 (비즈니스 로직 X)
// - mysql2/promise + namedPlaceholders 사용 (config/db.js에서 활성화)
// - 다른 계층(service/controller)이 재사용하기 쉽게 "작고 단순한 함수"로 노출

import { pool } from "../config/db.js";

/**
 * 로그 1건 INSERT
 * - req_ip: IPv4/IPv6 원문 문자열(req_ip_text)을 DB에서 INET6_ATON()으로 이진 저장
 * - created_at 은 DB default(now()) 사용
 * @param {object} data - 서비스 계층에서 정제된 데이터
 * @returns {number} insertId (PK idx)
 */
export async function insertLog(data) {
    const sql = `
        INSERT INTO r_log
        (cate1, cate2, request_id, service_key_id,
         req_ip, req_ip_text, req_server, req_status,
         api_name, api_parameter, result_code, latency_ms,
         error_code, error_message, content)
        VALUES
            (:cate1, :cate2, :request_id, :service_key_id,
             INET6_ATON(:req_ip_text), :req_ip_text, :req_server, :req_status,
             :api_name, :api_parameter, :result_code, :latency_ms,
             :error_code, :error_message, :content)
    `;

    // mysql2/promise: namedPlaceholders=true 라면 객체 그대로 바인딩 가능
    const [r] = await pool.execute(sql, data);
    return r.insertId;
}

/**
 * 최근 로그 N건 조회 (운영 확인용)
 * - 아주 가벼운 조회 API/내부 점검용
 * @param {number} limit - 최대 건수 (기본 20)
 * @returns {Array} rows
 */
export async function listLogs(limit = 20) {
    const sql = `
    SELECT idx, cate1, cate2, request_id, api_name,
           req_ip_text, result_code, error_code, created_at
    FROM r_log
    ORDER BY idx DESC
    LIMIT :limit
  `;
    const [rows] = await pool.execute(sql, { limit });
    return rows;
}
