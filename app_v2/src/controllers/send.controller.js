/**
 * ============================================
 * send.controller.js - 회사 지갑 일괄 전송 컨트롤러
 * ============================================
 *
 * 역할:
 * - 회사 지갑에서 여러 사용자에게 일괄 전송 (POST /api/send/company)
 * - 전송 상태 조회 (GET /api/send/company/:request_id)
 *
 * 변경 이력:
 * - 2025-11-05: Phase 2-D Swagger 문서화 추가
 */

import {
    createCompanySendRequest,
    processCompanySend,
    getCompanySendStatus
} from "../services/send.service.js";

/**
 * @swagger
 * /api/send/company:
 *   post:
 *     summary: 회사 지갑 일괄 전송
 *     description: |
 *       회사 지갑에서 여러 사용자에게 RIPY 토큰을 일괄 전송합니다.
 *
 *       **프로세스:**
 *       1. 전송 요청 접수 (즉시 request_id 반환)
 *       2. 백그라운드에서 비동기 처리 시작
 *       3. 각 수신자에게 순차적으로 전송
 *       4. 진행 상태는 GET /api/send/company/:request_id로 확인
 *
 *       **사용 사례:**
 *       - 이벤트 보상 일괄 지급
 *       - 에어드랍 배포
 *       - 급여/수당 지급
 *     tags:
 *       - Solana (전송) (수정중)
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipients
 *             properties:
 *               cate1:
 *                 type: string
 *                 description: 카테고리 1
 *                 default: "company_send"
 *                 example: "company_send"
 *               cate2:
 *                 type: string
 *                 description: 카테고리 2
 *                 default: "batch"
 *                 example: "batch"
 *               recipients:
 *                 type: array
 *                 description: 수신자 목록 (최소 1명 이상)
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - wallet_address_encrypted
 *                     - amount
 *                   properties:
 *                     wallet_address_encrypted:
 *                       type: string
 *                       description: 암호화된 수신자 지갑 주소
 *                       example: "U2FsdGVkX1+abcdefg..."
 *                     amount:
 *                       type: number
 *                       description: 전송할 RIPY 토큰 수량
 *                       minimum: 0.000000001
 *                       example: 100.5
 *                 example:
 *                   - wallet_address_encrypted: "U2FsdGVkX1+abc123..."
 *                     amount: 100.5
 *                   - wallet_address_encrypted: "U2FsdGVkX1+def456..."
 *                     amount: 50.25
 *     responses:
 *       202:
 *         description: 전송 요청 접수 완료 (비동기 처리 시작)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 request_id:
 *                   type: string
 *                   description: 전송 요청 ID (상태 조회용)
 *                   example: "req_20251105_abc123"
 *       400:
 *         description: 잘못된 요청 (수신자 목록 없음)
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
 *                   example: "recipients required"
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
 *                   example: "Internal server error"
 */
export const postCompanySend = async (req, res) => {
    const { cate1 = "company_send", cate2 = "batch", recipients = [] } = req.body || {};

    if (!Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ ok: false, error: "recipients required" });
    }

    const { request_id } = await createCompanySendRequest({ cate1, cate2, recipients });

    // 비동기 처리 kick (await 하지 않음)
    processCompanySend(request_id, {
        ip: req.ip?.toString().replace("::ffff:", ""),
        server: req.headers.host
    }).catch(err => console.error("[company_send]", err));

    res.status(202).json({ ok: true, request_id });
};

/**
 * @swagger
 * /api/send/company/{request_id}:
 *   get:
 *     summary: 일괄 전송 상태 조회
 *     description: |
 *       회사 지갑 일괄 전송의 진행 상태를 조회합니다.
 *
 *       **조회 가능 정보:**
 *       - 전체 전송 대상 수
 *       - 성공/실패 건수
 *       - 진행 중인 건수
 *       - 개별 전송 상태
 *
 *       **사용 사례:**
 *       - 일괄 전송 진행 상황 모니터링
 *       - 실패한 전송 확인
 *       - 전송 완료 여부 확인
 *     tags:
 *       - Solana (전송) (수정중)
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: request_id
 *         required: true
 *         schema:
 *           type: string
 *           example: "req_20251105_abc123"
 *         description: POST /api/send/company에서 받은 request_id
 *     responses:
 *       200:
 *         description: 전송 상태 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: object
 *                   description: 전송 상태 정보
 *                   properties:
 *                     request_id:
 *                       type: string
 *                       example: "req_20251105_abc123"
 *                     total:
 *                       type: integer
 *                       description: 전체 전송 대상 수
 *                       example: 10
 *                     success:
 *                       type: integer
 *                       description: 성공한 전송 건수
 *                       example: 8
 *                     failed:
 *                       type: integer
 *                       description: 실패한 전송 건수
 *                       example: 1
 *                     pending:
 *                       type: integer
 *                       description: 처리 중인 전송 건수
 *                       example: 1
 *                     completed:
 *                       type: boolean
 *                       description: 전체 전송 완료 여부
 *                       example: false
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       description: 요청 생성 시각
 *                       example: "2025-11-05T10:30:00.000Z"
 *       404:
 *         description: 전송 요청을 찾을 수 없음
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
 *                   example: "not found"
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
 *                   example: "Internal server error"
 */
export const getCompanySend = async (req, res) => {
    const s = await getCompanySendStatus(req.params.request_id);
    if (!s) return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true, status: s });
};