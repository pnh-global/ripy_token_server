/**
 * log.model.js 테스트
 * r_log 테이블: 로그 기록 관리
 *
 * 테스트 항목:
 * 1. insertLog() - 로그 삽입
 * 2. listLogs() - 최근 로그 조회
 * 3. getLogById() - ID로 로그 조회
 * 4. getLogsByRequestId() - request_id로 로그 조회
 */

import * as logModel from '../log.model.js';
import { pool } from '../../config/db.js';

// 테스트 전후 DB 정리를 위한 헬퍼 함수
const cleanupTestData = async () => {
    try {
        // 테스트 데이터 삭제 (test_ 접두사 사용)
        await pool.execute(
            `DELETE FROM r_log
             WHERE req_ip_text LIKE '192.168.%'
                OR request_id LIKE 'test-%'`
        );
    } catch (error) {
        console.error('Error in cleanupTestData:', error);
    }
};

describe('log.model.js - 로그 관리 테스트', () => {

    // 각 테스트 전후로 DB 정리
    beforeEach(async () => {
        await cleanupTestData();
    });

    afterEach(async () => {
        await cleanupTestData();
    });

    // 모든 테스트 종료 후 완전 정리 및 DB 연결 종료
    afterAll(async () => {
        await cleanupTestData();
        await pool.end();
    });

    /**
     * 테스트 1: insertLog() - 로그 삽입
     */
    describe('insertLog()', () => {

        test('정상적으로 로그를 삽입할 수 있어야 함', async () => {
            // Given: 로그 데이터
            const logData = {
                cate1: 'sign',
                cate2: 'create',
                request_id: 'test-uuid-12345',
                service_key_id: 1,
                req_ip_text: '192.168.1.100',
                req_server: 'token-server-01',
                req_status: 'Y',
                api_name: '/api/sign/create',
                api_parameter: JSON.stringify({ amount: 100 }),
                result_code: '200',
                latency_ms: 150,
                error_code: null,
                error_message: null,
                content: 'Test log entry'
            };

            // When: 로그 삽입
            const insertId = await logModel.insertLog(logData);

            // Then: insertId가 반환되어야 함
            expect(insertId).toBeDefined();
            expect(typeof insertId).toBe('number');
            expect(insertId).toBeGreaterThan(0);
        });

        test('필수 필드(req_ip_text)가 없으면 에러가 발생해야 함', async () => {
            // Given: req_ip_text가 없는 데이터
            const invalidData = {
                cate1: 'test',
                cate2: 'error',
                request_id: 'test-001',
                req_status: 'N',
                api_name: '/api/test'
            };

            // When & Then: 에러 발생
            await expect(logModel.insertLog(invalidData))
                .rejects
                .toThrow('req_ip_text is required');
        });

        test('잘못된 IP 형식일 때 에러가 발생해야 함', async () => {
            // Given: 잘못된 IP 주소
            const invalidData = {
                cate1: 'test',
                cate2: 'invalid',
                request_id: 'test-002',
                req_ip_text: 'invalid-ip-address',
                req_status: 'N',
                api_name: '/api/test'
            };

            // When & Then: Invalid IP address 에러
            await expect(logModel.insertLog(invalidData))
                .rejects
                .toThrow('Invalid IP address');
        });

        test('선택 필드 없이도 로그를 삽입할 수 있어야 함', async () => {
            // Given: 최소 필수 필드만 있는 데이터
            const minimalData = {
                cate1: 'test',
                cate2: 'minimal',
                request_id: 'test-min-001',
                req_ip_text: '192.168.1.101',
                req_status: 'N',
                api_name: '/api/minimal'
            };

            // When: 로그 삽입
            const insertId = await logModel.insertLog(minimalData);

            // Then: 정상 삽입
            expect(insertId).toBeDefined();
            expect(insertId).toBeGreaterThan(0);
        });

    });

    /**
     * 테스트 2: listLogs() - 최근 로그 조회
     */
    describe('listLogs()', () => {

        test('최근 로그를 조회할 수 있어야 함', async () => {
            // Given: 로그 3개 삽입
            await logModel.insertLog({
                cate1: 'test',
                cate2: 'list',
                request_id: 'test-list-001',
                req_ip_text: '192.168.1.110',
                req_status: 'Y',
                api_name: '/api/test1'
            });
            await logModel.insertLog({
                cate1: 'test',
                cate2: 'list',
                request_id: 'test-list-002',
                req_ip_text: '192.168.1.111',
                req_status: 'Y',
                api_name: '/api/test2'
            });
            await logModel.insertLog({
                cate1: 'test',
                cate2: 'list',
                request_id: 'test-list-003',
                req_ip_text: '192.168.1.112',
                req_status: 'Y',
                api_name: '/api/test3'
            });

            // When: 최근 로그 조회 (limit 10)
            const logs = await logModel.listLogs(10);

            // Then: 최소 3개 이상 조회되어야 함
            expect(Array.isArray(logs)).toBe(true);
            expect(logs.length).toBeGreaterThanOrEqual(3);

            // 최신순 정렬 확인 (idx가 큰 순서)
            if (logs.length >= 2) {
                expect(logs[0].idx).toBeGreaterThan(logs[1].idx);
            }
        });

        test('limit 파라미터가 작동해야 함', async () => {
            // Given: 로그 5개 삽입
            for (let i = 0; i < 5; i++) {
                await logModel.insertLog({
                    cate1: 'test',
                    cate2: 'limit',
                    request_id: `test-limit-00${i}`,
                    req_ip_text: `192.168.1.${120 + i}`,
                    req_status: 'Y',
                    api_name: `/api/test${i}`
                });
            }

            // When: limit 2로 조회
            const logs = await logModel.listLogs(2);

            // Then: 최대 2개만 조회
            expect(logs.length).toBeLessThanOrEqual(2);
        });

    });

    /**
     * 테스트 3: getLogById() - ID로 로그 조회
     */
    describe('getLogById()', () => {

        test('ID로 로그를 조회할 수 있어야 함', async () => {
            // Given: 로그 삽입
            const logData = {
                cate1: 'contract',
                cate2: 'view',
                request_id: 'test-getbyid-001',
                req_ip_text: '192.168.1.130',
                req_status: 'Y',
                api_name: '/api/contract/123',
                result_code: '200'
            };
            const insertId = await logModel.insertLog(logData);

            // When: ID로 조회
            const log = await logModel.getLogById(insertId);

            // Then: 로그가 조회되어야 함
            expect(log).toBeDefined();
            expect(log.idx).toBe(insertId);
            expect(log.req_ip_text).toBe('192.168.1.130');
            expect(log.cate1).toBe('contract');
            expect(log.api_name).toBe('/api/contract/123');
        });

        test('존재하지 않는 ID를 조회하면 null을 반환해야 함', async () => {
            // Given: 존재하지 않는 ID
            const nonExistentId = 999999999;

            // When: 조회
            const log = await logModel.getLogById(nonExistentId);

            // Then: null 반환
            expect(log).toBeNull();
        });

    });

    /**
     * 테스트 4: getLogsByRequestId() - request_id로 로그 조회
     */
    describe('getLogsByRequestId()', () => {

        test('같은 request_id를 가진 로그들을 모두 조회할 수 있어야 함', async () => {
            // Given: 같은 request_id로 로그 3개 삽입
            const requestId = 'test-request-abc123';

            await logModel.insertLog({
                cate1: 'sign',
                cate2: 'create',
                request_id: requestId,
                req_ip_text: '192.168.1.140',
                req_status: 'Y',
                api_name: '/api/sign/create',
                result_code: '200'
            });

            await logModel.insertLog({
                cate1: 'sign',
                cate2: 'finalize',
                request_id: requestId,
                req_ip_text: '192.168.1.140',
                req_status: 'Y',
                api_name: '/api/sign/finalize',
                result_code: '200'
            });

            await logModel.insertLog({
                cate1: 'solana',
                cate2: 'send',
                request_id: requestId,
                req_ip_text: '192.168.1.140',
                req_status: 'Y',
                api_name: '/api/solana/send',
                result_code: '200'
            });

            // When: request_id로 조회
            const logs = await logModel.getLogsByRequestId(requestId);

            // Then: 3개의 로그가 조회되어야 함
            expect(Array.isArray(logs)).toBe(true);
            expect(logs.length).toBe(3);

            // 모든 로그가 같은 request_id를 가져야 함
            logs.forEach(log => {
                expect(log.request_id).toBe(requestId);
            });

            // idx 오름차순 정렬 확인
            if (logs.length >= 2) {
                expect(logs[0].idx).toBeLessThan(logs[1].idx);
            }
        });

        test('존재하지 않는 request_id를 조회하면 빈 배열을 반환해야 함', async () => {
            // Given: 존재하지 않는 request_id
            const nonExistentRequestId = 'test-nonexistent-xyz789';

            // When: 조회
            const logs = await logModel.getLogsByRequestId(nonExistentRequestId);

            // Then: 빈 배열 반환
            expect(Array.isArray(logs)).toBe(true);
            expect(logs.length).toBe(0);
        });

        test('다른 request_id의 로그는 조회되지 않아야 함', async () => {
            // Given: 서로 다른 request_id로 로그 삽입
            const requestId1 = 'test-request-111';
            const requestId2 = 'test-request-222';

            await logModel.insertLog({
                cate1: 'test',
                cate2: 'multi',
                request_id: requestId1,
                req_ip_text: '192.168.1.150',
                req_status: 'Y',
                api_name: '/api/test1'
            });

            await logModel.insertLog({
                cate1: 'test',
                cate2: 'multi',
                request_id: requestId2,
                req_ip_text: '192.168.1.151',
                req_status: 'Y',
                api_name: '/api/test2'
            });

            // When: requestId1으로 조회
            const logs = await logModel.getLogsByRequestId(requestId1);

            // Then: requestId1의 로그만 조회
            expect(logs.length).toBe(1);
            expect(logs[0].request_id).toBe(requestId1);
            expect(logs[0].api_name).toBe('/api/test1');
        });

    });

    /**
     * 테스트 5: 에러 처리 통합 테스트
     */
    describe('에러 처리 테스트', () => {

        test('insertLog - 잘못된 IP 형식', async () => {
            await expect(logModel.insertLog({
                cate1: 'error',
                cate2: 'invalid_ip',
                request_id: 'test-err-001',
                req_ip_text: 'not-an-ip',
                req_status: 'N',
                api_name: '/api/error'
            })).rejects.toThrow('Invalid IP address');
        });

        test('insertLog - 필수 필드 누락 (빈 객체)', async () => {
            await expect(logModel.insertLog({}))
                .rejects
                .toThrow('cate1 is required');
        });

        test('insertLog - cate1 필드 누락', async () => {
            await expect(logModel.insertLog({
                cate2: 'test',
                request_id: 'test-err-002',
                req_ip_text: '192.168.1.1',
                req_status: 'Y',
                api_name: '/api/test'
            }))
                .rejects
                .toThrow('cate1 is required');
        });

        test('insertLog - cate2 필드 누락', async () => {
            await expect(logModel.insertLog({
                cate1: 'test',
                request_id: 'test-err-003',
                req_ip_text: '192.168.1.1',
                req_status: 'Y',
                api_name: '/api/test'
            }))
                .rejects
                .toThrow('cate2 is required');
        });

        test('insertLog - request_id 필드 누락', async () => {
            await expect(logModel.insertLog({
                cate1: 'test',
                cate2: 'test',
                req_ip_text: '192.168.1.1',
                req_status: 'Y',
                api_name: '/api/test'
            }))
                .rejects
                .toThrow('request_id is required');
        });

        test('insertLog - req_ip_text 필드 누락', async () => {
            await expect(logModel.insertLog({
                cate1: 'test',
                cate2: 'test',
                request_id: 'test-err-004',
                req_status: 'Y',
                api_name: '/api/test'
            }))
                .rejects
                .toThrow('req_ip_text is required');
        });

        test('insertLog - req_status 필드 누락', async () => {
            await expect(logModel.insertLog({
                cate1: 'test',
                cate2: 'test',
                request_id: 'test-err-005',
                req_ip_text: '192.168.1.1',
                api_name: '/api/test'
            }))
                .rejects
                .toThrow('req_status is required');
        });

        test('insertLog - api_name 필드 누락', async () => {
            await expect(logModel.insertLog({
                cate1: 'test',
                cate2: 'test',
                request_id: 'test-err-006',
                req_ip_text: '192.168.1.1',
                req_status: 'Y'
            }))
                .rejects
                .toThrow('api_name is required');
        });

        test('insertLog - req_status 잘못된 값', async () => {
            await expect(logModel.insertLog({
                cate1: 'test',
                cate2: 'test',
                request_id: 'test-err-007',
                req_ip_text: '192.168.1.1',
                req_status: 'INVALID',
                api_name: '/api/test'
            }))
                .rejects
                .toThrow('req_status must be either "Y" or "N"');
        });

    });

});