// src/utils/__tests__/ipHelper.test.js

/**
 * ============================================
 * ipHelper.test.js - IP 헬퍼 유틸리티 테스트
 * ============================================
 */

import {
    ipToBinary,
    binaryToIp,
    getClientIp,
    isIpInCIDR
} from '../ipHelper.js';

describe('ipHelper 유틸리티 테스트', () => {

    // ============================================
    // 1. ipToBinary 테스트
    // ============================================
    describe('ipToBinary - IP 주소를 Binary로 변환', () => {

        test('유효한 IPv4 주소 변환 성공', () => {
            // Given: 유효한 IPv4 주소
            const ipText = '192.168.1.1';

            // When: Binary로 변환
            const binary = ipToBinary(ipText);

            // Then: Buffer 타입이며, 4바이트 길이
            expect(Buffer.isBuffer(binary)).toBe(true);
            expect(binary.length).toBe(4);
            expect(Array.from(binary)).toEqual([192, 168, 1, 1]);
        });

        test('0.0.0.0 주소 변환 성공', () => {
            // Given: 최소값 IP
            const ipText = '0.0.0.0';

            // When: Binary로 변환
            const binary = ipToBinary(ipText);

            // Then: [0, 0, 0, 0]
            expect(Array.from(binary)).toEqual([0, 0, 0, 0]);
        });

        test('255.255.255.255 주소 변환 성공', () => {
            // Given: 최대값 IP
            const ipText = '255.255.255.255';

            // When: Binary로 변환
            const binary = ipToBinary(ipText);

            // Then: [255, 255, 255, 255]
            expect(Array.from(binary)).toEqual([255, 255, 255, 255]);
        });

        test('유효하지 않은 IPv4 주소는 에러 발생', () => {
            // Given: 범위를 벗어난 옥텟
            const invalidIPs = [
                '256.168.1.1',      // 256은 범위 초과
                '192.168.1',        // 옥텟 부족
                '192.168.1.1.1',    // 옥텟 초과
                'abc.def.ghi.jkl',  // 숫자 아님
                '',                 // 빈 문자열
            ];

            // When & Then: 각각 에러 발생
            invalidIPs.forEach(ip => {
                expect(() => ipToBinary(ip)).toThrow();
            });
        });
    });

    // ============================================
    // 2. binaryToIp 테스트
    // ============================================
    describe('binaryToIp - Binary를 IP 주소로 변환', () => {

        test('유효한 Binary를 IPv4로 변환 성공', () => {
            // Given: Binary 형태의 IP
            const binary = Buffer.from([192, 168, 1, 1]);

            // When: IP 텍스트로 변환
            const ipText = binaryToIp(binary);

            // Then: '192.168.1.1'
            expect(ipText).toBe('192.168.1.1');
        });

        test('0.0.0.0 Binary 변환 성공', () => {
            // Given: 최소값 Binary
            const binary = Buffer.from([0, 0, 0, 0]);

            // When: IP 텍스트로 변환
            const ipText = binaryToIp(binary);

            // Then: '0.0.0.0'
            expect(ipText).toBe('0.0.0.0');
        });

        test('255.255.255.255 Binary 변환 성공', () => {
            // Given: 최대값 Binary
            const binary = Buffer.from([255, 255, 255, 255]);

            // When: IP 텍스트로 변환
            const ipText = binaryToIp(binary);

            // Then: '255.255.255.255'
            expect(ipText).toBe('255.255.255.255');
        });

        test('Buffer가 아닌 경우 에러 발생', () => {
            // Given: Buffer가 아닌 데이터
            const invalidData = [
                '192.168.1.1',      // 문자열
                [192, 168, 1, 1],   // 배열
                null,               // null
                undefined,          // undefined
            ];

            // When & Then: 에러 발생
            invalidData.forEach(data => {
                expect(() => binaryToIp(data)).toThrow();
            });
        });

        test('4바이트가 아닌 Buffer는 에러 발생', () => {
            // Given: 잘못된 길이의 Buffer
            const invalidBuffers = [
                Buffer.from([192, 168, 1]),        // 3바이트
                Buffer.from([192, 168, 1, 1, 1]),  // 5바이트
                Buffer.from([]),                    // 빈 Buffer
            ];

            // When & Then: 에러 발생
            invalidBuffers.forEach(buffer => {
                expect(() => binaryToIp(buffer)).toThrow();
            });
        });
    });

    // ============================================
    // 3. 양방향 변환 테스트 (Round-trip)
    // ============================================
    describe('양방향 변환 테스트', () => {

        test('IP -> Binary -> IP 변환 후 원본과 동일', () => {
            // Given: 여러 IP 주소
            const testIPs = [
                '192.168.1.1',
                '10.0.0.1',
                '172.16.0.1',
                '8.8.8.8',
                '127.0.0.1',
                '0.0.0.0',
                '255.255.255.255'
            ];

            // When & Then: 각 IP가 양방향 변환 후 동일
            testIPs.forEach(originalIp => {
                const binary = ipToBinary(originalIp);
                const convertedIp = binaryToIp(binary);
                expect(convertedIp).toBe(originalIp);
            });
        });
    });

    // ============================================
    // 4. getClientIp 테스트
    // ============================================
    describe('getClientIp - Express Request에서 IP 추출', () => {

        test('X-Forwarded-For 헤더에서 IP 추출', () => {
            // Given: X-Forwarded-For 헤더가 있는 Request
            const req = {
                headers: {
                    'x-forwarded-for': '203.0.113.1, 198.51.100.1'
                },
                ip: '192.168.1.1'
            };

            // When: IP 추출
            const clientIp = getClientIp(req);

            // Then: 첫 번째 IP 반환 (실제 클라이언트 IP)
            expect(clientIp).toBe('203.0.113.1');
        });

        test('X-Real-IP 헤더에서 IP 추출', () => {
            // Given: X-Real-IP 헤더만 있는 Request
            const req = {
                headers: {
                    'x-real-ip': '203.0.113.50'
                },
                ip: '192.168.1.1'
            };

            // When: IP 추출
            const clientIp = getClientIp(req);

            // Then: X-Real-IP 반환
            expect(clientIp).toBe('203.0.113.50');
        });

        test('헤더 없으면 req.ip 사용', () => {
            // Given: 프록시 헤더가 없는 Request
            const req = {
                headers: {},
                ip: '192.168.1.100'
            };

            // When: IP 추출
            const clientIp = getClientIp(req);

            // Then: req.ip 반환
            expect(clientIp).toBe('192.168.1.100');
        });

        test('req.ip도 없으면 remoteAddress 사용', () => {
            // Given: req.ip가 없는 Request
            const req = {
                headers: {},
                connection: {
                    remoteAddress: '10.0.0.5'
                }
            };

            // When: IP 추출
            const clientIp = getClientIp(req);

            // Then: remoteAddress 반환
            expect(clientIp).toBe('10.0.0.5');
        });

        test('모든 값이 없으면 기본값 반환', () => {
            // Given: IP 정보가 전혀 없는 Request
            const req = {
                headers: {}
            };

            // When: IP 추출
            const clientIp = getClientIp(req);

            // Then: 기본값 '0.0.0.0' 반환
            expect(clientIp).toBe('0.0.0.0');
        });
    });

    // ============================================
    // 5. isIpInCIDR 테스트
    // ============================================
    describe('isIpInCIDR - IP가 CIDR 범위에 포함되는지 확인', () => {

        test('IP가 CIDR 범위 내에 있음', () => {
            // Given: CIDR 범위와 포함되는 IP
            const cidr = '192.168.1.0/24';
            const ipsInRange = [
                '192.168.1.0',
                '192.168.1.1',
                '192.168.1.100',
                '192.168.1.255'
            ];

            // When & Then: 모두 true 반환
            ipsInRange.forEach(ip => {
                expect(isIpInCIDR(ip, cidr)).toBe(true);
            });
        });

        test('IP가 CIDR 범위 밖에 있음', () => {
            // Given: CIDR 범위와 벗어난 IP
            const cidr = '192.168.1.0/24';
            const ipsOutOfRange = [
                '192.168.0.255',
                '192.168.2.0',
                '10.0.0.1',
                '172.16.0.1'
            ];

            // When & Then: 모두 false 반환
            ipsOutOfRange.forEach(ip => {
                expect(isIpInCIDR(ip, cidr)).toBe(false);
            });
        });

        test('/32 (단일 IP) CIDR 확인', () => {
            // Given: 단일 IP를 나타내는 CIDR
            const cidr = '192.168.1.100/32';

            // When & Then
            expect(isIpInCIDR('192.168.1.100', cidr)).toBe(true);
            expect(isIpInCIDR('192.168.1.101', cidr)).toBe(false);
        });

        test('/16 (넓은 범위) CIDR 확인', () => {
            // Given: 넓은 범위의 CIDR
            const cidr = '10.20.0.0/16';

            // When & Then
            expect(isIpInCIDR('10.20.0.1', cidr)).toBe(true);
            expect(isIpInCIDR('10.20.255.255', cidr)).toBe(true);
            expect(isIpInCIDR('10.21.0.0', cidr)).toBe(false);
        });

        test('잘못된 CIDR 형식은 false 반환', () => {
            // Given: 잘못된 CIDR 형식
            const invalidCIDRs = [
                'invalid',
                '192.168.1.0',      // 서브넷 없음
                '192.168.1.0/33',   // 서브넷 범위 초과
            ];

            // When & Then: 에러 없이 false 반환
            invalidCIDRs.forEach(cidr => {
                expect(isIpInCIDR('192.168.1.1', cidr)).toBe(false);
            });
        });
    });

    // ============================================
    // 6. 통합 시나리오 테스트
    // ============================================
    describe('통합 시나리오', () => {

        test('실제 사용 시나리오: 요청 IP를 DB에 저장 후 조회', () => {
            // Given: 클라이언트 요청
            const req = {
                headers: {
                    'x-forwarded-for': '203.0.113.45'
                }
            };

            // When: IP 추출 및 Binary 변환 (DB 저장용)
            const clientIp = getClientIp(req);
            const binaryIp = ipToBinary(clientIp);

            // 시뮬레이션: DB에 저장 후 조회
            const retrievedBinary = binaryIp; // DB에서 가져온다고 가정
            const retrievedIp = binaryToIp(retrievedBinary);

            // Then: 원본 IP와 동일
            expect(retrievedIp).toBe('203.0.113.45');
        });

        test('IP 블라인드 체크 시나리오', () => {
            // Given: 차단된 IP 범위
            const blockedCIDR = '192.168.1.0/24';

            // 클라이언트 요청들
            const requests = [
                { ip: '192.168.1.50', shouldBlock: true },
                { ip: '192.168.2.50', shouldBlock: false },
                { ip: '10.0.0.1', shouldBlock: false }
            ];

            // When & Then: 각 요청의 차단 여부 확인
            requests.forEach(({ ip, shouldBlock }) => {
                const isBlocked = isIpInCIDR(ip, blockedCIDR);
                expect(isBlocked).toBe(shouldBlock);
            });
        });
    });
});