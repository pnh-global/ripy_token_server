// "서비스" 계층
// - 역할: 비즈니스 로직 담당 (요청 메타 수집, 기본값 보정, 유효성/정책 적용 등)
// - 모델 계층에 의존하여 DB에 쓰고, 컨트롤러가 바로 응답할 수 있게 결과 형태를 리턴
// - 주의: 서비스는 HTTP/Express에 종속되지 않도록 설계(테스트 쉬움)

import crypto from "crypto";
import { insertLog, listLogs } from "../models/log.model.js";

/**
 * 실제 로그 쓰기(INSERT) 서비스
 * - 컨트롤러에서 req, body를 전달받아 메타정보를 수집/보정 후 모델로 위임
 * - request_id: 트랜잭션 추적을 위해 UUID 부여
 * @param {import('express').Request} req
 * @param {object} body - 클라이언트가 보낸 JSON 바디
 * @returns {{idx:number, request_id:string}}
 */
export async function writeLog(req, body = {}) {
    // 1) 접속 IP 추출 (프록시 환경 고려: x-forwarded-for 최우선)
    const xff = req.headers["x-forwarded-for"];
    // X-Forwarded-For가 배열 또는 comma-separated일 수 있어 첫 번째만 사용
    const rawIp = Array.isArray(xff)
        ? xff[0]
        : (typeof xff === "string" ? xff.split(",")[0] : (req.ip || ""));
    const ip = (rawIp || "").toString().trim().replace("::ffff:", "") || "0.0.0.0";

    // 2) 요청 추적용 UUID
    const request_id = crypto.randomUUID();

    // 3) 기본값 보정 + DB에 저장할 payload 구성
    const payload = {
        cate1: body.cate1 || "default",
        cate2: body.cate2 || "default",
        request_id,
        service_key_id: body.service_key_id ?? null, // 없으면 null

        req_ip_text: ip,
        req_server: req.headers.host || null,
        req_status: body.req_status || "Y", // 등록된 서비스 여부(기본 Y)

        api_name: body.api_name || "unknown",
        api_parameter: body.api_parameter || null, // 암호화된 파라미터라면 문자열

        result_code: body.result_code || "200",
        latency_ms: body.latency_ms ?? null,
        error_code: body.error_code || null,
        error_message: body.error_message || null,

        content: body.content || null,
    };

    // 4) DB INSERT
    const idx = await insertLog(payload);

    // 5) 컨트롤러로 반환(HTTP 응답에 바로 사용)
    return { idx, request_id };
}

/**
 * 최근 로그 N건 조회 서비스 (운영/관리자 확인용)
 * @param {number} limit
 */
export async function getRecentLogs(limit = 20) {
    return listLogs(limit);
}