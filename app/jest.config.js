/**
 * Jest 설정 파일
 *
 * Jest가 어떻게 테스트를 실행할지 설정합니다.
 * ES Module 프로젝트에서 Jest를 사용하기 위한 설정입니다.
 */

export default {
    // 테스트 환경: Node.js 환경에서 실행
    testEnvironment: 'node',

    // ES Module 사용 설정
    // transform을 비활성화하여 ES Module을 직접 사용
    transform: {},

    // Jest 글로벌 객체 자동 주입
    injectGlobals: true,

    // extensionsToTreatAsEsm 제거! (package.json에 "type": "module"이 있으면 불필요)
    // extensionsToTreatAsEsm: ['.js'],

    // moduleNameMapper도 제거 또는 단순화
    // moduleNameMapper: {
    //     '^(\\.{1,2}/.*)\\.js$': '$1',
    // },

    // 테스트 파일 패턴
    testMatch: [
        '**/__tests__/**/*.test.js',
        '**/?(*.)+(spec|test).js'
    ],

    // 테스트할 때 무시할 경로
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

    // 커버리지 디렉토리
    coverageDirectory: 'coverage',

    // 테스트 타임아웃
    testTimeout: 10000,

    // 테스트 실행 전에 실행할 설정 파일
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

    // 모듈 파일 확장자
    moduleFileExtensions: ['js', 'json', 'node'],

    // 상세한 출력 모드
    verbose: true,

    // 모든 테스트가 끝난 후 자동으로 mock 정리
    clearMocks: true,

    // 각 테스트 파일마다 격리된 환경 제공
    resetMocks: true,
    restoreMocks: true,
};