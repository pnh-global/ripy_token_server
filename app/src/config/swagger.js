/**
 * Swagger 설정 파일
 * API 문서 자동 생성을 위한 swagger-jsdoc 설정
 */
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'RIPY Token Server API',
            version: '1.0.0',
            description: `
RIPY 토큰 서버 API 문서입니다.

**Result Code 체계:**
- FFRR 형식 (FF: 기능 코드, RR: 원인 코드)
- 0000: 성공
- 9900: 서버 내부 오류
- 9800: 잘못된 요청
- 9801: 검증 실패
- 0702: 전송 실패 (조회 실패)

**주요 기능:**
- 부분 서명 트랜잭션 생성
- 최종 서명 완료 처리
- 계약서 조회 및 관리
- Solana 토큰 전송

**보안:**
- 웹 전용 API는 x-api-key 불필요
- 앱 전용 API는 x-api-key 필수
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
                url: 'https://api.ripy.io',
                description: '운영 서버 (Production)'
            }
        ],
        components: {
            securitySchemes: {
                ApiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'x-api-key',
                    description: '서비스 키 인증 (service_keys 테이블에서 발급)'
                }
            },
            schemas: {
                SuccessResponse: {
                    type: 'object',
                    required: ['ok', 'code', 'data'],
                    properties: {
                        ok: {
                            type: 'boolean',
                            description: '성공 여부 (항상 true)',
                            example: true
                        },
                        code: {
                            type: 'string',
                            description: 'Result Code (FFRR 형식)',
                            example: '0000'
                        },
                        message: {
                            type: 'string',
                            description: '응답 메시지 (선택)',
                            example: '요청이 성공적으로 처리되었습니다'
                        },
                        data: {
                            type: 'object',
                            description: '응답 데이터',
                            additionalProperties: true
                        }
                    },
                    example: {
                        ok: true,
                        code: '0000',
                        message: '사용자 서명이 필요합니다',
                        data: {
                            contract_id: '74b46e9b-147a-45f8-9d66-d716b0a56be7',
                            partial_transaction: 'AQAAAAo=...'
                        }
                    }
                },
                Error: {
                    type: 'object',
                    required: ['ok', 'code', 'error'],
                    properties: {
                        ok: {
                            type: 'boolean',
                            description: '성공 여부 (항상 false)',
                            example: false
                        },
                        code: {
                            type: 'string',
                            description: 'Result Code (FFRR 형식)',
                            enum: ['9800', '9801', '9900', '0701', '0702'],
                            example: '9800'
                        },
                        error: {
                            type: 'string',
                            description: '에러 메시지',
                            example: '필수 파라미터가 누락되었습니다'
                        }
                    },
                    example: {
                        ok: false,
                        code: '9800',
                        error: '필수 파라미터가 누락되었습니다'
                    }
                },
                ResultCodes: {
                    type: 'object',
                    description: 'Result Code 정의',
                    properties: {
                        '0000': {
                            type: 'string',
                            example: '성공 (SUCCESS)'
                        },
                        '9900': {
                            type: 'string',
                            example: '서버 내부 오류 (INTERNAL_SERVER_ERROR)'
                        },
                        '9800': {
                            type: 'string',
                            example: '잘못된 요청 (BAD_REQUEST)'
                        },
                        '9801': {
                            type: 'string',
                            example: '검증 실패 (VALIDATION_ERROR)'
                        },
                        '0702': {
                            type: 'string',
                            example: '전송 실패 - 조회 실패 (TRANSFER_NOT_FOUND)'
                        }
                    }
                }
            }
        },
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
                name: 'Transfer (Web)',
                description: '웹 서버 전용 토큰 전송 API (API Key 불필요)'
            },
            {
                name: 'Sign (서명)',
                description: '부분 서명 트랜잭션 생성 및 최종 서명 처리 (API Key 필요)'
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
    apis: [
        path.join(__dirname, '../routes/**/*.js'),
        path.join(__dirname, '../controllers/**/*.js')
    ]
};

export function setupSwagger(app) {
    try {
        const swaggerSpec = swaggerJsdoc(swaggerOptions);

        console.log('📄 Swagger 문서 생성 완료');
        console.log(`   - API 개수: ${Object.keys(swaggerSpec.paths || {}).length}`);

        const swaggerUiOptions = {
            explorer: true,
            swaggerOptions: {
                persistAuthorization: true,
                displayRequestDuration: true,
                filter: true,
                syntaxHighlight: {
                    activate: true,
                    theme: 'monokai'
                }
            }
        };

        app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

        app.get('/api-docs.json', (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(swaggerSpec);
        });

        console.log('✅ Swagger UI가 /api-docs 경로에 설정되었습니다.');
    } catch (error) {
        console.error('❌ Swagger 설정 중 오류 발생:', error.message);
        console.error(error.stack);
    }
}