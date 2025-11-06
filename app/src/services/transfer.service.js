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
    SystemProgram,
    sendAndConfirmTransaction
} from '@solana/web3.js';
import {
    getAssociatedTokenAddress,
    createTransferInstruction,
    TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { pool } from '../config/db.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { v4 as uuidv4 } from 'uuid';
import bs58 from 'bs58';

// Solana 네트워크 연결 설정
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

console.log('[INIT] Solana RPC URL:', SOLANA_RPC_URL);
console.log('[INIT] RIPY Token Mint Address:', process.env.RIPY_TOKEN_MINT_ADDRESS);

// RIPY 토큰 민트 주소 (환경변수에서 가져옴)
const RIPY_TOKEN_MINT = new PublicKey(process.env.RIPY_TOKEN_MINT_ADDRESS);

// 회사 feepayer 지갑 (환경변수에서 개인키 가져옴)
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
 *
 * @param {Object} params - 전송 파라미터
 * @param {string} params.from_wallet - 발신 지갑 주소
 * @param {string} params.to_wallet - 수신 지갑 주소
 * @param {string} params.amount - 전송 금액 (RIPY 단위)
 * @param {string} params.req_ip - 요청 IP 주소
 * @returns {Promise<Object>} 부분 서명된 트랜잭션 정보
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

        // 2. 계약 ID 생성 (UUID)
        console.log('[DEBUG] Step 2: Generating contract ID...');
        const contractId = uuidv4();
        console.log('[DEBUG] ✓ Contract ID:', contractId);

        // 3. Solana 트랜잭션 생성
        console.log('[DEBUG] Step 3: Creating public keys...');
        const fromPubkey = new PublicKey(from_wallet);
        const toPubkey = new PublicKey(to_wallet);
        console.log('[DEBUG] ✓ From pubkey:', fromPubkey.toBase58());
        console.log('[DEBUG] ✓ To pubkey:', toPubkey.toBase58());

        // 4. 발신자와 수신자의 토큰 계정 주소 가져오기
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

        // 5. 전송할 토큰 수량 계산 (RIPY는 9 decimals)
        console.log('[DEBUG] Step 5: Calculating transfer amount...');
        const transferAmount = BigInt(Math.floor(parseFloat(amount) * 1_000_000_000));
        console.log('[DEBUG] ✓ Transfer amount:', transferAmount.toString(), 'lamports');

        // 5.5. 발신자의 토큰 계정 존재 확인
        console.log('[DEBUG] Step 5.5: Verifying sender token account exists...');
        try {
            const fromAccountInfo = await connection.getAccountInfo(fromTokenAccount);

            if (!fromAccountInfo) {
                console.error('[ERROR] Sender token account does not exist:', fromTokenAccount.toBase58());
                throw new Error('발신자의 RIPY 토큰 계정이 존재하지 않습니다.');
            }

            console.log('[DEBUG] ✓ Sender token account verified');
        } catch (accountCheckError) {
            if (accountCheckError.message.includes('발신자의 RIPY 토큰 계정이 존재하지 않습니다')) {
                throw accountCheckError;
            }
            console.error('[ERROR] Failed to verify sender token account:', accountCheckError);
            throw new Error(`발신자 토큰 계정 확인 실패: ${accountCheckError.message}`);
        }

        // 5.6. 수신자의 토큰 계정 존재 확인
        console.log('[DEBUG] Step 5.6: Verifying recipient token account exists...');
        try {
            const toAccountInfo = await connection.getAccountInfo(toTokenAccount);

            if (!toAccountInfo) {
                console.error('[ERROR] Recipient token account does not exist:', toTokenAccount.toBase58());
                throw new Error('수신자의 RIPY 토큰 계정이 존재하지 않습니다. 수신자가 먼저 RIPY 지갑을 생성해야 합니다.');
            }

            console.log('[DEBUG] ✓ Recipient token account verified');
        } catch (accountCheckError) {
            if (accountCheckError.message.includes('수신자의 RIPY 토큰 계정이 존재하지 않습니다')) {
                throw accountCheckError;
            }
            console.error('[ERROR] Failed to verify recipient token account:', accountCheckError);
            throw new Error(`수신자 토큰 계정 확인 실패: ${accountCheckError.message}`);
        }

        // 6. 트랜잭션 생성
        console.log('[DEBUG] Step 6: Creating transaction...');
        const transaction = new Transaction();

        // SPL 토큰 전송 instruction 추가
        transaction.add(
            createTransferInstruction(
                fromTokenAccount,      // 발신자 토큰 계정
                toTokenAccount,        // 수신자 토큰 계정
                fromPubkey,            // 발신자 권한
                transferAmount,        // 전송 금액
                [],                    // 추가 서명자 (없음)
                TOKEN_PROGRAM_ID       // SPL Token 프로그램 ID
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
            console.error('[ERROR] Failed to get blockhash:', rpcError);
            throw new Error(`Solana RPC 연결 실패: ${rpcError.message}`);
        }

        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;

        // 8. feepayer 설정 및 서명
        console.log('[DEBUG] Step 8: Setting feepayer and signing...');
        if (!feepayerKeypair) {
            throw new Error('Feepayer 지갑이 초기화되지 않았습니다');
        }

        transaction.feePayer = feepayerKeypair.publicKey;
        console.log('[DEBUG] ✓ Feepayer set:', feepayerKeypair.publicKey.toBase58());

        transaction.partialSign(feepayerKeypair);
        console.log('[DEBUG] ✓ Transaction partially signed');

        // 9. 트랜잭션을 Base64로 직렬화
        console.log('[DEBUG] Step 9: Serializing transaction...');
        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false,  // 부분 서명 허용
            verifySignatures: false
        }).toString('base64');
        console.log('[DEBUG] ✓ Transaction serialized, length:', serializedTransaction.length);

        // 10. 지갑 주소 암호화
        console.log('[DEBUG] Step 10: Encrypting wallet addresses...');
        const encryptedFromWallet = encrypt(from_wallet);
        const encryptedToWallet = encrypt(to_wallet);
        console.log('[DEBUG] ✓ Wallet addresses encrypted');

        // 11. 트랜잭션 데이터 암호화
        console.log('[DEBUG] Step 11: Encrypting transaction data...');
        const encryptedTransaction = encrypt(serializedTransaction);
        console.log('[DEBUG] ✓ Transaction encrypted');

        // 12. IP 주소 처리
        console.log('[DEBUG] Step 12: Processing IP address...');
        const ipInt = req_ip ? `INET_ATON('${req_ip}')` : null;
        const ipText = req_ip || null;
        console.log('[DEBUG] ✓ IP processed:', ipText);

        // 13. DB 트랜잭션 시작
        console.log('[DEBUG] Step 13: Starting DB transaction...');
        await connection_db.beginTransaction();
        console.log('[DEBUG] ✓ DB transaction started');

        // 14. r_contract 테이블에 저장
        console.log('[DEBUG] Step 14: Inserting into r_contract...');
        const insertContractQuery = `
            INSERT INTO r_contract (
                contract_id,
                cate1,
                cate2,
                from_wallet_address,
                to_wallet_address,
                req_amount,
                contract_data,
                req_ip,
                req_ip_text,
                status,
                created_at
            ) VALUES (
                         :contract_id,
                         'web_transfer',
                         'user_sign',
                         :from_wallet,
                         :to_wallet,
                         :amount,
                         :contract_data,
                         ${ipInt ? ipInt : 'NULL'},
                         :req_ip_text,
                         'pending',
                         NOW()
                     )
        `;

        await connection_db.query(insertContractQuery, {
            contract_id: contractId,
            from_wallet: encryptedFromWallet,
            to_wallet: encryptedToWallet,
            amount: amount,
            contract_data: encryptedTransaction,
            req_ip_text: ipText
        });
        console.log('[DEBUG] ✓ Contract inserted');

        // 15. r_log 테이블에 기록
        console.log('[DEBUG] Step 15: Inserting into r_log...');
        const insertLogQuery = `
            INSERT INTO r_log (
                cate1,
                cate2,
                request_id,
                req_ip,
                req_ip_text,
                req_status,
                api_name,
                created_at
            ) VALUES (
                         'web_transfer',
                         'create',
                         :request_id,
                         ${ipInt ? ipInt : 'NULL'},
                         :req_ip_text,
                         'Y',
                         '/api/transfer/create',
                         NOW()
                     )
        `;

        await connection_db.query(insertLogQuery, {
            request_id: contractId,
            req_ip_text: ipText
        });
        console.log('[DEBUG] ✓ Log inserted');

        // 16. 커밋
        console.log('[DEBUG] Step 16: Committing transaction...');
        await connection_db.commit();
        console.log('[DEBUG] ✓ Transaction committed');

        // 17. 결과 반환
        console.log('[DEBUG] ========== createPartialTransaction SUCCESS ==========');
        return {
            contract_id: contractId,
            partial_transaction: serializedTransaction,
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
            const ipInt = params.req_ip ? `INET_ATON('${params.req_ip}')` : null;
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
                ) VALUES (
                             'web_transfer',
                             'create',
                             'error',
                             ${ipInt ? ipInt : 'NULL'},
                             :req_ip_text,
                             'N',
                             '/api/transfer/create',
                             :error_message,
                             NOW()
                         )
            `, {
                req_ip_text: params.req_ip || null,
                error_message: errorMessage.substring(0, 500)
            });
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
 *
 * @param {Object} params - 완료 파라미터
 * @param {string} params.contract_id - 계약 ID
 * @param {string} params.user_signature - 사용자 서명 (Base64)
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

        // 2. DB에서 계약 정보 조회
        const [contracts] = await connection_db.query(
            'SELECT * FROM r_contract WHERE contract_id = ?',
            [contract_id]
        );

        if (contracts.length === 0) {
            throw new Error('계약 정보를 찾을 수 없습니다');
        }

        const contract = contracts[0];

        // 3. 상태 체크
        if (contract.status === 'completed') {
            throw new Error('이미 처리된 계약입니다');
        }

        // 4. 트랜잭션 데이터 복호화
        const serializedTransaction = decrypt(contract.contract_data);

        // 5. 트랜잭션 복원
        const transaction = Transaction.from(
            Buffer.from(serializedTransaction, 'base64')
        );

        // 6. 사용자 서명 추가
        // 실제 구현에서는 클라이언트에서 받은 서명을 트랜잭션에 추가
        // 여기서는 Mock 처리 (실제로는 사용자가 서명한 트랜잭션을 받아야 함)

        // 7. Solana 네트워크로 전송
        let txSignature;
        try {
            // 실제 전송 (테스트 환경에서는 Mock)
            if (process.env.NODE_ENV === 'test') {
                // 테스트 환경에서는 Mock 서명 반환
                txSignature = 'mock_transaction_signature_' + Date.now();
            } else {
                // 실제 환경에서는 Solana 네트워크로 전송
                txSignature = await connection.sendRawTransaction(
                    transaction.serialize()
                );

                // 트랜잭션 확인 대기
                await connection.confirmTransaction(txSignature, 'confirmed');
            }
        } catch (sendError) {
            throw new Error(`트랜잭션 전송 실패: ${sendError.message}`);
        }

        // 8. DB 업데이트 트랜잭션 시작
        await connection_db.beginTransaction();

        // 9. r_contract 업데이트
        await connection_db.query(`
            UPDATE r_contract
            SET status = 'completed',
                tx_signature = :tx_signature,
                updated_at = NOW()
            WHERE contract_id = :contract_id
        `, {
            tx_signature: txSignature,
            contract_id: contract_id
        });

        // 10. r_log 기록
        const ipInt = req_ip ? `INET_ATON('${req_ip}')` : null;
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
            ) VALUES (
                         'web_transfer',
                         'finalize',
                         :request_id,
                         ${ipInt ? ipInt : 'NULL'},
                         :req_ip_text,
                         'Y',
                         '/api/transfer/finalize',
                         :res_data,
                         NOW()
                     )
        `, {
            request_id: contract_id,
            req_ip_text: req_ip || null,
            res_data: JSON.stringify({ signature: txSignature })
        });

        // 11. 커밋
        await connection_db.commit();

        // 12. 결과 반환
        return {
            success: true,
            signature: txSignature,
            status: 'completed',
            message: '전송이 완료되었습니다'
        };

    } catch (error) {
        // 롤백
        await connection_db.rollback();

        // 에러 로그 기록
        try {
            const ipInt = params.req_ip ? `INET_ATON('${params.req_ip}')` : null;
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
                ) VALUES (
                             'web_transfer',
                             'finalize',
                             :request_id,
                             ${ipInt ? ipInt : 'NULL'},
                             :req_ip_text,
                             'N',
                             '/api/transfer/finalize',
                             :error_message,
                             NOW()
                         )
            `, {
                request_id: params.contract_id || 'unknown',
                req_ip_text: params.req_ip || null,
                error_message: errorMessage.substring(0, 500)
            });
        } catch (logError) {
            console.error('에러 로그 기록 실패:', logError.message);
        }

        throw error;

    } finally {
        connection_db.release();
    }
}