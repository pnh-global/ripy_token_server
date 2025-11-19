/**
 * serviceKeys.model.test.js
 *
 * Service Keys Model 테스트
 * - 실제 DB 스키마에 맞춘 전체 필드 테스트
 * - IP 주소, 암호화 메타데이터, JSON 필드 포함
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { pool } from '../../config/db.js';
import * as ServiceKeysModel from '../serviceKeys.model.js';
import crypto from 'crypto';

describe('ServiceKeys Model', () => {
    let testServiceKeyData;
    let createdKeyIdx;

    beforeAll(async () => {
        // DB 연결 확인
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        console.log('serviceKeys.model.test.js - DB 연결 성공');
    });

    beforeEach(() => {
        // SHA-256 해시 생성 (64자 HEX 문자열)
        const keyHash = crypto.createHash('sha256')
            .update(`test-key-${Date.now()}`)
            .digest('hex');

        // AES-256-GCM용 IV 생성 (12바이트 = 24자 HEX)
        const keyIv = crypto.randomBytes(12).toString('hex');

        // 테스트용 Service Key 데이터
        testServiceKeyData = {
            req_ip_text: '192.168.1.100',
            req_server: 'TEST_WEB_SERVER',
            key_hash: keyHash,
            key_ciphertext: 'encrypted_test_key_base64_string',
            key_alg: 'aes-256-gcm',
            key_iv: keyIv,
            key_tag: 'test_auth_tag_hex_string',
            key_kms_id: '',
            key_last4: '5678',
            status: 'ACTIVE',
            scopes: ['read', 'write'],
            allow_cidrs: ['192.168.1.0/24'],
            allow_hosts: ['web-server.example.com']
        };
    });

    afterAll(async () => {
        // 테스트 데이터 정리
        try {
            if (createdKeyIdx) {
                await pool.execute('DELETE FROM service_keys WHERE idx = ?', [createdKeyIdx]);
            }
            await pool.execute(`DELETE FROM service_keys WHERE req_server = 'TEST_WEB_SERVER'`);
        } catch (error) {
            console.error('Cleanup error:', error);
        }

        await pool.end();
        console.log('serviceKeys.model.test.js - 정리 완료');
    });

    // ========================================
    // createServiceKey 테스트
    // ========================================
    describe('createServiceKey', () => {
        test('서비스 키를 성공적으로 생성해야 함', async () => {
            const result = await ServiceKeysModel.createServiceKey(testServiceKeyData);
            createdKeyIdx = result.idx;

            expect(result).toBeDefined();
            expect(result.idx).toBeGreaterThan(0);

            // 기본 필드 검증
            expect(result.req_ip_text).toBe(testServiceKeyData.req_ip_text);
            expect(result.req_server).toBe(testServiceKeyData.req_server);
            expect(result.key_hash.toUpperCase()).toBe(testServiceKeyData.key_hash.toUpperCase());
            expect(result.key_ciphertext).toBe(testServiceKeyData.key_ciphertext);

            // 암호화 메타데이터 검증
            expect(result.key_alg).toBe(testServiceKeyData.key_alg);
            expect(result.key_iv).toBe(testServiceKeyData.key_iv);
            expect(result.key_tag).toBe(testServiceKeyData.key_tag);
            expect(result.key_last4).toBe(testServiceKeyData.key_last4);

            // 상태 검증
            expect(result.status).toBe('ACTIVE');

            // JSON 필드 검증
            expect(Array.isArray(result.scopes)).toBe(true);
            expect(result.scopes).toContain('read');
            expect(result.scopes).toContain('write');

            expect(Array.isArray(result.allow_cidrs)).toBe(true);
            expect(result.allow_cidrs).toContain('192.168.1.0/24');

            expect(Array.isArray(result.allow_hosts)).toBe(true);
            expect(result.allow_hosts).toContain('web-server.example.com');
        });

        test('필수 필드 누락 시 에러를 발생시켜야 함 - req_ip_text', async () => {
            const invalidData = { ...testServiceKeyData };
            delete invalidData.req_ip_text;

            await expect(
                ServiceKeysModel.createServiceKey(invalidData)
            ).rejects.toThrow('req_ip_text는 필수 항목입니다.');
        });

        test('필수 필드 누락 시 에러를 발생시켜야 함 - req_server', async () => {
            const invalidData = { ...testServiceKeyData };
            delete invalidData.req_server;

            await expect(
                ServiceKeysModel.createServiceKey(invalidData)
            ).rejects.toThrow('req_server는 필수 항목입니다.');
        });

        test('필수 필드 누락 시 에러를 발생시켜야 함 - key_hash', async () => {
            const invalidData = { ...testServiceKeyData };
            delete invalidData.key_hash;

            await expect(
                ServiceKeysModel.createServiceKey(invalidData)
            ).rejects.toThrow('key_hash는 필수 항목입니다.');
        });

        test('필수 필드 누락 시 에러를 발생시켜야 함 - key_iv', async () => {
            const invalidData = { ...testServiceKeyData };
            delete invalidData.key_iv;

            await expect(
                ServiceKeysModel.createServiceKey(invalidData)
            ).rejects.toThrow('key_iv는 필수 항목입니다.');
        });

        test('필수 필드 누락 시 에러를 발생시켜야 함 - key_last4', async () => {
            const invalidData = { ...testServiceKeyData };
            delete invalidData.key_last4;

            await expect(
                ServiceKeysModel.createServiceKey(invalidData)
            ).rejects.toThrow('key_last4는 필수 항목입니다.');
        });

        test('중복된 key_hash 입력 시 에러를 발생시켜야 함', async () => {
            await ServiceKeysModel.createServiceKey(testServiceKeyData);

            await expect(
                ServiceKeysModel.createServiceKey(testServiceKeyData)
            ).rejects.toThrow('이미 존재하는 key_hash입니다.');
        });

        test('기본값 테스트 - scopes', async () => {
            const minimalData = {
                req_ip_text: '192.168.1.101',
                req_server: 'TEST_SERVER_2',
                key_hash: crypto.createHash('sha256').update('test-2').digest('hex'),
                key_ciphertext: 'encrypted_key_2',
                key_iv: crypto.randomBytes(12).toString('hex'),
                key_last4: '9999'
            };

            const result = await ServiceKeysModel.createServiceKey(minimalData);

            expect(result.scopes).toEqual(['read']); // 기본값
            expect(result.key_alg).toBe('aes-256-gcm'); // 기본값
            expect(result.status).toBe('ACTIVE'); // 기본값

            // 정리
            await pool.execute('DELETE FROM service_keys WHERE idx = ?', [result.idx]);
        });
    });

    // ========================================
    // getServiceKeyById 테스트
    // ========================================
    describe('getServiceKeyById', () => {
        beforeEach(async () => {
            const result = await ServiceKeysModel.createServiceKey(testServiceKeyData);
            createdKeyIdx = result.idx;
        });

        test('ID로 서비스 키를 조회해야 함', async () => {
            const key = await ServiceKeysModel.getServiceKeyById(createdKeyIdx);

            expect(key).toBeDefined();
            expect(key.idx).toBe(createdKeyIdx);

            // 기본 필드
            expect(key.req_ip_text).toBe(testServiceKeyData.req_ip_text);
            expect(key.req_server).toBe(testServiceKeyData.req_server);
            expect(key.key_hash.toUpperCase()).toBe(testServiceKeyData.key_hash.toUpperCase());

            // 암호화 메타데이터
            expect(key.key_alg).toBe(testServiceKeyData.key_alg);
            expect(key.key_iv).toBe(testServiceKeyData.key_iv);
            expect(key.key_last4).toBe(testServiceKeyData.key_last4);

            // JSON 필드 타입 검증
            expect(Array.isArray(key.scopes)).toBe(true);
            expect(Array.isArray(key.allow_cidrs)).toBe(true);
            expect(Array.isArray(key.allow_hosts)).toBe(true);
        });

        test('존재하지 않는 ID 조회 시 null을 반환해야 함', async () => {
            const key = await ServiceKeysModel.getServiceKeyById(999999);
            expect(key).toBeNull();
        });

        test('잘못된 ID 타입 입력 시 에러를 발생시켜야 함', async () => {
            await expect(
                ServiceKeysModel.getServiceKeyById('invalid')
            ).rejects.toThrow('유효하지 않은 ID입니다.');
        });

        test('음수 ID 입력 시 에러를 발생시켜야 함', async () => {
            await expect(
                ServiceKeysModel.getServiceKeyById(-1)
            ).rejects.toThrow('유효하지 않은 ID입니다.');
        });
    });

    // ========================================
    // verifyServiceKey 테스트
    // ========================================
    describe('verifyServiceKey', () => {
        beforeEach(async () => {
            const result = await ServiceKeysModel.createServiceKey(testServiceKeyData);
            createdKeyIdx = result.idx;
        });

        test('유효한 서비스 키를 검증해야 함 (키 정보 반환)', async () => {
            const keyInfo = await ServiceKeysModel.verifyServiceKey(
                testServiceKeyData.key_hash
            );

            expect(keyInfo).toBeDefined();
            expect(keyInfo).not.toBeNull();
            expect(keyInfo.idx).toBe(createdKeyIdx);
            expect(keyInfo.status).toBe('ACTIVE');

            // JSON 필드 검증
            expect(Array.isArray(keyInfo.scopes)).toBe(true);
            expect(Array.isArray(keyInfo.allow_cidrs)).toBe(true);
            expect(Array.isArray(keyInfo.allow_hosts)).toBe(true);
        });

        test('존재하지 않는 키 검증 시 null을 반환해야 함', async () => {
            const keyInfo = await ServiceKeysModel.verifyServiceKey('nonexistent_hash_64_characters_long_hex_string_1234567890ab');
            expect(keyInfo).toBeNull();
        });

        test('회수된(REVOKED) 키 검증 시 null을 반환해야 함', async () => {
            await ServiceKeysModel.revokeServiceKey(createdKeyIdx);

            const keyInfo = await ServiceKeysModel.verifyServiceKey(
                testServiceKeyData.key_hash
            );
            expect(keyInfo).toBeNull();
        });

        test('INACTIVE 상태 키 검증 시 null을 반환해야 함', async () => {
            // 상태를 INACTIVE로 변경
            await pool.execute(
                'UPDATE service_keys SET status = ? WHERE idx = ?',
                ['INACTIVE', createdKeyIdx]
            );

            const keyInfo = await ServiceKeysModel.verifyServiceKey(
                testServiceKeyData.key_hash
            );
            expect(keyInfo).toBeNull();
        });
    });

    // ========================================
    // revokeServiceKey 테스트
    // ========================================
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

    // ========================================
    // updateLastUsed 테스트
    // ========================================
    describe('updateLastUsed', () => {
        beforeEach(async () => {
            const result = await ServiceKeysModel.createServiceKey(testServiceKeyData);
            createdKeyIdx = result.idx;
        });

        test('마지막 사용 시간을 업데이트해야 함', async () => {
            const beforeKey = await ServiceKeysModel.getServiceKeyById(createdKeyIdx);
            const beforeTime = beforeKey.last_used_at;

            // 1초 대기
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

        test('마지막 사용 IP 및 서버 정보를 업데이트해야 함', async () => {
            const testIp = '192.168.1.200';
            const testServer = 'api-server-01';

            const result = await ServiceKeysModel.updateLastUsed(
                createdKeyIdx,
                testIp,
                testServer
            );
            expect(result).toBe(true);

            const key = await ServiceKeysModel.getServiceKeyById(createdKeyIdx);
            expect(key.last_ip_text).toBe(testIp);
            expect(key.last_server).toBe(testServer);
        });

        test('존재하지 않는 키 업데이트 시 false를 반환해야 함', async () => {
            const result = await ServiceKeysModel.updateLastUsed(999999);
            expect(result).toBe(false);
        });
    });

    // ========================================
    // listServiceKeys 테스트
    // ========================================
    describe('listServiceKeys', () => {
        let testKeys = [];

        beforeEach(async () => {
            // 테스트용 키 3개 생성
            for (let i = 0; i < 3; i++) {
                const keyData = {
                    req_ip_text: `192.168.1.${100 + i}`,
                    req_server: 'TEST_WEB_SERVER',
                    key_hash: crypto.createHash('sha256').update(`test-${i}-${Date.now()}`).digest('hex'),
                    key_ciphertext: `encrypted_key_${i}`,
                    key_iv: crypto.randomBytes(12).toString('hex'),
                    key_last4: `000${i}`,
                    status: i === 2 ? 'REVOKED' : 'ACTIVE'
                };

                const result = await ServiceKeysModel.createServiceKey(keyData);
                testKeys.push(result.idx);
            }
        });

        afterEach(async () => {
            // 테스트 키 정리
            for (const idx of testKeys) {
                await pool.execute('DELETE FROM service_keys WHERE idx = ?', [idx]);
            }
            testKeys = [];
        });

        test('모든 서비스 키 목록을 조회해야 함', async () => {
            const keys = await ServiceKeysModel.listServiceKeys();

            expect(Array.isArray(keys)).toBe(true);
            expect(keys.length).toBeGreaterThanOrEqual(3);
        });

        test('상태 필터로 조회해야 함 - ACTIVE', async () => {
            const keys = await ServiceKeysModel.listServiceKeys({ status: 'ACTIVE' });

            expect(Array.isArray(keys)).toBe(true);
            keys.forEach(key => {
                expect(key.status).toBe('ACTIVE');
            });
        });

        test('상태 필터로 조회해야 함 - REVOKED', async () => {
            const keys = await ServiceKeysModel.listServiceKeys({ status: 'REVOKED' });

            expect(Array.isArray(keys)).toBe(true);
            keys.forEach(key => {
                expect(key.status).toBe('REVOKED');
            });
        });

        test('서버명 필터로 조회해야 함', async () => {
            const keys = await ServiceKeysModel.listServiceKeys({
                req_server: 'TEST_WEB'
            });

            expect(Array.isArray(keys)).toBe(true);
            expect(keys.length).toBeGreaterThanOrEqual(3);

            keys.forEach(key => {
                expect(key.req_server).toContain('TEST_WEB');
            });
        });

        test('페이징 처리를 해야 함', async () => {
            const page1 = await ServiceKeysModel.listServiceKeys({
                limit: 2,
                offset: 0
            });

            const page2 = await ServiceKeysModel.listServiceKeys({
                limit: 2,
                offset: 2
            });

            expect(page1.length).toBeLessThanOrEqual(2);
            expect(page2.length).toBeLessThanOrEqual(2);

            // 페이지가 다르면 결과도 달라야 함
            if (page1.length > 0 && page2.length > 0) {
                expect(page1[0].idx).not.toBe(page2[0].idx);
            }
        });

        test('JSON 필드가 배열로 파싱되어야 함', async () => {
            const keys = await ServiceKeysModel.listServiceKeys({ limit: 1 });

            if (keys.length > 0) {
                expect(Array.isArray(keys[0].scopes)).toBe(true);
                expect(Array.isArray(keys[0].allow_cidrs)).toBe(true);
                expect(Array.isArray(keys[0].allow_hosts)).toBe(true);
            }
        });
    });
});