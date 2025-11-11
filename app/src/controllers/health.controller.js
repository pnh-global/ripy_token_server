// src/controllers/health.controller.js

/**
 * 헬스 체크 컨트롤러
 * 서버 상태와 데이터베이스 연결 상태를 확인합니다
 */

import pool from '../config/db.js';
import {
    SUCCESS,
    INTERNAL_SERVER_ERROR
} from '../utils/resultCodes.js';
/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: 서버 헬스 체크
 *     description: 서버와 데이터베이스 연결 상태를 확인합니다
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: 서버 정상 동작
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: "success"
 *                 code:
 *                   type: string
 *                   example: "CODE0000"
 *                 detail:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: "healthy"
 *                     database:
 *                       type: object
 *                       properties:
 *                         connected:
 *                           type: boolean
 *                           example: true
 *       503:
 *         description: 서버 또는 DB 연결 실패
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: "fail"
 *                 code:
 *                   type: string
 *                   example: "CODE9999"
 *                 detail:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: "unhealthy"
 *                     database:
 *                       type: object
 *                       properties:
 *                         connected:
 *                           type: boolean
 *                           example: false
 *                 message:
 *                   type: string
 *                   example: "Database connection failed"
 */

/**
 * @api {get} /health Health Check
 * @apiName HealthCheck
 * @apiGroup Health
 * @apiDescription 서버 및 DB 연결 상태 확인
 */
export async function healthCheck(req, res) {
    try {
        // DB 연결 상태 확인
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();

        // 정상 응답
        return res.status(200).json({
            result: 'success',
            code: SUCCESS,
            detail: {
                status: 'healthy',
                database: {
                    connected: true
                }
            }
        });
    } catch (error) {
        // DB 연결 실패 시에도 서버는 살아있음을 알림
        return res.status(503).json({
            result: 'fail',
            code: INTERNAL_SERVER_ERROR,
            detail: {
                status: 'unhealthy',
                database: {
                    connected: false
                }
            },
            message: error.message
        });
    }
}