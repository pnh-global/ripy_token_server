// jest.setup.js

/**
 * Jest 전역 설정
 * 모든 테스트 파일 실행 전에 실행됨
 */

// Jest globals를 명시적으로 전역에 할당
global.jest = jest;
global.describe = describe;
global.test = test;
global.it = it;
global.expect = expect;
global.beforeEach = beforeEach;
global.afterEach = afterEach;
global.beforeAll = beforeAll;
global.afterAll = afterAll;

// 환경 변수 설정
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// 타임아웃 설정
jest.setTimeout(10000);