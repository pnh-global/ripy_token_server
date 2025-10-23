/**
 * @swagger
 * components:
 *   schemas:
 *     LogCreateRequest:
 *       type: object
 *       properties:
 *         cate1: { type: string, example: "demo" }
 *         cate2: { type: string, example: "test" }
 *         service_key_id: { type: integer, example: 1, nullable: true }
 *         api_name: { type: string, example: "demo.insert" }
 *         api_parameter: { type: string, nullable: true, example: "encrypted_params_base64" }
 *         result_code: { type: string, example: "200" }
 *         latency_ms: { type: integer, example: 42 }
 *         error_code: { type: string, nullable: true, example: null }
 *         error_message: { type: string, nullable: true, example: null }
 *         content: { type: string, nullable: true, example: "hello log" }
 *       required: [cate1, cate2, api_name]
 *
 *     LogCreateResponse:
 *       type: object
 *       properties:
 *         ok: { type: boolean, example: true }
 *         idx: { type: integer, example: 123 }
 *         request_id: { type: string, example: "c3a2e6c0-0b9e-4f6e-b8f1-3bb1d0f7a9af" }
 *
 * /api/log:
 *   post:
 *     summary: Create a log entry
 *     description: r_log 테이블에 접근/처리 로그를 적재합니다.
 *     tags: [Logs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LogCreateRequest'
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LogCreateResponse'
 *     security:
 *       - ApiKeyAuth: []
 */