// src/utils/sample.js
// Jest 테스트 환경 확인용 샘플 유틸리티 함수들

/**
 * 두 숫자를 더하는 함수
 * @param {number} a - 첫 번째 숫자
 * @param {number} b - 두 번째 숫자
 * @returns {number} 두 숫자의 합
 */
export function add(a, b) {
    return a + b;
}

/**
 * 두 숫자를 곱하는 함수
 * @param {number} a - 첫 번째 숫자
 * @param {number} b - 두 번째 숫자
 * @returns {number} 두 숫자의 곱
 */
export function multiply(a, b) {
    return a * b;
}

/**
 * 문자열이 비어있는지 확인하는 함수
 * @param {string|null|undefined} str - 확인할 문자열
 * @returns {boolean} 비어있으면 true, 아니면 false
 */
export function isEmpty(str) {
    // null 또는 undefined인 경우 true 반환
    if (str == null) {
        return true;
    }

    // 문자열로 변환 후 공백 제거하여 길이가 0이면 true
    return String(str).trim().length === 0;
}