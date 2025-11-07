/**
 * test-transfer-api.js
 *
 * 토큰 전송 API 테스트 스크립트
 * 위치: app/scripts/test-transfer-api.js
 */

import axios from 'axios';
import { Transaction } from '@solana/web3.js';

// 설정
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

// 지갑 주소 (환경변수에서 가져오거나 기본값 사용)
const WALLET_1 = process.env.WALLET_ADDRESS1 || 'BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh';
const WALLET_2 = process.env.WALLET_ADDRESS2 || 'AiF7NdJKaDxHsfnRzKKH2SR1GJ2u8upvnnVSsrPEikgw';
const FEEPAYER = process.env.FEEPAYER_ADDRESS || '7ZTPH4FY43jiEy1fGDhyz8a1dLw7yTjxQUbU2PdGQd8H';

// 전송 금액
const TRANSFER_AMOUNT = '10';

/**
 * Step 1: 부분 서명 트랜잭션 생성
 */
async function testCreatePartialTransaction() {
    console.log('\n===========================================');
    console.log('Step 1: 부분 서명 트랜잭션 생성');
    console.log('===========================================\n');

    try {
        console.log('요청 정보:');
        console.log(`  - API: ${API_BASE_URL}/api/transfer/create`);
        console.log(`  - 발신자 (WALLET_ADDRESS1): ${WALLET_1}`);
        console.log(`  - 수신자 (WALLET_ADDRESS2): ${WALLET_2}`);
        console.log(`  - Feepayer: ${FEEPAYER}`);
        console.log(`  - 금액: ${TRANSFER_AMOUNT} RIPY\n`);

        const response = await axios.post(
            `${API_BASE_URL}/api/transfer/create`,
            {
                from_wallet: WALLET_1,
                to_wallet: WALLET_2,
                amount: TRANSFER_AMOUNT
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        console.log('[성공] 부분 서명 트랜잭션 생성 완료!\n');

        const { contract_id, partial_transaction, status, message } = response.data.data;

        console.log('응답 데이터:');
        console.log(`  - Contract ID: ${contract_id}`);
        console.log(`  - Status: ${status}`);
        console.log(`  - Message: ${message}`);
        console.log(`  - Partial Transaction: ${partial_transaction.substring(0, 64)}...`);

        // 트랜잭션 정보 파싱
        try {
            const transaction = Transaction.from(
                Buffer.from(partial_transaction, 'base64')
            );

            console.log('\n트랜잭션 상세 정보:');
            console.log(`  - Fee Payer: ${transaction.feePayer?.toBase58() || 'N/A'}`);
            console.log(`  - Recent Blockhash: ${transaction.recentBlockhash || 'N/A'}`);
            console.log(`  - Instructions: ${transaction.instructions.length}개`);
            console.log(`  - Total Signatures: ${transaction.signatures.length}개`);

            console.log('\n  서명 상태:');
            transaction.signatures.forEach((sig, index) => {
                const hasSig = sig.signature !== null;
                const role = sig.publicKey.toBase58() === FEEPAYER ? '(Feepayer)' : '(사용자)';
                console.log(`    ${index + 1}. ${sig.publicKey.toBase58().substring(0, 32)}... ${role}`);
                console.log(`       서명: ${hasSig ? '완료' : '대기중'}`);
            });

        } catch (parseError) {
            console.log('\n[경고] 트랜잭션 파싱 실패:', parseError.message);
        }

        return {
            contract_id,
            partial_transaction
        };

    } catch (error) {
        console.error('[에러] 부분 서명 트랜잭션 생성 실패:\n');

        if (error.response) {
            console.error(`  상태 코드: ${error.response.status}`);
            console.error(`  에러 메시지: ${error.response.data.error || error.response.data}`);
        } else if (error.request) {
            console.error('  서버 응답 없음. 서버가 실행 중인지 확인하세요.');
        } else {
            console.error(`  에러: ${error.message}`);
        }

        throw error;
    }
}

/**
 * Step 2: 사용자 서명 시뮬레이션
 */
async function simulateUserSignature(partialTransaction) {
    console.log('\n===========================================');
    console.log('Step 2: 사용자 서명 프로세스');
    console.log('===========================================\n');

    console.log('실제 환경에서의 프로세스:\n');
    console.log('  1. 웹/앱이 부분 서명된 트랜잭션을 받음');
    console.log('  2. 사용자 지갑(Phantom, Solflare 등)으로 서명 요청');
    console.log('  3. 사용자가 지갑에서 서명 승인');
    console.log('  4. 완전히 서명된 트랜잭션을 Base64로 인코딩');
    console.log('  5. 웹 서버로 전송\n');

    console.log('[현재 상황]');
    console.log('  - 발신자(WALLET_ADDRESS1)의 개인키가 없어 실제 서명 불가');
    console.log('  - 실제 테스트를 위해서는 웹/앱 연동 필요\n');

    return null;
}

/**
 * 메인 함수
 */
async function main() {
    console.log('\n===========================================');
    console.log('RIPY 토큰 전송 API 테스트');
    console.log('===========================================\n');
    console.log(`API URL: ${API_BASE_URL}`);
    console.log('\n환경 변수:');
    console.log(`  - WALLET_ADDRESS1: ${WALLET_1.substring(0, 32)}...`);
    console.log(`  - WALLET_ADDRESS2: ${WALLET_2.substring(0, 32)}...`);
    console.log(`  - FEEPAYER_ADDRESS: ${FEEPAYER.substring(0, 32)}...`);

    try {
        // Step 1: 부분 서명 트랜잭션 생성
        const { contract_id, partial_transaction } = await testCreatePartialTransaction();

        // Step 2: 사용자 서명 시뮬레이션
        await simulateUserSignature(partial_transaction);

        console.log('\n===========================================');
        console.log('테스트 완료');
        console.log('===========================================\n');

        console.log('다음 단계:\n');
        console.log('  1. 웹/앱에서 부분 서명 트랜잭션 생성 API 호출');
        console.log('  2. 받은 partial_transaction을 사용자 지갑으로 서명');
        console.log('  3. 서명된 트랜잭션으로 finalize API 호출');
        console.log('  4. Solana Explorer에서 트랜잭션 확인\n');

    } catch (error) {
        console.error('\n[테스트 실패]');
        console.error(`에러: ${error.message}\n`);

        console.log('문제 해결:\n');
        console.log('  1. 서버가 실행 중인지 확인');
        console.log('  2. 지갑 상태 확인: node app/scripts/check-wallets-status.js');
        console.log('  3. .env 파일 확인');
        console.log('  4. 라우트 등록 확인\n');

        process.exit(1);
    }
}

main().catch(error => {
    console.error('\n[치명적 에러]', error.message);
    process.exit(1);
});