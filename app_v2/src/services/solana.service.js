/**
 * ============================================
 * Solana Service (비즈니스 로직) - 최종 개선 버전
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

// ✅ solana.util.js 함수들 import
import {
    createConnection,
    loadCompanyWallet,
    getATAAddress,
    createATAInstruction,
    getLatestBlockhash,
    checkATAExists as utilCheckATAExists,
    isValidSolanaAddress
} from '../utils/solana.util.js';

// ✅ solana.config.js import
import { SOLANA_CONFIG } from '../config/solana.config.js';

/**
 * Solana Connection 가져오기 (개선 버전)
 */
function getSolanaConnection() {
    return createConnection();
}

/**
 * 회사 지갑 Keypair 생성 (개선 버전)
 * @returns {Keypair} 회사 지갑 Keypair 객체
 */
function getCompanyWallet() {
    return loadCompanyWallet();
}

/**
 * 토큰 민트 공개키 가져오기
 */
function getTokenMintPublicKey() {
    if (!SOLANA_CONFIG.RIPY_TOKEN_MINT_ADDRESS) {
        throw new Error('RIPY_TOKEN_MINT_ADDRESS가 설정되지 않았습니다.');
    }
    return new PublicKey(SOLANA_CONFIG.RIPY_TOKEN_MINT_ADDRESS);
}

/**
 * ATA(Associated Token Account) 존재 여부 확인
 * @param {Connection} connection - Solana Connection
 * @param {PublicKey} ataAddress - ATA 주소
 * @returns {Promise<boolean>} 존재 여부
 */
async function checkATAExists(connection, ataAddress) {
    return utilCheckATAExists(connection, ataAddress);
}

/**
 * ============================================
 * 0. 미서명 트랜잭션 생성 (개선 버전)
 * ============================================
 */
export async function createUnsignedTransaction(senderPublicKeyStr, recipientPublicKeyStr, amount) {
    try {
        // ✅ 입력값 검증
        if (!isValidSolanaAddress(senderPublicKeyStr)) {
            throw new Error('유효하지 않은 송신자 주소입니다.');
        }
        if (!isValidSolanaAddress(recipientPublicKeyStr)) {
            throw new Error('유효하지 않은 수신자 주소입니다.');
        }
        if (!amount || amount <= 0) {
            throw new Error('유효하지 않은 금액입니다.');
        }

        const connection = getSolanaConnection();
        const mintPublicKey = getTokenMintPublicKey();

        // 공개키 변환
        const senderPublicKey = new PublicKey(senderPublicKeyStr);
        const recipientPublicKey = new PublicKey(recipientPublicKeyStr);

        // ATA 주소 계산
        const senderAta = await getATAAddress(senderPublicKey, mintPublicKey);
        const recipientAta = await getATAAddress(recipientPublicKey, mintPublicKey);

        // 송신자 ATA 존재 확인
        const senderAtaExists = await checkATAExists(connection, senderAta);
        if (!senderAtaExists) {
            throw new Error('송신자의 토큰 계정(ATA)이 존재하지 않습니다.');
        }

        // 토큰 decimal 가져오기
        const decimals = SOLANA_CONFIG.TOKEN_DECIMALS;
        const transferAmount = Math.floor(amount * Math.pow(10, decimals));

        // 트랜잭션 생성
        const transaction = new Transaction();

        // 수신자 ATA 존재 확인 및 생성 instruction 추가
        const recipientAtaExists = await checkATAExists(connection, recipientAta);
        if (!recipientAtaExists) {
            const companyWallet = getCompanyWallet();
            const createAtaIx = createATAInstruction(
                companyWallet.publicKey,
                recipientPublicKey,
                recipientAta,
                mintPublicKey
            );
            transaction.add(createAtaIx);
        }

        // 토큰 전송 instruction 추가
        const transferIx = createTransferInstruction(
            senderAta,
            recipientAta,
            senderPublicKey,
            transferAmount,
            [],
            TOKEN_PROGRAM_ID
        );
        transaction.add(transferIx);

        // Blockhash 설정
        const { blockhash, lastValidBlockHeight } = await getLatestBlockhash(connection);
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = senderPublicKey;

        // 트랜잭션 직렬화 (Base58)
        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false
        });
        const base58Transaction = bs58.encode(serializedTransaction);

        return {
            success: true,
            transaction: base58Transaction,
            blockhash: blockhash,
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
 * 1. 부분서명 트랜잭션 생성 (개선 버전)
 * ============================================
 */
export async function createPartialSignedTransaction(senderWalletAddress, amount) {
    try {
        // ✅ 입력값 검증
        if (!isValidSolanaAddress(senderWalletAddress)) {
            throw new Error('유효하지 않은 송신자 주소입니다.');
        }
        if (!amount || amount <= 0) {
            throw new Error('유효하지 않은 금액입니다.');
        }

        const connection = getSolanaConnection();
        const companyWallet = getCompanyWallet();
        const mintPublicKey = getTokenMintPublicKey();

        // 송신자 공개키
        const senderPublicKey = new PublicKey(senderWalletAddress);

        // 송신자와 회사의 ATA 주소 가져오기
        const senderAta = await getATAAddress(senderPublicKey, mintPublicKey);
        const companyAta = await getATAAddress(companyWallet.publicKey, mintPublicKey);

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
        const decimals = SOLANA_CONFIG.TOKEN_DECIMALS;
        const transferAmount = Math.floor(amount * Math.pow(10, decimals));

        // 최근 블록해시 가져오기
        const { blockhash, lastValidBlockHeight } = await getLatestBlockhash(connection);

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
 * 1-1. 부분서명 생성 - 사용자 → 회사 (개선 버전)
 * ============================================
 */
export async function createAndPartialSignPayment(senderPublicKeyStr, amount, requestId) {
    try {
        // ✅ 입력값 검증
        if (!isValidSolanaAddress(senderPublicKeyStr)) {
            throw new Error('유효하지 않은 송신자 주소입니다.');
        }
        if (!amount || amount <= 0) {
            throw new Error('유효하지 않은 금액입니다.');
        }

        const connection = getSolanaConnection();
        const companyWallet = getCompanyWallet();
        const mintPublicKey = getTokenMintPublicKey();

        // 송신자 공개키
        const senderPublicKey = new PublicKey(senderPublicKeyStr);

        // ATA 주소 계산
        const senderAta = await getATAAddress(senderPublicKey, mintPublicKey);
        const companyAta = await getATAAddress(companyWallet.publicKey, mintPublicKey);

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
        const decimals = SOLANA_CONFIG.TOKEN_DECIMALS;
        const transferAmount = Math.floor(amount * Math.pow(10, decimals));

        // 최근 블록해시 가져오기
        const { blockhash, lastValidBlockHeight } = await getLatestBlockhash(connection);

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
 * 1-2. 부분서명 생성 - 사용자 → 사용자 (개선 버전)
 * ============================================
 */
export async function createAndPartialSignReceive(senderPublicKeyStr, recipientPublicKeyStr, amount, requestId) {
    try {
        // ✅ 입력값 검증
        if (!isValidSolanaAddress(senderPublicKeyStr)) {
            throw new Error('유효하지 않은 송신자 주소입니다.');
        }
        if (!isValidSolanaAddress(recipientPublicKeyStr)) {
            throw new Error('유효하지 않은 수신자 주소입니다.');
        }
        if (!amount || amount <= 0) {
            throw new Error('유효하지 않은 금액입니다.');
        }

        const connection = getSolanaConnection();
        const companyWallet = getCompanyWallet();
        const mintPublicKey = getTokenMintPublicKey();

        // 공개키 변환
        const senderPublicKey = new PublicKey(senderPublicKeyStr);
        const recipientPublicKey = new PublicKey(recipientPublicKeyStr);

        // ATA 주소 계산
        const senderAta = await getATAAddress(senderPublicKey, mintPublicKey);
        const recipientAta = await getATAAddress(recipientPublicKey, mintPublicKey);

        // 송신자 ATA 존재 확인
        const senderAtaExists = await checkATAExists(connection, senderAta);
        if (!senderAtaExists) {
            throw new Error('송신자의 토큰 계정(ATA)이 존재하지 않습니다.');
        }

        // 토큰 decimal 가져오기
        const decimals = SOLANA_CONFIG.TOKEN_DECIMALS;
        const transferAmount = Math.floor(amount * Math.pow(10, decimals));

        // 최근 블록해시 가져오기
        const { blockhash, lastValidBlockHeight } = await getLatestBlockhash(connection);

        // 트랜잭션 생성
        const transaction = new Transaction();

        // 수신자 ATA가 없으면 생성 instruction 추가
        const recipientAtaExists = await checkATAExists(connection, recipientAta);
        if (!recipientAtaExists) {
            const createAtaIx = createATAInstruction(
                companyWallet.publicKey,  // payer (회사가 ATA 생성 비용 지불)
                recipientPublicKey,       // owner
                recipientAta,            // associatedToken
                mintPublicKey            // mint
            );
            transaction.add(createAtaIx);
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
 * 2. 완전 서명된 트랜잭션 전송 (개선 버전)
 * ============================================
 */
export async function sendSignedTransaction(signedTransactionBase64) {
    try {
        // ✅ 입력값 검증
        if (!signedTransactionBase64) {
            throw new Error('서명된 트랜잭션이 제공되지 않았습니다.');
        }

        if (typeof signedTransactionBase64 !== 'string') {
            throw new Error('유효하지 않은 트랜잭션 형식입니다.');
        }

        const connection = getSolanaConnection();

        // Base64 → Buffer 변환
        let transactionBuffer;
        try {
            transactionBuffer = Buffer.from(signedTransactionBase64, 'base64');
        } catch (error) {
            throw new Error('트랜잭션 디코딩 실패: 유효하지 않은 Base64 형식입니다.');
        }

        // 트랜잭션 전송
        const signature = await connection.sendRawTransaction(transactionBuffer, {
            skipPreflight: false,
            preflightCommitment: SOLANA_CONFIG.COMMITMENT
        });

        console.log('[트랜잭션 전송] 서명:', signature);

        // 컨펌 대기
        await connection.confirmTransaction(signature, SOLANA_CONFIG.COMMITMENT);

        console.log('[트랜잭션 전송] 확인 완료');

        return {
            success: true,
            signature,
            explorer_url: `https://explorer.solana.com/tx/${signature}?cluster=${SOLANA_CONFIG.NETWORK}`,
            message: '트랜잭션이 성공적으로 전송되었습니다.'
        };

    } catch (error) {
        console.error('트랜잭션 전송 오류:', error);

        // 상세한 에러 정보 로깅
        console.error('에러 상세 정보:', {
            errorMessage: error.message,
            errorLogs: error.logs
        });

        throw error;
    }
}

/**
 * ============================================
 * 3. 회사 지갑 → 다중 수신자 일괄 전송 (개선 버전)
 * ============================================
 */
export async function bulkTransfer(recipients) {
    try {
        // ✅ 입력값 검증
        if (!recipients || !Array.isArray(recipients)) {
            throw new Error('수신자 목록이 유효하지 않습니다.');
        }

        if (recipients.length === 0) {
            throw new Error('수신자 목록이 비어있습니다.');
        }

        // 각 수신자 검증
        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];

            if (!recipient.wallet_address) {
                throw new Error(`수신자 ${i + 1}: 지갑 주소가 없습니다.`);
            }

            if (!isValidSolanaAddress(recipient.wallet_address)) {
                throw new Error(`수신자 ${i + 1}: 유효하지 않은 지갑 주소입니다.`);
            }

            if (!recipient.amount || recipient.amount <= 0) {
                throw new Error(`수신자 ${i + 1}: 유효하지 않은 금액입니다.`);
            }
        }

        const connection = getSolanaConnection();
        const companyWallet = getCompanyWallet();
        const mintPublicKey = getTokenMintPublicKey();

        // 회사 ATA
        const companyAta = await getATAAddress(companyWallet.publicKey, mintPublicKey);

        // 회사 ATA 존재 확인
        const companyAtaExists = await checkATAExists(connection, companyAta);
        if (!companyAtaExists) {
            throw new Error('회사의 토큰 계정(ATA)이 존재하지 않습니다.');
        }

        // 토큰 decimal
        const decimals = SOLANA_CONFIG.TOKEN_DECIMALS;

        // 트랜잭션 생성
        const transaction = new Transaction();

        // 각 수신자에 대한 전송 Instruction 추가
        for (const recipient of recipients) {
            const recipientPublicKey = new PublicKey(recipient.wallet_address);
            const recipientAta = await getATAAddress(recipientPublicKey, mintPublicKey);

            // 수신자 ATA 존재 확인 및 생성
            const recipientAtaExists = await checkATAExists(connection, recipientAta);
            if (!recipientAtaExists) {
                console.log(`[일괄 전송] 수신자 ATA 생성 필요: ${recipient.wallet_address}`);
                const createAtaIx = createATAInstruction(
                    companyWallet.publicKey,
                    recipientPublicKey,
                    recipientAta,
                    mintPublicKey
                );
                transaction.add(createAtaIx);
            }

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
        const { blockhash } = await getLatestBlockhash(connection);
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = companyWallet.publicKey;

        // 서명 및 전송
        transaction.sign(companyWallet);
        const signature = await connection.sendRawTransaction(transaction.serialize());

        console.log('[일괄 전송] 트랜잭션 전송:', signature);

        await connection.confirmTransaction(signature, SOLANA_CONFIG.COMMITMENT);

        console.log('[일괄 전송] 확인 완료');

        const totalAmount = recipients.reduce((sum, r) => sum + r.amount, 0);

        return {
            success: true,
            signature,
            recipients_count: recipients.length,
            total_amount: totalAmount,
            explorer_url: `https://explorer.solana.com/tx/${signature}?cluster=${SOLANA_CONFIG.NETWORK}`,
            message: `${recipients.length}명에게 토큰이 성공적으로 전송되었습니다.`
        };

    } catch (error) {
        console.error('일괄 전송 오류:', error);
        throw error;
    }
}

/**
 * ============================================
 * 4. 토큰 잔액 조회 (최종 개선 버전)
 * ============================================
 */
export async function getTokenBalance(walletAddress) {
    try {
        // ✅ 입력값 검증 1: null/undefined 체크
        if (!walletAddress) {
            throw new Error('지갑 주소가 제공되지 않았습니다.');
        }

        // ✅ 입력값 검증 2: 타입 체크
        if (typeof walletAddress !== 'string') {
            throw new Error(`유효하지 않은 주소 타입입니다. (받은 타입: ${typeof walletAddress})`);
        }

        // ✅ 입력값 검증 3: 빈 문자열 체크
        const trimmedAddress = walletAddress.trim();
        if (trimmedAddress === '') {
            throw new Error('지갑 주소가 비어있습니다.');
        }

        // ✅ 입력값 검증 4: Base58 형식 검증
        if (!isValidSolanaAddress(trimmedAddress)) {
            console.error('[잔액 조회] 유효하지 않은 주소:', trimmedAddress.substring(0, 20) + '...');
            throw new Error(`유효하지 않은 Solana 주소 형식입니다.`);
        }

        const connection = getSolanaConnection();
        const mintPublicKey = getTokenMintPublicKey();

        // 이제 안전하게 PublicKey 생성
        const walletPublicKey = new PublicKey(trimmedAddress);

        // ATA 주소 계산
        const ata = await getATAAddress(walletPublicKey, mintPublicKey);

        console.log('[잔액 조회] ATA 주소:', ata.toBase58());

        // ATA 존재 확인
        const ataExists = await checkATAExists(connection, ata);

        if (!ataExists) {
            console.log('[잔액 조회] ATA가 존재하지 않음');
            return {
                success: true,
                wallet_address: trimmedAddress,
                ata_address: ata.toBase58(),
                amount: 0,
                amount_in_smallest_unit: 0,
                decimals: SOLANA_CONFIG.TOKEN_DECIMALS,
                message: '토큰 계정이 아직 생성되지 않았습니다.'
            };
        }

        // 토큰 잔액 조회
        const balance = await connection.getTokenAccountBalance(ata);

        console.log('[잔액 조회] 성공:', balance.value.uiAmount);

        return {
            success: true,
            wallet_address: trimmedAddress,
            ata_address: ata.toBase58(),
            amount: parseFloat(balance.value.uiAmount || 0),
            amount_in_smallest_unit: balance.value.amount,
            decimals: balance.value.decimals,
            message: '토큰 잔액 조회 성공'
        };

    } catch (error) {
        console.error('토큰 잔액 조회 오류:', error);

        // 상세한 에러 정보 로깅
        console.error('에러 상세 정보:', {
            walletAddress: walletAddress?.substring(0, 10) + '...',
            errorMessage: error.message,
            errorStack: error.stack?.split('\n')[0]
        });

        throw error;
    }
}

/**
 * ============================================
 * 5. 트랜잭션 상세 정보 조회 (최종 개선 버전)
 * ============================================
 */
export async function getTransactionDetails(signature) {
    try {
        // ✅ 입력값 검증 1: null/undefined 체크
        if (!signature) {
            throw new Error('트랜잭션 서명이 제공되지 않았습니다.');
        }

        // ✅ 입력값 검증 2: 타입 체크
        if (typeof signature !== 'string') {
            throw new Error(`유효하지 않은 서명 타입입니다. (받은 타입: ${typeof signature})`);
        }

        // ✅ 입력값 검증 3: 빈 문자열 체크
        const trimmedSignature = signature.trim();
        if (trimmedSignature === '') {
            throw new Error('트랜잭션 서명이 비어있습니다.');
        }

        // ✅ 입력값 검증 4: Base58 형식 검증
        try {
            bs58.decode(trimmedSignature);
        } catch (decodeError) {
            console.error('[트랜잭션 조회] 디코딩 실패:', trimmedSignature.substring(0, 20) + '...');
            throw new Error('유효하지 않은 서명 형식입니다.');
        }

        // ✅ 입력값 검증 5: 길이 체크 (Solana 서명은 일반적으로 88자)
        if (trimmedSignature.length < 80 || trimmedSignature.length > 100) {
            console.error('[트랜잭션 조회] 유효하지 않은 길이:', trimmedSignature.length);
            throw new Error(`유효하지 않은 서명 길이입니다. (길이: ${trimmedSignature.length})`);
        }

        const connection = getSolanaConnection();

        console.log('[트랜잭션 조회] 서명:', trimmedSignature.substring(0, 20) + '...');

        // 트랜잭션 조회
        const tx = await connection.getTransaction(trimmedSignature, {
            maxSupportedTransactionVersion: 0
        });

        if (!tx) {
            throw new Error('트랜잭션을 찾을 수 없습니다.');
        }

        console.log('[트랜잭션 조회] 성공');

        return {
            success: true,
            signature: trimmedSignature,
            status: tx.meta.err ? 'FAILED' : 'SUCCESS',
            slot: tx.slot,
            block_time: tx.blockTime,
            fee: tx.meta.fee,
            explorer_url: `https://explorer.solana.com/tx/${trimmedSignature}?cluster=${SOLANA_CONFIG.NETWORK}`,
            message: '트랜잭션 정보 조회 성공'
        };

    } catch (error) {
        console.error('트랜잭션 조회 오류:', error);

        // 상세한 에러 정보 로깅
        console.error('에러 상세 정보:', {
            signature: signature?.substring(0, 10) + '...',
            errorMessage: error.message,
            errorCode: error.code
        });

        throw error;
    }
}

/**
 * ============================================
 * 6. SOL 잔액 조회 (개선 버전)
 * ============================================
 */
export async function getSolBalance(walletAddress) {
    try {
        // ✅ 입력값 검증
        if (!walletAddress) {
            throw new Error('지갑 주소가 제공되지 않았습니다.');
        }

        if (typeof walletAddress !== 'string') {
            throw new Error('유효하지 않은 주소 타입입니다.');
        }

        const trimmedAddress = walletAddress.trim();
        if (trimmedAddress === '') {
            throw new Error('지갑 주소가 비어있습니다.');
        }

        if (!isValidSolanaAddress(trimmedAddress)) {
            throw new Error('유효하지 않은 Solana 주소 형식입니다.');
        }

        const connection = getSolanaConnection();
        const walletPublicKey = new PublicKey(trimmedAddress);

        const balance = await connection.getBalance(walletPublicKey);

        return {
            success: true,
            wallet_address: trimmedAddress,
            sol: balance / 1e9,
            lamports: balance,
            message: 'SOL 잔액 조회 성공'
        };

    } catch (error) {
        console.error('SOL 잔액 조회 오류:', error);
        throw error;
    }
}