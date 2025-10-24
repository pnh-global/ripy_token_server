// jest.config.js
// Jest 테스트 프레임워크 설정 파일
// 이 파일은 Jest가 어떻게 동작할지 정의합니다

export default {
  // 테스트 실행 환경 설정
  // 'node' - Node.js 환경에서 테스트 실행 (브라우저 환경 아님)
  testEnvironment: 'node',
  
  // 테스트 파일 패턴 정의
  // Jest가 어떤 파일을 테스트 파일로 인식할지 결정
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // 코드 커버리지 수집 대상 파일 정의
  // 어떤 파일들의 테스트 커버리지를 측정할지 결정
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/__tests__/**',
    '!src/**/*.test.js'
  ],
  
  // 커버리지 리포트 형식
  // text: 터미널에 텍스트로 출력
  // lcov: HTML 리포트 생성
  // json: JSON 형식으로 저장
  coverageReporters: ['text', 'lcov', 'json'],
  
  // 커버리지 리포트가 저장될 폴더
  coverageDirectory: 'coverage',
  
  // 각 테스트의 최대 실행 시간 (밀리초)
  // DB 연결 등 비동기 작업 때문에 10초로 설정
  testTimeout: 10000,
  
  // 모듈 경로 별칭 설정
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // 각 테스트 결과를 상세히 출력
  verbose: true,
  
  // ES Module을 네이티브로 지원하도록 설정
  transform: {}
};
