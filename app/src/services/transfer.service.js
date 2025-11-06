/**
 * Transfer Service
 * 토큰 전송 비즈니스 로직 처리
 */

import { transferToken } from "./webTransfer.service.js";
import pool from "../config/db.js";

/**
 * 토큰 전송 실행 함수
 *
 * @description
 * 1. 데시밸 값을 일반 단위로 변환
 * 2. Solana 블록체인에 토큰 전송 요청
 * 3. 전송 결과를 데이터베이스에 저장
 *
 * @param {object} transferData - 전송 데이터
 * @param {string} transferData.from_wallet - 보내는 지갑 주소
 * @param {string} transferData.to_wallet - 받는 지갑 주소
 * @param {number} transferData.amount - 전송 금액 (데시밸 단위)
 *
 * @returns {Promise<object>} 전송 결과
 * @returns {number} return.tx_id - 데이터베이스 전송 ID
 * @returns {string} return.signature - 블록체인 트랜잭션 서명
 * @returns {string} return.from_wallet - 보내는 지갑 주소
 * @returns {string} return.to_wallet - 받는 지갑 주소
 * @returns {number} return.amount - 실제 전송 금액 (일반 단위)
 * @returns {number} return.amount_decimal - 데시밸 단위 금액
 * @returns {string} return.timestamp - 전송 시간
 *
 * @throws {Error} 전송 실패 시 에러 발생
 */
export const executeTransfer = async (transferData) => {
    const { from_wallet, to_wallet, amount } = transferData;

    // DB 연결 객체
    let connection = null;

    try {
        // 1. 데시밸을 일반 단위로 변환
        // 데시밸(decibel)은 10^-1 단위, 즉 0.1 배율
        // 예: amount가 100이면 실제로는 10 토큰을 의미
        const actualAmount = amount / 10;

        console.log("[Transfer Service] 변환된 금액:", {
            input_decimal: amount,
            output_amount: actualAmount
        });

        // 2. 데이터베이스 연결 획득
        connection = await pool.getConnection();

        // 3. 트랜잭션 시작
        await connection.beginTransaction();

        // 4. 전송 전 pending 상태로 DB에 먼저 기록
        const pendingRecord = await savePendingTransfer(connection, {
            from_wallet,
            to_wallet,
            amount: actualAmount,
            amount_decimal: amount
        });

        console.log("[Transfer Service] Pending 기록 생성:", pendingRecord.insertId);

        // 5. Solana 블록체인에 토큰 전송 요청
        let transferResult;
        try {
            transferResult = await transferToken(
                from_wallet,
                to_wallet,
                actualAmount
            );
        } catch (solanaError) {
            // Solana 전송 실패 시
            console.error("[Transfer Service] Solana 전송 실패:", solanaError);

            // DB에 실패 상태 업데이트
            await updateTransferStatus(connection, pendingRecord.insertId, {
                status: "failed",
                error_message: solanaError.message
            });

            // 트랜잭션 커밋
            await connection.commit();

            throw new Error(`블록체인 전송 실패: ${solanaError.message}`);
        }

        // 6. 전송 결과 확인
        if (!transferResult.success) {
            // 전송 실패 처리
            await updateTransferStatus(connection, pendingRecord.insertId, {
                status: "failed",
                error_message: transferResult.message || "전송 실패"
            });

            await connection.commit();

            throw new Error(transferResult.message || "토큰 전송 실패");
        }

        // 7. 전송 성공 - DB 상태 업데이트
        await updateTransferStatus(connection, pendingRecord.insertId, {
            status: "completed",
            tx_signature: transferResult.signature
        });

        // 8. 트랜잭션 커밋
        await connection.commit();

        console.log("[Transfer Service] 전송 완료:", {
            tx_id: pendingRecord.insertId,
            signature: transferResult.signature
        });

        // 9. 성공 응답 반환
        return {
            tx_id: pendingRecord.insertId,
            signature: transferResult.signature,
            from_wallet,
            to_wallet,
            amount: actualAmount,
            amount_decimal: amount,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        // 10. 에러 발생 시 롤백
        if (connection) {
            await connection.rollback();
            console.log("[Transfer Service] 트랜잭션 롤백 완료");
        }

        console.error("[Transfer Service] 에러 발생:", error);
        throw error;

    } finally {
        // 11. 데이터베이스 연결 반환
        if (connection) {
            connection.release();
        }
    }
};

/**
 * Pending 상태의 전송 기록 생성
 *
 * @param {object} connection - DB 연결 객체
 * @param {object} recordData - 기록할 데이터
 * @returns {Promise<object>} DB 저장 결과
 */
async function savePendingTransfer(connection, recordData) {
    const query = `
        INSERT INTO token_transfers
            (from_wallet, to_wallet, amount, amount_decimal, status, created_at)
        VALUES (?, ?, ?, ?, 'pending', NOW())
    `;

    const values = [
        recordData.from_wallet,
        recordData.to_wallet,
        recordData.amount,
        recordData.amount_decimal
    ];

    const [result] = await connection.query(query, values);
    return result;
}

/**
 * 전송 상태 업데이트
 *
 * @param {object} connection - DB 연결 객체
 * @param {number} txId - 전송 ID
 * @param {object} updateData - 업데이트할 데이터
 * @returns {Promise<object>} DB 업데이트 결과
 */
async function updateTransferStatus(connection, txId, updateData) {
    const query = `
        UPDATE token_transfers
        SET
            status = ?,
            tx_signature = ?,
            error_message = ?,
            updated_at = NOW()
        WHERE id = ?
    `;

    const values = [
        updateData.status,
        updateData.tx_signature || null,
        updateData.error_message || null,
        txId
    ];

    const [result] = await connection.query(query, values);
    return result;
}