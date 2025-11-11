/**
 * ============================================
 * resultCodes.js - 리피 응답 코드 (Result Code) 정의
 * ============================================
 *
 * RIPY 서버 전체에서 사용하는 표준 응답 코드
 *
 * 코드 체계: CODEFFRR
 * - CODE: 구분용 문자열 (고정)
 * - FF: 기능 코드 (숫자 2자리)
 * - RR: 원인 코드 (숫자 2자리)
 *
 * 작성일: 2025-11-11
 */

// ========================================
// 공통 코드 (00, 10)
// ========================================

// 성공
export const SUCCESS = 'CODE0000';

// 시스템 오류
export const INTERNAL_SERVER_ERROR = 'CODE9999';

// 공통 에러 (10XX)
export const BAD_REQUEST = 'CODE1000';           // 잘못된 요청
export const PERMISSION_DENIED = 'CODE1003';     // 권한 부족
export const NOT_FOUND = 'CODE1004';             // 조회 실패
export const DUPLICATE_ENTRY = 'CODE1009';       // 이미 등록된 데이터

// ========================================
// 토큰 코드 (11XX)
// ========================================

// 액세스 토큰 관련
export const ACCESS_TOKEN_MISSING = 'CODE1101';      // 액세스 토큰이 없음
export const ACCESS_TOKEN_INVALID = 'CODE1102';      // 유효하지 않은 액세스 토큰
export const ACCESS_TOKEN_MISMATCH = 'CODE1103';     // 액세스 토큰 정보 불일치

// 리프레시 토큰 관련
export const REFRESH_TOKEN_MISSING = 'CODE1111';     // 리프레시 토큰이 없음
export const REFRESH_TOKEN_INVALID = 'CODE1112';     // 유효하지 않은 리프레시 토큰
export const REFRESH_TOKEN_MISMATCH = 'CODE1113';    // 리프레시 토큰 정보 불일치

// ========================================
// 유저 코드 (13XX)
// ========================================

export const USER_ALREADY_EXISTS = 'CODE1302';       // 이미 가입된 사용자

// ========================================
// 약관 코드 (14XX)
// ========================================
// 추후 정의

// ========================================
// 지갑 코드 (15XX)
// ========================================
// 추후 정의

// ========================================
// 주소록 코드 (16XX)
// ========================================
// 추후 정의

// ========================================
// 코드 설명 매핑
// ========================================

export const CODE_MESSAGES = {
    // 공통
    'CODE0000': '성공',
    'CODE9999': '시스템 오류 (서버 오류)',
    'CODE1000': '잘못된 요청',
    'CODE1003': '권한 부족',
    'CODE1004': '조회 실패',
    'CODE1009': '이미 등록된 데이터입니다',

    // 토큰
    'CODE1101': '액세스 토큰이 없음',
    'CODE1102': '유효하지 않은 액세스 토큰',
    'CODE1103': '액세스 토큰 정보가 일치하지 않음',
    'CODE1111': '리프레시 토큰이 없음',
    'CODE1112': '유효하지 않은 리프레시 토큰',
    'CODE1113': '리프레시 토큰 정보가 일치하지 않음',

    // 유저
    'CODE1302': '이미 가입되어 있는 사용자'
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
 * HTTP 상태 코드 매핑
 *
 * @param {string} code - Result Code
 * @returns {number} HTTP 상태 코드
 */
export function getHttpStatus(code) {
    const statusMap = {
        'CODE0000': 200,  // 성공
        'CODE1000': 400,  // 잘못된 요청
        'CODE1003': 403,  // 권한 부족
        'CODE1004': 404,  // 조회 실패
        'CODE1009': 409,  // 중복 데이터
        'CODE1101': 401,  // 액세스 토큰 없음
        'CODE1102': 401,  // 유효하지 않은 액세스 토큰
        'CODE1103': 401,  // 액세스 토큰 불일치
        'CODE1111': 401,  // 리프레시 토큰 없음
        'CODE1112': 401,  // 유효하지 않은 리프레시 토큰
        'CODE1113': 401,  // 리프레시 토큰 불일치
        'CODE1302': 409,  // 이미 가입된 사용자
        'CODE9999': 500   // 시스템 오류
    };

    return statusMap[code] || 500;
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