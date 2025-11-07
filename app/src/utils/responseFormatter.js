/**
 * responseFormatter.js
 *
 * API 응답 포맷 통일
 */

export const ResponseCode = {
    // 성공 (2xx)
    SUCCESS: 'SUCCESS',
    CREATED: 'CREATED',

    // 클라이언트 에러 (4xx)
    BAD_REQUEST: 'BAD_REQUEST',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',

    // 서버 에러 (5xx)
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

    // 비즈니스 로직 에러
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    SIGNATURE_ERROR: 'SIGNATURE_ERROR',
    TRANSACTION_ERROR: 'TRANSACTION_ERROR',
    INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
    NETWORK_ERROR: 'NETWORK_ERROR'
};

export const ResponseMessage = {
    [ResponseCode.SUCCESS]: '요청이 성공적으로 처리되었습니다',
    [ResponseCode.CREATED]: '리소스가 생성되었습니다',
    [ResponseCode.BAD_REQUEST]: '잘못된 요청입니다',
    [ResponseCode.UNAUTHORIZED]: '인증이 필요합니다',
    [ResponseCode.FORBIDDEN]: '접근 권한이 없습니다',
    [ResponseCode.NOT_FOUND]: '요청한 리소스를 찾을 수 없습니다',
    [ResponseCode.CONFLICT]: '리소스 충돌이 발생했습니다',
    [ResponseCode.INTERNAL_ERROR]: '서버 내부 오류가 발생했습니다',
    [ResponseCode.SERVICE_UNAVAILABLE]: '서비스를 사용할 수 없습니다',
    [ResponseCode.VALIDATION_ERROR]: '입력값 검증에 실패했습니다',
    [ResponseCode.SIGNATURE_ERROR]: '서명 검증에 실패했습니다',
    [ResponseCode.TRANSACTION_ERROR]: '트랜잭션 처리에 실패했습니다',
    [ResponseCode.INSUFFICIENT_BALANCE]: '잔액이 부족합니다',
    [ResponseCode.NETWORK_ERROR]: '네트워크 오류가 발생했습니다'
};

export function successResponse(data, code = ResponseCode.SUCCESS, message = null) {
    return {
        success: true,
        code: code,
        message: message || ResponseMessage[code],
        data: data,
        timestamp: new Date().toISOString()
    };
}

export function errorResponse(error, code = ResponseCode.INTERNAL_ERROR, httpStatus = 500) {
    const errorMessage = typeof error === 'string' ? error : error.message;

    return {
        success: false,
        code: code,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        httpStatus: httpStatus
    };
}