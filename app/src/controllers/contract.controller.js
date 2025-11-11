/**
 * ============================================
 * contract.controller.js - 계약서 조회 컨트롤러
 * ============================================
 *
 * 역할:
 * - 계약서 단건 조회 (GET /api/contract/:id)
 * - 계약서 목록 조회 (GET /api/contract)
 * - 필터링 및 페이징 지원
 *
 * 변경 이력:
 * - 2025-11-04: Phase 2-D Swagger 문서화 추가
 */

import { getContractById, listContracts } from '../models/contract.model.js';
import logger from '../utils/logger.js';

/**
 * @swagger
 * /api/contract/{id}:
 *   get:
 *     summary: 계약서 단건 조회
 *     description: |
 *       idx(계약서 ID)로 특정 계약서 정보를 조회합니다.
 *
 *       **사용 사례:**
 *       - 관리자가 특정 계약서의 상세 정보를 확인할 때
 *       - 계약 체결 후 계약서 정보를 다시 확인할 때
 *       - 서명 상태 확인 (signed_or_not1, signed_or_not2)
 *     tags:
 *       - Contract (계약서) (수정중)
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: 조회할 계약서의 idx (Primary Key)
 *     responses:
 *       200:
 *         description: 계약서 조회 성공
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
 *                       description: 계약서 ID
 *                       example: 1
 *                     cate1:
 *                       type: string
 *                       description: 카테고리 1
 *                       example: "reward"
 *                     cate2:
 *                       type: string
 *                       description: 카테고리 2
 *                       example: "event"
 *                     sender:
 *                       type: string
 *                       description: 발신자 지갑 주소
 *                       example: "DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy"
 *                     recipient:
 *                       type: string
 *                       description: 수신자 지갑 주소
 *                       example: "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV"
 *                     feepayer:
 *                       type: string
 *                       description: 수수료 대납자 지갑 주소
 *                       example: "CompanyWalletAddress123"
 *                     ripy:
 *                       type: string
 *                       description: RIPY 토큰 수량
 *                       example: "100.50"
 *                     signed_or_not1:
 *                       type: string
 *                       enum: [Y, N]
 *                       description: 발신자 서명 여부
 *                       example: "Y"
 *                     signed_or_not2:
 *                       type: string
 *                       enum: [Y, N]
 *                       description: 수신자 서명 여부
 *                       example: "N"
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       description: 생성 일시
 *                       example: "2025-11-04T10:30:00.000Z"
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       description: 수정 일시
 *                       example: "2025-11-04T10:30:00.000Z"
 *       404:
 *         description: 계약서를 찾을 수 없음
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
 *                   example: "계약서를 찾을 수 없습니다"
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
 *                   example: "유효하지 않은 계약서 ID입니다"
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
 *                   example: "계약서 조회 중 오류가 발생했습니다"
 */
export async function getContract(req, res) {
    try {
        // URL 파라미터에서 id 추출
        const { id } = req.params;

        // id가 숫자인지 검증
        if (!id || isNaN(id)) {
            return res.status(400).json({
                ok: false,
                error: '유효하지 않은 계약서 ID입니다'
            });
        }

        // DB에서 계약서 조회
        const contract = await getContractById(parseInt(id));

        // 계약서가 없으면 404 반환
        if (!contract) {
            return res.status(404).json({
                ok: false,
                error: '계약서를 찾을 수 없습니다'
            });
        }

        // 성공 응답
        return res.status(200).json({
            ok: true,
            data: contract
        });

    } catch (error) {
        logger.error('[getContract] 계약서 조회 중 오류:', error);
        return res.status(500).json({
            ok: false,
            error: '계약서 조회 중 오류가 발생했습니다'
        });
    }
}

/**
 * @swagger
 * /api/contract:
 *   get:
 *     summary: 계약서 목록 조회
 *     description: |
 *       계약서 목록을 조회합니다. 필터링과 페이징을 지원합니다.
 *
 *       **필터링 옵션:**
 *       - cate1: 카테고리 1로 필터링
 *       - cate2: 카테고리 2로 필터링
 *       - sender: 발신자 지갑 주소로 필터링
 *       - recipient: 수신자 지갑 주소로 필터링
 *
 *       **페이징:**
 *       - page: 페이지 번호 (기본값: 1)
 *       - limit: 페이지당 항목 수 (기본값: 10, 최대: 100)
 *
 *       **사용 사례:**
 *       - 관리자가 전체 계약서 목록을 확인할 때
 *       - 특정 사용자의 계약서 목록을 조회할 때
 *       - 카테고리별로 계약서를 분류하여 조회할 때
 *     tags:
 *       - Contract (계약서) (수정중)
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: cate1
 *         schema:
 *           type: string
 *           example: "reward"
 *         description: 카테고리 1로 필터링
 *       - in: query
 *         name: cate2
 *         schema:
 *           type: string
 *           example: "event"
 *         description: 카테고리 2로 필터링
 *       - in: query
 *         name: sender
 *         schema:
 *           type: string
 *           example: "DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy"
 *         description: 발신자 지갑 주소로 필터링
 *       - in: query
 *         name: recipient
 *         schema:
 *           type: string
 *           example: "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV"
 *         description: 수신자 지갑 주소로 필터링
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *           example: 1
 *         description: 페이지 번호 (1부터 시작)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *           example: 10
 *         description: 페이지당 항목 수
 *     responses:
 *       200:
 *         description: 계약서 목록 조회 성공
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
 *                     contracts:
 *                       type: array
 *                       description: 계약서 목록
 *                       items:
 *                         type: object
 *                         properties:
 *                           idx:
 *                             type: integer
 *                             example: 1
 *                           cate1:
 *                             type: string
 *                             example: "reward"
 *                           cate2:
 *                             type: string
 *                             example: "event"
 *                           sender:
 *                             type: string
 *                             example: "DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy"
 *                           recipient:
 *                             type: string
 *                             example: "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV"
 *                           ripy:
 *                             type: string
 *                             example: "100.50"
 *                           signed_or_not1:
 *                             type: string
 *                             example: "Y"
 *                           signed_or_not2:
 *                             type: string
 *                             example: "N"
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-11-04T10:30:00.000Z"
 *                     pagination:
 *                       type: object
 *                       description: 페이징 정보
 *                       properties:
 *                         total:
 *                           type: integer
 *                           description: 전체 계약서 수
 *                           example: 50
 *                         page:
 *                           type: integer
 *                           description: 현재 페이지
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           description: 페이지당 항목 수
 *                           example: 10
 *                         totalPages:
 *                           type: integer
 *                           description: 전체 페이지 수
 *                           example: 5
 *       400:
 *         description: 잘못된 요청 파라미터
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
 *                   example: "페이지 번호는 1 이상이어야 합니다"
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
 *                   example: "계약서 목록 조회 중 오류가 발생했습니다"
 */
export async function getContractList(req, res) {
    try {
        // 쿼리 파라미터에서 필터 조건 추출
        const { cate1, cate2, sender, recipient, page = 1, limit = 10 } = req.query;

        // 페이지 및 limit 검증
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        if (isNaN(pageNum) || pageNum < 1) {
            return res.status(400).json({
                ok: false,
                error: '페이지 번호는 1 이상이어야 합니다'
            });
        }

        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            return res.status(400).json({
                ok: false,
                error: 'limit은 1~100 사이여야 합니다'
            });
        }

        // 필터 객체 구성
        const filters = {
            page: pageNum,
            limit: limitNum
        };

        // 선택적 필터 추가
        if (cate1) filters.cate1 = cate1;
        if (cate2) filters.cate2 = cate2;
        if (sender) filters.sender = sender;
        if (recipient) filters.recipient = recipient;

        // DB에서 계약서 목록 조회
        const result = await listContracts(filters);

        // 성공 응답
        return res.status(200).json({
            ok: true,
            data: result
        });

    } catch (error) {
        logger.error('[getContractList] 계약서 목록 조회 중 오류:', error);
        return res.status(500).json({
            ok: false,
            error: '계약서 목록 조회 중 오류가 발생했습니다'
        });
    }
}