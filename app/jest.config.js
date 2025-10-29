/**
 * Jest 설정 파일
 */

export default {
    testEnvironment: 'node',
    transform: {},
    injectGlobals: true,
    testMatch: [
        '**/__tests__/**/*.test.js',
        '**/?(*.)+(spec|test).js'
    ],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/coverage/'
    ],
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/**/*.test.js',
        '!src/**/__tests__/**',
        '!src/config/db.js'
    ],
    coverageReporters: [
        'text',
        'lcov',
        'html'
    ],
    coverageDirectory: 'coverage',
    testTimeout: 5000,

    // 이 줄을 주석 처리하거나 삭제
    // setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

    moduleFileExtensions: ['js', 'json', 'node'],
    verbose: true,
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
};