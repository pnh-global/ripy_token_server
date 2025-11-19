import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

async function airdropSol() {
    console.log('\n========================================');
    console.log('Devnet SOL Airdrop 요청');
    console.log('========================================\n');

    try {
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

        // 지갑 로드
        const secretKey = bs58.decode(process.env.COMPANY_WALLET_PRIVATE_KEY);
        const keypair = Keypair.fromSecretKey(secretKey);

        console.log('지갑 주소:', keypair.publicKey.toBase58());
        console.log('요청 금액: 2 SOL\n');

        // Airdrop 요청
        const signature = await connection.requestAirdrop(
            keypair.publicKey,
            2 * LAMPORTS_PER_SOL
        );

        console.log('Airdrop 트랜잭션:', signature);
        console.log('컨펌 대기 중...');

        await connection.confirmTransaction(signature);

        console.log('✅ Airdrop 성공!\n');

        // 잔액 확인
        const balance = await connection.getBalance(keypair.publicKey);
        console.log('현재 잔액:', balance / LAMPORTS_PER_SOL, 'SOL');
        console.log('========================================\n');

    } catch (error) {
        console.error('❌ Airdrop 실패:', error.message);
        console.log('\n대안: Solana Faucet 사용');
        console.log('https://faucet.solana.com/');
        console.log('========================================\n');
    }
}

airdropSol();