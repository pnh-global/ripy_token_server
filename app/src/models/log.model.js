import { pool } from "../config/db.js";

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
    const [r] = await pool.execute(sql, data);
    return r.insertId;
}