/**
 * response.test.js
 *
 * 응답 포맷 유틸리티 테스트
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { successResponse, errorResponse, paginatedResponse } from '../response.js';

describe('Response Utils', () => {
    let mockRes;

    beforeEach(() => {
        // Express response 객체 모킹
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
    });

    // ========================================
    // successResponse 테스트
    // ========================================
    describe('successResponse', () => {
        test('기본 성공 응답을 반환해야 함', () => {
            const data = { userId: 123 };

            successResponse(mockRes, data);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                ok: true,
                data: { userId: 123 }
            });
        });

        test('메시지와 함께 성공 응답을 반환해야 함', () => {
            const data = { id: 1 };
            const message = '서비스 키가 생성되었습니다.';

            successResponse(mockRes, data, 201, message);

            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith({
                ok: true,
                message,
                data: { id: 1 }
            });
        });

        test('데이터 없이 성공 응답을 반환해야 함', () => {
            successResponse(mockRes, null);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                ok: true
            });
        });

        test('배열 데이터도 처리해야 함', () => {
            const data = [1, 2, 3];

            successResponse(mockRes, data);

            expect(mockRes.json).toHaveBeenCalledWith({
                ok: true,
                data: [1, 2, 3]
            });
        });

        test('커스텀 상태 코드를 설정할 수 있어야 함', () => {
            successResponse(mockRes, { id: 1 }, 201);

            expect(mockRes.status).toHaveBeenCalledWith(201);
        });
    });

    // ========================================
    // errorResponse 테스트
    // ========================================
    describe('errorResponse', () => {
        test('Error 객체로 에러 응답을 반환해야 함', () => {
            const error = new Error('잘못된 요청입니다.');

            errorResponse(mockRes, error, 400);

            expect(mockRes.status).toHaveBeenCalledWith(400);

            // json 호출 인자 가져오기
            const callArg = mockRes.json.mock.calls[0][0];

            // 필수 필드 검증
            expect(callArg.ok).toBe(false);
            expect(callArg.error).toBe('잘못된 요청입니다.');

            // stack은 개발 환경에서만 추가되므로 존재 여부만 확인
            if (process.env.NODE_ENV !== 'production') {
                expect(callArg.stack).toBeDefined();
            }
        });

        test('문자열로 에러 응답을 반환해야 함', () => {
            errorResponse(mockRes, '서버 내부 오류', 500);

            expect(mockRes.status).toHaveBeenCalledWith(500);

            const callArg = mockRes.json.mock.calls[0][0];
            expect(callArg.ok).toBe(false);
            expect(callArg.error).toBe('서버 내부 오류');
        });

        test('커스텀 에러 객체를 처리해야 함', () => {
            const error = {
                code: 'INVALID_KEY',
                message: '유효하지 않은 키입니다.',
                statusCode: 401
            };

            errorResponse(mockRes, error);

            expect(mockRes.status).toHaveBeenCalledWith(401);

            const callArg = mockRes.json.mock.calls[0][0];
            expect(callArg.ok).toBe(false);
            expect(callArg.error).toBe('유효하지 않은 키입니다.');
            expect(callArg.code).toBe('INVALID_KEY');
        });

        test('Error 객체의 status를 우선 사용해야 함', () => {
            const error = new Error('Unauthorized');
            error.status = 401;
            error.code = 'AUTH_FAILED';

            errorResponse(mockRes, error);

            expect(mockRes.status).toHaveBeenCalledWith(401);

            const callArg = mockRes.json.mock.calls[0][0];
            expect(callArg.ok).toBe(false);
            expect(callArg.error).toBe('Unauthorized');
            expect(callArg.code).toBe('AUTH_FAILED');
        });

        test('기본 상태 코드는 500이어야 함', () => {
            errorResponse(mockRes, 'Something went wrong');

            expect(mockRes.status).toHaveBeenCalledWith(500);
        });

        test('알 수 없는 타입은 기본 메시지를 반환해야 함', () => {
            errorResponse(mockRes, null);

            const callArg = mockRes.json.mock.calls[0][0];
            expect(callArg.ok).toBe(false);
            expect(callArg.error).toBe('Internal Server Error');
        });
    });

    // ========================================
    // paginatedResponse 테스트
    // ========================================
    describe('paginatedResponse', () => {
        test('페이징 응답을 반환해야 함', () => {
            const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
            const total = 100;
            const page = 2;
            const limit = 20;

            paginatedResponse(mockRes, items, total, page, limit);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                ok: true,
                data: {
                    items,
                    pagination: {
                        total: 100,
                        page: 2,
                        limit: 20,
                        totalPages: 5,
                        hasNext: true,
                        hasPrev: true
                    }
                }
            });
        });

        test('첫 페이지는 hasPrev가 false여야 함', () => {
            paginatedResponse(mockRes, [], 50, 1, 10);

            const callArg = mockRes.json.mock.calls[0][0];
            expect(callArg.data.pagination.hasPrev).toBe(false);
            expect(callArg.data.pagination.hasNext).toBe(true);
        });

        test('마지막 페이지는 hasNext가 false여야 함', () => {
            paginatedResponse(mockRes, [], 50, 5, 10);

            const callArg = mockRes.json.mock.calls[0][0];
            expect(callArg.data.pagination.hasNext).toBe(false);
            expect(callArg.data.pagination.hasPrev).toBe(true);
        });

        test('메시지와 함께 페이징 응답을 반환해야 함', () => {
            const message = '조회 완료';

            paginatedResponse(mockRes, [], 0, 1, 10, message);

            const callArg = mockRes.json.mock.calls[0][0];
            expect(callArg.message).toBe(message);
        });

        test('totalPages 계산이 정확해야 함', () => {
            // 23개 아이템, 페이지당 10개 → 3페이지
            paginatedResponse(mockRes, [], 23, 1, 10);

            const callArg = mockRes.json.mock.calls[0][0];
            expect(callArg.data.pagination.totalPages).toBe(3);
        });
    });
});