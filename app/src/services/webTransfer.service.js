/**
 * Web Transfer Service
 * 웹 서버에서 호출하는 토큰 전송 전용 서비스
 * 데이터베이스에서 지갑 Private Key를 조회하여 전송
 */

import { Connection, PublicKey, Keypair, Transaction } from "@solana/web3.js";
import {
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    createTransferInstruction
} from "@solana/spl-token";
import pool from "../config/db.js";
import crypto from "crypto";
// import { SOLANA_CONFIG } from "../config/solana.config.js";

/**
 * SPL 토큰 전송 함수
 *
 * @param {string} fromWallet - 보내는 지갑 주소
 * @param {string} toWallet - 받는 지갑 주소
 * @param {number} amount - 전송할 토큰 수량 (일반 단위)
 * @returns {Promise<object>} 전송 결과
 */
export const transferToken = async (fromWallet, toWallet, amount) => {
    try {
        console.log("[webTransfer] 전송 시작:", {
            from: fromWallet,
            to: toWallet,
            amount
        });

        // 1. Solana 연결 설정
        const connection = new Connection(
            process.env.SOLANA_NETWORK || "https://api.devnet.solana.com",
            "confirmed"
        );

        // 2. 공개키 객체 생성
        const fromPublicKey = new PublicKey(fromWallet);
        const toPublicKey = new PublicKey(toWallet);
        const tokenMintPublicKey = new PublicKey(process.env.TOKEN_MINT_ADDRESS);

        // 3. 보내는 지갑의 Keypair 로드 (데이터베이스에서 조회)
        const fromKeypair = await loadWalletKeypairFromDB(fromWallet);

        // 4. 보내는 지갑과 받는 지갑의 토큰 계정 주소 가져오기
        const fromTokenAccount = await getAssociatedTokenAddress(
            tokenMintPublicKey,
            fromPublicKey
        );

        const toTokenAccount = await getAssociatedTokenAddress(
            tokenMintPublicKey,
            toPublicKey
        );

        console.log("[webTransfer] 토큰 계정:", {
            fromTokenAccount: fromTokenAccount.toString(),
            toTokenAccount: toTokenAccount.toString()
        });

        // 5. 보내는 지갑의 토큰 잔액 확인
        const fromTokenAccountInfo = await connection.getTokenAccountBalance(fromTokenAccount);
        const currentBalance = fromTokenAccountInfo.value.uiAmount;

        console.log("[webTransfer] 현재 잔액:", currentBalance);

        if (currentBalance < amount) {
            throw new Error(`잔액이 부족합니다. (현재: ${currentBalance}, 필요: ${amount})`);
        }

        // 6. 받는 쪽 토큰 계정 존재 여부 확인
        const toTokenAccountInfo = await connection.getAccountInfo(toTokenAccount);

        // 7. 트랜잭션 생성
        const transaction = new Transaction();

        // 8. 받는 쪽 토큰 계정이 없으면 생성 instruction 추가
        if (!toTokenAccountInfo) {
            console.log("[webTransfer] 받는 지갑의 토큰 계정 생성 필요");

            transaction.add(
                createAssociatedTokenAccountInstruction(
                    fromPublicKey,
                    toTokenAccount,
                    toPublicKey,
                    tokenMintPublicKey
                )
            );
        }

        // 9. 토큰 전송 금액 계산 (decimals 적용)
        const decimals = parseInt(process.env.TOKEN_DECIMALS) || 9;
        const transferAmount = Math.floor(amount * Math.pow(10, decimals));

        console.log("[webTransfer] 전송 금액:", {
            inputAmount: amount,
            transferAmount,
            decimals
        });

        // 10. 토큰 전송 instruction 추가
        transaction.add(
            createTransferInstruction(
                fromTokenAccount,
                toTokenAccount,
                fromPublicKey,
                transferAmount
            )
        );

        // 11. 최신 블록해시 가져오기
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPublicKey;

        // 12. 트랜잭션 서명
        transaction.sign(fromKeypair);

        // 13. 트랜잭션 전송
        const signature = await connection.sendRawTransaction(
            transaction.serialize(),
            {
                skipPreflight: false,
                preflightCommitment: "confirmed"
            }
        );

        console.log("[webTransfer] 트랜잭션 전송 완료:", signature);

        // 14. 트랜잭션 확인 대기
        const confirmation = await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight
        }, "confirmed");

        if (confirmation.value.err) {
            throw new Error(`트랜잭션 확인 실패: ${JSON.stringify(confirmation.value.err)}`);
        }

        console.log("[webTransfer] 트랜잭션 확인 완료");

        // 15. 성공 응답 반환
        return {
            success: true,
            signature,
            message: "토큰 전송이 완료되었습니다."
        };

    } catch (error) {
        console.error("[webTransfer] 전송 실패:", error);
        throw error;
    }
};

/**
 * 데이터베이스에서 지갑 Keypair 로드
 *
 * @param {string} walletAddress - 지갑 주소
 * @returns {Promise<Keypair>} Solana Keypair 객체
 */
async function loadWalletKeypairFromDB(walletAddress) {
    try {
        const [rows] = await pool.query(
            "SELECT encrypted_private_key FROM wallets WHERE wallet_address = ? AND is_active = 1",
            [walletAddress]
        );

        if (rows.length === 0) {
            throw new Error(`지갑 정보를 찾을 수 없습니다: ${walletAddress}`);
        }

        const encryptedPrivateKey = rows[0].encrypted_private_key;
        const decryptedPrivateKey = decryptPrivateKey(encryptedPrivateKey);

        const privateKeyArray = JSON.parse(decryptedPrivateKey);
        const secretKey = Uint8Array.from(privateKeyArray);

        return Keypair.fromSecretKey(secretKey);

    } catch (error) {
        console.error("[loadWalletKeypairFromDB] 에러:", error);
        throw new Error(`지갑 Keypair 로드 실패: ${error.message}`);
    }
}

/**
 * Private Key 복호화
 *
 * @param {string} encryptedKey - 암호화된 Private Key
 * @returns {string} 복호화된 Private Key
 */
function decryptPrivateKey(encryptedKey) {
    try {
        const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
        const iv = Buffer.from(process.env.ENCRYPTION_IV, "hex");

        const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

        let decrypted = decipher.update(encryptedKey, "base64", "utf8");
        decrypted += decipher.final("utf8");

        return decrypted;

    } catch (error) {
        throw new Error(`복호화 실패: ${error.message}`);
    }
}