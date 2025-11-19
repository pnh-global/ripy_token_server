/**
 * 토큰 전송 컨트롤러
 * 웹 서버로부터 받은 토큰 전송 요청을 처리합니다.
 */

const transferService = require('../services/transferService');
const { validationResult } = require('express-validator');

/**
 * 토큰 전송 처리
 *
 * @param {object} req - 요청 객체
 * @param {object} res - 응답 객체
 * @returns {object} JSON 응답
 */
exports.transferToken = async (req, res) => {
    try {
        // 요청 파라미터 추출
        const { from_wallet, to_wallet, amount } = req.body;

        // 필수 파라미터 검증
        if (!from_wallet || !to_wallet || !amount) {
            return res.status(400).json({
                success: false,
                message: '필수 파라미터가 누락되었습니다.',
                required_params: ['from_wallet', 'to_wallet', 'amount']
            });
        }

        // 지갑 주소 형식 검증 (Solana 지갑 주소는 32-44자 길이)
        if (from_wallet.length < 32 || from_wallet.length > 44) {
            return res.status(400).json({
                success: false,
                message: '보내는 지갑 주소 형식이 올바르지 않습니다.'
            });
        }

        if (to_wallet.length < 32 || to_wallet.length > 44) {
            return res.status(400).json({
                success: false,
                message: '받는 지갑 주소 형식이 올바르지 않습니다.'
            });
        }

        // 금액 검증 (숫자 형식 및 양수 확인)
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: '금액은 0보다 큰 숫자여야 합니다.'
            });
        }

        // 토큰 전송 서비스 호출
        const result = await transferService.executeTransfer({
            from_wallet,
            to_wallet,
            amount: parsedAmount
        });

        // 성공 응답
        return res.status(200).json({
            success: true,
            message: '토큰 전송이 완료되었습니다.',
            data: result
        });

    } catch (error) {
        // 에러 로깅
        console.error('토큰 전송 에러:', error);

        // 에러 응답
        return res.status(500).json({
            success: false,
            message: '토큰 전송 중 오류가 발생했습니다.',
            error: error.message
        });
    }
};