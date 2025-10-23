// 회사 지갑 다중 송신 요청 관련 모델
import { exec } from "../lib/db.util.js";

/** 요청 마스터 생성 */
export async function createSendRequest({ request_id, cate1, cate2, total_count }) {
    const sql = `
    INSERT INTO r_send_request (request_id, cate1, cate2, total_count, status)
    VALUES (:request_id, :cate1, :cate2, :total_count, 'PENDING')
  `;
    await exec(sql, { request_id, cate1, cate2, total_count });
}

/** 상세(Bulk) 생성 */
export async function insertSendDetails(request_id, rows) {
    // rows: [{ wallet_address_encrypted, amount }, ...]
    const values = rows.map((_, i) =>
        `(:request_id, :w${i}, :a${i})`
    ).join(", ");
    const params = { request_id };
    rows.forEach((r, i) => {
        params[`w${i}`] = r.wallet_address_encrypted;
        params[`a${i}`] = r.amount;
    });
    const sql = `
    INSERT INTO r_send_detail (request_id, wallet_address, amount)
    VALUES ${values}
  `;
    await exec(sql, params);
}

/** 처리 대상 상세 가져오기 (미전송 & 3회 미만 시도) */
export async function listPendingDetails(request_id, limit = 100) {
    const sql = `
    SELECT idx, wallet_address, amount, attempt_count
    FROM r_send_detail
    WHERE request_id = :request_id AND sent = 'N' AND attempt_count < 3
    ORDER BY idx ASC
    LIMIT :limit
  `;
    const [rows] = await exec(sql, { request_id, limit });
    return rows;
}

/** 상세 결과 업데이트(시도수 증가 + 결과 기록) */
export async function updateDetailResult(idx, { success, result_code, error_message }) {
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
        error_message: error_message ?? null
    });
}

/** 마스터 집계 갱신 */
export async function refreshMasterStats(request_id) {
    const [r1] = await exec(
        "SELECT COUNT(*) AS total FROM r_send_detail WHERE request_id=:id",
        { id: request_id }
    );
    const [r2] = await exec(
        "SELECT SUM(sent='Y') AS ok, SUM(sent='N') AS no FROM r_send_detail WHERE request_id=:id",
        { id: request_id }
    );
    const total = r1[0].total || 0;
    const completed = r2[0].ok || 0;
    const failed = r2[0].no || 0;
    await exec(
        "UPDATE r_send_request SET total_count=:total, completed_count=:ok, failed_count=:failed, updated_at=CURRENT_TIMESTAMP WHERE request_id=:id",
        { total, ok: completed, failed, id: request_id }
    );
}

/** 마스터 상태 변경 */
export async function setMasterStatus(request_id, status) {
    await exec(
        "UPDATE r_send_request SET status=:status, updated_at=CURRENT_TIMESTAMP WHERE request_id=:id",
        { status, id: request_id }
    );
}

/** 상태 조회 */
export async function getRequestStatus(request_id) {
    const [rows] = await exec(
        "SELECT * FROM r_send_request WHERE request_id=:id",
        { id: request_id }
    );
    return rows[0] || null;
}
