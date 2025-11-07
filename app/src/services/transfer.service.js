/**
 * transfer.service.js
 *
 * 웹 서버 전용 토큰 전송 서비스
 * - API Key 검증 없음
 * - 사용자 서명 기반 전송
 * - feepayer는 회사 지갑
 */

import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    sendAndConfirmTransaction
} from '@solana/web3.js';
import {
    getAssociatedTokenAddress,
    createTransferInstruction,
    TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { pool } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import bs58 from 'bs58';

// Solana 네트워크 연결 설정
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

console.log('[INIT] Solana RPC URL:', SOLANA_RPC_URL);
console.log('[INIT] RIPY Token Mint Address:', process.env.RIPY_TOKEN_MINT_ADDRESS);

// RIPY 토큰 민트 주소
const RIPY_TOKEN_MINT = new PublicKey(process.env.RIPY_TOKEN_MINT_ADDRESS);

// 회사 feepayer 지갑
let feepayerKeypair;
try {
    const feepayerPrivateKey = process.env.FEEPAYER_PRIVATE_KEY;
    if (!feepayerPrivateKey) {
        throw new Error('FEEPAYER_PRIVATE_KEY 환경변수가 설정되지 않았습니다');
    }
    feepayerKeypair = Keypair.fromSecretKey(bs58.decode(feepayerPrivateKey));
    console.log('[INIT] Feepayer loaded:', feepayerKeypair.publicKey.toBase58());
} catch (error) {
    console.error('[INIT ERROR] Feepayer 지갑 로드 실패:', error.message);
}

/**
 * 입력값 검증 함수
 */
function validateTransferParams(params) {
    const { from_wallet, to_wallet, amount } = params;

    // 필수 파라미터 체크
    if (!from_wallet) {
        throw new Error('발신 지갑 주소가 필요합니다');
    }
    if (!to_wallet) {
        throw new Error('수신 지갑 주소가 필요합니다');
    }
    if (!amount) {
        throw new Error('전송 금액이 필요합니다');
    }

    // 금액 검증
    const amountNumber = parseFloat(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
        throw new Error('전송 금액은 0보다 커야 합니다');
    }

    // 지갑 주소 형식 검증
    try {
        new PublicKey(from_wallet);
        new PublicKey(to_wallet);
    } catch (error) {
        throw new Error('유효하지 않은 지갑 주소 형식입니다');
    }

    return true;
}

/**
 * 부분 서명 트랜잭션 생성
 */
export async function createPartialTransaction(params) {
    console.log('[DEBUG] ========== createPartialTransaction START ==========');
    console.log('[DEBUG] Input params:', JSON.stringify(params, null, 2));

    const connection_db = await pool.getConnection();

    try {
        // 1. 입력값 검증
        console.log('[DEBUG] Step 1: Validating parameters...');
        validateTransferParams(params);
        console.log('[DEBUG] ✓ Parameters validated');

        const { from_wallet, to_wallet, amount, req_ip } = params;

        // 2. 계약 ID 생성
        console.log('[DEBUG] Step 2: Generating contract ID...');
        const contractId = uuidv4();
        console.log('[DEBUG] ✓ Contract ID:', contractId);

        // 3. Solana 공개키 생성
        console.log('[DEBUG] Step 3: Creating public keys...');
        const fromPubkey = new PublicKey(from_wallet);
        const toPubkey = new PublicKey(to_wallet);
        console.log('[DEBUG] ✓ From pubkey:', fromPubkey.toBase58());
        console.log('[DEBUG] ✓ To pubkey:', toPubkey.toBase58());

        // 4. 토큰 계정 주소 가져오기
        console.log('[DEBUG] Step 4: Getting associated token addresses...');
        let fromTokenAccount, toTokenAccount;

        try {
            fromTokenAccount = await getAssociatedTokenAddress(
                RIPY_TOKEN_MINT,
                fromPubkey
            );
            console.log('[DEBUG] ✓ From token account:', fromTokenAccount.toBase58());

            toTokenAccount = await getAssociatedTokenAddress(
                RIPY_TOKEN_MINT,
                toPubkey
            );
            console.log('[DEBUG] ✓ To token account:', toTokenAccount.toBase58());
        } catch (tokenError) {
            console.error('[ERROR] Failed to get token accounts:', tokenError);
            throw new Error(`토큰 계정 주소 조회 실패: ${tokenError.message}`);
        }

        // 5. 전송 금액 계산 (9 decimals)
        console.log('[DEBUG] Step 5: Calculating transfer amount...');
        const transferAmount = BigInt(Math.floor(parseFloat(amount) * 1_000_000_000));
        console.log('[DEBUG] ✓ Transfer amount:', transferAmount.toString(), 'lamports');

        // 5.5. 발신자 토큰 계정 존재 확인
        console.log('[DEBUG] Step 5.5: Verifying sender token account...');
        try {
            const fromAccountInfo = await connection.getAccountInfo(fromTokenAccount);
            if (!fromAccountInfo) {
                throw new Error('발신자의 RIPY 토큰 계정이 존재하지 않습니다.');
            }
            console.log('[DEBUG] ✓ Sender token account verified');
        } catch (accountCheckError) {
            if (accountCheckError.message.includes('발신자의 RIPY 토큰 계정이 존재하지 않습니다')) {
                throw accountCheckError;
            }
            throw new Error(`발신자 토큰 계정 확인 실패: ${accountCheckError.message}`);
        }

        // 5.6. 수신자 토큰 계정 존재 확인
        console.log('[DEBUG] Step 5.6: Verifying recipient token account...');
        let needCreateAta = false;

        try {
            const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
            if (!toAccountInfo) {
                console.log('[DEBUG] ⚠ Recipient token account does not exist');
                console.log('[DEBUG] → Will create recipient token account');
                needCreateAta = true;
            } else {
                console.log('[DEBUG] ✓ Recipient token account verified');
            }
        } catch (accountCheckError) {
            throw new Error(`수신자 토큰 계정 확인 실패: ${accountCheckError.message}`);
        }

        // 6. 트랜잭션 생성
        console.log('[DEBUG] Step 6: Creating transaction...');
        const transaction = new Transaction();

        // 6.1. ATA 생성이 필요하면 instruction 추가
        if (needCreateAta) {
            console.log('[DEBUG] Step 6.1: Adding create ATA instruction...');
            const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');

            const createAtaIx = createAssociatedTokenAccountInstruction(
                feepayerKeypair.publicKey,
                toTokenAccount,
                toPubkey,
                RIPY_TOKEN_MINT
            );

            transaction.add(createAtaIx);
            console.log('[DEBUG] ✓ Create ATA instruction added');
        }

        // 6.2. 토큰 전송 instruction 추가
        console.log('[DEBUG] Step 6.2: Adding transfer instruction...');
        transaction.add(
            createTransferInstruction(
                fromTokenAccount,
                toTokenAccount,
                fromPubkey,
                transferAmount,
                [],
                TOKEN_PROGRAM_ID
            )
        );
        console.log('[DEBUG] ✓ Transfer instruction added');

        // 7. 최근 블록해시 가져오기
        console.log('[DEBUG] Step 7: Getting latest blockhash...');
        let blockhash, lastValidBlockHeight;

        try {
            const blockHashResult = await connection.getLatestBlockhash('finalized');
            blockhash = blockHashResult.blockhash;
            lastValidBlockHeight = blockHashResult.lastValidBlockHeight;
            console.log('[DEBUG] ✓ Blockhash:', blockhash);
            console.log('[DEBUG] ✓ Last valid block height:', lastValidBlockHeight);
        } catch (rpcError) {
            throw new Error(`Solana RPC 연결 실패: ${rpcError.message}`);
        }

        // 8. 트랜잭션 설정
        console.log('[DEBUG] Step 8: Setting transaction properties...');
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        transaction.feePayer = feepayerKeypair.publicKey;
        console.log('[DEBUG] ✓ Fee payer:', feepayerKeypair.publicKey.toBase58());

        // 9. 회사 지갑으로 부분 서명
        console.log('[DEBUG] Step 9: Partial signing with feepayer...');
        transaction.partialSign(feepayerKeypair);
        console.log('[DEBUG] ✓ Transaction partially signed');

        // 10. 트랜잭션 직렬화
        console.log('[DEBUG] Step 10: Serializing transaction...');
        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false
        });
        const transactionBase64 = serializedTransaction.toString('base64');
        console.log('[DEBUG] ✓ Transaction serialized (length:', transactionBase64.length, ')');

        // 11. DB 트랜잭션 시작
        console.log('[DEBUG] Step 11: Starting DB transaction...');
        await connection_db.beginTransaction();

        // 12. r_contract 테이블에 저장
        console.log('[DEBUG] Step 12: Inserting into r_contract...');

        const insertQuery = `
            INSERT INTO r_contract (
                contract_id,
                cate1,
                cate2,
                from_wallet,
                to_wallet,
                ripy,
                contract_data,
                status,
                blockhash,
                last_valid_block_height,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;

        await connection_db.query(insertQuery, [
            contractId,
            'web_transfer',
            'user_to_user',
            from_wallet,
            to_wallet,
            amount,
            transactionBase64,
            'pending',
            blockhash,
            lastValidBlockHeight
        ]);
        console.log('[DEBUG] ✓ Contract inserted');

        // 13. r_log 테이블에 로그 기록
        console.log('[DEBUG] Step 13: Inserting into r_log...');

        const ipv4Address = req_ip ? req_ip.replace('::ffff:', '') : null;

        const logQuery = `
            INSERT INTO r_log (
                cate1,
                cate2,
                request_id,
                req_ip_text,
                req_status,
                api_name,
                res_data,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `;

        await connection_db.query(logQuery, [
            'web_transfer',
            'create',
            contractId,
            ipv4Address,
            'Y',
            '/api/transfer/create',
            JSON.stringify({
                from_wallet,
                to_wallet,
                amount,
                blockhash
            })
        ]);
        console.log('[DEBUG] ✓ Log inserted');

        // 14. 커밋
        console.log('[DEBUG] Step 14: Committing transaction...');
        await connection_db.commit();
        console.log('[DEBUG] ✓ Transaction committed');

        // 15. 결과 반환
        console.log('[DEBUG] ========== createPartialTransaction SUCCESS ==========\n');

        return {
            contract_id: contractId,
            partial_transaction: transactionBase64,
            status: 'pending',
            message: '사용자 서명이 필요합니다'
        };

    } catch (error) {
        console.error('[ERROR] ========== createPartialTransaction FAILED ==========');
        console.error('[ERROR] Name:', error.name);
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
            const ipv4Address = params.req_ip ? params.req_ip.replace('::ffff:', '') : null;
            const errorMessage = error.message || 'Unknown error occurred';

            const errorLogQuery = `
                INSERT INTO r_log (
                    cate1,
                    cate2,
                    request_id,
                    req_ip_text,
                    req_status,
                    api_name,
                    error_message,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            `;

            await connection_db.query(errorLogQuery, [
                'web_transfer',
                'create',
                'error',
                ipv4Address,
                'N',
                '/api/transfer/create',
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

/**
 * 최종 서명 완료 및 전송
 */
export async function finalizeAndSendTransaction(params) {
    console.log('[DEBUG] ========== finalizeAndSendTransaction START ==========');
    console.log('[DEBUG] Input params:', JSON.stringify({
        contract_id: params.contract_id,
        has_signature: !!params.user_signature,
        signature_length: params.user_signature?.length
    }, null, 2));

    const connection_db = await pool.getConnection();

    try {
        // 1. 입력값 검증
        console.log('[DEBUG] Step 1: Validating parameters...');
        const { contract_id, user_signature, req_ip } = params;

        if (!contract_id) {
            throw new Error('계약 ID가 필요합니다');
        }
        if (!user_signature) {
            throw new Error('사용자 서명이 필요합니다');
        }
        console.log('[DEBUG] ✓ Parameters validated');

        // 2. DB에서 계약 정보 조회
        console.log('[DEBUG] Step 2: Fetching contract from DB...');
        const [contracts] = await connection_db.query(
            'SELECT * FROM r_contract WHERE contract_id = ?',
            [contract_id]
        );

        if (contracts.length === 0) {
            throw new Error('계약 정보를 찾을 수 없습니다');
        }

        const contract = contracts[0];
        console.log('[DEBUG] ✓ Contract found:', contract_id);

        // 3. 상태 체크
        console.log('[DEBUG] Step 3: Checking contract status...');
        if (contract.status === 'completed') {
            throw new Error('이미 처리된 계약입니다');
        }
        if (contract.status === 'failed') {
            throw new Error('실패한 계약입니다');
        }
        console.log('[DEBUG] ✓ Contract status is valid');

        // 4. 사용자가 서명한 트랜잭션 복원
        console.log('[DEBUG] Step 4: Deserializing signed transaction...');
        let transaction;

        try {
            transaction = Transaction.from(
                Buffer.from(user_signature, 'base64')
            );
            console.log('[DEBUG] ✓ Transaction deserialized');
        } catch (deserializeError) {
            throw new Error(`트랜잭션 복원 실패: ${deserializeError.message}`);
        }

        // 5. 서명 검증
        console.log('[DEBUG] Step 5: Verifying signatures...');
        const fromPubkey = new PublicKey(contract.from_wallet);
        const feepayerPubkey = feepayerKeypair.publicKey;

        let hasFeepayerSignature = false;
        let hasUserSignature = false;

        for (const sig of transaction.signatures) {
            if (sig.publicKey.equals(feepayerPubkey) && sig.signature !== null) {
                hasFeepayerSignature = true;
            }
            if (sig.publicKey.equals(fromPubkey) && sig.signature !== null) {
                hasUserSignature = true;
            }
        }

        if (!hasFeepayerSignature) {
            throw new Error('Feepayer 서명이 없습니다');
        }
        if (!hasUserSignature) {
            throw new Error('사용자 서명이 없습니다');
        }
        console.log('[DEBUG] ✓ All required signatures present');

        // 6. Solana 네트워크로 전송
        console.log('[DEBUG] Step 6: Sending transaction to Solana...');
        let txSignature;

        try {
            const serializedTx = transaction.serialize();

            txSignature = await connection.sendRawTransaction(serializedTx, {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
                maxRetries: 3
            });
            console.log('[DEBUG] ✓ Transaction sent:', txSignature);

            const confirmation = await connection.confirmTransaction({
                signature: txSignature,
                blockhash: contract.blockhash,
                lastValidBlockHeight: contract.last_valid_block_height
            }, 'confirmed');

            if (confirmation.value.err) {
                throw new Error(`트랜잭션 실패: ${JSON.stringify(confirmation.value.err)}`);
            }
            console.log('[DEBUG] ✓ Transaction confirmed');

        } catch (sendError) {
            await connection_db.beginTransaction();

            await connection_db.query(`
                UPDATE r_contract
                SET status = 'failed',
                    error_message = ?,
                    updated_at = NOW()
                WHERE contract_id = ?
            `, [
                sendError.message.substring(0, 500),
                contract_id
            ]);

            await connection_db.commit();

            throw new Error(`트랜잭션 전송 실패: ${sendError.message}`);
        }

        // 7. DB 업데이트
        await connection_db.beginTransaction();

        await connection_db.query(`
            UPDATE r_contract
            SET status = 'completed',
                tx_signature = ?,
                updated_at = NOW()
            WHERE contract_id = ?
        `, [
            txSignature,
            contract_id
        ]);

        const ipv4Address = req_ip ? req_ip.replace('::ffff:', '') : null;

        await connection_db.query(`
            INSERT INTO r_log (
                cate1,
                cate2,
                request_id,
                req_ip_text,
                req_status,
                api_name,
                res_data,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
            'web_transfer',
            'finalize',
            contract_id,
            ipv4Address,
            'Y',
            '/api/transfer/finalize',
            JSON.stringify({ signature: txSignature })
        ]);

        await connection_db.commit();

        return {
            success: true,
            signature: txSignature,
            status: 'completed',
            message: '전송이 완료되었습니다',
            explorer_url: `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`
        };

    } catch (error) {
        await connection_db.rollback();

        try {
            const ipv4Address = params.req_ip ? params.req_ip.replace('::ffff:', '') : null;

            await connection_db.query(`
                INSERT INTO r_log (
                    cate1,
                    cate2,
                    request_id,
                    req_ip_text,
                    req_status,
                    api_name,
                    error_message,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                'web_transfer',
                'finalize',
                params.contract_id || 'unknown',
                ipv4Address,
                'N',
                '/api/transfer/finalize',
                error.message.substring(0, 500)
            ]);
        } catch (logError) {
            console.error('[ERROR] Failed to insert error log:', logError.message);
        }

        throw error;

    } finally {
        connection_db.release();
    }
}