// src/services/log.service.js

/**
 * 로그 서비스 (Log Service)
 *
 * 역할:
 * - 비즈니스 로직 담당 (요청 메타 수집, 기본값 보정, 유효성/정책 적용)
 * - 모델 계층에 의존하여 DB 작업 수행
 * - HTTP/Express에 종속되지 않도록 설계 (테스트 용이성)
 *
 * 주의사항:
 * - 서비스는 req, res 객체를 직접 다루지 않음
 * - 컨트롤러가 필요한 데이터를 추출하여 전달
 */

import crypto from "crypto";
import { insertLog, listLogs } from "../models/log.model.js";
import logger from "../utils/logger.js";

/**
 * IP 주소 추출 및 정제
 * - X-Forwarded-For 헤더 우선 (프록시 환경 고려)
 * - IPv6의 ::ffff: 접두사 제거
 *
 * @param {Object} headers - HTTP 요청 헤더
 * @param {string} [defaultIp=''] - 기본 IP (req.ip)
 * @returns {string} 정제된 IP 주소
 *
 * @private
 */
function extractClientIp(headers, defaultIp = '') {
    const xff = headers['x-forwarded-for'];

    // X-Forwarded-For는 comma-separated 리스트일 수 있음 (첫 번째 = 실제 클라이언트 IP)
    let rawIp;
    if (Array.isArray(xff)) {
        rawIp = xff[0];
    } else if (typeof xff === 'string') {
        rawIp = xff.split(',')[0];
    } else {
        rawIp = defaultIp;
    }

    // IPv6 접두사 제거 및 trim
    const cleanedIp = (rawIp || '').toString().trim().replace('::ffff:', '');

    return cleanedIp || '0.0.0.0';
}

/**
 * 로그 데이터 검증
 * - 필수 필드가 누락되었는지 확인
 *
 * @param {Object} data - 검증할 로그 데이터
 * @throws {Error} 필수 필드 누락 시 에러 발생
 *
 * @private
 */
function validateLogData(data) {
    const requiredFields = ['cate1', 'cate2', 'api_name'];

    for (const field of requiredFields) {
        if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
            throw new Error(`${field} is required and cannot be empty`);
        }
    }
}

/**
 * 실제 로그 쓰기(INSERT) 서비스
 *
 * 처리 흐름:
 * 1. 클라이언트 IP 추출 및 정제
 * 2. 고유 request_id 생성 (UUID)
 * 3. 기본값 보정
 * 4. 입력 데이터 검증
 * 5. DB에 로그 저장
 *
 * @param {Object} requestMeta - 요청 메타 정보
 * @param {Object} requestMeta.headers - HTTP 요청 헤더
 * @param {string} [requestMeta.ip] - 요청 IP
 * @param {Object} logData - 로그 데이터
 * @param {string} logData.cate1 - 대분류 (필수)
 * @param {string} logData.cate2 - 중분류 (필수)
 * @param {string} logData.api_name - API 이름 (필수)
 * @param {number} [logData.service_key_id] - 서비스 키 ID
 * @param {string} [logData.api_parameter] - API 파라미터 (암호화됨)
 * @param {string} [logData.result_code='200'] - 결과 코드
 * @param {number} [logData.latency_ms] - 응답 시간 (ms)
 * @param {string} [logData.error_code] - 에러 코드
 * @param {string} [logData.error_message] - 에러 메시지
 * @param {string} [logData.content] - 전체 로그 내용
 * @returns {Promise<{idx: number, request_id: string}>} 생성된 로그 정보
 * @throws {Error} 유효성 검증 실패 또는 DB 에러 시
 *
 * @example
 * const result = await writeLog(
 *   { headers: req.headers, ip: req.ip },
 *   { cate1: 'sign', cate2: 'create', api_name: '/api/sign/create' }
 * );
 * console.log('Log ID:', result.idx, 'Request ID:', result.request_id);
 */
export async function writeLog(requestMeta, logData) {
    try {
        // 1. IP 추출 및 정제
        const ip = extractClientIp(requestMeta.headers || {}, requestMeta.ip || '');

        // 2. 고유 request_id 생성
        const request_id = crypto.randomUUID();

        // 3. 기본값 보정 + payload 구성
        const payload = {
            cate1: logData.cate1 || 'default',
            cate2: logData.cate2 || 'default',
            request_id,
            service_key_id: logData.service_key_id ?? null,

            req_ip_text: ip,
            req_server: requestMeta.headers?.host || null,
            req_status: logData.req_status || 'Y',

            api_name: logData.api_name || 'unknown',
            api_parameter: logData.api_parameter || null,

            result_code: logData.result_code || '200',
            latency_ms: logData.latency_ms ?? null,
            error_code: logData.error_code || null,
            error_message: logData.error_message || null,

            content: logData.content || null,
        };

        // 4. 입력 데이터 검증
        validateLogData(payload);

        // 5. DB INSERT
        const idx = await insertLog(payload);

        logger.info(`Log created: idx=${idx}, request_id=${request_id}`);

        // 6. 컨트롤러로 반환
        return { idx, request_id };

    } catch (error) {
        logger.error('writeLog service error:', error);
        throw error; // 컨트롤러가 처리하도록 전파
    }
}

/**
 * 최근 로그 N건 조회 서비스
 * - 운영/관리자 확인용
 * - 페이징 처리 지원
 *
 * @param {number} [limit=20] - 조회할 로그 개수 (기본 20)
 * @returns {Promise<Array<Object>>} 로그 목록
 * @throws {Error} DB 조회 에러 시
 *
 * @example
 * const logs = await getRecentLogs(50);
 * console.log(`Total logs: ${logs.length}`);
 */
export async function getRecentLogs(limit = 20) {
    try {
        // limit 유효성 검증
        const validLimit = Math.max(1, Math.min(limit, 1000)); // 1~1000 사이로 제한

        const logs = await listLogs(validLimit);

        logger.info(`Retrieved ${logs.length} recent logs`);

        return logs;

    } catch (error) {
        logger.error('getRecentLogs service error:', error);
        throw error;
    }
}