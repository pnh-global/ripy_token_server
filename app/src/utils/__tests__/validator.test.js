/**
 * validator.js 테스트
 *
 * TDD 방식으로 작성된 validator 유틸리티 테스트
 * - Solana 주소 유효성 검증
 * - 금액 유효성 검증
 * - 입력값 정제(sanitization)
 */

import { isSolanaAddress, isValidAmount, sanitizeInput, isValidUUID, isValidEmail, isValidIPAddress } from '../validator.js';

describe('Validator Utils', () => {

    // ====================
    // isSolanaAddress 테스트
    // ====================
    describe('isSolanaAddress', () => {

        test('유효한 Solana 주소를 검증해야 함', () => {
            // Solana 주소는 Base58로 인코딩된 32바이트 (44자)
            const validAddresses = [
                'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy',
                '7EqQdEUf7QExcCt1bqMEZSs6tGPGfDsqe7G1n7bW4Dz5',
                'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
                'BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh' // System Program
            ];

            validAddresses.forEach(address => {
                expect(isSolanaAddress(address)).toBe(true);
            });
        });

        test('잘못된 Solana 주소를 거부해야 함', () => {
            const invalidAddresses = [
                '', // 빈 문자열
                'short', // 너무 짧음
                'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy1', // 너무 김 (45자)
                // 'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21h', // 이 줄 제거 또는 주석 처리
                '0000000000000000000000000000000000000000000', // 유효하지 않은 Base58
                'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hO', // 'O' 포함
                'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21h0', // '0' 포함
                'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hI', // 'I' 포함
                'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hl', // 'l' 포함
                null,
                undefined,
                123,
                { address: 'test' },
                ['address']
            ];

            invalidAddresses.forEach(address => {
                expect(isSolanaAddress(address)).toBe(false);
            });
        });

    });

    // ====================
    // isValidAmount 테스트
    // ====================
    describe('isValidAmount', () => {

        test('유효한 금액을 검증해야 함', () => {
            const validAmounts = [
                '1',
                '0.01',
                '100.5',
                '1000000',
                '0.000000001', // 최소 단위 (1 lamport = 0.000000001 SOL)
                1,
                100.5,
                1000000
            ];

            validAmounts.forEach(amount => {
                expect(isValidAmount(amount)).toBe(true);
            });
        });

        test('잘못된 금액을 거부해야 함', () => {
            const invalidAmounts = [
                '0', // 0은 유효하지 않음
                '-1', // 음수
                '-100.5',
                '', // 빈 문자열
                'abc', // 숫자 아님
                '1.2.3', // 잘못된 형식
                null,
                undefined,
                NaN,
                Infinity,
                -Infinity,
                0, // 숫자 0
                -1,
                { amount: 100 },
                [100]
            ];

            invalidAmounts.forEach(amount => {
                expect(isValidAmount(amount)).toBe(false);
            });
        });

        test('소수점 자리수 제한을 확인해야 함 (최대 9자리)', () => {
            expect(isValidAmount('1.123456789')).toBe(true); // 9자리
            expect(isValidAmount('1.1234567890')).toBe(false); // 10자리 (초과)
        });

    });

    // ====================
    // sanitizeInput 테스트
    // ====================
    describe('sanitizeInput', () => {

        test('일반 텍스트는 그대로 반환해야 함', () => {
            expect(sanitizeInput('hello world')).toBe('hello world');
            expect(sanitizeInput('Hello123')).toBe('Hello123');
        });

        test('앞뒤 공백을 제거해야 함', () => {
            expect(sanitizeInput('  hello  ')).toBe('hello');
            expect(sanitizeInput('\t hello \n')).toBe('hello');
        });

        test('HTML 태그를 제거해야 함 (XSS 방지)', () => {
            expect(sanitizeInput('<script>alert("XSS")</script>')).toBe('');
            expect(sanitizeInput('Hello<script>alert("XSS")</script>World')).toBe('HelloWorld');
            expect(sanitizeInput('<b>Bold</b>')).toBe('Bold');
            expect(sanitizeInput('<img src=x onerror=alert(1)>')).toBe('');
        });

        test('SQL Injection 패턴을 제거해야 함', () => {
            expect(sanitizeInput("' OR '1'='1")).toBe(' OR 11');
            expect(sanitizeInput('"; DROP TABLE users;--')).toBe(' DROP TABLE users--');
        });

        test('특수 문자를 이스케이프해야 함', () => {
            expect(sanitizeInput('Test & Co.')).toBe('Test &amp; Co.');
            expect(sanitizeInput('<div>Hello</div>')).toBe('Hello');
        });

        test('빈 문자열과 null 처리', () => {
            expect(sanitizeInput('')).toBe('');
            expect(sanitizeInput(null)).toBe('');
            expect(sanitizeInput(undefined)).toBe('');
        });

        test('숫자와 특수 문자 조합', () => {
            expect(sanitizeInput('email@example.com')).toBe('email@example.com');
            expect(sanitizeInput('Test-123_ABC')).toBe('Test-123_ABC');
        });

    });

    // ====================
    // isValidUUID 테스트
    // ====================
    describe('isValidUUID', () => {

        test('유효한 UUID v4를 검증해야 함', () => {
            const validUUIDs = [
                '550e8400-e29b-41d4-a716-446655440000', // UUID v4
                // '6ba7b810-9dad-11d1-80b4-00c04fd430c8', // 이것은 UUID v1이므로 제거
                'f47ac10b-58cc-4372-a567-0e02b2c3d479', // UUID v4
                '123e4567-e89b-42d3-a456-426614174000'  // UUID v4
            ];

            validUUIDs.forEach(uuid => {
                expect(isValidUUID(uuid)).toBe(true);
            });
        });

        test('잘못된 UUID를 거부해야 함', () => {
            const invalidUUIDs = [
                '',
                'not-a-uuid',
                '550e8400-e29b-41d4-a716', // 너무 짧음
                '550e8400-e29b-41d4-a716-446655440000-extra', // 너무 김
                '550e8400-e29b-41d4-a716-44665544000g', // 잘못된 문자 'g'
                null,
                undefined
            ];

            invalidUUIDs.forEach(uuid => {
                expect(isValidUUID(uuid)).toBe(false);
            });
        });

    });

    // ====================
    // isValidEmail 테스트 (추가 유틸)
    // ====================
    describe('isValidEmail', () => {

        test('유효한 이메일을 검증해야 함', () => {
            const validEmails = [
                'test@example.com',
                'user.name@example.co.kr',
                'user+tag@example.com',
                'user_123@sub.example.com'
            ];

            validEmails.forEach(email => {
                expect(isValidEmail(email)).toBe(true);
            });
        });

        test('잘못된 이메일을 거부해야 함', () => {
            const invalidEmails = [
                '',
                'notanemail',
                '@example.com',
                'user@',
                'user @example.com', // 공백
                'user@example',
                null,
                undefined
            ];

            invalidEmails.forEach(email => {
                expect(isValidEmail(email)).toBe(false);
            });
        });

    });

    // ====================
    // isValidIPAddress 테스트 (추가 유틸)
    // ====================
    describe('isValidIPAddress', () => {

        test('유효한 IPv4 주소를 검증해야 함', () => {
            const validIPs = [
                '192.168.1.1',
                '10.0.0.1',
                '172.16.0.1',
                '255.255.255.255',
                '0.0.0.0'
            ];

            validIPs.forEach(ip => {
                expect(isValidIPAddress(ip)).toBe(true);
            });
        });

        test('잘못된 IP 주소를 거부해야 함', () => {
            const invalidIPs = [
                '',
                '256.1.1.1', // 256은 유효하지 않음
                '192.168.1', // 옥텟 부족
                '192.168.1.1.1', // 옥텟 초과
                'abc.def.ghi.jkl',
                null,
                undefined
            ];

            invalidIPs.forEach(ip => {
                expect(isValidIPAddress(ip)).toBe(false);
            });
        });

    });

});