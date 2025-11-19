/**
 * errorHandler 미들웨어 테스트
 *
 * 목적: Express의 전역 에러 핸들러가 다양한 에러 상황을
 *       올바르게 처리하고 적절한 응답을 반환하는지 테스트합니다.
 */

import { jest } from '@jest/globals';
import { errorHandler } from '../errorHandler.js';

describe('errorHandler 미들웨어', () => {
    // Mock 객체들을 각 테스트마다 새로 생성
    let req, res, next;

    beforeEach(() => {
        // req는 요청 객체 (에러 핸들러에서는 사용하지 않음)
        req = {};

        // res는 응답 객체 (status, json 메서드를 가짐)
        res = {
            status: jest.fn().mockReturnThis(), // status()는 자기자신(res)을 반환
            json: jest.fn() // json()은 응답 데이터를 반환
        };

        // next는 다음 미들웨어로 넘기는 함수 (에러 핸들러에서는 사용 안 함)
        next = jest.fn();
    });

    /**
     * 테스트 1: 기본 에러 처리
     * - status가 없는 일반 에러는 500으로 처리
     */
    test('기본 에러를 500 상태코드로 처리해야 함', () => {
        // Given: status가 없는 일반 에러
        const error = new Error('Something went wrong');

        // When: errorHandler 호출
        errorHandler(error, req, res, next);

        // Then: 500 상태코드와 에러 메시지 반환
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            ok: false,
            error: 'Something went wrong'
        });
    });

    /**
     * 테스트 2: 커스텀 상태코드가 있는 에러 처리
     * - 에러 객체에 status 속성이 있으면 해당 상태코드 사용
     */
    test('커스텀 상태코드를 가진 에러를 올바르게 처리해야 함', () => {
        // Given: 404 상태코드를 가진 에러
        const error = new Error('Not Found');
        error.status = 404;

        // When: errorHandler 호출
        errorHandler(error, req, res, next);

        // Then: 404 상태코드와 에러 메시지 반환
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            ok: false,
            error: 'Not Found'
        });
    });

    /**
     * 테스트 3: 401 인증 에러 처리
     */
    test('401 Unauthorized 에러를 처리해야 함', () => {
        // Given: 인증 실패 에러
        const error = new Error('Unauthorized');
        error.status = 401;

        // When: errorHandler 호출
        errorHandler(error, req, res, next);

        // Then: 401 상태코드 반환
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            ok: false,
            error: 'Unauthorized'
        });
    });

    /**
     * 테스트 4: 400 Bad Request 에러 처리
     */
    test('400 Bad Request 에러를 처리해야 함', () => {
        // Given: 잘못된 요청 에러
        const error = new Error('Invalid request parameters');
        error.status = 400;

        // When: errorHandler 호출
        errorHandler(error, req, res, next);

        // Then: 400 상태코드 반환
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            ok: false,
            error: 'Invalid request parameters'
        });
    });

    /**
     * 테스트 5: 메시지가 없는 에러 처리
     * - 기본 메시지 "Internal Server Error" 사용
     */
    test('메시지가 없는 에러는 기본 메시지를 사용해야 함', () => {
        // Given: 메시지가 없는 에러
        const error = new Error();
        error.message = '';

        // When: errorHandler 호출
        errorHandler(error, req, res, next);

        // Then: 기본 메시지 반환
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            ok: false,
            error: 'Internal Server Error'
        });
    });
});