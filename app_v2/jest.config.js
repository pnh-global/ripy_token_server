/**
 * Jest 설정 파일 (ESM 모듈 지원)
 */

export default {
    // Node.js 환경 사용
    testEnvironment: 'node',

    // ESM 모듈 변환 비활성화
    transform: {},

    // Jest 글로벌 변수 자동 주입
    injectGlobals: true,

    // 테스트 파일 매칭 패턴
    testMatch: [
        '**/__tests__/**/*.test.js',
        '**/?(*.)+(spec|test).js'
    ],

    // 테스트에서 제외할 경로
    testPathIgnorePatterns: [
        '/node_modules/',
        '/coverage/'
    ],

    // 커버리지 수집 대상
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/**/*.test.js',
        '!src/**/__tests__/**',
        '!src/config/db.js'
    ],

    // 커버리지 리포트 형식
    coverageReporters: [
        'text',
        'lcov',
        'html'
    ],

    // 커버리지 저장 디렉토리
    coverageDirectory: 'coverage',

    // 기본 테스트 타임아웃 (밀리초)
    testTimeout: 30000,

    // 테스트 전 환경 설정 파일 (주석 해제하여 사용)
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

    // 파일 확장자 설정
    moduleFileExtensions: ['js', 'json', 'node'],

    // 상세 로그 출력
    verbose: true,

    // Mock 자동 정리
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
};