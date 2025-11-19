import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

async function checkBalance() {
    console.log('\n========================================');
    console.log('SOL 잔액 확인');
    console.log('========================================\n');

    try {
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        const secretKey = bs58.decode(process.env.COMPANY_WALLET_PRIVATE_KEY);
        const keypair = Keypair.fromSecretKey(secretKey);

        console.log('지갑 주소:', keypair.publicKey.toBase58());

        const balance = await connection.getBalance(keypair.publicKey);
        console.log('현재 잔액:', balance / LAMPORTS_PER_SOL, 'SOL');

        if (balance < 0.1 * LAMPORTS_PER_SOL) {
            console.log('\n⚠️  잔액이 부족합니다!');
            console.log('다음 사이트에서 SOL을 받으세요:');
            console.log('https://faucet.solana.com/\n');
            console.log('지갑 주소:', keypair.publicKey.toBase58());
        } else {
            console.log('\n✅ 잔액이 충분합니다!\n');
        }

        console.log('========================================\n');
    } catch (error) {
        console.error('❌ 오류:', error.message);
    }
}

checkBalance();