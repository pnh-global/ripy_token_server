/**
 * 토큰 전송 서비스
 * 실제 토큰 전송 로직과 데이터베이스 처리를 담당합니다.
 */

const solanaService = require('./solanaService');
const db = require('../config/database');

/**
 * 토큰 전송 실행
 *
 * @param {object} transferData - 전송 데이터
 * @param {string} transferData.from_wallet - 보내는 지갑 주소
 * @param {string} transferData.to_wallet - 받는 지갑 주소
 * @param {number} transferData.amount - 전송 금액 (데시밸)
 * @returns {object} 전송 결과
 */
exports.executeTransfer = async (transferData) => {
    const { from_wallet, to_wallet, amount } = transferData;

    try {
        // 1. 데시밸을 일반 단위로 변환 (데시밸 = 10^-1, 즉 0.1 단위)
        // 예: amount가 10이면 실제로는 1 토큰을 의미
        const actualAmount = amount / 10;

        // 2. Solana 블록체인에 토큰 전송 요청
        const transferResult = await solanaService.transferToken(
            from_wallet,
            to_wallet,
            actualAmount
        );

        // 3. 전송 결과가 실패한 경우
        if (!transferResult.success) {
            throw new Error(transferResult.message || '토큰 전송 실패');
        }

        // 4. 전송 내역을 데이터베이스에 저장
        const txRecord = await saveTransferRecord({
            from_wallet,
            to_wallet,
            amount: actualAmount,
            amount_decimal: amount, // 데시밸 값 저장
            tx_signature: transferResult.signature,
            status: 'completed'
        });

        // 5. 성공 응답 반환
        return {
            tx_id: txRecord.insertId,
            signature: transferResult.signature,
            from_wallet,
            to_wallet,
            amount: actualAmount,
            amount_decimal: amount,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        // 에러 발생 시 데이터베이스에 실패 기록 저장
        await saveTransferRecord({
            from_wallet,
            to_wallet,
            amount: amount / 10,
            amount_decimal: amount,
            tx_signature: null,
            status: 'failed',
            error_message: error.message
        });

        throw error;
    }
};

/**
 * 전송 내역을 데이터베이스에 저장
 *
 * @param {object} recordData - 저장할 전송 데이터
 * @returns {object} DB 저장 결과
 */
async function saveTransferRecord(recordData) {
    const query = `
        INSERT INTO token_transfers 
        (from_wallet, to_wallet, amount, amount_decimal, tx_signature, status, error_message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const values = [
        recordData.from_wallet,
        recordData.to_wallet,
        recordData.amount,
        recordData.amount_decimal,
        recordData.tx_signature,
        recordData.status,
        recordData.error_message || null
    ];

    return await db.query(query, values);
}