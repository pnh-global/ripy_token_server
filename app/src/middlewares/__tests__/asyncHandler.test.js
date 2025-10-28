/**
 * asyncHandler 미들웨어 테스트
 *
 * 목적: 비동기 라우트 핸들러에서 발생하는 에러를 자동으로 catch하여
 *       Express의 에러 핸들러로 전달하는 기능을 테스트합니다.
 */

import { jest } from '@jest/globals';
import { asyncHandler } from '../asyncHandler.js';

describe('asyncHandler 미들웨어', () => {
    // Mock 객체들을 각 테스트마다 새로 생성
    let req, res, next;

    beforeEach(() => {
        // req, res, next는 Express의 미들웨어 함수에 전달되는 파라미터입니다
        req = {}; // 요청 객체 (현재는 빈 객체로 충분)
        res = {}; // 응답 객체 (현재는 빈 객체로 충분)
        next = jest.fn(); // next 함수는 Jest의 mock 함수로 생성 (호출 여부 확인 가능)
    });

    /**
     * 테스트 1: 정상적인 비동기 함수 실행
     * - 비동기 함수가 성공적으로 실행되면 next가 호출되지 않아야 함
     */
    test('정상 비동기 함수가 성공적으로 실행되어야 함', async () => {
        // Given: 정상적으로 동작하는 비동기 핸들러
        const normalHandler = async (req, res, next) => {
            // 실제 비즈니스 로직 (예: DB 조회 등)
            await Promise.resolve('success');
            return 'completed';
        };

        // asyncHandler로 감싼 핸들러
        const wrappedHandler = asyncHandler(normalHandler);

        // When: 핸들러 실행
        await wrappedHandler(req, res, next);

        // Then: 에러가 없으므로 next가 호출되지 않아야 함
        expect(next).not.toHaveBeenCalled();
    });

    /**
     * 테스트 2: 비동기 함수에서 에러 발생 시 처리
     * - 에러가 발생하면 next(error)가 호출되어 에러가 전달되어야 함
     */
    test('에러 발생 시 next(error)가 호출되어야 함', async () => {
        // Given: 에러를 발생시키는 비동기 핸들러
        const errorMessage = 'Database connection failed';
        const errorHandler = async (req, res, next) => {
            // 비동기 작업 중 에러 발생 (예: DB 연결 실패)
            throw new Error(errorMessage);
        };

        // asyncHandler로 감싼 핸들러
        const wrappedHandler = asyncHandler(errorHandler);

        // When: 핸들러 실행
        await wrappedHandler(req, res, next);

        // Then: next가 에러와 함께 호출되어야 함
        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith(expect.any(Error));

        // 전달된 에러 메시지 확인
        const error = next.mock.calls[0][0];
        expect(error.message).toBe(errorMessage);
    });

    /**
     * 테스트 3: Promise reject 처리
     * - Promise가 reject되어도 정상적으로 catch되어야 함
     */
    test('Promise reject 시 에러가 캐치되어야 함', async () => {
        // Given: Promise를 reject하는 핸들러
        const rejectHandler = async (req, res, next) => {
            return Promise.reject(new Error('Promise rejected'));
        };

        const wrappedHandler = asyncHandler(rejectHandler);

        // When: 핸들러 실행
        await wrappedHandler(req, res, next);

        // Then: next가 에러와 함께 호출되어야 함
        expect(next).toHaveBeenCalledWith(expect.any(Error));
        expect(next.mock.calls[0][0].message).toBe('Promise rejected');
    });

    /**
     * 테스트 4: 동기 함수도 지원하는지 확인
     * - 동기 함수도 asyncHandler로 감쌀 수 있어야 함
     */
    test('동기 함수도 처리할 수 있어야 함', async () => {
        // Given: 동기 함수
        const syncHandler = (req, res, next) => {
            return 'sync result';
        };

        const wrappedHandler = asyncHandler(syncHandler);

        // When: 핸들러 실행
        await wrappedHandler(req, res, next);

        // Then: 에러 없이 실행되어야 함
        expect(next).not.toHaveBeenCalled();
    });

    /**
     * 테스트 5: 커스텀 에러 객체 처리
     * - status 코드나 기타 속성을 가진 커스텀 에러도 처리되어야 함
     */
    test('커스텀 에러 객체를 올바르게 전달해야 함', async () => {
        // Given: 커스텀 에러를 던지는 핸들러
        const customError = new Error('Unauthorized');
        customError.status = 401;
        customError.code = 'AUTH_FAILED';

        const customErrorHandler = async (req, res, next) => {
            throw customError;
        };

        const wrappedHandler = asyncHandler(customErrorHandler);

        // When: 핸들러 실행
        await wrappedHandler(req, res, next);

        // Then: 커스텀 에러의 모든 속성이 보존되어야 함
        expect(next).toHaveBeenCalledWith(customError);
        const passedError = next.mock.calls[0][0];
        expect(passedError.status).toBe(401);
        expect(passedError.code).toBe('AUTH_FAILED');
    });
});