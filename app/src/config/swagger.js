/**
 * Swagger 설정 파일
 * API 문서 자동 생성을 위한 swagger-jsdoc 설정
 */

export const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'RIPY Token Server API',
            version: '1.0.0',
            description: `
RIPY 토큰 서버 API 문서입니다.

**주요 기능:**
- 부분 서명 트랜잭션 생성 (서명 요청)
- 최종 서명 완료 처리
- 계약서 조회 및 관리
- Solana 토큰 전송
- 서비스 키 관리
- 로그 조회

**보안:**
- 모든 API는 x-api-key 헤더를 통한 인증이 필요합니다.
- 민감한 데이터는 AES-256-CBC로 암호화하여 전송합니다.
- IP 기반 접근 제어가 가능합니다.
            `,
            contact: {
                name: 'RIPY Development Team',
                email: 'dev@ripy.io'
            }
        },
        servers: [
            {
                url: 'http://localhost:4000',
                description: '개발 서버 (Development)'
            },
            {
                url: 'http://localhost:4001',
                description: '개발 테스트 서버 (Dev Test)'
            },
            {
                url: 'https://api.ripy.io',
                description: '운영 서버 (Production)'
            }
        ],
        // 보안 스키마 정의
        components: {
            securitySchemes: {
                ApiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'x-api-key',
                    description: '서비스 키 인증 (service_keys 테이블에서 발급)'
                }
            }
        },
        // 전역 보안 적용 (모든 API에 기본 적용)
        security: [
            {
                ApiKeyAuth: []
            }
        ],
        tags: [
            {
                name: 'Health',
                description: '서버 상태 체크'
            },
            {
                name: 'Sign (서명)',
                description: '부분 서명 트랜잭션 생성 및 최종 서명 처리'
            },
            {
                name: 'Contract (계약서)',
                description: '계약서 조회 및 관리'
            },
            {
                name: 'Solana (전송)',
                description: 'Solana 토큰 전송 및 트랜잭션 조회'
            },
            {
                name: 'Key (서비스 키)',
                description: '서비스 키 발급, 검증, 회수'
            },
            {
                name: 'Log',
                description: 'API 호출 로그 조회'
            }
        ]
    },
    // JSDoc 주석을 읽을 파일 경로
    apis: [
        './src/routes/*.js',
        './src/controllers/*.js'
    ]
};