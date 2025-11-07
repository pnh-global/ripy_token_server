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
 *     tags:
 *       - Transfer (Web)
 *     summary: 부분 서명 트랜잭션 생성 (1단계)
 *     description: |
 *       **전체 플로우:**
 *       ```
 *       1. 웹서버 → 토큰서버: A지갑에서 B지갑으로 RIPY 전송 요청
 *       2. 토큰서버: Feepayer(회사 지갑) 서명 완료 + 계약 정보 DB 저장
 *       3. 토큰서버 → 웹서버: "A지갑 사용자에게 서명 받아오세요" (partial_transaction 포함)
 *       4. 웹서버 → 앱: 서명 요청 (partial_transaction 전달)
 *       5. 앱: Phantom 지갑으로 A지갑 사용자 서명
 *       6. 앱 → 웹서버: 서명 완료된 트랜잭션 전달
 *       7. 웹서버 → 토큰서버: /api/transfer/finalize 호출
 *       8. 토큰서버: Solana 네트워크로 전송 → B지갑으로 RIPY 전송 완료
 *       ```
 *
 *       **이 API의 역할 (1~3단계):**
 *       - from_wallet(A지갑), to_wallet(B지갑), amount를 받아서
 *       - Feepayer(회사 지갑)가 가스비 부담을 위해 먼저 서명
 *       - 부분 서명된 트랜잭션(partial_transaction)을 웹서버에 반환
 *       - 웹서버는 이것을 앱으로 전달하여 A지갑 사용자에게 서명 요청
 *
 *       **중요:**
 *       - API Key 검증 없음 (웹 전용)
 *       - Feepayer가 가스비 부담
 *       - 반환된 partial_transaction은 이미 Feepayer 서명 완료 상태
 *       - A지갑 사용자 서명만 추가하면 전송 가능
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - from_wallet
 *               - to_wallet
 *               - amount
 *             properties:
 *               from_wallet:
 *                 type: string
 *                 description: 발신자 지갑 주소 (A지갑, Base58 형식)
 *                 example: "BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh"
 *               to_wallet:
 *                 type: string
 *                 description: 수신자 지갑 주소 (B지갑, Base58 형식)
 *                 example: "AiF7NdJKaDxHsfnRzKKH2SR1GJ2u8upvnnVSsrPEikgw"
 *               amount:
 *                 type: string
 *                 description: 전송 금액 (RIPY 단위, 소수점 가능)
 *                 example: "10"
 *     responses:
 *       200:
 *         description: 부분 서명 트랜잭션 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     contract_id:
 *                       type: string
 *                       format: uuid
 *                       description: 계약 ID (다음 단계에서 필요)
 *                       example: "74b46e9b-147a-45f8-9d66-d716b0a56be7"
 *                     partial_transaction:
 *                       type: string
 *                       description: |
 *                         Feepayer가 서명한 부분 서명 트랜잭션 (Base64)
 *                         - 웹서버는 이것을 앱으로 전달
 *                         - 앱에서 Phantom 지갑으로 A지갑 사용자 서명 요청
 *                       example: "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo=..."
 *                     status:
 *                       type: string
 *                       enum: [pending]
 *                       description: 계약 상태 (사용자 서명 대기 중)
 *                       example: "pending"
 *                     message:
 *                       type: string
 *                       description: 다음 단계 안내 메시지
 *                       example: "사용자 서명이 필요합니다"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *             example:
 *               success: true
 *               data:
 *                 contract_id: "74b46e9b-147a-45f8-9d66-d716b0a56be7"
 *                 partial_transaction: "AQAAAAAAAAAAAAAAAAAAAAo=..."
 *                 status: "pending"
 *                 message: "사용자 서명이 필요합니다"
 *               timestamp: "2025-11-07T02:20:02.000Z"
 *       400:
 *         description: |
 *           잘못된 요청
 *           - 필수 파라미터 누락 (from_wallet, to_wallet, amount)
 *           - 잘못된 지갑 주소 형식
 *           - 금액이 0 이하
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: "발신 지갑 주소가 필요합니다"
 *               timestamp: "2025-11-07T02:20:02.000Z"
 *       500:
 *         description: |
 *           서버 내부 오류
 *           - DB 연결 실패
 *           - Solana RPC 연결 실패
 *           - 발신자 토큰 계정 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/create', asyncHandler(createTransferSign));

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
 *       **웹서버가 전달해야 하는 것:**
 *       - contract_id: /api/transfer/create에서 받은 계약 ID
 *       - user_signature: 앱에서 A지갑 사용자가 서명한 완전한 트랜잭션 (Base64)
 *
 *       **user_signature 생성 과정 (앱에서):**
 *       ```javascript
 *       // 1. partial_transaction 복원
 *       const tx = Transaction.from(Buffer.from(partial_transaction, 'base64'));
 *
 *       // 2. Phantom 지갑으로 서명 요청
 *       const signedTx = await window.solana.signTransaction(tx);
 *
 *       // 3. 완전히 서명된 트랜잭션 직렬화
 *       const user_signature = signedTx.serialize().toString('base64');
 *       ```
 *
 *       **주의:**
 *       - partial_transaction ≠ user_signature (다른 값!)
 *       - user_signature는 A지갑 사용자 서명까지 포함된 완전한 트랜잭션
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contract_id
 *               - user_signature
 *             properties:
 *               contract_id:
 *                 type: string
 *                 format: uuid
 *                 description: /api/transfer/create에서 받은 계약 ID
 *                 example: "74b46e9b-147a-45f8-9d66-d716b0a56be7"
 *               user_signature:
 *                 type: string
 *                 description: |
 *                   A지갑 사용자가 서명한 완전한 트랜잭션 (Base64)
 *                   - 앱에서 Phantom 지갑으로 서명 완료한 트랜잭션
 *                   - Feepayer 서명 + A지갑 서명 모두 포함
 *                 example: "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo=..."
 *     responses:
 *       200:
 *         description: 전송 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     signature:
 *                       type: string
 *                       description: Solana 트랜잭션 서명 (해시)
 *                       example: "5B1mQ4Qxcg82M43DXiYPv7WGaiTKEqhXCrN9knTypqo2wrHqLg6DwYLeafRyMw45QxdadXAZ4DeEXp3KPgoyFw29"
 *                     status:
 *                       type: string
 *                       enum: [completed]
 *                       description: 계약 상태 (전송 완료)
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
 *             example:
 *               success: true
 *               data:
 *                 success: true
 *                 signature: "5B1mQ4Qxcg82M43DXiYPv7WGaiTKEqhXCrN9knTypqo2wrHqLg6DwYLeafRyMw45QxdadXAZ4DeEXp3KPgoyFw29"
 *                 status: "completed"
 *                 message: "전송이 완료되었습니다"
 *                 explorer_url: "https://explorer.solana.com/tx/5B1mQ4Qxcg82M43DXiYPv7WGaiTKEqhXCrN9knTypqo2wrHqLg6DwYLeafRyMw45QxdadXAZ4DeEXp3KPgoyFw29?cluster=devnet"
 *               timestamp: "2025-11-07T02:20:05.000Z"
 *       400:
 *         description: |
 *           잘못된 요청
 *           - contract_id 또는 user_signature 누락
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: |
 *           계약을 찾을 수 없음
 *           - 존재하지 않는 contract_id
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
 *           이미 처리된 계약
 *           - 중복 전송 방지
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
 *           전송 실패
 *           - Feepayer 또는 사용자 서명 없음
 *           - Solana 네트워크 오류
 *           - 잔액 부족
 *           - 트랜잭션 타임아웃
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: "트랜잭션 전송 실패: insufficient funds"
 *               timestamp: "2025-11-07T02:20:05.000Z"
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
 *       2. user_signature (필수)
 *          - 앱에서 A지갑 사용자가 서명한 완전한 트랜잭션 (Base64 형식)
 *          - Feepayer 서명 + A지갑 사용자 서명 모두 포함
 *
 *       **user_signature 생성 과정 (앱에서):**
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
 *       const user_signature = signedTx.serialize().toString('base64');
 *
 *       // Step 4: 웹서버로 전송
 *       // 웹서버는 이것을 받아서 토큰서버로 전달
 *       ```
 *
 *       **⚠️ 주의사항:**
 *       - partial_transaction (Step 1에서 받음) ≠ user_signature (Step 2에서 보냄)
 *       - user_signature는 A지갑 사용자 서명까지 추가된 완전한 트랜잭션
 *       - contract_id는 반드시 /api/transfer/create에서 받은 값을 사용
 *
 *       **호출 예시 (웹서버 → 토큰서버):**
 *       ```javascript
 *       fetch('http://token-server:4000/api/transfer/finalize', {
 *         method: 'POST',
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify({
 *           contract_id: "74b46e9b-147a-45f8-9d66-d716b0a56be7",
 *           user_signature: "AQAAAAAAAAAAAAAAAAAAAAo=..."
 *         })
 *       })
 *       ```
 *     requestBody:
 *       required: true
 *       description: |
 *         **필수 데이터 2개를 JSON 형식으로 전송**
 *         - contract_id: 계약 ID
 *         - user_signature: 사용자가 서명한 트랜잭션
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contract_id
 *               - user_signature
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
 *               user_signature:
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
 *                 user_signature: "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAo=..."
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
 *           - user_signature 누락
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
 *                 summary: user_signature 누락
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