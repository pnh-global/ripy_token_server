/**
 * ============================================
 * log.controller.js - 로그 조회/생성 컨트롤러
 * ============================================
 *
 * 역할:
 * - 로그 생성 (POST /api/log)
 * - 최근 로그 조회 (GET /api/log)
 * - 로그 단건 조회 (GET /api/log/:id)
 *
 * 변경 이력:
 * - 2025-11-05: Phase 2-D Swagger 문서화 추가
 */

import { writeLog, getRecentLogs } from "../services/log.service.js";
import { getLogById as getLogByIdFromModel } from "../models/log.model.js";

/**
 * @swagger
 * /api/log:
 *   post:
 *     summary: 로그 생성
 *     description: |
 *       r_log 테이블에 API 호출 로그를 기록합니다.
 *
 *       **사용 사례:**
 *       - API 호출 시 자동으로 로그 기록
 *       - 에러 발생 시 에러 로그 기록
 *       - 성능 모니터링을 위한 latency 기록
 *     tags:
 *       - Log
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cate1
 *               - cate2
 *             properties:
 *               cate1:
 *                 type: string
 *                 description: 카테고리 1
 *                 example: "sign"
 *               cate2:
 *                 type: string
 *                 description: 카테고리 2
 *                 example: "create"
 *               service_key_id:
 *                 type: integer
 *                 nullable: true
 *                 description: 서비스 키 ID
 *                 example: 1
 *               api_name:
 *                 type: string
 *                 description: API 이름
 *                 example: "/api/sign/create"
 *               api_parameter:
 *                 type: string
 *                 nullable: true
 *                 description: API 파라미터 (암호화 가능)
 *                 example: "encrypted_params"
 *               result_code:
 *                 type: string
 *                 description: 결과 코드
 *                 example: "200"
 *               latency_ms:
 *                 type: integer
 *                 description: 응답 시간 (밀리초)
 *                 example: 42
 *               error_code:
 *                 type: string
 *                 nullable: true
 *                 description: 에러 코드
 *                 example: null
 *               error_message:
 *                 type: string
 *                 nullable: true
 *                 description: 에러 메시지
 *                 example: null
 *               content:
 *                 type: string
 *                 nullable: true
 *                 description: 추가 내용
 *                 example: "success"
 *     responses:
 *       201:
 *         description: 로그 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "log inserted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     idx:
 *                       type: integer
 *                       example: 123
 *                     request_id:
 *                       type: string
 *                       example: "c3a2e6c0-0b9e-4f6e-b8f1-3bb1d0f7a9af"
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Failed to insert log"
 */
export const createLog = async (req, res, next) => {
    try {
        // req 객체를 직접 전달 (log.service.js에서 req.headers, req.ip 사용)
        const result = await writeLog(req, req.body);
        return res.status(201).json({
            ok: true,
            message: "log inserted successfully",
            data: result,
        });
    } catch (err) {
        console.error("createLog Error:", err);
        return res.status(500).json({
            ok: false,
            error: "Failed to insert log",
            details: err.message,
        });
    }
};

/**
 * @swagger
 * /api/log:
 *   get:
 *     summary: 로그 목록 조회
 *     description: |
 *       최근 로그 목록을 조회합니다.
 *
 *       **사용 사례:**
 *       - 최근 API 호출 이력 확인
 *       - 에러 로그 모니터링
 *       - 시스템 상태 확인
 *     tags:
 *       - Log
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *           example: 20
 *         description: 조회할 로그 개수
 *     responses:
 *       200:
 *         description: 로그 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   description: 조회된 로그 개수
 *                   example: 20
 *                 data:
 *                   type: array
 *                   description: 로그 목록
 *                   items:
 *                     type: object
 *                     properties:
 *                       idx:
 *                         type: integer
 *                         example: 123
 *                       cate1:
 *                         type: string
 *                         example: "sign"
 *                       cate2:
 *                         type: string
 *                         example: "create"
 *                       request_id:
 *                         type: string
 *                         example: "c3a2e6c0-0b9e-4f6e-b8f1-3bb1d0f7a9af"
 *                       api_name:
 *                         type: string
 *                         example: "/api/sign/create"
 *                       result_code:
 *                         type: string
 *                         example: "200"
 *                       latency_ms:
 *                         type: integer
 *                         example: 42
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-11-05T10:30:00.000Z"
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "limit은 1~100 사이여야 합니다"
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch logs"
 */
export const getLogs = async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit || "20", 10);

        // limit 범위 검증
        if (limit < 1 || limit > 100) {
            return res.status(400).json({
                ok: false,
                error: "limit은 1~100 사이여야 합니다"
            });
        }

        const rows = await getRecentLogs(limit);
        return res.status(200).json({
            ok: true,
            count: rows.length,
            data: rows,
        });
    } catch (err) {
        console.error("getLogs Error:", err);
        return res.status(500).json({
            ok: false,
            error: "Failed to fetch logs",
            details: err.message,
        });
    }
};

/**
 * @swagger
 * /api/log/{id}:
 *   get:
 *     summary: 로그 단건 조회
 *     description: |
 *       idx로 특정 로그를 조회합니다.
 *
 *       **사용 사례:**
 *       - 특정 API 호출의 상세 로그 확인
 *       - 에러 발생 시 해당 로그 상세 조회
 *     tags:
 *       - Log
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 123
 *         description: 조회할 로그의 idx
 *     responses:
 *       200:
 *         description: 로그 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     idx:
 *                       type: integer
 *                       example: 123
 *                     cate1:
 *                       type: string
 *                       example: "sign"
 *                     cate2:
 *                       type: string
 *                       example: "create"
 *                     request_id:
 *                       type: string
 *                       example: "c3a2e6c0-0b9e-4f6e-b8f1-3bb1d0f7a9af"
 *                     service_key_id:
 *                       type: integer
 *                       example: 1
 *                     req_ip_text:
 *                       type: string
 *                       example: "192.168.1.100"
 *                     req_server:
 *                       type: string
 *                       example: "web-server-01"
 *                     req_status:
 *                       type: string
 *                       example: "Y"
 *                     api_name:
 *                       type: string
 *                       example: "/api/sign/create"
 *                     result_code:
 *                       type: string
 *                       example: "200"
 *                     latency_ms:
 *                       type: integer
 *                       example: 42
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-11-05T10:30:00.000Z"
 *       404:
 *         description: 로그를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "로그를 찾을 수 없습니다"
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "유효하지 않은 로그 ID입니다"
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "로그 조회 중 오류가 발생했습니다"
 */
export const getLog = async (req, res, next) => {
    try {
        const { id } = req.params;

        // id 검증
        if (!id || isNaN(id)) {
            return res.status(400).json({
                ok: false,
                error: '유효하지 않은 로그 ID입니다'
            });
        }

        const log = await getLogByIdFromModel(parseInt(id));

        if (!log) {
            return res.status(404).json({
                ok: false,
                error: '로그를 찾을 수 없습니다'
            });
        }

        return res.status(200).json({
            ok: true,
            data: log
        });

    } catch (err) {
        // logger.error("getLog Error:", err);
        return res.status(500).json({
            ok: false,
            error: "로그 조회 중 오류가 발생했습니다",
            details: err.message,
        });
    }
};