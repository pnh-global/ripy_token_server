/**
 * response.js
 *
 * API 응답 포맷 표준화 유틸리티
 * - 프로젝트 표준: { result, code, detail }
 * - Result Code: FFRR 형식
 */

/**
 * 성공 응답 포맷 (표준)
 */
export function successResponse(res, data, statusCode = 200, code = '0000', message = '') {
    const response = {
        result: 'success',
        code: code
    };

    if (message) {
        response.message = message;
    }

    response.detail = data || {};

    return res.status(statusCode).json(response);
}

/**
 * 에러 응답 포맷 (표준)
 */
export function errorResponse(res, error, statusCode = 500, code = '9900') {
    const response = {
        result: 'fail',
        code: code
    };

    if (error instanceof Error) {
        response.message = error.message;
        if (error.code) {
            response.code = error.code;
        }
        if (error.status) {
            statusCode = error.status;
        }
    } else if (typeof error === 'object' && error !== null) {
        response.message = error.message || error.error || '알 수 없는 오류';
        if (error.code) {
            response.code = error.code;
        }
        if (error.statusCode || error.status) {
            statusCode = error.statusCode || error.status;
        }
    } else if (typeof error === 'string') {
        response.message = error;
    } else {
        response.message = 'Internal Server Error';
    }

    if (process.env.NODE_ENV !== 'production' && error instanceof Error && error.stack) {
        response.stack = error.stack;
    }

    return res.status(statusCode).json(response);
}

/**
 * 페이징 응답 포맷
 */
export function paginatedResponse(res, items, total, page, limit, code = '0000', message = '') {
    const totalPages = Math.ceil(total / limit);

    const response = {
        result: 'success',
        code: code
    };

    if (message) {
        response.message = message;
    }

    response.detail = {
        total_count: total,
        total_pages: totalPages,
        current_page: page,
        items_per_page: limit,
        has_next: page < totalPages,
        has_prev: page > 1,
        items: items
    };

    return res.status(200).json(response);
}

export default {
    successResponse,
    errorResponse,
    paginatedResponse
};