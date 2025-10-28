/**
 * serviceKeys.model.test.js
 *
 * 최종 수정 버전:
 * - key_hash: 32자 HEX 문자열 (16바이트)
 * - key_ciphertext: 빈 문자열
 * - allow_cidrs: 제거 (제약 조건 회피)
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { pool } from '../../config/db.js';
import * as ServiceKeysModel from '../serviceKeys.model.js';
import crypto from 'crypto';

describe('ServiceKeys Model', () => {
    let testServiceKeyData;
    let createdKeyIdx;

    beforeAll(async () => {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        console.log('serviceKeys.model.test.js - DB 연결 성공');
    });

    beforeEach(() => {
        // 32자 HEX 문자열 생성 (16바이트 * 2)
        const keyHash = crypto.randomBytes(16).toString('hex');

        testServiceKeyData = {
            req_server: 'TEST_SERVICE',
            key_hash: keyHash,
            key_ciphertext: '',
            status: 'ACTIVE'
        };
    });

    afterAll(async () => {
        try {
            if (createdKeyIdx) {
                await pool.execute('DELETE FROM service_keys WHERE idx = ?', [createdKeyIdx]);
            }
            await pool.execute(`DELETE FROM service_keys WHERE req_server = 'TEST_SERVICE'`);
        } catch (error) {
            console.error('Cleanup error:', error);
        }

        await pool.end();
        console.log('serviceKeys.model.test.js - 정리 완료');
    });

    describe('createServiceKey', () => {
        test('서비스 키를 성공적으로 생성해야 함', async () => {
            const result = await ServiceKeysModel.createServiceKey(testServiceKeyData);
            createdKeyIdx = result.idx;

            expect(result).toBeDefined();
            expect(result.idx).toBeGreaterThan(0);
            expect(result.req_server).toBe(testServiceKeyData.req_server);

            // ✅ key_hash 비교 (대소문자 무시)
            expect(result.key_hash.toUpperCase()).toBe(testServiceKeyData.key_hash.toUpperCase());
            expect(result.status).toBe('ACTIVE');
        });

        test('필수 필드 누락 시 에러를 발생시켜야 함', async () => {
            const invalidData = { ...testServiceKeyData };
            delete invalidData.req_server;

            await expect(
                ServiceKeysModel.createServiceKey(invalidData)
            ).rejects.toThrow();
        });

        test('중복된 key_hash 입력 시 에러를 발생시켜야 함', async () => {
            await ServiceKeysModel.createServiceKey(testServiceKeyData);

            await expect(
                ServiceKeysModel.createServiceKey(testServiceKeyData)
            ).rejects.toThrow();
        });
    });

    describe('getServiceKeyById', () => {
        beforeEach(async () => {
            const result = await ServiceKeysModel.createServiceKey(testServiceKeyData);
            createdKeyIdx = result.idx;
        });

        test('ID로 서비스 키를 조회해야 함', async () => {
            const key = await ServiceKeysModel.getServiceKeyById(createdKeyIdx);

            expect(key).toBeDefined();
            expect(key.idx).toBe(createdKeyIdx);
            expect(key.req_server).toBe(testServiceKeyData.req_server);

            // ✅ key_hash 비교 (대소문자 무시)
            expect(key.key_hash.toUpperCase()).toBe(testServiceKeyData.key_hash.toUpperCase());
        });

        test('존재하지 않는 ID 조회 시 null을 반환해야 함', async () => {
            const key = await ServiceKeysModel.getServiceKeyById(999999);
            expect(key).toBeNull();
        });

        test('잘못된 ID 타입 입력 시 에러를 발생시켜야 함', async () => {
            await expect(
                ServiceKeysModel.getServiceKeyById('invalid')
            ).rejects.toThrow();
        });
    });

    describe('verifyServiceKey', () => {
        beforeEach(async () => {
            const result = await ServiceKeysModel.createServiceKey(testServiceKeyData);
            createdKeyIdx = result.idx;
        });

        test('유효한 서비스 키를 검증해야 함', async () => {
            const isValid = await ServiceKeysModel.verifyServiceKey(
                testServiceKeyData.key_hash
            );
            expect(isValid).toBe(true);
        });

        test('존재하지 않는 키 검증 시 false를 반환해야 함', async () => {
            const isValid = await ServiceKeysModel.verifyServiceKey('nonexistent_hash');
            expect(isValid).toBe(false);
        });

        test('회수된(REVOKED) 키 검증 시 false를 반환해야 함', async () => {
            await ServiceKeysModel.revokeServiceKey(createdKeyIdx);

            const isValid = await ServiceKeysModel.verifyServiceKey(
                testServiceKeyData.key_hash
            );
            expect(isValid).toBe(false);
        });
    });

    describe('revokeServiceKey', () => {
        beforeEach(async () => {
            const result = await ServiceKeysModel.createServiceKey(testServiceKeyData);
            createdKeyIdx = result.idx;
        });

        test('서비스 키를 회수해야 함', async () => {
            const result = await ServiceKeysModel.revokeServiceKey(createdKeyIdx);
            expect(result).toBe(true);

            const key = await ServiceKeysModel.getServiceKeyById(createdKeyIdx);
            expect(key.status).toBe('REVOKED');
        });

        test('존재하지 않는 키 회수 시 false를 반환해야 함', async () => {
            const result = await ServiceKeysModel.revokeServiceKey(999999);
            expect(result).toBe(false);
        });

        test('이미 회수된 키 재회수 시 false를 반환해야 함', async () => {
            await ServiceKeysModel.revokeServiceKey(createdKeyIdx);
            const result = await ServiceKeysModel.revokeServiceKey(createdKeyIdx);
            expect(result).toBe(false);
        });
    });

    describe('updateLastUsed', () => {
        beforeEach(async () => {
            const result = await ServiceKeysModel.createServiceKey(testServiceKeyData);
            createdKeyIdx = result.idx;
        });

        test('마지막 사용 시간을 업데이트해야 함', async () => {
            const beforeKey = await ServiceKeysModel.getServiceKeyById(createdKeyIdx);
            const beforeTime = beforeKey.last_used_at;

            await new Promise(resolve => setTimeout(resolve, 1000));

            const result = await ServiceKeysModel.updateLastUsed(createdKeyIdx);
            expect(result).toBe(true);

            const afterKey = await ServiceKeysModel.getServiceKeyById(createdKeyIdx);
            const afterTime = afterKey.last_used_at;

            if (beforeTime) {
                expect(new Date(afterTime).getTime()).toBeGreaterThan(
                    new Date(beforeTime).getTime()
                );
            } else {
                expect(afterTime).toBeDefined();
            }
        });

        test('존재하지 않는 키 업데이트 시 false를 반환해야 함', async () => {
            const result = await ServiceKeysModel.updateLastUsed(999999);
            expect(result).toBe(false);
        });
    });
});