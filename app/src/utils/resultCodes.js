/**
 * ============================================
 * resultCodes.js - 리피 응답 코드 (Result Code) 정의
 * ============================================
 *
 * RIPY 서버 전체에서 사용하는 표준 응답 코드
 *
 * 코드 체계:
 * - 0000: 성공
 * - 99XX: 서버/시스템 오류
 * - 98XX: 클라이언트 요청 오류
 * - 07XX: 전송 관련 오류
 *
 * 작성일: 2025-11-11
 */

// 성공 코드
export const SUCCESS = '0000';

// 서버 오류 (99XX)
export const INTERNAL_SERVER_ERROR = '9900';

// 클라이언트 요청 오류 (98XX)
export const BAD_REQUEST = '9800';
export const VALIDATION_ERROR = '9801';

// 전송 관련 오류 (07XX)
export const TRANSFER_CREATE_FAILED = '0701';  // 전송 실패 - 생성 실패
export const TRANSFER_NOT_FOUND = '0702';      // 전송 실패 - 조회 실패

// 코드 설명 매핑
export const CODE_MESSAGES = {
    '0000': '성공',
    '9900': '서버 내부 오류',
    '9800': '잘못된 요청',
    '9801': '검증 실패',
    '0701': '전송 실패 - 생성 실패',
    '0702': '전송 실패 - 조회 실패'
};

/**
 * Result Code에 해당하는 메시지 반환
 *
 * @param {string} code - Result Code
 * @returns {string} 코드 설명
 */
export function getCodeMessage(code) {
    return CODE_MESSAGES[code] || '알 수 없는 오류';
}

/**
 * 표준 성공 응답 생성
 *
 * @param {Object} data - 응답 데이터
 * @param {string} message - 선택적 메시지
 * @returns {Object} 표준 응답 객체
 */
export function createSuccessResponse(data, message = null) {
    const response = {
        ok: true,
        code: SUCCESS,
        data
    };

    if (message) {
        response.message = message;
    }

    return response;
}

/**
 * 표준 에러 응답 생성
 *
 * @param {string} code - Result Code
 * @param {string} error - 에러 메시지
 * @returns {Object} 표준 응답 객체
 */
export function createErrorResponse(code, error) {
    return {
        ok: false,
        code,
        error
    };
}