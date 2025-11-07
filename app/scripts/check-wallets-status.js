/**
 * check-wallets-status.js
 *
 * 세 지갑의 상태를 확인하는 스크립트
 * 위치: app/scripts/check-wallets-status.js
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';

// Solana Devnet 연결
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// RIPY 토큰 민트 주소
const RIPY_TOKEN_MINT = new PublicKey(
    process.env.RIPY_TOKEN_MINT_ADDRESS || '833QSADX3ErnCNFYXRrWSiLxCBnmr7gY4DZkda1AHeik'
);

// 지갑 주소 (환경변수에서 가져오거나 기본값 사용)
const WALLET_1 = process.env.WALLET_ADDRESS1 || 'BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh';
const WALLET_2 = process.env.WALLET_ADDRESS2 || 'AiF7NdJKaDxHsfnRzKKH2SR1GJ2u8upvnnVSsrPEikgw';
const FEEPAYER = process.env.FEEPAYER_ADDRESS || '7ZTPH4FY43jiEy1fGDhyz8a1dLw7yTjxQUbU2PdGQd8H';

/**
 * 지갑 상태 확인 함수
 */
async function checkWalletStatus(walletAddress, walletName) {
    console.log(`\n========================================`);
    console.log(`${walletName} 상태 확인`);
    console.log(`주소: ${walletAddress}`);
    console.log(`========================================`);

    try {
        const publicKey = new PublicKey(walletAddress);

        // 1. SOL 잔액 확인
        console.log('\n1. SOL 잔액 확인 중...');
        const solBalance = await connection.getBalance(publicKey);
        const solBalanceFormatted = (solBalance / 1_000_000_000).toFixed(9);
        console.log(`   - SOL 잔액: ${solBalanceFormatted} SOL`);

        if (solBalance === 0) {
            console.log('   [경고] SOL 잔액이 0입니다.');
            if (walletName.includes('Feepayer')) {
                console.log('   [중요] Feepayer는 수수료 대납을 위해 SOL이 필수입니다!');
            }
            console.log('   Devnet Faucet: https://faucet.solana.com/');
        }

        // 2. RIPY 토큰 ATA 주소 계산
        console.log('\n2. RIPY 토큰 계정(ATA) 확인 중...');
        const ata = await getAssociatedTokenAddress(
            RIPY_TOKEN_MINT,
            publicKey
        );
        console.log(`   - ATA 주소: ${ata.toBase58()}`);

        // 3. ATA 존재 여부 확인
        const ataAccountInfo = await connection.getAccountInfo(ata);

        if (!ataAccountInfo) {
            console.log('   [에러] RIPY 토큰 계정(ATA)이 존재하지 않습니다.');
            console.log('   ATA를 생성해야 합니다.');
            return {
                walletAddress,
                walletName,
                solBalance: solBalanceFormatted,
                hasATA: false,
                ataAddress: ata.toBase58(),
                ripyBalance: 0
            };
        }

        console.log('   - RIPY 토큰 계정(ATA) 존재함');

        // 4. RIPY 토큰 잔액 확인
        console.log('\n3. RIPY 토큰 잔액 확인 중...');
        try {
            const tokenAccount = await getAccount(connection, ata);
            const ripyBalance = Number(tokenAccount.amount) / 1_000_000_000;
            console.log(`   - RIPY 잔액: ${ripyBalance.toFixed(9)} RIPY`);

            if (ripyBalance === 0) {
                console.log('   [경고] RIPY 토큰 잔액이 0입니다.');
                if (walletName.includes('발신자')) {
                    console.log('   [중요] 발신자는 전송할 RIPY 토큰이 필요합니다!');
                }
            }

            return {
                walletAddress,
                walletName,
                solBalance: solBalanceFormatted,
                hasATA: true,
                ataAddress: ata.toBase58(),
                ripyBalance: ripyBalance.toFixed(9)
            };

        } catch (error) {
            console.log('   [에러] RIPY 토큰 잔액 조회 실패:', error.message);
            return {
                walletAddress,
                walletName,
                solBalance: solBalanceFormatted,
                hasATA: true,
                ataAddress: ata.toBase58(),
                ripyBalance: 0,
                error: error.message
            };
        }

    } catch (error) {
        console.error(`\n[에러] ${walletName} 상태 확인 실패:`, error.message);
        return {
            walletAddress,
            walletName,
            error: error.message
        };
    }
}

/**
 * 메인 함수
 */
async function main() {
    console.log('\n===========================================');
    console.log('RIPY 지갑 상태 확인 스크립트');
    console.log('===========================================\n');
    console.log(`RPC URL: ${SOLANA_RPC_URL}`);
    console.log(`RIPY Token Mint: ${RIPY_TOKEN_MINT.toBase58()}`);
    console.log('\n지갑 역할:');
    console.log(`   - WALLET_ADDRESS1: 사용자 A (발신자)`);
    console.log(`   - WALLET_ADDRESS2: 사용자 B (수신자)`);
    console.log(`   - FEEPAYER_ADDRESS: 회사 지갑 (수수료 대납)`);

    // 지갑 1 확인
    const wallet1Status = await checkWalletStatus(WALLET_1, 'WALLET_ADDRESS1 (사용자 A - 발신자)');

    // 지갑 2 확인
    const wallet2Status = await checkWalletStatus(WALLET_2, 'WALLET_ADDRESS2 (사용자 B - 수신자)');

    // Feepayer 확인
    const feepayerStatus = await checkWalletStatus(FEEPAYER, 'FEEPAYER_ADDRESS (회사 지갑)');

    // 요약
    console.log('\n\n===========================================');
    console.log('최종 요약');
    console.log('===========================================\n');

    console.log('WALLET_ADDRESS1 (사용자 A - 발신자):');
    console.log(`  주소: ${wallet1Status.walletAddress}`);
    console.log(`  SOL: ${wallet1Status.solBalance} SOL`);
    console.log(`  ATA: ${wallet1Status.hasATA ? '생성됨' : '미생성'}`);
    console.log(`  RIPY: ${wallet1Status.ripyBalance || 0} RIPY`);

    console.log('\nWALLET_ADDRESS2 (사용자 B - 수신자):');
    console.log(`  주소: ${wallet2Status.walletAddress}`);
    console.log(`  SOL: ${wallet2Status.solBalance} SOL`);
    console.log(`  ATA: ${wallet2Status.hasATA ? '생성됨' : '미생성'}`);
    console.log(`  RIPY: ${wallet2Status.ripyBalance || 0} RIPY`);

    console.log('\nFEEPAYER_ADDRESS (회사 지갑):');
    console.log(`  주소: ${feepayerStatus.walletAddress}`);
    console.log(`  SOL: ${feepayerStatus.solBalance} SOL`);
    console.log(`  ATA: ${feepayerStatus.hasATA ? '생성됨' : '미생성'}`);
    console.log(`  RIPY: ${feepayerStatus.ripyBalance || 0} RIPY`);

    // 전송 가능 여부 판단
    console.log('\n===========================================');
    console.log('전송 준비 상태 체크');
    console.log('===========================================\n');

    const checks = [];

    if (wallet1Status.hasATA) {
        checks.push('[O] 발신자(WALLET_ADDRESS1) ATA 생성됨');
    } else {
        checks.push('[X] 발신자(WALLET_ADDRESS1) ATA 생성 필요');
    }

    if (parseFloat(wallet1Status.ripyBalance || 0) > 0) {
        checks.push('[O] 발신자(WALLET_ADDRESS1)에 RIPY 토큰 있음');
    } else {
        checks.push('[X] 발신자(WALLET_ADDRESS1)에 RIPY 토큰 필요');
    }

    if (wallet2Status.hasATA) {
        checks.push('[O] 수신자(WALLET_ADDRESS2) ATA 생성됨');
    } else {
        checks.push('[X] 수신자(WALLET_ADDRESS2) ATA 생성 필요');
    }

    if (parseFloat(feepayerStatus.solBalance || 0) > 0) {
        checks.push('[O] Feepayer에 SOL 있음 (수수료 대납 가능)');
    } else {
        checks.push('[X] Feepayer에 SOL 필요 (수수료 대납용)');
    }

    checks.forEach(check => console.log(check));

    const canTransfer =
        wallet1Status.hasATA &&
        wallet2Status.hasATA &&
        parseFloat(wallet1Status.ripyBalance || 0) > 0 &&
        parseFloat(feepayerStatus.solBalance || 0) > 0;

    console.log('\n');
    if (canTransfer) {
        console.log('[성공] 토큰 전송 준비 완료!');
        console.log('다음 단계: node app/scripts/test-transfer-api.js');
    } else {
        console.log('[준비 미완료] 아래 작업을 완료해주세요:\n');

        if (!wallet1Status.hasATA) {
            console.log('1. 발신자(WALLET_ADDRESS1) ATA 생성');
        }

        if (!wallet2Status.hasATA) {
            console.log('2. 수신자(WALLET_ADDRESS2) ATA 생성');
        }

        if (parseFloat(wallet1Status.ripyBalance || 0) === 0) {
            console.log('3. 발신자(WALLET_ADDRESS1)에 RIPY 토큰 전송 필요');
        }

        if (parseFloat(feepayerStatus.solBalance || 0) === 0) {
            console.log('4. Feepayer에 SOL Airdrop 필요');
        }
    }

    console.log('');
}

main().catch(console.error);