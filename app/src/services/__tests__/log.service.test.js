// src/services/__tests__/log.service.test.js

/**
 * log.service.js 테스트
 */

// Jest globals를 명시적으로 선언 (ESLint 경고 방지)
/* global jest, describe, test, expect, beforeEach */

import { writeLog, getRecentLogs } from '../log.service.js';
import * as logModel from '../../models/log.model.js';

// 모델 함수들을 모킹
jest.mock('../../models/log.model.js');

// logger를 모킹 - default export 방식
jest.mock('../../utils/logger.js', () => ({
    default: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

describe('Log Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('writeLog()', () => {
        test('should successfully write log with valid data', async () => {
            const mockIdx = 123;
            logModel.insertLog.mockResolvedValue(mockIdx);

            const requestMeta = {
                headers: {
                    'host': 'localhost:4000',
                    'x-forwarded-for': '192.168.1.100'
                },
                ip: '127.0.0.1'
            };

            const logData = {
                cate1: 'sign',
                cate2: 'create',
                api_name: '/api/sign/create',
                result_code: '200'
            };

            const result = await writeLog(requestMeta, logData);

            expect(result).toHaveProperty('idx', mockIdx);
            expect(result).toHaveProperty('request_id');
            expect(result.request_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

            expect(logModel.insertLog).toHaveBeenCalledTimes(1);
            expect(logModel.insertLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    cate1: 'sign',
                    cate2: 'create',
                    api_name: '/api/sign/create',
                    req_ip_text: '192.168.1.100',
                    req_server: 'localhost:4000',
                    req_status: 'Y',
                    result_code: '200'
                })
            );
        });

        test('should handle X-Forwarded-For as array', async () => {
            const mockIdx = 456;
            logModel.insertLog.mockResolvedValue(mockIdx);

            const requestMeta = {
                headers: {
                    'x-forwarded-for': ['10.0.0.1', '10.0.0.2', '10.0.0.3']
                }
            };

            const logData = {
                cate1: 'test',
                cate2: 'array',
                api_name: '/api/test'
            };

            await writeLog(requestMeta, logData);

            expect(logModel.insertLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    req_ip_text: '10.0.0.1'
                })
            );
        });

        test('should handle X-Forwarded-For as comma-separated string', async () => {
            const mockIdx = 789;
            logModel.insertLog.mockResolvedValue(mockIdx);

            const requestMeta = {
                headers: {
                    'x-forwarded-for': '172.16.0.1, 172.16.0.2, 172.16.0.3'
                }
            };

            const logData = {
                cate1: 'test',
                cate2: 'string',
                api_name: '/api/test'
            };

            await writeLog(requestMeta, logData);

            expect(logModel.insertLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    req_ip_text: '172.16.0.1'
                })
            );
        });

        test('should remove ::ffff: prefix from IPv6 addresses', async () => {
            const mockIdx = 111;
            logModel.insertLog.mockResolvedValue(mockIdx);

            const requestMeta = {
                headers: {},
                ip: '::ffff:192.168.1.50'
            };

            const logData = {
                cate1: 'test',
                cate2: 'ipv6',
                api_name: '/api/test'
            };

            await writeLog(requestMeta, logData);

            expect(logModel.insertLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    req_ip_text: '192.168.1.50'
                })
            );
        });

        test('should use default IP when no IP is provided', async () => {
            const mockIdx = 222;
            logModel.insertLog.mockResolvedValue(mockIdx);

            const requestMeta = {
                headers: {}
            };

            const logData = {
                cate1: 'test',
                cate2: 'noip',
                api_name: '/api/test'
            };

            await writeLog(requestMeta, logData);

            expect(logModel.insertLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    req_ip_text: '0.0.0.0'
                })
            );
        });

        test('should apply default values for missing fields', async () => {
            const mockIdx = 333;
            logModel.insertLog.mockResolvedValue(mockIdx);

            const requestMeta = {
                headers: {}
            };

            const logData = {};

            await writeLog(requestMeta, logData);

            expect(logModel.insertLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    cate1: 'default',
                    cate2: 'default',
                    api_name: 'unknown',
                    req_status: 'Y',
                    result_code: '200'
                })
            );
        });

        test('should throw error when cate1 is empty string', async () => {
            const requestMeta = { headers: {} };
            const logData = {
                cate1: '',
                cate2: 'test',
                api_name: '/api/test'
            };

            await expect(writeLog(requestMeta, logData))
                .rejects
                .toThrow('cate1 is required and cannot be empty');

            expect(logModel.insertLog).not.toHaveBeenCalled();
        });

        test('should propagate error from model layer', async () => {
            const dbError = new Error('Database connection failed');
            logModel.insertLog.mockRejectedValue(dbError);

            const requestMeta = { headers: {} };
            const logData = {
                cate1: 'test',
                cate2: 'test',
                api_name: '/api/test'
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
            logModel.listLogs.mockResolvedValue(mockLogs);

            const result = await getRecentLogs();

            expect(result).toEqual(mockLogs);
            expect(logModel.listLogs).toHaveBeenCalledWith(20);
        });

        test('should cap limit at 1000', async () => {
            logModel.listLogs.mockResolvedValue([]);

            await getRecentLogs(9999);

            expect(logModel.listLogs).toHaveBeenCalledWith(1000);
        });

        test('should set minimum limit to 1', async () => {
            logModel.listLogs.mockResolvedValue([]);

            await getRecentLogs(0);

            expect(logModel.listLogs).toHaveBeenCalledWith(1);
        });
    });
});