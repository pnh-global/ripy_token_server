/**
 * apiKeyMiddleware.test.js
 *
 * API Key 인증 미들웨어 테스트
 * - Service Key 검증
 * - IP 제한 확인
 * - 사용 기록 업데이트
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { apiKeyMiddleware } from '../apiKeyMiddleware.js';
import { pool } from '../../config/db.js';
import * as ServiceKeysModel from '../../models/serviceKeys.model.js';
import crypto from 'crypto';

describe('API Key Middleware', () => {
    let testKeyHash;
    let testKeyIdx;
    let mockReq;
    let mockRes;
    let mockNext;

    beforeAll(async () => {
        // DB 연결 확인
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        console.log('apiKeyMiddleware.test.js - DB 연결 성공');
    });

    beforeEach(async () => {
        // 테스트용 Service Key 생성
        testKeyHash = crypto.createHash('sha256')
            .update(`test-api-key-${Date.now()}`)
            .digest('hex');

        const keyIv = crypto.randomBytes(12).toString('hex');

        const keyData = {
            req_ip_text: '192.168.1.100',
            req_server: 'TEST_API_MIDDLEWARE',
            key_hash: testKeyHash,
            key_ciphertext: 'encrypted_test_key',
            key_alg: 'aes-256-gcm',
            key_iv: keyIv,
            key_tag: 'test_tag',
            key_kms_id: '',
            key_last4: '1234',
            status: 'ACTIVE',
            scopes: ['read', 'write'],
            allow_cidrs: ['192.168.1.0/24', '10.0.0.0/8'],
            allow_hosts: ['localhost', 'test.example.com']
        };

        const result = await ServiceKeysModel.createServiceKey(keyData);
        testKeyIdx = result.idx;

        // Mock 객체 초기화
        mockReq = {
            headers: {},
            ip: '192.168.1.50',
            hostname: 'localhost',
            get: jest.fn((header) => {
                if (header === 'host') return 'localhost:4000';
                return mockReq.headers[header.toLowerCase()];
            })
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        mockNext = jest.fn();
    });

    afterAll(async () => {
        // 테스트 데이터 정리
        try {
            await pool.execute(
                'DELETE FROM service_keys WHERE req_server = ?',
                ['TEST_API_MIDDLEWARE']
            );
        } catch (error) {
            console.error('Cleanup error:', error);
        }

        await pool.end();
        console.log('apiKeyMiddleware.test.js - 정리 완료');
    });

    // ========================================
    // 유효한 API Key 테스트
    // ========================================
    describe('유효한 API Key', () => {
        test('올바른 API Key와 허용된 IP로 요청 시 통과해야 함', async () => {
            mockReq.headers['x-api-key'] = testKeyHash;
            mockReq.ip = '192.168.1.50'; // allow_cidrs에 포함됨

            await apiKeyMiddleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalledWith(); // 인자 없이 호출
            expect(mockRes.status).not.toHaveBeenCalled();
            expect(mockRes.json).not.toHaveBeenCalled();

            // req.serviceKey에 키 정보가 설정되어야 함
            expect(mockReq.serviceKey).toBeDefined();
            expect(mockReq.serviceKey.idx).toBe(testKeyIdx);
            expect(mockReq.serviceKey.status).toBe('ACTIVE');
        });

        test('10.0.0.0/8 범위의 IP도 허용해야 함', async () => {
            mockReq.headers['x-api-key'] = testKeyHash;
            mockReq.ip = '10.1.2.3';

            await apiKeyMiddleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.serviceKey).toBeDefined();
        });
    });

    // ========================================
    // 잘못된 API Key 테스트
    // ========================================
    describe('잘못된 API Key', () => {
        test('API Key 헤더가 없으면 401 에러를 반환해야 함', async () => {
            // x-api-key 헤더 없음
            await apiKeyMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: 'MISSING_API_KEY',
                    message: 'API Key가 필요합니다.'
                }
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        test('존재하지 않는 API Key로 요청 시 401 에러를 반환해야 함', async () => {
            mockReq.headers['x-api-key'] = 'invalid_key_hash_64_characters_long_hex_string_1234567890abcdef';

            await apiKeyMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: 'INVALID_API_KEY',
                    message: '유효하지 않은 API Key입니다.'
                }
            });
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    // ========================================
    // 만료된 키 테스트
    // ========================================
    describe('만료된 키', () => {
        test('REVOKED 상태의 키로 요청 시 401 에러를 반환해야 함', async () => {
            // 키 회수
            await ServiceKeysModel.revokeServiceKey(testKeyIdx);

            mockReq.headers['x-api-key'] = testKeyHash;
            mockReq.ip = '192.168.1.50';

            await apiKeyMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: 'INVALID_API_KEY',
                    message: '유효하지 않은 API Key입니다.'
                }
            });
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    // ========================================
    // IP 제한 테스트
    // ========================================
    describe('IP 제한', () => {
        test('허용되지 않은 IP에서 요청 시 403 에러를 반환해야 함', async () => {
            mockReq.headers['x-api-key'] = testKeyHash;
            mockReq.ip = '203.0.113.1'; // allow_cidrs에 없는 IP

            await apiKeyMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: 'IP_NOT_ALLOWED',
                    message: '허용되지 않은 IP 주소입니다.'
                }
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        test('allow_cidrs가 비어있으면 모든 IP 허용', async () => {
            // allow_cidrs를 빈 배열로 설정
            await pool.execute(
                'UPDATE service_keys SET allow_cidrs = ? WHERE idx = ?',
                [JSON.stringify([]), testKeyIdx]
            );

            mockReq.headers['x-api-key'] = testKeyHash;
            mockReq.ip = '203.0.113.1'; // 어떤 IP든 허용

            await apiKeyMiddleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.serviceKey).toBeDefined();
        });
    });

    // ========================================
    // 사용 기록 업데이트 테스트
    // ========================================
    describe('사용 기록 업데이트', () => {
        test('성공적인 인증 후 last_used_at이 업데이트되어야 함', async () => {
            mockReq.headers['x-api-key'] = testKeyHash;
            mockReq.ip = '192.168.1.50';

            await apiKeyMiddleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();

            // DB에서 키 정보 확인
            const key = await ServiceKeysModel.getServiceKeyById(testKeyIdx);
            expect(key.last_used_at).not.toBeNull();
            expect(key.last_ip_text).toBe('192.168.1.50');
        });
    });
});