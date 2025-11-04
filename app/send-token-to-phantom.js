/**
 * 회사 지갑 → 팬텀 지갑으로 토큰 전송
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, transfer } from '@solana/spl-token';
import bs58 from 'bs58';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

async function sendTokenToPhantom() {
    console.log('\n========================================');
    console.log('팬텀 지갑으로 토큰 전송');
    console.log('========================================\n');

    try {
        const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');

        // 회사 지갑 로드
        const secretKey = bs58.decode(process.env.COMPANY_WALLET_PRIVATE_KEY);
        const companyWallet = Keypair.fromSecretKey(secretKey);

        // 토큰 민트
        const mintPublicKey = new PublicKey(process.env.RIPY_TOKEN_MINT_ADDRESS);

        // 팬텀 지갑 주소
        const phantomWallet = new PublicKey('BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh');

        console.log('회사 지갑:', companyWallet.publicKey.toBase58());
        console.log('팬텀 지갑:', phantomWallet.toBase58());
        console.log('토큰 민트:', mintPublicKey.toBase58());
        console.log('');

        // 1. 회사 지갑의 토큰 계정 가져오기
        console.log('1/3: 회사 지갑 토큰 계정 확인 중...');
        const companyTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            companyWallet,
            mintPublicKey,
            companyWallet.publicKey
        );
        console.log('✅ 회사 ATA:', companyTokenAccount.address.toBase58());
        console.log('');

        // 2. 팬텀 지갑의 토큰 계정 생성 (없으면)
        console.log('2/3: 팬텀 지갑 토큰 계정 생성 중...');
        const phantomTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            companyWallet, // payer
            mintPublicKey,
            phantomWallet
        );
        console.log('✅ 팬텀 ATA:', phantomTokenAccount.address.toBase58());
        console.log('');

        // 3. 토큰 전송 (100 토큰)
        const amount = 100;
        const decimals = parseInt(process.env.TOKEN_DECIMALS);
        const transferAmount = amount * Math.pow(10, decimals);

        console.log('3/3: 토큰 전송 중...');
        console.log(`  전송 금액: ${amount} 토큰`);
        console.log('');

        const signature = await transfer(
            connection,
            companyWallet, // payer
            companyTokenAccount.address, // from
            phantomTokenAccount.address, // to
            companyWallet, // owner
            transferAmount
        );

        console.log('✅ 전송 완료!');
        console.log('');
        console.log('트랜잭션 서명:', signature);
        console.log('');
        console.log('Solana Explorer:');
        console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);
        console.log('');

        // 잔액 확인
        console.log('========================================');
        console.log('잔액 확인');
        console.log('========================================\n');

        const companyBalance = await connection.getTokenAccountBalance(companyTokenAccount.address);
        const phantomBalance = await connection.getTokenAccountBalance(phantomTokenAccount.address);

        console.log('회사 지갑:', companyBalance.value.uiAmount, '토큰');
        console.log('팬텀 지갑:', phantomBalance.value.uiAmount, '토큰');
        console.log('');

        console.log('========================================');
        console.log('✅ 모든 작업 완료!');
        console.log('========================================\n');

    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
        console.error(error);
    }
}

sendTokenToPhantom();