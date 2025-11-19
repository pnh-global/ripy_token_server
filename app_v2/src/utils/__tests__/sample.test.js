// src/utils/__tests__/sample.test.js
// Jest 테스트 환경 확인용 샘플 테스트

import { add, multiply, isEmpty } from '../sample.js';

// describe: 테스트 그룹을 정의 (관련된 테스트들을 묶음)
describe('Sample Utility Functions', () => {

    // test (또는 it): 개별 테스트 케이스
    // "무엇을 테스트하는지" 명확하게 작성
    test('add 함수는 두 숫자를 올바르게 더해야 함', () => {
        // Given: 테스트할 데이터 준비
        const a = 5;
        const b = 3;

        // When: 테스트할 함수 실행
        const result = add(a, b);

        // Then: 결과 검증
        expect(result).toBe(8);
    });

    test('add 함수는 음수도 처리할 수 있어야 함', () => {
        expect(add(-5, 3)).toBe(-2);
        expect(add(-5, -3)).toBe(-8);
    });

    test('multiply 함수는 두 숫자를 올바르게 곱해야 함', () => {
        expect(multiply(4, 5)).toBe(20);
        expect(multiply(0, 100)).toBe(0);
        expect(multiply(-2, 3)).toBe(-6);
    });

    // describe 안에 describe를 중첩 가능
    describe('isEmpty 함수', () => {

        test('빈 문자열에 대해 true를 반환해야 함', () => {
            expect(isEmpty('')).toBe(true);
        });

        test('공백만 있는 문자열에 대해 true를 반환해야 함', () => {
            expect(isEmpty('   ')).toBe(true);
        });

        test('null에 대해 true를 반환해야 함', () => {
            expect(isEmpty(null)).toBe(true);
        });

        test('undefined에 대해 true를 반환해야 함', () => {
            expect(isEmpty(undefined)).toBe(true);
        });

        test('내용이 있는 문자열에 대해 false를 반환해야 함', () => {
            expect(isEmpty('hello')).toBe(false);
            expect(isEmpty('  hello  ')).toBe(false);
        });
    });
});