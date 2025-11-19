/**
 * transfer.service.js - finalizeAndSendTransaction 수정 버전
 *
 * 실제 사용자 서명 처리 로직 구현
 */

/**
 * 최종 서명 완료 및 전송 (수정 버전)
 *
 * @param {Object} params - 완료 파라미터
 * @param {string} params.contract_id - 계약 ID
 * @param {string} params.user_signature - 사용자 서명 (Base64 인코딩된 서명된 트랜잭션)
 * @param {string} params.req_ip - 요청 IP 주소
 * @returns {Promise<Object>} 전송 결과
 */
export async function finalizeAndSendTransaction(params) {
    const connection_db = await pool.getConnection();

    try {
        // 1. 입력값 검증
        const { contract_id, user_signature, req_ip } = params;

        if (!contract_id) {
            throw new Error('계약 ID가 필요합니다');
        }
        if (!user_signature) {
            throw new Error('사용자 서명이 필요합니다');
        }

        console.log('[DEBUG] ========== finalizeAndSendTransaction START ==========');
        console.log('[DEBUG] Contract ID:', contract_id);

        // 2. DB에서 계약 정보 조회
        console.log('[DEBUG] Step 1: Querying contract from DB...');
        const [contracts] = await connection_db.query(
            'SELECT * FROM r_contract WHERE contract_id = ?',
            [contract_id]
        );

        if (contracts.length === 0) {
            throw new Error('계약 정보를 찾을 수 없습니다');
        }

        const contract = contracts[0];
        console.log('[DEBUG] ✓ Contract found, status:', contract.status);

        // 3. 상태 체크
        if (contract.status === 'completed') {
            throw new Error('이미 처리된 계약입니다');
        }

        // 4. 사용자가 서명한 트랜잭션 복원
        console.log('[DEBUG] Step 2: Restoring signed transaction...');

        let transaction;
        try {
            // user_signature는 이미 사용자가 완전히 서명한 트랜잭션 (Base64)
            // 클라이언트에서 다음과 같이 처리됨:
            // 1. 서버로부터 부분 서명된 트랜잭션을 받음
            // 2. 사용자가 지갑으로 서명 추가
            // 3. 완전히 서명된 트랜잭션을 Base64로 인코딩하여 전송

            transaction = Transaction.from(
                Buffer.from(user_signature, 'base64')
            );

            console.log('[DEBUG] ✓ Transaction restored from user signature');
            console.log('[DEBUG] ✓ Transaction signatures count:', transaction.signatures.length);

        } catch (deserializeError) {
            console.error('[ERROR] Failed to deserialize transaction:', deserializeError);
            throw new Error('트랜잭션 복원 실패: 유효하지 않은 서명 데이터입니다');
        }

        // 5. 서명 검증
        console.log('[DEBUG] Step 3: Verifying signatures...');

        // 트랜잭션에 필요한 서명이 모두 있는지 확인
        const requiredSigners = transaction.compileMessage().header.numRequiredSignatures;
        const providedSignatures = transaction.signatures.filter(sig => sig.signature !== null).length;

        console.log('[DEBUG] Required signatures:', requiredSigners);
        console.log('[DEBUG] Provided signatures:', providedSignatures);

        if (providedSignatures < requiredSigners) {
            throw new Error(`서명이 부족합니다. 필요: ${requiredSigners}, 제공: ${providedSignatures}`);
        }

        console.log('[DEBUG] ✓ All required signatures present');

        // 6. Solana 네트워크로 전송
        console.log('[DEBUG] Step 4: Sending transaction to Solana network...');
        let txSignature;

        try {
            // 트랜잭션을 직렬화하여 전송
            const serializedTransaction = transaction.serialize();

            console.log('[DEBUG] Serialized transaction size:', serializedTransaction.length, 'bytes');

            // Solana 네트워크로 전송
            txSignature = await connection.sendRawTransaction(
                serializedTransaction,
                {
                    skipPreflight: false, // 프리플라이트 검증 수행
                    preflightCommitment: 'confirmed',
                    maxRetries: 3 // 최대 3번 재시도
                }
            );

            console.log('[DEBUG] ✓ Transaction sent, signature:', txSignature);

            // 트랜잭션 확인 대기
            console.log('[DEBUG] Step 5: Waiting for confirmation...');
            const confirmation = await connection.confirmTransaction(
                txSignature,
                'confirmed' // 확인 레벨: processed, confirmed, finalized
            );

            if (confirmation.value.err) {
                throw new Error(`트랜잭션 실패: ${JSON.stringify(confirmation.value.err)}`);
            }

            console.log('[DEBUG] ✓ Transaction confirmed');

        } catch (sendError) {
            console.error('[ERROR] Transaction send failed:', sendError);

            // Solana 에러 메시지 파싱
            let errorMessage = sendError.message;

            if (errorMessage.includes('insufficient funds')) {
                errorMessage = '잔액이 부족합니다';
            } else if (errorMessage.includes('blockhash not found')) {
                errorMessage = '트랜잭션이 만료되었습니다. 다시 시도해주세요';
            } else if (errorMessage.includes('already processed')) {
                errorMessage = '이미 처리된 트랜잭션입니다';
            }

            throw new Error(`트랜잭션 전송 실패: ${errorMessage}`);
        }

        // 7. DB 업데이트 트랜잭션 시작
        console.log('[DEBUG] Step 6: Updating database...');
        await connection_db.beginTransaction();

        // 8. r_contract 업데이트
        await connection_db.query(`
            UPDATE r_contract
            SET status = 'completed',
                tx_signature = ?,
                updated_at = NOW()
            WHERE contract_id = ?
        `, [txSignature, contract_id]);

        console.log('[DEBUG] ✓ Contract status updated');

        // 9. r_log 기록
        const ipInt = req_ip ? req_ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) : null;

        await connection_db.query(`
            INSERT INTO r_log (
                cate1,
                cate2,
                request_id,
                req_ip,
                req_ip_text,
                req_status,
                api_name,
                res_data,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
            'web_transfer',
            'finalize',
            contract_id,
            ipInt,
            req_ip || null,
            'Y',
            '/api/transfer/finalize',
            JSON.stringify({ signature: txSignature })
        ]);

        console.log('[DEBUG] ✓ Log inserted');

        // 10. 커밋
        await connection_db.commit();
        console.log('[DEBUG] ✓ Database transaction committed');

        console.log('[DEBUG] ========== finalizeAndSendTransaction SUCCESS ==========');

        // 11. 결과 반환
        return {
            success: true,
            signature: txSignature,
            status: 'completed',
            message: '전송이 완료되었습니다',
            explorer_url: `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`
        };

    } catch (error) {
        console.error('[ERROR] ========== finalizeAndSendTransaction FAILED ==========');
        console.error('[ERROR] Message:', error.message);
        console.error('[ERROR] Stack:', error.stack);

        // 롤백
        try {
            await connection_db.rollback();
            console.log('[DEBUG] ✓ Transaction rolled back');
        } catch (rollbackError) {
            console.error('[ERROR] Rollback failed:', rollbackError.message);
        }

        // 에러 로그 기록
        try {
            const ipInt = params.req_ip ? params.req_ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) : null;
            const errorMessage = error.message || 'Unknown error occurred';

            await connection_db.query(`
                INSERT INTO r_log (
                    cate1,
                    cate2,
                    request_id,
                    req_ip,
                    req_ip_text,
                    req_status,
                    api_name,
                    error_message,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                'web_transfer',
                'finalize',
                params.contract_id || 'unknown',
                ipInt,
                params.req_ip || null,
                'N',
                '/api/transfer/finalize',
                errorMessage.substring(0, 500)
            ]);

            console.log('[DEBUG] ✓ Error log inserted');
        } catch (logError) {
            console.error('[ERROR] Failed to insert error log:', logError.message);
        }

        throw error;

    } finally {
        connection_db.release();
        console.log('[DEBUG] ✓ DB connection released');
    }
}