/**
 * log.service.test.js
 * - log 서비스 계층의 비즈니스 로직 테스트
 * - writeLog(), getRecentLogs() 함수 검증
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { pool } from '../../config/db.js';

// 실제 서비스 import
import { writeLog, getRecentLogs } from '../log.service.js';

describe('Log Service', () => {

    // 테스트 후 삽입된 데이터 정리
    let insertedIds = [];

    afterEach(async () => {
        // 테스트에서 생성된 로그 삭제
        if (insertedIds.length > 0) {
            try {
                const placeholders = insertedIds.map(() => '?').join(',');
                await pool.execute(
                    `DELETE FROM r_log WHERE idx IN (${placeholders})`,
                    insertedIds
                );
                insertedIds = [];
            } catch (error) {
                console.error('Clean up error:', error);
            }
        }
    });

    /**
     * 테스트 1: writeLog() - 로그 작성 서비스
     */
    describe('writeLog()', () => {

        test('정상적인 요청으로 로그를 작성할 수 있어야 함', async () => {
            // Given: requestMeta와 logData 준비
            const requestMeta = {
                headers: {
                    'x-forwarded-for': '192.168.1.100',
                    'host': 'localhost:4000'
                },
                ip: '::ffff:192.168.1.100'
            };

            const logData = {
                cate1: 'test',
                cate2: 'service',
                service_key_id: 1,
                api_name: '/api/test',
                result_code: '200'
            };

            // When: writeLog 호출
            const result = await writeLog(requestMeta, logData);
            insertedIds.push(result.idx);

            // Then: 결과 검증
            expect(result).toHaveProperty('idx');
            expect(typeof result.idx).toBe('number');
            expect(result).toHaveProperty('request_id');
            expect(typeof result.request_id).toBe('string');

            // DB에서 실제로 저장되었는지 확인
            const [rows] = await pool.execute(
                'SELECT * FROM r_log WHERE idx = ?',
                [result.idx]
            );

            expect(rows).toHaveLength(1);
            expect(rows[0].cate1).toBe('test');
            expect(rows[0].cate2).toBe('service');
            expect(rows[0].req_ip_text).toBe('192.168.1.100');
            expect(rows[0].req_server).toBe('localhost:4000');
            expect(rows[0].api_name).toBe('/api/test');
            expect(rows[0].result_code).toBe('200');
            expect(rows[0].req_status).toBe('Y');
        });

        test('X-Forwarded-For 헤더가 없을 때 req.ip를 사용해야 함', async () => {
            // Given: X-Forwarded-For 없는 requestMeta
            const requestMeta = {
                headers: { host: 'localhost:4000' },
                ip: '203.0.113.45'
            };

            const logData = {
                cate1: 'test',
                cate2: 'fallback',
                api_name: '/api/fallback'
            };

            // When
            const result = await writeLog(requestMeta, logData);
            insertedIds.push(result.idx);

            // Then: req.ip가 사용되었는지 확인
            const [rows] = await pool.execute(
                'SELECT * FROM r_log WHERE idx = ?',
                [result.idx]
            );

            expect(rows[0].req_ip_text).toBe('203.0.113.45');
        });

        test('IPv6 주소에서 ::ffff: 접두사를 제거해야 함', async () => {
            // Given: IPv4-mapped IPv6 주소
            const requestMeta = {
                headers: {},
                ip: '::ffff:192.168.1.200'
            };

            const logData = {
                cate1: 'test',
                cate2: 'ipv6',
                api_name: '/api/ipv6test'
            };

            // When
            const result = await writeLog(requestMeta, logData);
            insertedIds.push(result.idx);

            // Then: ::ffff:가 제거된 IP
            const [rows] = await pool.execute(
                'SELECT * FROM r_log WHERE idx = ?',
                [result.idx]
            );

            expect(rows[0].req_ip_text).toBe('192.168.1.200');
        });

        test('최소한의 필수 필드만 있어도 로그를 작성할 수 있어야 함', async () => {
            // Given: 최소한의 필수 필드만 제공
            const requestMeta = {
                headers: {},
                ip: '127.0.0.1'
            };

            const logData = {
                cate1: 'test',
                cate2: 'minimal',
                api_name: '/api/minimal'
            };

            // When
            const result = await writeLog(requestMeta, logData);
            insertedIds.push(result.idx);

            // Then: 기본값이 적용되어야 함
            const [rows] = await pool.execute(
                'SELECT * FROM r_log WHERE idx = ?',
                [result.idx]
            );

            expect(rows[0].cate1).toBe('test');
            expect(rows[0].cate2).toBe('minimal');
            expect(rows[0].api_name).toBe('/api/minimal');
            expect(rows[0].req_status).toBe('Y');
            expect(rows[0].result_code).toBe('200');
            expect(rows[0].req_ip_text).toBe('127.0.0.1');
        });

        test('X-Forwarded-For가 여러 IP를 포함할 때 첫 번째 IP를 사용해야 함', async () => {
            // Given: 프록시 체인을 거친 요청
            const requestMeta = {
                headers: {
                    'x-forwarded-for': '203.0.113.1, 192.168.1.1, 10.0.0.1'
                },
                ip: '10.0.0.1'
            };

            const logData = {
                cate1: 'test',
                cate2: 'proxy',
                api_name: '/api/proxy-test'
            };

            // When
            const result = await writeLog(requestMeta, logData);
            insertedIds.push(result.idx);

            // Then: 첫 번째 IP만 사용
            const [rows] = await pool.execute(
                'SELECT * FROM r_log WHERE idx = ?',
                [result.idx]
            );

            expect(rows[0].req_ip_text).toBe('203.0.113.1');
        });

        test('request_id가 UUID 형식이어야 함', async () => {
            // Given
            const requestMeta = {
                headers: {},
                ip: '127.0.0.1'
            };

            const logData = {
                cate1: 'test',
                cate2: 'uuid',
                api_name: '/api/uuid-test'
            };

            // When
            const result = await writeLog(requestMeta, logData);
            insertedIds.push(result.idx);

            // Then: UUID v4 형식 검증
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(result.request_id).toMatch(uuidRegex);
        });

        test('잘못된 IP 형식이 들어와도 처리할 수 있어야 함', async () => {
            // Given: 잘못된 형식의 IP
            const requestMeta = {
                headers: {},
                ip: '' // 빈 문자열
            };

            const logData = {
                cate1: 'test',
                cate2: 'invalid-ip',
                api_name: '/api/test'
            };

            // When
            const result = await writeLog(requestMeta, logData);
            insertedIds.push(result.idx);

            // Then: 기본값 0.0.0.0이 사용되어야 함
            const [rows] = await pool.execute(
                'SELECT * FROM r_log WHERE idx = ?',
                [result.idx]
            );

            expect(rows[0].req_ip_text).toBe('0.0.0.0');
        });

        test('필수 필드가 누락되면 에러를 throw해야 함', async () => {
            // Given: 필수 필드 누락
            const requestMeta = {
                headers: {},
                ip: '127.0.0.1'
            };

            const logData = {
                cate1: 'test',
                // cate2 누락
                api_name: '/api/test'
            };

            // When & Then: 에러 발생
            await expect(writeLog(requestMeta, logData)).rejects.toThrow('cate2 is required');
        });

    });

    /**
     * 테스트 2: getRecentLogs() - 최근 로그 조회 서비스
     */
    describe('getRecentLogs()', () => {

        // 테스트용 데이터 생성
        beforeEach(async () => {
            // 테스트용 로그 3개 삽입
            for (let i = 0; i < 3; i++) {
                const requestMeta = {
                    headers: {},
                    ip: '127.0.0.1'
                };
                const logData = {
                    cate1: 'test',
                    cate2: 'getRecent',
                    api_name: `/api/test${i}`
                };
                const result = await writeLog(requestMeta, logData);
                insertedIds.push(result.idx);
            }
        });

        test('기본값으로 최근 20개의 로그를 조회할 수 있어야 함', async () => {
            // When: 파라미터 없이 호출
            const logs = await getRecentLogs();

            // Then: 배열이 반환되어야 함
            expect(Array.isArray(logs)).toBe(true);
            expect(logs.length).toBeGreaterThanOrEqual(3);

            // 최신순 정렬 확인
            if (logs.length >= 2) {
                expect(logs[0].idx).toBeGreaterThan(logs[1].idx);
            }
        });

        test('limit 파라미터로 조회 개수를 지정할 수 있어야 함', async () => {
            // When: limit 2로 호출
            const logs = await getRecentLogs(2);

            // Then: 최대 2개만 반환
            expect(logs.length).toBeLessThanOrEqual(2);
        });

        test('limit에 큰 숫자를 넘겨도 처리할 수 있어야 함', async () => {
            // When: limit 1000으로 호출 (내부적으로 1000으로 제한됨)
            const logs = await getRecentLogs(1500);

            // Then: 에러 없이 조회되어야 함
            expect(Array.isArray(logs)).toBe(true);
        });

        test('조회된 로그가 필수 필드를 포함해야 함', async () => {
            // When
            const logs = await getRecentLogs(1);

            // Then
            expect(logs.length).toBeGreaterThan(0);
            const log = logs[0];

            expect(log).toHaveProperty('idx');
            expect(log).toHaveProperty('cate1');
            expect(log).toHaveProperty('cate2');
            expect(log).toHaveProperty('request_id');
            expect(log).toHaveProperty('req_ip_text');
            expect(log).toHaveProperty('api_name');
        });

    });

});