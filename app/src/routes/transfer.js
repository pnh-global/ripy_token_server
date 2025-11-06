/**
 * 토큰 전송 라우트
 * 웹 서버로부터 토큰 전송 요청을 받아 처리합니다.
 * API Key 검증 없이 동작합니다.
 * 토큰 전송 요청을 받는 엔드포인트를 정의
 */

const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');

/**
 * POST /api/transfer
 *
 * @description 토큰 전송 API
 * @param {string} from_wallet - 보내는 지갑 주소
 * @param {string} to_wallet - 받는 지갑 주소
 * @param {string} amount - 전송할 금액 (데시밸 값)
 *
 * @returns {object} 전송 결과
 */
router.post('/', transferController.transferToken);

module.exports = router;