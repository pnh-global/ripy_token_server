// src/controllers/__tests__/health.controller.test.js

/**
 * health.controller.js 테스트
 * Health Check API의 정상 동작을 검증합니다
 */

import { jest } from '@jest/globals';
import { healthCheck } from '../health.controller.js';

// Mock pool 생성
let mockPool;

// 테스트 전 설정
beforeEach(() => {
    // pool mock 초기화
    mockPool = {
        getConnection: null
    };
});

// Mock 요청/응답 헬퍼
const mockRequest = () => {
    return {};
};

const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('Health Controller', () => {
    describe('healthCheck()', () => {
        test('DB 연결이 정상일 때 200과 healthy 상태를 반환해야 함', async () => {
            // Given: Mock DB 연결
            const mockConnection = {
                ping: jest.fn().mockResolvedValue(true),
                release: jest.fn()
            };

            // pool.getConnection을 동적으로 import하여 mock
            const poolModule = await import('../../config/db.js');
            poolModule.default.getConnection = jest.fn().mockResolvedValue(mockConnection);

            const req = mockRequest();
            const res = mockResponse();

            // When: healthCheck 호출
            await healthCheck(req, res);

            // Then: 정상 응답 확인
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                ok: true,
                status: 'healthy',
                database: {
                    connected: true
                }
            });

            // DB 연결이 해제되었는지 확인
            expect(mockConnection.release).toHaveBeenCalled();
        });

        test('DB 연결 실패 시 503과 unhealthy 상태를 반환해야 함', async () => {
            // Given: DB 연결 실패 Mock
            const dbError = new Error('Database connection failed');

            const poolModule = await import('../../config/db.js');
            poolModule.default.getConnection = jest.fn().mockRejectedValue(dbError);

            const req = mockRequest();
            const res = mockResponse();

            // When: healthCheck 호출
            await healthCheck(req, res);

            // Then: 에러 응답 확인
            expect(res.status).toHaveBeenCalledWith(503);
            expect(res.json).toHaveBeenCalledWith({
                ok: false,
                status: 'unhealthy',
                database: {
                    connected: false
                },
                error: 'Database connection failed'
            });
        });

        test('DB ping 실패 시 503을 반환해야 함', async () => {
            // Given: ping 실패 Mock
            const mockConnection = {
                ping: jest.fn().mockRejectedValue(new Error('Ping failed')),
                release: jest.fn()
            };

            const poolModule = await import('../../config/db.js');
            poolModule.default.getConnection = jest.fn().mockResolvedValue(mockConnection);

            const req = mockRequest();
            const res = mockResponse();

            // When: healthCheck 호출
            await healthCheck(req, res);

            // Then: 에러 응답 확인
            expect(res.status).toHaveBeenCalledWith(503);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    ok: false,
                    status: 'unhealthy',
                    database: {
                        connected: false
                    }
                })
            );
        });
    });
});