/**
 * test-transfer-step1-only.js
 *
 * 부분 서명 트랜잭션 생성만 테스트
 * 위치: app/scripts/test-transfer-step1-only.js
 *
 * 실행 방법:
 * node app/scripts/test-transfer-step1-only.js
 */

import axios from 'axios';
import { Transaction } from '@solana/web3.js';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';
const WALLET_1 = process.env.WALLET_ADDRESS1 || 'BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh';
const WALLET_2 = process.env.WALLET_ADDRESS2 || 'AiF7NdJKaDxHsfnRzKKH2SR1GJ2u8upvnnVSsrPEikgw';
const TRANSFER_AMOUNT = '10';

async function testCreateOnly() {
    console.log('\n========================================');
    console.log('부분 서명 트랜잭션 생성 테스트');
    console.log('========================================\n');

    try {
        console.log('[요청]');
        console.log(`  URL: ${API_BASE_URL}/api/transfer/create`);
        console.log(`  발신자: ${WALLET_1.substring(0, 16)}...`);
        console.log(`  수신자: ${WALLET_2.substring(0, 16)}...`);
        console.log(`  금액: ${TRANSFER_AMOUNT} RIPY\n`);

        const response = await axios.post(
            `${API_BASE_URL}/api/transfer/create`,
            {
                from_wallet: WALLET_1,
                to_wallet: WALLET_2,
                amount: TRANSFER_AMOUNT
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );

        console.log('[성공]');
        console.log(`  Contract ID: ${response.data.data.contract_id}`);
        console.log(`  Status: ${response.data.data.status}`);
        console.log(`  Message: ${response.data.data.message}`);

        // 트랜잭션 파싱
        const tx = Transaction.from(
            Buffer.from(response.data.data.partial_transaction, 'base64')
        );

        console.log(`\n[트랜잭션 정보]`);
        console.log(`  서명 수: ${tx.signatures.length}`);
        console.log(`  명령 수: ${tx.instructions.length}`);

        console.log(`\n테스트 성공!\n`);

    } catch (error) {
        console.error('\n[실패]');
        if (error.response) {
            console.error(`  Status: ${error.response.status}`);
            console.error(`  Error: ${JSON.stringify(error.response.data, null, 2)}`);
        } else {
            console.error(`  ${error.message}`);
        }
        process.exit(1);
    }
}

testCreateOnly();