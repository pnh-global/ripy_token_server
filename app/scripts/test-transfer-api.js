/**
 * test-transfer-complete.js
 *
 * RIPY 토큰 전송 전체 플로우 테스트
 * 위치: app/scripts/test-transfer-complete.js
 *
 * 실행 방법:
 * node app/scripts/test-transfer-complete.js
 */

import axios from 'axios';
import {
    Connection,
    Keypair,
    PublicKey,
    Transaction
} from '@solana/web3.js';
import bs58 from 'bs58';
import dotenv from 'dotenv';

// 환경변수 로드
dotenv.config();

// ========================================
// 설정
// ========================================

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

// Solana 연결
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// 테스트용 지갑 주소들
const WALLET_1 = process.env.WALLET_ADDRESS1 || 'BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh';
const WALLET_2 = process.env.WALLET_ADDRESS2 || 'AiF7NdJKaDxHsfnRzKKH2SR1GJ2u8upvnnVSsrPEikgw';
const FEEPAYER = process.env.FEEPAYER_ADDRESS || '7ZTPH4FY43jiEy1fGDhyz8a1dLw7yTjxQUbU2PdGQd8H';

// 전송 금액 (RIPY 단위)
const TRANSFER_AMOUNT = '10';

// 사용자 개인키 (테스트용 - 실제 환경에서는 앱에서 서명)
// 주의: 개인키는 절대 코드에 하드코딩하지 마세요!
const USER_PRIVATE_KEY = process.env.WALLET_1_PRIVATE_KEY;

if (!USER_PRIVATE_KEY) {
    console.error('\n[ERROR] WALLET_1_PRIVATE_KEY 환경변수가 설정되지 않았습니다.');
    console.error('테스트를 위해서는 발신자 지갑의 개인키가 필요합니다.\n');
    console.error('.env 파일에 다음을 추가하세요:');
    console.error('WALLET_1_PRIVATE_KEY=your_private_key_here\n');
    process.exit(1);
}

// ========================================
// 유틸리티 함수
// ========================================

/**
 * 구분선 출력
 */
function printSeparator(title = '') {
    console.log('\n' + '='.repeat(80));
    if (title) {
        console.log(title);
        console.log('='.repeat(80));
    }
}

/**
 * 대기 함수
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 축약된 주소 표시
 */
function shortAddress(address, start = 8, end = 8) {
    if (!address || address.length <= start + end) return address;
    return `${address.substring(0, start)}...${address.substring(address.length - end)}`;
}

// ========================================
// Step 1: 부분 서명 트랜잭션 생성
// ========================================

async function step1_CreatePartialTransaction() {
    printSeparator('Step 1: 부분 서명 트랜잭션 생성');

    try {
        console.log('\n[요청 정보]');
        console.log(`  API: ${API_BASE_URL}/api/transfer/create`);
        console.log(`  발신자: ${shortAddress(WALLET_1)}`);
        console.log(`  수신자: ${shortAddress(WALLET_2)}`);
        console.log(`  금액: ${TRANSFER_AMOUNT} RIPY`);

        const startTime = Date.now();

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

        const latency = Date.now() - startTime;

        if (!response.data.success) {
            throw new Error('API 응답 실패: ' + JSON.stringify(response.data));
        }

        const { contract_id, partial_transaction, status, message } = response.data.data;

        console.log('\n[성공] 부분 서명 트랜잭션 생성 완료!');
        console.log(`  응답 시간: ${latency}ms`);
        console.log(`  Contract ID: ${contract_id}`);
        console.log(`  Status: ${status}`);
        console.log(`  Message: ${message}`);
        console.log(`  Transaction Length: ${partial_transaction.length} bytes`);

        // 트랜잭션 파싱 및 검증
        try {
            const transaction = Transaction.from(
                Buffer.from(partial_transaction, 'base64')
            );

            console.log('\n[트랜잭션 상세 정보]');
            console.log(`  Fee Payer: ${shortAddress(transaction.feePayer?.toBase58() || 'N/A')}`);
            console.log(`  Recent Blockhash: ${transaction.recentBlockhash || 'N/A'}`);
            console.log(`  Instructions: ${transaction.instructions.length}개`);
            console.log(`  Total Signatures: ${transaction.signatures.length}개`);

            console.log('\n[서명 상태]');
            transaction.signatures.forEach((sig, index) => {
                const address = sig.publicKey.toBase58();
                const hasSig = sig.signature !== null;
                const role = address === FEEPAYER ? 'Feepayer' :
                    address === WALLET_1 ? 'Sender' : 'Unknown';

                console.log(`  ${index + 1}. ${shortAddress(address)} (${role})`);
                console.log(`     서명: ${hasSig ? '✓ 완료' : '✗ 대기중'}`);
            });

        } catch (parseError) {
            console.log('\n[경고] 트랜잭션 파싱 실패:', parseError.message);
        }

        return {
            contract_id,
            partial_transaction
        };

    } catch (error) {
        console.error('\n[실패] 부분 서명 트랜잭션 생성 실패');

        if (error.response) {
            console.error(`  HTTP Status: ${error.response.status}`);
            console.error(`  Error: ${JSON.stringify(error.response.data, null, 2)}`);
        } else if (error.request) {
            console.error('  서버 응답 없음. 서버가 실행 중인지 확인하세요.');
        } else {
            console.error(`  Error: ${error.message}`);
        }

        throw error;
    }
}

// ========================================
// Step 2: 사용자 지갑으로 서명
// ========================================

async function step2_SignWithUserWallet(partialTransaction) {
    printSeparator('Step 2: 사용자 지갑으로 서명');

    try {
        console.log('\n[서명 프로세스]');
        console.log('  실제 환경에서는 앱/웹에서 사용자 지갑(Phantom 등)으로 서명합니다.');
        console.log('  테스트 환경에서는 개인키를 직접 사용하여 서명합니다.\n');

        // 1. 트랜잭션 복원
        console.log('  1. 부분 서명된 트랜잭션 복원 중...');
        const transaction = Transaction.from(
            Buffer.from(partialTransaction, 'base64')
        );
        console.log('     ✓ 트랜잭션 복원 완료');

        // 2. 사용자 지갑 로드
        console.log('  2. 사용자 지갑 로드 중...');
        const userKeypair = Keypair.fromSecretKey(bs58.decode(USER_PRIVATE_KEY));
        console.log(`     ✓ 사용자 지갑: ${shortAddress(userKeypair.publicKey.toBase58())}`);

        // 3. 서명 상태 확인
        console.log('  3. 서명 전 상태 확인...');
        let feepayerSigned = false;
        let userSigned = false;

        for (const sig of transaction.signatures) {
            if (sig.publicKey.equals(new PublicKey(FEEPAYER)) && sig.signature !== null) {
                feepayerSigned = true;
            }
            if (sig.publicKey.equals(userKeypair.publicKey) && sig.signature !== null) {
                userSigned = true;
            }
        }

        console.log(`     Feepayer 서명: ${feepayerSigned ? '✓' : '✗'}`);
        console.log(`     사용자 서명: ${userSigned ? '✓' : '✗'}`);

        if (!feepayerSigned) {
            throw new Error('Feepayer 서명이 없습니다. 트랜잭션이 잘못되었습니다.');
        }

        // 4. 사용자 서명 추가
        console.log('  4. 사용자 서명 추가 중...');
        transaction.partialSign(userKeypair);
        console.log('     ✓ 사용자 서명 완료');

        // 5. 최종 서명 상태 확인
        console.log('  5. 서명 후 상태 확인...');
        for (const sig of transaction.signatures) {
            if (sig.publicKey.equals(userKeypair.publicKey)) {
                if (sig.signature === null) {
                    throw new Error('사용자 서명 추가 실패');
                }
            }
        }
        console.log('     ✓ 모든 서명 완료');

        // 6. 완전히 서명된 트랜잭션 직렬화
        console.log('  6. 트랜잭션 직렬화 중...');
        const serializedTransaction = transaction.serialize({
            requireAllSignatures: true,   // 모든 서명 필수
            verifySignatures: true         // 서명 검증
        });
        const signedTransactionBase64 = serializedTransaction.toString('base64');
        console.log(`     ✓ 직렬화 완료 (${signedTransactionBase64.length} bytes)`);

        console.log('\n[성공] 사용자 서명 완료!');

        return signedTransactionBase64;

    } catch (error) {
        console.error('\n[실패] 사용자 서명 실패');
        console.error(`  Error: ${error.message}`);
        throw error;
    }
}

// ========================================
// Step 3: 최종 전송
// ========================================

async function step3_FinalizeTransaction(contractId, signedTransaction) {
    printSeparator('Step 3: 최종 전송');

    try {
        console.log('\n[요청 정보]');
        console.log(`  API: ${API_BASE_URL}/api/transfer/finalize`);
        console.log(`  Contract ID: ${contractId}`);
        console.log(`  Signed Transaction: ${signedTransaction.length} bytes`);

        const startTime = Date.now();

        const response = await axios.post(
            `${API_BASE_URL}/api/transfer/finalize`,
            {
                contract_id: contractId,
                user_signature: signedTransaction
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 60000  // 60초 (트랜잭션 확인 대기 시간 포함)
            }
        );

        const latency = Date.now() - startTime;

        if (!response.data.success) {
            throw new Error('API 응답 실패: ' + JSON.stringify(response.data));
        }

        const { success, signature, status, message, explorer_url } = response.data.data;

        console.log('\n[성공] 트랜잭션 전송 완료!');
        console.log(`  응답 시간: ${latency}ms`);
        console.log(`  Status: ${status}`);
        console.log(`  Message: ${message}`);
        console.log(`  Transaction Signature: ${signature}`);

        if (explorer_url) {
            console.log(`\n[Explorer 링크]`);
            console.log(`  ${explorer_url}`);
        }

        return {
            signature,
            status
        };

    } catch (error) {
        console.error('\n[실패] 최종 전송 실패');

        if (error.response) {
            console.error(`  HTTP Status: ${error.response.status}`);
            console.error(`  Error: ${JSON.stringify(error.response.data, null, 2)}`);
        } else if (error.request) {
            console.error('  서버 응답 없음. 서버가 실행 중인지 확인하세요.');
        } else {
            console.error(`  Error: ${error.message}`);
        }

        throw error;
    }
}

// ========================================
// Step 4: 상태 확인
// ========================================

async function step4_CheckStatus(contractId) {
    printSeparator('Step 4: 전송 상태 확인');

    try {
        console.log('\n[요청 정보]');
        console.log(`  API: ${API_BASE_URL}/api/transfer/status/${contractId}`);

        const response = await axios.get(
            `${API_BASE_URL}/api/transfer/status/${contractId}`,
            {
                timeout: 10000
            }
        );

        if (!response.data.success) {
            throw new Error('API 응답 실패: ' + JSON.stringify(response.data));
        }

        const data = response.data.data;

        console.log('\n[계약 정보]');
        console.log(`  Contract ID: ${data.contract_id}`);
        console.log(`  Status: ${data.status}`);
        console.log(`  Transaction Signature: ${data.tx_signature || 'N/A'}`);
        console.log(`  Created At: ${data.created_at}`);
        console.log(`  Updated At: ${data.updated_at}`);

        return data;

    } catch (error) {
        console.error('\n[실패] 상태 확인 실패');

        if (error.response) {
            console.error(`  HTTP Status: ${error.response.status}`);
            console.error(`  Error: ${JSON.stringify(error.response.data, null, 2)}`);
        } else {
            console.error(`  Error: ${error.message}`);
        }

        throw error;
    }
}

// ========================================
// 메인 함수
// ========================================

async function main() {
    printSeparator('RIPY 토큰 전송 전체 플로우 테스트');

    console.log('\n[환경 설정]');
    console.log(`  API URL: ${API_BASE_URL}`);
    console.log(`  Solana RPC: ${SOLANA_RPC_URL}`);
    console.log(`  발신자 (WALLET_1): ${shortAddress(WALLET_1)}`);
    console.log(`  수신자 (WALLET_2): ${shortAddress(WALLET_2)}`);
    console.log(`  Feepayer: ${shortAddress(FEEPAYER)}`);
    console.log(`  전송 금액: ${TRANSFER_AMOUNT} RIPY`);

    try {
        // Step 1: 부분 서명 트랜잭션 생성
        const { contract_id, partial_transaction } = await step1_CreatePartialTransaction();
        await sleep(1000);

        // Step 2: 사용자 지갑으로 서명
        const signed_transaction = await step2_SignWithUserWallet(partial_transaction);
        await sleep(1000);

        // Step 3: 최종 전송
        const { signature, status } = await step3_FinalizeTransaction(contract_id, signed_transaction);
        await sleep(2000);

        // Step 4: 상태 확인
        await step4_CheckStatus(contract_id);

        // 최종 결과
        printSeparator('테스트 완료');
        console.log('\n[최종 결과]');
        console.log(`  ✓ Contract ID: ${contract_id}`);
        console.log(`  ✓ Status: ${status}`);
        console.log(`  ✓ Transaction: ${signature}`);
        console.log(`  ✓ Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
        console.log('\n모든 테스트를 성공적으로 완료했습니다!\n');

        process.exit(0);

    } catch (error) {
        printSeparator('테스트 실패');
        console.error('\n[에러 요약]');
        console.error(`  ${error.message}\n`);

        console.log('[문제 해결 가이드]');
        console.log('  1. 서버 실행 확인: docker-compose ps');
        console.log('  2. 로그 확인: docker-compose logs -f app');
        console.log('  3. 환경변수 확인: cat .env');
        console.log('  4. 지갑 잔액 확인: node app/check-balance.js');
        console.log('  5. DB 연결 확인: docker-compose exec mariadb mysql -u ripy_user -p\n');

        process.exit(1);
    }
}

// 스크립트 실행
main().catch(error => {
    console.error('\n[치명적 에러]', error.message);
    process.exit(1);
});