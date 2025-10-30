/**
 * ============================================
 * Solana Service (비즈니스 로직)
 * ============================================
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import {
    getAssociatedTokenAddress,
    createTransferInstruction,
    createAssociatedTokenAccountInstruction,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import bs58 from 'bs58';

/**
 * Solana Connection 가져오기
 */
function getSolanaConnection() {
    return new Connection(
        process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        'confirmed'
    );
}

/**
 * 회사 지갑 Keypair 생성
 * @returns {Keypair} 회사 지갑 Keypair 객체
 */
function getCompanyWallet() {
    // ESM 모듈 호환성을 위한 bs58 decode
    const decode = bs58.decode || (bs58.default && bs58.default.decode);
    if (!decode) {
        throw new Error('bs58 decode 함수를 찾을 수 없습니다');
    }

    const secretKey = decode(process.env.SERVICE_WALLET_SECRET_KEY);
    return Keypair.fromSecretKey(secretKey);
}

/**
 * 토큰 민트 공개키 가져오기
 */
function getTokenMintPublicKey() {
    return new PublicKey(process.env.TOKEN_MINT_ADDRESS);
}

/**
 * ATA(Associated Token Account) 존재 여부 확인
 * @param {Connection} connection - Solana Connection
 * @param {PublicKey} ataAddress - ATA 주소
 * @returns {Promise<boolean>} 존재 여부
 */
async function checkATAExists(connection, ataAddress) {
    try {
        const accountInfo = await connection.getAccountInfo(ataAddress);
        return accountInfo !== null;
    } catch (error) {
        console.error('ATA 존재 확인 오류:', error);
        return false;
    }
}

/**
 * ============================================
 * 0. 미서명 트랜잭션 생성 (신규 추가)
 * ============================================
 *
 * 용도: Flutter 앱에서 사용자가 서명할 수 있도록 미서명 트랜잭션 생성
 */
export async function createUnsignedTransaction(senderPublicKeyStr, recipientPublicKeyStr, amount) {
    try {
        const connection = getSolanaConnection();
        const mintPublicKey = getTokenMintPublicKey();

        // 공개키 변환
        const senderPublicKey = new PublicKey(senderPublicKeyStr);
        const recipientPublicKey = new PublicKey(recipientPublicKeyStr);

        // ATA 주소 계산
        const senderAta = await getAssociatedTokenAddress(
            mintPublicKey,
            senderPublicKey
        );

        const recipientAta = await getAssociatedTokenAddress(
            mintPublicKey,
            recipientPublicKey
        );

        // 송신자 ATA 존재 확인
        const senderAtaExists = await checkATAExists(connection, senderAta);
        if (!senderAtaExists) {
            throw new Error('송신자의 토큰 계정(ATA)이 존재하지 않습니다.');
        }

        // 토큰 decimal 가져오기
        const decimals = parseInt(process.env.TOKEN_DECIMALS || '9');
        const transferAmount = Math.floor(amount * Math.pow(10, decimals));

        // 최근 블록해시 가져오기
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

        // 트랜잭션 생성
        const transaction = new Transaction();

        // 수신자 ATA가 없으면 생성 instruction 추가
        const recipientAtaExists = await checkATAExists(connection, recipientAta);
        if (!recipientAtaExists) {
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    senderPublicKey,        // payer (송신자가 ATA 생성 비용 지불)
                    recipientAta,           // associatedToken
                    recipientPublicKey,     // owner
                    mintPublicKey           // mint
                )
            );
        }

        // 토큰 전송 instruction 추가
        transaction.add(
            createTransferInstruction(
                senderAta,              // from
                recipientAta,           // to
                senderPublicKey,        // owner
                transferAmount          // amount
            )
        );

        // 트랜잭션 설정
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        transaction.feePayer = senderPublicKey;

        // 미서명 트랜잭션 직렬화
        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false
        });
        const transactionBase64 = serializedTransaction.toString('base64');

        return {
            success: true,
            unsigned_transaction: transactionBase64,
            blockhash,
            last_valid_block_height: lastValidBlockHeight,
            sender_ata: senderAta.toBase58(),
            recipient_ata: recipientAta.toBase58(),
            amount,
            message: '미서명 트랜잭션이 생성되었습니다.'
        };

    } catch (error) {
        console.error('미서명 트랜잭션 생성 오류:', error);
        throw error;
    }
}

/**
 * ============================================
 * 1. 부분서명 트랜잭션 생성 (기존 - 유지)
 * ============================================
 */
export async function createPartialSignedTransaction(senderWalletAddress, amount) {
    try {
        const connection = getSolanaConnection();
        const companyWallet = getCompanyWallet();
        const mintPublicKey = getTokenMintPublicKey();

        // 송신자 공개키
        const senderPublicKey = new PublicKey(senderWalletAddress);

        // 송신자와 회사의 ATA 주소 가져오기
        const senderAta = await getAssociatedTokenAddress(
            mintPublicKey,
            senderPublicKey
        );

        const companyAta = await getAssociatedTokenAddress(
            mintPublicKey,
            companyWallet.publicKey
        );

        // 송신자 ATA 존재 확인
        const senderAtaInfo = await connection.getAccountInfo(senderAta);
        if (!senderAtaInfo) {
            throw new Error('송신자의 토큰 계정(ATA)이 존재하지 않습니다.');
        }

        // 회사 ATA 존재 확인
        const companyAtaInfo = await connection.getAccountInfo(companyAta);
        if (!companyAtaInfo) {
            throw new Error('회사의 토큰 계정(ATA)이 존재하지 않습니다.');
        }

        // 토큰 decimal 가져오기
        const decimals = parseInt(process.env.TOKEN_DECIMALS || '9');
        const transferAmount = Math.floor(amount * Math.pow(10, decimals));

        // 최근 블록해시 가져오기
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

        // 트랜잭션 생성
        const transaction = new Transaction();

        // 토큰 전송 Instruction 추가
        transaction.add(
            createTransferInstruction(
                senderAta,              // from
                companyAta,             // to
                senderPublicKey,        // owner (송신자만 가능)
                transferAmount
            )
        );

        // 트랜잭션 설정
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;

        // 중요: feePayer를 회사로 설정 (회사가 가스비 지불 + 부분서명 역할)
        transaction.feePayer = companyWallet.publicKey;

        // 회사 지갑으로 부분 서명 (feePayer로서 서명)
        transaction.sign(companyWallet);

        // 트랜잭션을 Base64로 직렬화
        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false
        });
        const transactionBase64 = serializedTransaction.toString('base64');

        return {
            success: true,
            transaction_base64: transactionBase64,
            blockhash,
            last_valid_block_height: lastValidBlockHeight,
            sender_ata: senderAta.toBase58(),
            company_ata: companyAta.toBase58(),
            amount,
            message: '부분서명된 트랜잭션이 생성되었습니다.',
            note: '회사가 가스비를 대신 지불하는 방식으로 부분서명 완료. 사용자가 최종 서명 후 전송해야 합니다.'
        };

    } catch (error) {
        console.error('부분서명 트랜잭션 생성 오류:', error);
        throw error;
    }
}

/**
 * ============================================
 * 1-1. 부분서명 생성 - 사용자 → 회사 (신규 추가)
 * ============================================
 *
 * 용도: 사용자가 회사로 토큰 전송 시 회사가 Fee Payer로 부분서명
 */
export async function createAndPartialSignPayment(senderPublicKeyStr, amount, requestId) {
    try {
        const connection = getSolanaConnection();
        const companyWallet = getCompanyWallet();
        const mintPublicKey = getTokenMintPublicKey();

        // 송신자 공개키
        const senderPublicKey = new PublicKey(senderPublicKeyStr);

        // ATA 주소 계산
        const senderAta = await getAssociatedTokenAddress(
            mintPublicKey,
            senderPublicKey
        );

        const companyAta = await getAssociatedTokenAddress(
            mintPublicKey,
            companyWallet.publicKey
        );

        // 송신자 ATA 존재 확인
        const senderAtaExists = await checkATAExists(connection, senderAta);
        if (!senderAtaExists) {
            throw new Error('송신자의 토큰 계정(ATA)이 존재하지 않습니다.');
        }

        // 회사 ATA 존재 확인
        const companyAtaExists = await checkATAExists(connection, companyAta);
        if (!companyAtaExists) {
            throw new Error('회사의 토큰 계정(ATA)이 존재하지 않습니다.');
        }

        // 토큰 decimal 가져오기
        const decimals = parseInt(process.env.TOKEN_DECIMALS || '9');
        const transferAmount = Math.floor(amount * Math.pow(10, decimals));

        // 최근 블록해시 가져오기
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

        // 트랜잭션 생성
        const transaction = new Transaction();

        // 토큰 전송 instruction 추가
        transaction.add(
            createTransferInstruction(
                senderAta,              // from
                companyAta,             // to
                senderPublicKey,        // owner
                transferAmount
            )
        );

        // 트랜잭션 설정
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        transaction.feePayer = companyWallet.publicKey;  // 회사가 가스비 지불

        // 회사 지갑으로 부분서명
        transaction.partialSign(companyWallet);

        // 부분 서명된 트랜잭션 직렬화
        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false
        });
        const transactionBase64 = serializedTransaction.toString('base64');

        return {
            success: true,
            partial_signed_transaction: transactionBase64,
            blockhash,
            last_valid_block_height: lastValidBlockHeight,
            sender_ata: senderAta.toBase58(),
            company_ata: companyAta.toBase58(),
            amount,
            request_id: requestId,
            message: '부분서명된 트랜잭션이 생성되었습니다.'
        };

    } catch (error) {
        console.error('부분서명 생성 오류 (사용자→회사):', error);
        throw error;
    }
}

/**
 * ============================================
 * 1-2. 부분서명 생성 - 사용자 → 사용자 (신규 추가)
 * ============================================
 *
 * 용도: 사용자 간 토큰 전송 시 회사가 Fee Payer로 부분서명
 */
export async function createAndPartialSignReceive(senderPublicKeyStr, recipientPublicKeyStr, amount, requestId) {
    try {
        const connection = getSolanaConnection();
        const companyWallet = getCompanyWallet();
        const mintPublicKey = getTokenMintPublicKey();

        // 공개키 변환
        const senderPublicKey = new PublicKey(senderPublicKeyStr);
        const recipientPublicKey = new PublicKey(recipientPublicKeyStr);

        // ATA 주소 계산
        const senderAta = await getAssociatedTokenAddress(
            mintPublicKey,
            senderPublicKey
        );

        const recipientAta = await getAssociatedTokenAddress(
            mintPublicKey,
            recipientPublicKey
        );

        // 송신자 ATA 존재 확인
        const senderAtaExists = await checkATAExists(connection, senderAta);
        if (!senderAtaExists) {
            throw new Error('송신자의 토큰 계정(ATA)이 존재하지 않습니다.');
        }

        // 토큰 decimal 가져오기
        const decimals = parseInt(process.env.TOKEN_DECIMALS || '9');
        const transferAmount = Math.floor(amount * Math.pow(10, decimals));

        // 최근 블록해시 가져오기
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

        // 트랜잭션 생성
        const transaction = new Transaction();

        // 수신자 ATA가 없으면 생성 instruction 추가
        const recipientAtaExists = await checkATAExists(connection, recipientAta);
        if (!recipientAtaExists) {
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    companyWallet.publicKey,  // payer (회사가 ATA 생성 비용 지불)
                    recipientAta,             // associatedToken
                    recipientPublicKey,       // owner
                    mintPublicKey             // mint
                )
            );
        }

        // 토큰 전송 instruction 추가
        transaction.add(
            createTransferInstruction(
                senderAta,              // from
                recipientAta,           // to
                senderPublicKey,        // owner
                transferAmount
            )
        );

        // 트랜잭션 설정
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        transaction.feePayer = companyWallet.publicKey;  // 회사가 가스비 지불

        // 회사 지갑으로 부분서명
        transaction.partialSign(companyWallet);

        // 부분 서명된 트랜잭션 직렬화
        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false
        });
        const transactionBase64 = serializedTransaction.toString('base64');

        return {
            success: true,
            partial_signed_transaction: transactionBase64,
            blockhash,
            last_valid_block_height: lastValidBlockHeight,
            sender_ata: senderAta.toBase58(),
            recipient_ata: recipientAta.toBase58(),
            amount,
            request_id: requestId,
            message: '부분서명된 트랜잭션이 생성되었습니다.'
        };

    } catch (error) {
        console.error('부분서명 생성 오류 (사용자→사용자):', error);
        throw error;
    }
}

/**
 * ============================================
 * 2. 완전 서명된 트랜잭션 전송 (기존 - 유지)
 * ============================================
 */
export async function sendSignedTransaction(signedTransactionBase64) {
    try {
        const connection = getSolanaConnection();

        // Base64 → Buffer 변환
        const transactionBuffer = Buffer.from(signedTransactionBase64, 'base64');

        // 트랜잭션 전송
        const signature = await connection.sendRawTransaction(transactionBuffer, {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
        });

        // 컨펌 대기
        await connection.confirmTransaction(signature, 'confirmed');

        return {
            success: true,
            signature,
            explorer_url: `https://explorer.solana.com/tx/${signature}?cluster=${process.env.SOLANA_NETWORK || 'devnet'}`,
            message: '트랜잭션이 성공적으로 전송되었습니다.'
        };

    } catch (error) {
        console.error('트랜잭션 전송 오류:', error);
        throw error;
    }
}

/**
 * ============================================
 * 3. 회사 지갑 → 다중 수신자 일괄 전송 (기존 - 유지)
 * ============================================
 */
export async function bulkTransfer(recipients) {
    try {
        const connection = getSolanaConnection();
        const companyWallet = getCompanyWallet();
        const mintPublicKey = getTokenMintPublicKey();

        // 회사 ATA
        const companyAta = await getAssociatedTokenAddress(
            mintPublicKey,
            companyWallet.publicKey
        );

        // 토큰 decimal
        const decimals = parseInt(process.env.TOKEN_DECIMALS || '9');

        // 트랜잭션 생성
        const transaction = new Transaction();

        // 각 수신자에 대한 전송 Instruction 추가
        for (const recipient of recipients) {
            const recipientPublicKey = new PublicKey(recipient.wallet_address);
            const recipientAta = await getAssociatedTokenAddress(
                mintPublicKey,
                recipientPublicKey
            );

            const transferAmount = Math.floor(recipient.amount * Math.pow(10, decimals));

            transaction.add(
                createTransferInstruction(
                    companyAta,
                    recipientAta,
                    companyWallet.publicKey,
                    transferAmount
                )
            );
        }

        // 최근 블록해시
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = companyWallet.publicKey;

        // 서명 및 전송
        transaction.sign(companyWallet);
        const signature = await connection.sendRawTransaction(transaction.serialize());

        await connection.confirmTransaction(signature, 'confirmed');

        const totalAmount = recipients.reduce((sum, r) => sum + r.amount, 0);

        return {
            success: true,
            signature,
            recipients_count: recipients.length,
            total_amount: totalAmount,
            explorer_url: `https://explorer.solana.com/tx/${signature}?cluster=${process.env.SOLANA_NETWORK || 'devnet'}`,
            message: `${recipients.length}명에게 토큰이 성공적으로 전송되었습니다.`
        };

    } catch (error) {
        console.error('일괄 전송 오류:', error);
        throw error;
    }
}

/**
 * ============================================
 * 4. 토큰 잔액 조회 (기존 - 유지)
 * ============================================
 */
export async function getTokenBalance(walletAddress) {
    try {
        const connection = getSolanaConnection();
        const mintPublicKey = getTokenMintPublicKey();
        const walletPublicKey = new PublicKey(walletAddress);

        const ata = await getAssociatedTokenAddress(mintPublicKey, walletPublicKey);

        const accountInfo = await connection.getAccountInfo(ata);

        if (!accountInfo) {
            return {
                success: true,
                wallet_address: walletAddress,
                ata_address: ata.toBase58(),
                amount: 0,
                amount_in_smallest_unit: 0,
                decimals: parseInt(process.env.TOKEN_DECIMALS || '9'),
                message: '토큰 계정이 아직 생성되지 않았습니다.'
            };
        }

        const tokenBalance = await connection.getTokenAccountBalance(ata);

        return {
            success: true,
            wallet_address: walletAddress,
            ata_address: ata.toBase58(),
            amount: parseFloat(tokenBalance.value.uiAmount),
            amount_in_smallest_unit: parseInt(tokenBalance.value.amount),
            decimals: tokenBalance.value.decimals,
            message: '잔액 조회 성공'
        };

    } catch (error) {
        console.error('토큰 잔액 조회 오류:', error);
        throw error;
    }
}

/**
 * ============================================
 * 5. 트랜잭션 상세 정보 조회 (기존 - 유지)
 * ============================================
 */
export async function getTransactionDetails(signature) {
    try {
        const connection = getSolanaConnection();

        const tx = await connection.getTransaction(signature, {
            maxSupportedTransactionVersion: 0
        });

        if (!tx) {
            throw new Error('트랜잭션을 찾을 수 없습니다.');
        }

        return {
            success: true,
            signature,
            status: tx.meta.err ? 'FAILED' : 'SUCCESS',
            slot: tx.slot,
            block_time: tx.blockTime,
            fee: tx.meta.fee,
            explorer_url: `https://explorer.solana.com/tx/${signature}?cluster=${process.env.SOLANA_NETWORK || 'devnet'}`,
            message: '트랜잭션 정보 조회 성공'
        };

    } catch (error) {
        console.error('트랜잭션 조회 오류:', error);
        throw error;
    }
}

/**
 * ============================================
 * 6. SOL 잔액 조회 (기존 - 유지)
 * ============================================
 */
export async function getSolBalance(walletAddress) {
    try {
        const connection = getSolanaConnection();
        const walletPublicKey = new PublicKey(walletAddress);

        const balance = await connection.getBalance(walletPublicKey);

        return {
            success: true,
            wallet_address: walletAddress,
            sol: balance / 1e9,
            lamports: balance,
            message: 'SOL 잔액 조회 성공'
        };

    } catch (error) {
        console.error('SOL 잔액 조회 오류:', error);
        throw error;
    }
}