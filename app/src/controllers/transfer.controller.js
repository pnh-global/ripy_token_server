/**
 * Transfer Controller
 * 토큰 전송 요청 처리 컨트롤러
 */

import { executeTransfer } from "../services/transfer.service.js";

/**
 * 토큰 전송 처리 함수
 *
 * @description 웹 서버로부터 받은 토큰 전송 요청을 검증하고 처리합니다.
 *
 * @param {object} req - Express 요청 객체
 * @param {object} req.body - 요청 본문
 * @param {string} req.body.from_wallet - 보내는 지갑 주소
 * @param {string} req.body.to_wallet - 받는 지갑 주소
 * @param {number} req.body.amount - 전송 금액 (데시밸 단위)
 *
 * @param {object} res - Express 응답 객체
 *
 * @returns {Promise<object>} JSON 응답
 *
 * @throws {Error} 파라미터 검증 실패, 전송 실패 등
 */
export const transferToken = async (req, res) => {
    try {
        // 1. 요청 파라미터 추출
        const { from_wallet, to_wallet, amount } = req.body;

        // 2. 필수 파라미터 존재 여부 검증
        if (!from_wallet || !to_wallet || !amount) {
            return res.status(400).json({
                success: false,
                message: "필수 파라미터가 누락되었습니다.",
                required_params: ["from_wallet", "to_wallet", "amount"],
                received_params: {
                    from_wallet: from_wallet ? "존재" : "누락",
                    to_wallet: to_wallet ? "존재" : "누락",
                    amount: amount ? "존재" : "누락"
                }
            });
        }

        // 3. 보내는 지갑 주소 형식 검증
        // Solana 지갑 주소는 Base58 인코딩으로 32-44자 길이
        if (typeof from_wallet !== "string" || from_wallet.length < 32 || from_wallet.length > 44) {
            return res.status(400).json({
                success: false,
                message: "보내는 지갑 주소 형식이 올바르지 않습니다.",
                detail: "Solana 지갑 주소는 32-44자 길이여야 합니다.",
                received_length: from_wallet ? from_wallet.length : 0
            });
        }

        // 4. 받는 지갑 주소 형식 검증
        if (typeof to_wallet !== "string" || to_wallet.length < 32 || to_wallet.length > 44) {
            return res.status(400).json({
                success: false,
                message: "받는 지갑 주소 형식이 올바르지 않습니다.",
                detail: "Solana 지갑 주소는 32-44자 길이여야 합니다.",
                received_length: to_wallet ? to_wallet.length : 0
            });
        }

        // 5. 같은 지갑으로 전송 방지
        if (from_wallet === to_wallet) {
            return res.status(400).json({
                success: false,
                message: "보내는 지갑과 받는 지갑이 동일할 수 없습니다."
            });
        }

        // 6. 금액 검증 (숫자 형식 및 양수 확인)
        const parsedAmount = parseFloat(amount);

        if (isNaN(parsedAmount)) {
            return res.status(400).json({
                success: false,
                message: "금액은 숫자 형식이어야 합니다.",
                received_amount: amount,
                received_type: typeof amount
            });
        }

        if (parsedAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "금액은 0보다 커야 합니다.",
                received_amount: parsedAmount
            });
        }

        // 7. 최대 금액 검증 (예: 1,000,000 데시밸 = 100,000 토큰)
        const MAX_AMOUNT = 1000000;
        if (parsedAmount > MAX_AMOUNT) {
            return res.status(400).json({
                success: false,
                message: `최대 전송 금액을 초과했습니다. (최대: ${MAX_AMOUNT} 데시밸)`,
                received_amount: parsedAmount,
                max_amount: MAX_AMOUNT
            });
        }

        // 8. 요청 로깅
        console.log("[Transfer Request]", {
            from_wallet,
            to_wallet,
            amount: parsedAmount,
            timestamp: new Date().toISOString()
        });

        // 9. 토큰 전송 서비스 호출
        const result = await executeTransfer({
            from_wallet,
            to_wallet,
            amount: parsedAmount
        });

        // 10. 성공 응답 로깅
        console.log("[Transfer Success]", {
            tx_id: result.tx_id,
            signature: result.signature,
            timestamp: new Date().toISOString()
        });

        // 11. 성공 응답 반환
        return res.status(200).json({
            success: true,
            message: "토큰 전송이 완료되었습니다.",
            data: result
        });

    } catch (error) {
        // 12. 에러 상세 로깅
        console.error("[Transfer Error]", {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });

        // 13. 에러 응답 반환
        return res.status(500).json({
            success: false,
            message: "토큰 전송 중 오류가 발생했습니다.",
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};