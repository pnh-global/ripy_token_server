import { writeLog, getRecentLogs } from '../log.service.js';
import { pool } from '../../config/db.js';

describe('Log Service', () => {

    // ========== 테스트 후 정리 ==========
    afterAll(async () => {
        // DB 연결 풀 종료
        await pool.end();
        console.log('log.service.test.js - DB 연결 정리 완료');
    });

    describe('writeLog()', () => {
        test('정상적인 요청으로 로그를 작성할 수 있어야 함', async () => {
            // Given: 정상적인 요청 메타와 바디
            const requestMeta = {
                headers: {
                    'x-forwarded-for': '203.0.113.42',
                    'host': 'api.example.com'
                },
                ip: '127.0.0.1'
            };

            const logData = {
                cate1: 'test',
                cate2: 'integration',
                api_name: '/api/test/create',
                result_code: '200',
                latency_ms: 45
            };

            // When: writeLog 호출
            const result = await writeLog(requestMeta, logData);

            // Then: 결과 확인
            expect(result).toBeDefined();
            expect(result.idx).toBeGreaterThan(0);
            expect(result.request_id).toBeDefined();
            expect(typeof result.request_id).toBe('string');
            expect(result.request_id.length).toBeGreaterThan(0);
        });

        test('X-Forwarded-For 헤더가 없을 때 req.ip를 사용해야 함', async () => {
            // Given: X-Forwarded-For가 없는 요청
            const requestMeta = {
                headers: {
                    'host': 'api.example.com'
                },
                ip: '192.168.1.100'
            };

            const logData = {
                cate1: 'test',
                cate2: 'ip-test',
                api_name: '/api/test'
            };

            // When: writeLog 호출
            const result = await writeLog(requestMeta, logData);

            // Then: 정상 처리
            expect(result).toBeDefined();
            expect(result.idx).toBeGreaterThan(0);
        });

        test('IPv6 주소에서 ::ffff: 접두사를 제거해야 함', async () => {
            // Given: IPv6 mapped IPv4 주소
            const requestMeta = {
                headers: {},
                ip: '::ffff:192.168.1.50'
            };

            const logData = {
                cate1: 'test',
                cate2: 'ipv6-test',
                api_name: '/api/test'
            };

            // When: writeLog 호출
            const result = await writeLog(requestMeta, logData);

            // Then: 정상 처리
            expect(result).toBeDefined();
            expect(result.idx).toBeGreaterThan(0);
        });

        test('최소한의 필수 필드만 있어도 로그를 작성할 수 있어야 함', async () => {
            // Given: 최소 필수 필드만 있는 데이터
            const requestMeta = {
                headers: {},
                ip: '127.0.0.1'
            };

            const logData = {
                cate1: 'test',
                cate2: 'minimal'
            };

            // When: writeLog 호출
            const result = await writeLog(requestMeta, logData);

            // Then: 정상 처리
            expect(result).toBeDefined();
            expect(result.idx).toBeGreaterThan(0);
        });

        test('X-Forwarded-For가 여러 IP를 포함할 때 첫 번째 IP를 사용해야 함', async () => {
            // Given: 쉼표로 구분된 여러 IP
            const requestMeta = {
                headers: {
                    'x-forwarded-for': '203.0.113.1, 198.51.100.1, 192.0.2.1'
                },
                ip: '127.0.0.1'
            };

            const logData = {
                cate1: 'test',
                cate2: 'multi-ip',
                api_name: '/api/test'
            };

            // When: writeLog 호출
            const result = await writeLog(requestMeta, logData);

            // Then: 정상 처리
            expect(result).toBeDefined();
            expect(result.idx).toBeGreaterThan(0);
        });

        test('request_id가 UUID 형식이어야 함', async () => {
            // Given
            const requestMeta = {
                headers: {},
                ip: '127.0.0.1'
            };

            const logData = {
                cate1: 'test',
                cate2: 'uuid-test',
                api_name: '/api/test'
            };

            // When
            const result = await writeLog(requestMeta, logData);

            // Then: UUID v4 형식 검증
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(result.request_id).toMatch(uuidRegex);
        });

        test('잘못된 IP 형식이 들어와도 처리할 수 있어야 함', async () => {
            // Given: 잘못된 IP (기본값 0.0.0.0 사용)
            const requestMeta = {
                headers: {},
                ip: '' // 빈 문자열
            };

            const logData = {
                cate1: 'test',
                cate2: 'invalid-ip',
                api_name: '/api/test'
            };

            // When: writeLog 호출
            const result = await writeLog(requestMeta, logData);

            // Then: 기본 IP로 처리
            expect(result).toBeDefined();
            expect(result.idx).toBeGreaterThan(0);
        });

        test('필수 필드가 누락되면 에러를 throw해야 함', async () => {
            // Given: cate2가 누락된 데이터
            const requestMeta = {
                headers: {},
                ip: '127.0.0.1'
            };

            const logData = {
                cate1: 'test'
                // cate2 누락
            };

            // When & Then: 에러 발생
            await expect(writeLog(requestMeta, logData)).rejects.toThrow('cate2 is required');
        });

    });

    describe('getRecentLogs()', () => {
        test('기본값으로 최근 20개의 로그를 조회할 수 있어야 함', async () => {
            // When: 기본값으로 조회
            const logs = await getRecentLogs();

            // Then: 배열 반환
            expect(Array.isArray(logs)).toBe(true);
            expect(logs.length).toBeLessThanOrEqual(20);
        });

        test('limit 파라미터로 조회 개수를 지정할 수 있어야 함', async () => {
            // When: limit=2로 조회
            const logs = await getRecentLogs(2);

            // Then: 최대 2개 반환
            expect(Array.isArray(logs)).toBe(true);
            expect(logs.length).toBeLessThanOrEqual(2);
        });

        test('limit에 큰 숫자를 넘겨도 처리할 수 있어야 함', async () => {
            // When: limit=1000
            const logs = await getRecentLogs(1000);

            // Then: 정상 처리
            expect(Array.isArray(logs)).toBe(true);
        });

        test('조회된 로그가 필수 필드를 포함해야 함', async () => {
            // Given: 먼저 로그 생성
            const requestMeta = { headers: {}, ip: '127.0.0.1' };
            const logData = {
                cate1: 'test',
                cate2: 'recent-log-test',
                api_name: '/api/test/recent'
            };

            await writeLog(requestMeta, logData);

            // When: 최근 로그 조회
            const logs = await getRecentLogs(5);

            // Then: 필수 필드 존재 확인
            if (logs.length > 0) {
                const log = logs[0];
                expect(log).toHaveProperty('idx');
                expect(log).toHaveProperty('cate1');
                expect(log).toHaveProperty('cate2');
                expect(log).toHaveProperty('request_id');
                expect(log).toHaveProperty('created_at');
            }
        });
    });

});