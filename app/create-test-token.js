/**
 * Devnet 테스트 토큰 생성 스크립트
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { Connection, Keypair } from '@solana/web3.js';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import bs58 from 'bs58';

// ES Module에서 .env 파일 경로 지정
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

async function createTestToken() {
    console.log('\n========================================');
    console.log('Devnet 테스트 토큰 생성');
    console.log('========================================\n');

    try {
        // Connection 생성
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

        // 회사 지갑 로드
        const secretKey = bs58.decode(process.env.SERVICE_WALLET_SECRET_KEY);
        const payer = Keypair.fromSecretKey(secretKey);

        console.log('회사 지갑:', payer.publicKey.toBase58());
        console.log('');

        // SOL 잔액 확인
        const balance = await connection.getBalance(payer.publicKey);
        console.log('SOL 잔액:', balance / 1e9, 'SOL');
        console.log('');

        if (balance < 0.1 * 1e9) {
            console.error('SOL 잔액이 부족합니다. 최소 0.1 SOL이 필요합니다.');
            return;
        }

        console.log('1/4: 토큰 민트 생성 중...');
        const mint = await createMint(
            connection,
            payer,              // payer
            payer.publicKey,    // mint authority
            null,               // freeze authority
            9                   // decimals (RIPY와 동일)
        );
        console.log('토큰 민트 생성 완료!');
        console.log('민트 주소:', mint.toBase58());
        console.log('');

        console.log('2/4: 회사 지갑 토큰 계정(ATA) 생성 중...');
        const companyTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            payer,
            mint,
            payer.publicKey
        );
        console.log('토큰 계정 생성 완료!');
        console.log('토큰 계정 주소:', companyTokenAccount.address.toBase58());
        console.log('');

        console.log('3/4: 초기 토큰 발행 중... (1,000,000 테스트 토큰)');
        await mintTo(
            connection,
            payer,
            mint,
            companyTokenAccount.address,
            payer.publicKey,
            1000000 * Math.pow(10, 9) // 1,000,000 토큰
        );
        console.log('토큰 발행 완료!');
        console.log('');

        console.log('4/4: 잔액 확인 중...');
        const tokenBalance = await connection.getTokenAccountBalance(companyTokenAccount.address);
        console.log('현재 토큰 잔액:', tokenBalance.value.uiAmount, '토큰');
        console.log('');

        console.log('========================================');
        console.log('.env 파일 업데이트 필요:');
        console.log('========================================\n');
        console.log(`TOKEN_MINT_ADDRESS=${mint.toBase58()}`);
        console.log('');

        console.log('========================================');
        console.log('Solana Explorer:');
        console.log('========================================\n');
        console.log(`민트 주소: https://explorer.solana.com/address/${mint.toBase58()}?cluster=devnet`);
        console.log(`회사 ATA: https://explorer.solana.com/address/${companyTokenAccount.address.toBase58()}?cluster=devnet`);
        console.log('');

        console.log('========================================');
        console.log('모든 작업 완료!');
        console.log('========================================\n');

    } catch (error) {
        console.error('오류 발생:', error.message);
        console.error(error);
    }
}

createTestToken();