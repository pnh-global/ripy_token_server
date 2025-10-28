/**
 * encryption.js 테스트
 *
 * 테스트 항목:
 * 1. encrypt 함수가 평문을 암호화하는지 확인
 * 2. decrypt 함수가 암호문을 복호화하는지 확인
 * 3. 암호화 -> 복호화 시 원본 데이터가 일치하는지 확인
 * 4. 잘못된 키로 복호화 시도 시 에러 발생 확인
 * 5. generateKey 함수가 키를 생성하는지 확인
 */

import { encrypt, decrypt, generateKey } from '../encryption.js';

describe('Encryption Utils', () => {
    // 테스트용 암호화 키 (32바이트 hex 문자열 - AES-256)
    const testKey = 'a'.repeat(64); // 32바이트를 hex로 표현하면 64자
    const testData = { userId: 123, wallet: 'ABC123XYZ789' };
    const testString = 'test message for encryption';

    describe('encrypt 함수', () => {
        test('평문을 암호화하여 암호문을 반환해야 함', () => {
            // given: 평문 데이터
            const plaintext = JSON.stringify(testData);

            // when: 암호화 실행
            const encrypted = encrypt(plaintext, testKey);

            // then: 암호문이 생성되어야 하고, 원본과 달라야 함
            expect(encrypted).toBeDefined();
            expect(typeof encrypted).toBe('string');
            expect(encrypted).not.toBe(plaintext);
            expect(encrypted.length).toBeGreaterThan(0);
        });

        test('빈 문자열도 암호화할 수 있어야 함', () => {
            // given: 빈 문자열
            const plaintext = '';

            // when: 암호화 실행
            const encrypted = encrypt(plaintext, testKey);

            // then: 암호문이 생성되어야 함
            expect(encrypted).toBeDefined();
            expect(typeof encrypted).toBe('string');
        });

        test('키가 없으면 에러를 발생시켜야 함', () => {
            // given: 키가 없는 상태
            const plaintext = 'test';

            // when & then: 에러 발생
            expect(() => encrypt(plaintext, '')).toThrow();
            expect(() => encrypt(plaintext, null)).toThrow();
            expect(() => encrypt(plaintext, undefined)).toThrow();
        });
    });

    describe('decrypt 함수', () => {
        test('암호문을 복호화하여 평문을 반환해야 함', () => {
            // given: 암호화된 데이터
            const plaintext = JSON.stringify(testData);
            const encrypted = encrypt(plaintext, testKey);

            // when: 복호화 실행
            const decrypted = decrypt(encrypted, testKey);

            // then: 원본 평문과 일치해야 함
            expect(decrypted).toBe(plaintext);
            expect(JSON.parse(decrypted)).toEqual(testData);
        });

        test('잘못된 키로 복호화 시도 시 에러를 발생시켜야 함', () => {
            // given: 암호화된 데이터와 잘못된 키
            const plaintext = testString;
            const encrypted = encrypt(plaintext, testKey);
            const wrongKey = 'b'.repeat(64);

            // when & then: 에러 발생
            expect(() => decrypt(encrypted, wrongKey)).toThrow();
        });

        test('손상된 암호문 복호화 시 에러를 발생시켜야 함', () => {
            // given: 손상된 암호문
            const corruptedCiphertext = 'invalid-ciphertext-data';

            // when & then: 에러 발생
            expect(() => decrypt(corruptedCiphertext, testKey)).toThrow();
        });
    });

    describe('암호화/복호화 통합 테스트', () => {
        test('다양한 데이터 타입이 암호화/복호화 후 원본과 일치해야 함', () => {
            // 테스트 케이스 배열
            const testCases = [
                { userId: 1, name: 'test' },
                { amount: 1000.50, currency: 'RIPY' },
                { array: [1, 2, 3], nested: { key: 'value' } },
                '한글 테스트 데이터',
                'Special characters: !@#$%^&*()',
            ];

            testCases.forEach((testCase) => {
                // given: 테스트 데이터
                const plaintext = typeof testCase === 'string'
                    ? testCase
                    : JSON.stringify(testCase);

                // when: 암호화 -> 복호화
                const encrypted = encrypt(plaintext, testKey);
                const decrypted = decrypt(encrypted, testKey);

                // then: 원본과 일치
                expect(decrypted).toBe(plaintext);
            });
        });

        test('같은 평문도 매번 다른 암호문을 생성해야 함 (IV 사용)', () => {
            // given: 같은 평문
            const plaintext = testString;

            // when: 여러 번 암호화
            const encrypted1 = encrypt(plaintext, testKey);
            const encrypted2 = encrypt(plaintext, testKey);
            const encrypted3 = encrypt(plaintext, testKey);

            // then: 암호문은 서로 달라야 함 (IV가 매번 다르므로)
            expect(encrypted1).not.toBe(encrypted2);
            expect(encrypted2).not.toBe(encrypted3);
            expect(encrypted1).not.toBe(encrypted3);

            // 하지만 복호화하면 모두 같은 평문
            expect(decrypt(encrypted1, testKey)).toBe(plaintext);
            expect(decrypt(encrypted2, testKey)).toBe(plaintext);
            expect(decrypt(encrypted3, testKey)).toBe(plaintext);
        });
    });

    describe('generateKey 함수', () => {
        test('32바이트(64자 hex) 키를 생성해야 함', () => {
            // when: 키 생성
            const key = generateKey();

            // then: 64자 hex 문자열
            expect(key).toBeDefined();
            expect(typeof key).toBe('string');
            expect(key.length).toBe(64);
            expect(key).toMatch(/^[0-9a-f]{64}$/); // hex 문자만 포함
        });

        test('매번 다른 키를 생성해야 함', () => {
            // when: 여러 번 키 생성
            const key1 = generateKey();
            const key2 = generateKey();
            const key3 = generateKey();

            // then: 모두 달라야 함
            expect(key1).not.toBe(key2);
            expect(key2).not.toBe(key3);
            expect(key1).not.toBe(key3);
        });

        test('생성된 키로 암호화/복호화가 정상 작동해야 함', () => {
            // given: 생성된 키
            const newKey = generateKey();
            const plaintext = testString;

            // when: 암호화 -> 복호화
            const encrypted = encrypt(plaintext, newKey);
            const decrypted = decrypt(encrypted, newKey);

            // then: 원본과 일치
            expect(decrypted).toBe(plaintext);
        });
    });

    describe('에러 처리', () => {
        test('잘못된 키 길이는 에러를 발생시켜야 함', () => {
            // given: 잘못된 길이의 키
            const shortKey = 'a'.repeat(32); // 16바이트 - 너무 짧음
            const plaintext = testString;

            // when & then: 에러 발생
            expect(() => encrypt(plaintext, shortKey)).toThrow();
        });

        test('유효하지 않은 hex 키는 에러를 발생시켜야 함', () => {
            // given: 유효하지 않은 hex 문자열
            const invalidKey = 'g'.repeat(64); // 'g'는 hex 문자가 아님
            const plaintext = testString;

            // when & then: 에러 발생
            expect(() => encrypt(plaintext, invalidKey)).toThrow();
        });
    });
});