// 컨트롤러 (Controller)
// - 역할: Express 요청(req)과 응답(res)을 직접 다룸
// - 서비스 계층 호출 → 결과를 JSON 형태로 반환
// - HTTP 상태코드, 에러 핸들링을 담당
// - 비즈니스 로직은 절대 직접 수행하지 않음

import { writeLog, getRecentLogs } from "../services/log.service.js";

/**
 * [POST] /api/log
 * 요청 바디를 받아 로그 1건을 기록
 * ex) { cate1:"test", cate2:"api", api_name:"health", result_code:"200" }
 */
export const createLog = async (req, res, next) => {
    try {
        // requestMeta 객체 구성 (서비스 계층이 필요한 정보만 전달)
        const requestMeta = {
            headers: req.headers,
            ip: req.ip
        };

        const result = await writeLog(requestMeta, req.body);

        return res.status(201).json({
            ok: true,
            message: "log inserted successfully",
            data: result,
        });
    } catch (err) {
        console.error("createLog Error:", err);
        return res.status(500).json({
            ok: false,
            error: "Failed to insert log",
            details: err.message,
        });
    }
};

/**
 * [GET] /api/log/recent
 * 최근 로그 N건을 조회 (기본 20건)
 */
export const getLogs = async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit || "20", 10);
        const rows = await getRecentLogs(limit);
        return res.status(200).json({
            ok: true,
            count: rows.length,
            data: rows,
        });
    } catch (err) {
        console.error("getLogs Error:", err);
        return res.status(500).json({
            ok: false,
            error: "Failed to fetch logs",
            details: err.message,
        });
    }
};