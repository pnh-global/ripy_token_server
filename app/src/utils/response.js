/**
 * response.js
 *
 * API 응답 포맷 표준화 유틸리티
 * - 모든 API 응답은 일관된 형식을 따라야 함
 * - 성공/실패 여부를 명확히 구분
 * - 에러 처리 시 적절한 HTTP 상태 코드 반환
 */

/**
 * 성공 응답 포맷
 *
 * @param {Object} res - Express response 객체
 * @param {*} data - 응답 데이터 (객체, 배열, 문자열 등)
 * @param {number} [statusCode=200] - HTTP 상태 코드
 * @param {string} [message=''] - 추가 메시지 (선택)
 * @returns {Object} Express response
 *
 * @example
 * // 단순 성공 응답
 * successResponse(res, { userId: 123 });
 * // 결과: { ok: true, data: { userId: 123 } }
 *
 * @example
 * // 메시지와 함께 성공 응답
 * successResponse(res, { id: 1 }, 201, '서비스 키가 생성되었습니다.');
 * // 결과: { ok: true, message: '서비스 키가 생성되었습니다.', data: { id: 1 } }
 */
export function successResponse(res, data, statusCode = 200, message = '') {
    const response = {
        ok: true
    };

    // 메시지가 있으면 추가
    if (message) {
        response.message = message;
    }

    // 데이터가 있으면 추가
    if (data !== undefined && data !== null) {
        response.data = data;
    }

    return res.status(statusCode).json(response);
}

/**
 * 에러 응답 포맷
 *
 * @param {Object} res - Express response 객체
 * @param {Error|string|Object} error - 에러 객체 또는 에러 메시지
 * @param {number} [statusCode=500] - HTTP 상태 코드
 * @returns {Object} Express response
 *
 * @example
 * // Error 객체로 응답
 * errorResponse(res, new Error('잘못된 요청입니다.'), 400);
 * // 결과: { ok: false, error: '잘못된 요청입니다.' }
 *
 * @example
 * // 문자열로 응답
 * errorResponse(res, '서버 내부 오류', 500);
 * // 결과: { ok: false, error: '서버 내부 오류' }
 *
 * @example
 * // 에러 코드와 함께 응답
 * errorResponse(res, { code: 'INVALID_KEY', message: '유효하지 않은 키입니다.' }, 401);
 * // 결과: { ok: false, error: '유효하지 않은 키입니다.', code: 'INVALID_KEY' }
 */
export function errorResponse(res, error, statusCode = 500) {
    const response = {
        ok: false
    };

    // error가 Error 객체인 경우
    if (error instanceof Error) {
        response.error = error.message;

        // Error 객체에 code가 있으면 추가
        if (error.code) {
            response.code = error.code;
        }

        // Error 객체에 status가 있으면 우선 사용
        if (error.status) {
            statusCode = error.status;
        }
    }
    // error가 객체인 경우 (커스텀 에러)
    else if (typeof error === 'object' && error !== null) {
        response.error = error.message || error.error || '알 수 없는 오류';

        // 에러 코드가 있으면 추가
        if (error.code) {
            response.code = error.code;
        }

        // 상태 코드가 있으면 우선 사용
        if (error.statusCode || error.status) {
            statusCode = error.statusCode || error.status;
        }
    }
    // error가 문자열인 경우
    else if (typeof error === 'string') {
        response.error = error;
    }
    // 그 외의 경우
    else {
        response.error = 'Internal Server Error';
    }

    // 개발 환경에서는 스택 트레이스 추가 (선택)
    if (process.env.NODE_ENV !== 'production' && error instanceof Error && error.stack) {
        response.stack = error.stack;
    }

    return res.status(statusCode).json(response);
}

/**
 * 페이징 응답 포맷
 *
 * @param {Object} res - Express response 객체
 * @param {Array} items - 결과 아이템 배열
 * @param {number} total - 전체 아이템 개수
 * @param {number} page - 현재 페이지 (1부터 시작)
 * @param {number} limit - 페이지당 아이템 개수
 * @param {string} [message=''] - 추가 메시지 (선택)
 * @returns {Object} Express response
 *
 * @example
 * paginatedResponse(res, users, 100, 2, 20);
 * // 결과:
 * // {
 * //   ok: true,
 * //   data: { items: [...], total: 100, page: 2, limit: 20, totalPages: 5 }
 * // }
 */
export function paginatedResponse(res, items, total, page, limit, message = '') {
    const totalPages = Math.ceil(total / limit);

    const response = {
        ok: true
    };

    if (message) {
        response.message = message;
    }

    response.data = {
        items,
        pagination: {
            total,
            page,
            limit,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
        }
    };

    return res.status(200).json(response);
}

// 기본 export
export default {
    successResponse,
    errorResponse,
    paginatedResponse
};