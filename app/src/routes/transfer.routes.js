/**
 * transfer.routes.js
 *
 * 웹 서버 전용 토큰 전송 라우트
 */

import { Router } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import {
    createTransferSign,
    finalizeTransferSign,
    getTransferStatus
} from '../controllers/transfer.controller.js';

const router = Router();

/**
 * @swagger
 * /api/transfer/create:
 *   post:
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: success
 *                 code:
 *                   type: string
 *                   example: "0000"
 *                 message:
 *                   type: string
 *                   example: "사용자 서명이 필요합니다"
 *                 detail:
 *                   type: object
 *                   properties:
 *                     contract_id:
 *                       type: string
 *                       example: "8e436674-e6ee-43ee-8d72-7149da50a8f1"
 *                     partial_transaction:
 *                       type: string
 *                       example: "AQAAAAo=..."
 *                     status:
 *                       type: string
 *                       example: "pending"
 *       400:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: fail
 *                 code:
 *                   type: string
 *                   example: "9800"
 *                 message:
 *                   type: string
 *                   example: "필수 파라미터가 누락되었습니다"
 */
router.post('/create', asyncHandler(createTransferSign));

/**
 * @swagger
 * /api/transfer/finalize:
 *   post:
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contract_id
 *               - partial_transaction
 *             properties:
 *               contract_id:
 *                 type: string
 *                 example: "8e436674-e6ee-43ee-8d72-7149da50a8f1"
 *               partial_transaction:
 *                 type: string
 *                 description: 사용자 서명이 완료된 트랜잭션 (Base64)
 *                 example: "AgMfARmNTU2hKY+b..."
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: success
 *                 code:
 *                   type: string
 *                   example: "0000"
 *                 message:
 *                   type: string
 *                   example: "전송이 완료되었습니다"
 *                 detail:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     signature:
 *                       type: string
 *                     status:
 *                       type: string
 *                     explorer_url:
 *                       type: string
 */
router.post('/finalize', asyncHandler(finalizeTransferSign));

/**
 * @swagger
 * /api/transfer/finalize:
 *   post:
 *     tags:
 *       - Transfer (Web)
 *     summary: 최종 서명 완료 및 전송 (2단계)
 *     description: |
 *       **이 API의 역할 (7~8단계):**
 *       - A지갑 사용자가 서명한 완전한 트랜잭션을 받음
 *       - 서명 검증 (Feepayer ✓, A지갑 사용자 ✓)
 *       - Solana 네트워크로 트랜잭션 전송
 *       - B지갑으로 RIPY 전송 완료
 *       - DB 상태 업데이트 (pending → completed)
 *
 *       **⚠️ 중요: 이 API는 Request Body로 데이터를 전송합니다**
 *
 *       **웹서버가 전송해야 하는 데이터 (Request Body):**
 *       1. contract_id (필수)
 *          - /api/transfer/create에서 받은 계약 ID (UUID 형식)
 *          - 예: "74b46e9b-147a-45f8-9d66-d716b0a56be7"
 *
 *       2. user_transaction (필수)
 *          - 앱에서 A지갑 사용자가 서명한 완전한 트랜잭션 (Base64 형식)
 *          - Feepayer 서명 + A지갑 사용자 서명 모두 포함
 *
 *       **user_transaction 생성 과정 (앱에서):**
 *       ```javascript
 *       // Step 1: partial_transaction 복원
 *       const tx = Transaction.from(
 *         Buffer.from(partial_transaction, 'base64')
 *       );
 *
 *       // Step 2: Phantom 지갑으로 사용자 서명 요청
 *       const signedTx = await window.solana.signTransaction(tx);
 *
 *       // Step 3: 완전히 서명된 트랜잭션 직렬화
 *       const user_transaction = signedTx.serialize().toString('base64');
 *
 *       // Step 4: 웹서버로 전송
 *       // 웹서버는 이것을 받아서 토큰서버로 전달
 *       ```
 *
 *       **⚠️ 주의사항:**
 *       - partial_transaction (Step 1에서 받음) ≠ user_transaction (Step 2에서 보냄)
 *       - user_transaction는 A지갑 사용자 서명까지 추가된 완전한 트랜잭션
 *       - contract_id는 반드시 /api/transfer/create에서 받은 값을 사용
 *
 *       **호출 예시 (웹서버 → 토큰서버):**
 *       ```javascript
 *       fetch('http://token-server:4000/api/transfer/finalize', {
 *         method: 'POST',
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify({
 *           contract_id: "74b46e9b-147a-45f8-9d66-d716b0a56be7",
 *           user_transaction: "AQAAAAAAAAAAAAAAAAAAAAo=..."
 *         })
 *       })
 *       ```
 *     requestBody:
 *       required: true
 *       description: |
 *         **필수 데이터 2개를 JSON 형식으로 전송**
 *         - contract_id: 계약 ID
 *         - user_transaction: 사용자가 서명한 트랜잭션
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contract_id
 *               - user_transaction
 *             properties:
 *               contract_id:
 *                 type: string
 *                 format: uuid
 *                 description: |
 *                   **[필수]** /api/transfer/create에서 받은 계약 ID
 *
 *                   - 형식: UUID
 *                   - 예시: "74b46e9b-147a-45f8-9d66-d716b0a56be7"
 *                 example: "74b46e9b-147a-45f8-9d66-d716b0a56be7"
 *               user_transaction:
 *                 type: string
 *                 format: byte
 *                 description: |
 *                   **[필수]** A지갑 사용자가 서명한 완전한 트랜잭션 (Base64)
 *
 *                   **생성 방법:**
 *                   1. 앱이 partial_transaction을 받음
 *                   2. Phantom 지갑으로 사용자 서명
 *                   3. 서명된 트랜잭션을 Base64로 인코딩
 *                   4. 웹서버로 전달
 *                   5. 웹서버가 이 값을 토큰서버로 전송
 *
 *                   **주의:** partial_transaction과 다른 값!
 *                 example: "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo=..."
 *           examples:
 *             example1:
 *               summary: 정상 요청 예시
 *               value:
 *                 contract_id: "74b46e9b-147a-45f8-9d66-d716b0a56be7"
 *                 user_transaction: "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo=..."
 *     responses:
 *       200:
 *         description: |
 *           **전송 성공**
 *
 *           - Solana 네트워크로 트랜잭션 전송 완료
 *           - B지갑으로 RIPY 전송 완료
 *           - DB 상태 업데이트 완료
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: 성공 여부
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     signature:
 *                       type: string
 *                       description: |
 *                         Solana 트랜잭션 서명 (해시)
 *                         - Solana Explorer에서 확인 가능
 *                       example: "5B1mQ4Qxcg82M43DXiYPv7WGaiTKEqhXCrN9knTypqo2wrHqLg6DwYLeafRyMw45QxdadXAZ4DeEXp3KPgoyFw29"
 *                     status:
 *                       type: string
 *                       enum: [completed]
 *                       description: 계약 상태
 *                       example: "completed"
 *                     message:
 *                       type: string
 *                       example: "전송이 완료되었습니다"
 *                     explorer_url:
 *                       type: string
 *                       format: uri
 *                       description: Solana Explorer 링크 (트랜잭션 확인)
 *                       example: "https://explorer.solana.com/tx/5B1mQ4Qxcg82M43DXiYPv7WGaiTKEqhXCrN9knTypqo2wrHqLg6DwYLeafRyMw45QxdadXAZ4DeEXp3KPgoyFw29?cluster=devnet"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *             examples:
 *               success:
 *                 summary: 성공 응답
 *                 value:
 *                   success: true
 *                   data:
 *                     success: true
 *                     signature: "5B1mQ4Qxcg82M43DXiYPv7WGaiTKEqhXCrN9knTypqo2wrHqLg6DwYLeafRyMw45QxdadXAZ4DeEXp3KPgoyFw29"
 *                     status: "completed"
 *                     message: "전송이 완료되었습니다"
 *                     explorer_url: "https://explorer.solana.com/tx/5B1mQ4Qxcg82M43DXiYPv7WGaiTKEqhXCrN9knTypqo2wrHqLg6DwYLeafRyMw45QxdadXAZ4DeEXp3KPgoyFw29?cluster=devnet"
 *                   timestamp: "2025-11-07T02:20:05.000Z"
 *       400:
 *         description: |
 *           **잘못된 요청**
 *
 *           다음의 경우 400 에러 발생:
 *           - contract_id 누락
 *           - user_transaction 누락
 *           - JSON 형식 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missing_contract_id:
 *                 summary: contract_id 누락
 *                 value:
 *                   success: false
 *                   error: "계약 ID가 필요합니다"
 *                   timestamp: "2025-11-07T02:20:05.000Z"
 *               missing_signature:
 *                 summary: user_transaction 누락
 *                 value:
 *                   success: false
 *                   error: "사용자 서명이 필요합니다"
 *                   timestamp: "2025-11-07T02:20:05.000Z"
 *       404:
 *         description: |
 *           **계약을 찾을 수 없음**
 *
 *           - 존재하지 않는 contract_id
 *           - 잘못된 UUID 형식
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: "계약 정보를 찾을 수 없습니다"
 *               timestamp: "2025-11-07T02:20:05.000Z"
 *       409:
 *         description: |
 *           **이미 처리된 계약**
 *
 *           - 중복 전송 방지
 *           - 동일한 contract_id로 이미 완료된 경우
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: "이미 처리된 계약입니다"
 *               timestamp: "2025-11-07T02:20:05.000Z"
 *       500:
 *         description: |
 *           **전송 실패**
 *
 *           다음의 경우 500 에러 발생:
 *           - Feepayer 서명 누락 (트랜잭션 오류)
 *           - 사용자 서명 누락 (트랜잭션 오류)
 *           - Solana 네트워크 오류
 *           - A지갑 잔액 부족
 *           - 트랜잭션 타임아웃
 *           - DB 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missing_feepayer_sig:
 *                 summary: Feepayer 서명 없음
 *                 value:
 *                   success: false
 *                   error: "Feepayer 서명이 없습니다"
 *                   timestamp: "2025-11-07T02:20:05.000Z"
 *               missing_user_sig:
 *                 summary: 사용자 서명 없음
 *                 value:
 *                   success: false
 *                   error: "사용자 서명이 없습니다"
 *                   timestamp: "2025-11-07T02:20:05.000Z"
 *               insufficient_funds:
 *                 summary: 잔액 부족
 *                 value:
 *                   success: false
 *                   error: "트랜잭션 전송 실패: insufficient funds"
 *                   timestamp: "2025-11-07T02:20:05.000Z"
 *               network_error:
 *                 summary: 네트워크 오류
 *                 value:
 *                   success: false
 *                   error: "트랜잭션 전송 실패: network timeout"
 *                   timestamp: "2025-11-07T02:20:05.000Z"
 */
router.get('/status/:contract_id', asyncHandler(getTransferStatus));

export default router;