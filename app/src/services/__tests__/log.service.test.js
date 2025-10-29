/**
 * log.service.test.js
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// 모델 함수들을 mock으로 생성
const mockInsertLog = jest.fn();
const mockListLogs = jest.fn();

// 모듈 모킹
jest.mock('../../models/log.model.js', () => ({
    insertLog: mockInsertLog,
    listLogs: mockListLogs
}));

// logger 모킹
jest.mock('../../utils/logger.js', () => ({
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

// 모킹 후에 import
import { writeLog, getRecentLogs } from '../log.service.js';

describe('Log Service', () => {

    // 각 테스트 전에 mock 초기화
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('writeLog()', () => {

        test('should successfully write log with valid data', async () => {
            const mockIdx = 123;
            // 이제 mockInsertLog 사용
            mockInsertLog.mockResolvedValue(mockIdx);

            const requestMeta = {
                headers: {
                    'x-forwarded-for': '203.0.113.1'
                }
            };

            const logData = {
                cate1: 'sign',
                cate2: 'create',
                request_id: 'test-uuid-001',
                api_name: '/api/sign/create',
                result_code: '200'
            };

            const result = await writeLog(requestMeta, logData);

            expect(result).toEqual({
                idx: mockIdx,
                request_id: 'test-uuid-001'
            });

            expect(mockInsertLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    cate1: 'sign',
                    cate2: 'create',
                    req_ip_text: '203.0.113.1'
                })
            );
        });

        test('should handle X-Forwarded-For as array', async () => {
            const mockIdx = 456;
            mockInsertLog.mockResolvedValue(mockIdx);

            const requestMeta = {
                headers: {
                    'x-forwarded-for': ['203.0.113.1', '198.51.100.1']
                }
            };

            const logData = {
                cate1: 'test',
                cate2: 'array',
                request_id: 'test-002'
            };

            await writeLog(requestMeta, logData);

            expect(mockInsertLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    req_ip_text: '203.0.113.1'
                })
            );
        });

        test('should throw error when cate1 is empty string', async () => {
            const requestMeta = { headers: {} };
            const logData = {
                cate1: '',  // 빈 문자열
                cate2: 'test',
                request_id: 'test-err-001'
            };

            await expect(writeLog(requestMeta, logData))
                .rejects
                .toThrow('cate1 is required and cannot be empty');
        });

        test('should propagate error from model layer', async () => {
            const dbError = new Error('Database connection failed');
            mockInsertLog.mockRejectedValue(dbError);

            const requestMeta = { headers: {} };
            const logData = {
                cate1: 'test',
                cate2: 'error',
                request_id: 'test-err-002'
            };

            await expect(writeLog(requestMeta, logData))
                .rejects
                .toThrow('Database connection failed');
        });
    });

    describe('getRecentLogs()', () => {

        test('should retrieve recent logs with default limit', async () => {
            const mockLogs = [
                { idx: 1, cate1: 'sign', cate2: 'create' },
                { idx: 2, cate1: 'contract', cate2: 'get' }
            ];
            mockListLogs.mockResolvedValue(mockLogs);

            const result = await getRecentLogs();

            expect(result).toEqual(mockLogs);
            expect(mockListLogs).toHaveBeenCalledWith(100); // 기본 limit
        });

        test('should cap limit at 1000', async () => {
            mockListLogs.mockResolvedValue([]);

            await getRecentLogs(9999);

            expect(mockListLogs).toHaveBeenCalledWith(1000);
        });

        test('should set minimum limit to 1', async () => {
            mockListLogs.mockResolvedValue([]);

            await getRecentLogs(0);

            expect(mockListLogs).toHaveBeenCalledWith(1);
        });
    });
});