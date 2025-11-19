/**
 * ============================================
 * generate-test-wallet.js
 * ============================================
 *
 * Devnet 테스트용 지갑 생성 및 에어드랍 스크립트
 *
 * 실행 방법:
 * node generate-test-wallet.js
 */

import { Keypair, Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import {
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import bs58 from 'bs58';
import fs from 'fs';

const DEVNET_RPC_URL = 'https://api.devnet.solana.com';

/**
 * 새 지갑 생성
 */
function generateWallet() {
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    const secretKey = bs58.encode(keypair.secretKey);

    console.log('\n' + '='.repeat(60));
    console.log('새 지갑 생성 완료!');
    console.log('='.repeat(60));
    console.log('Public Key (지갑 주소):');
    console.log(publicKey);
    console.log('\nSecret Key (Base58):');
    console.log(secretKey);
    console.log('\n⚠️  Secret Key는 안전하게 보관하세요!');
    console.log('='.repeat(60) + '\n');

    return keypair;
}

/**
 * SOL 에어드랍
 */
async function requestAirdrop(connection, publicKey, amount = 2) {
    console.log(`\n${publicKey.toBase58()}에 ${amount} SOL 에어드랍 요청 중...`);

    try {
        const signature = await connection.requestAirdrop(
            publicKey,
            amount * LAMPORTS_PER_SOL
        );

        console.log('에어드랍 트랜잭션 전송됨:', signature);
        console.log('확인 대기 중...');

        await connection.confirmTransaction(signature, 'confirmed');

        const balance = await connection.getBalance(publicKey);
        console.log(`✅ 에어드랍 완료! 현재 잔액: ${balance / LAMPORTS_PER_SOL} SOL`);

        return signature;
    } catch (error) {
        console.error('❌ 에어드랍 실패:', error.message);
        console.log('💡 Tip: Devnet 에어드랍은 24시간에 제한이 있습니다.');
        console.log('   대안: https://faucet.solana.com 에서 직접 에어드랍 받으세요.');
        throw error;
    }
}

/**
 * ATA (Associated Token Account) 생성
 */
async function createTokenAccount(connection, payer, owner, mintAddress) {
    console.log('\n토큰 계정(ATA) 생성 중...');

    try {
        const mint = new PublicKey(mintAddress);
        const ata = await getAssociatedTokenAddress(mint, owner);

        console.log('ATA 주소:', ata.toBase58());

        // ATA 존재 여부 확인
        const accountInfo = await connection.getAccountInfo(ata);

        if (accountInfo) {
            console.log('✅ ATA가 이미 존재합니다.');
            return ata;
        }

        console.log('ATA가 없습니다. 생성 중...');

        // ATA 생성 트랜잭션
        const { Transaction } = await import('@solana/web3.js');
        const transaction = new Transaction().add(
            createAssociatedTokenAccountInstruction(
                payer.publicKey,  // payer
                ata,              // associatedToken
                owner,            // owner
                mint              // mint
            )
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = payer.publicKey;

        transaction.sign(payer);

        const signature = await connection.sendRawTransaction(transaction.serialize());
        await connection.confirmTransaction(signature, 'confirmed');

        console.log('✅ ATA 생성 완료!');
        console.log('트랜잭션:', signature);

        return ata;
    } catch (error) {
        console.error('❌ ATA 생성 실패:', error.message);
        throw error;
    }
}

/**
 * .env.test 파일 업데이트
 */
function updateEnvFile(secretKey, publicKey) {
    const envPath = '.env.test';

    try {
        let envContent = '';

        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        } else {
            // .env.test 템플릿 생성
            envContent = `# Solana 테스트 환경변수
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
TOKEN_DECIMALS=9
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
NODE_ENV=test
`;
        }

        // COMPANY_WALLET_PRIVATE_KEY 업데이트
        if (envContent.includes('COMPANY_WALLET_PRIVATE_KEY=')) {
            envContent = envContent.replace(
                /COMPANY_WALLET_PRIVATE_KEY=.*/,
                `COMPANY_WALLET_PRIVATE_KEY=${secretKey}`
            );
        } else {
            envContent += `\nCOMPANY_WALLET_PRIVATE_KEY=${secretKey}`;
        }

        // 주석 추가
        envContent += `\n# Public Key: ${publicKey}\n`;

        fs.writeFileSync(envPath, envContent);
        console.log(`\n✅ ${envPath} 파일이 업데이트되었습니다.`);
    } catch (error) {
        console.error('❌ .env.test 파일 업데이트 실패:', error.message);
    }
}

/**
 * 메인 실행 함수
 */
async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('Devnet 테스트 지갑 생성 도구');
    console.log('='.repeat(60) + '\n');

    // Connection 생성
    const connection = new Connection(DEVNET_RPC_URL, 'confirmed');

    // 새 지갑 생성
    const wallet = generateWallet();
    const publicKey = wallet.publicKey.toBase58();
    const secretKey = bs58.encode(wallet.secretKey);

    // SOL 에어드랍 요청
    try {
        await requestAirdrop(connection, wallet.publicKey, 2);
    } catch (error) {
        console.log('\n⚠️  에어드랍은 실패했지만 지갑은 생성되었습니다.');
        console.log('   수동으로 에어드랍을 받으려면:');
        console.log('   1. https://faucet.solana.com 방문');
        console.log('   2. 지갑 주소 입력:', publicKey);
    }

    // .env.test 파일 업데이트
    updateEnvFile(secretKey, publicKey);

    console.log('\n' + '='.repeat(60));
    console.log('다음 단계:');
    console.log('='.repeat(60));
    console.log('1. .env.test 파일에서 RIPY_TOKEN_MINT_ADDRESS를 설정하세요');
    console.log('   - Devnet에서 테스트 토큰을 생성하거나');
    console.log('   - 기존 Devnet 토큰 주소를 사용하세요');
    console.log('\n2. ATA(Associated Token Account)를 생성하세요');
    console.log('   - node create-test-token.js 실행');
    console.log('\n3. 테스트를 실행하세요');
    console.log('   - npm test src/services/__tests__/solana.service.test.js');
    console.log('='.repeat(60) + '\n');
}

// 스크립트 실행
main().catch(console.error);