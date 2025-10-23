import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "RIPY Token Server API",
            version: "0.1.0",
            description: "RIPY token server for Solana-based transactions"
        },
        servers: [
            { url: "http://49.50.130.174", description: "Production server" },
            { url: "http://localhost:4000", description: "Local test" }
        ],
        components: {
            securitySchemes: {
                ApiKeyAuth: {
                    type: "apiKey",
                    in: "header",
                    name: "x-api-key",
                    description: "서비스 키를 헤더로 전달"
                }
            }
        },
        security: [{ ApiKeyAuth: [] }] // 모든 엔드포인트에 기본 적용(원하면 라우트별로 해제 가능)
    },
    apis: ["./src/routes/*.js"], // 라우트 주석 기반 문서화
};

export const swaggerSpec = swaggerJSDoc(options);
export const swaggerUiMiddleware = swaggerUi;