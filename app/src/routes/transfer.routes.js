/**
 * Transfer Routes
 * 토큰 전송 관련 라우트
 * API Key 검증 없이 동작
 */

import { Router } from "express";
import { transferToken } from "../controllers/transfer.controller.js";

const router = Router();

/**
 * POST /api/transfer
 * 토큰 전송 API
 *
 * @description 웹 서버로부터 토큰 전송 요청을 받아 처리합니다.
 * @route POST /api/transfer
 * @access Public (API Key 검증 없음)
 *
 * @body {string} from_wallet - 보내는 지갑 주소 (Solana 주소 형식, 32-44자)
 * @body {string} to_wallet - 받는 지갑 주소 (Solana 주소 형식, 32-44자)
 * @body {number} amount - 전송 금액 (데시밸 단위)
 *
 * @returns {object} 200 - 전송 성공
 * @returns {object} 400 - 잘못된 요청 (파라미터 오류)
 * @returns {object} 500 - 서버 에러
 *
 * @example
 * Request Body:
 * {
 *   "from_wallet": "BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh",
 *   "to_wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
 *   "amount": 100
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "토큰 전송이 완료되었습니다.",
 *   "data": {
 *     "tx_id": 1,
 *     "signature": "5J7Wm...",
 *     "from_wallet": "BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh",
 *     "to_wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
 *     "amount": 10,
 *     "amount_decimal": 100,
 *     "timestamp": "2025-11-06T12:00:00.000Z"
 *   }
 * }
 */
router.post("/", transferToken);

export default router;