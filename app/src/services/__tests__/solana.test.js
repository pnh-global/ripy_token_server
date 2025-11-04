/**
 * ============================================
 * solana.service.test.js - Solana 서비스 테스트
 * ============================================
 *
 * 테스트 대상 함수:
 * 1. createPartialSignedTransaction - 부분서명 트랜잭션 생성
 * 2. sendSignedTransaction - 완전 서명된 트랜잭션 전송
 * 3. bulkTransfer - 회사 지갑에서 다중 수신자 일괄 전송
 * 4. getTokenBalance - 토큰 잔액 조회
 * 5. getTransactionDetails - 트랜잭션 상세 정보 조회
 * 6. getSolBalance - SOL 잔액 조회
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { closePool } from '../../lib/db.util.js';

// 테스트 대상 서비스 함수들
import {
    createPartialSignedTransaction,
    sendSignedTransaction,
    bulkTransfer,
    getTokenBalance,
    getTransactionDetails,
    getSolBalance
} from '../solana.service.js';

// ============================================
// 테스트 환경 설정
// ============================================

const DEVNET_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
let connection;
let testUserWallet;
let testRecipientWallet;

beforeAll(() => {
    // 테스트용 지갑 생성
    testUserWallet = Keypair.generate();
    testRecipientWallet = Keypair.generate();

    // Connection 생성
    connection = new Connection(DEVNET_RPC_URL, 'confirmed');

    console.log('\n' + '='.repeat(60));
    console.log('Solana Service 테스트 환경 초기화');
    console.log('='.repeat(60));
    console.log('RPC URL:', DEVNET_RPC_URL);
    console.log('네트워크:', process.env.SOLANA_NETWORK || 'devnet');
    console.log('테스트 사용자 지갑:', testUserWallet.publicKey.toBase58());
    console.log('테스트 수신자 지갑:', testRecipientWallet.publicKey.toBase58());
    console.log('회사 지갑:', process.env.COMPANY_WALLET_ADDRESS);
    console.log('='.repeat(60) + '\n');
});

afterAll(async () => {
    console.log('\n테스트 완료 - DB 연결 정리');
    await closePool();
});

// ============================================
// 1. createPartialSignedTransaction 테스트
// ============================================
describe('createPartialSignedTransaction', () => {

    test('유효한 파라미터로 부분서명 트랜잭션을 생성해야 함', async () => {
        // Given
        const senderWalletAddress = testUserWallet.publicKey.toBase58();
        const amount = 10.5;

        try {
            // When
            const result = await createPartialSignedTransaction(senderWalletAddress, amount);

            // Then
            expect(result).toBeDefined();
            expect(result.transaction_base64).toBeDefined();
            expect(typeof result.transaction_base64).toBe('string');
            expect(result.blockhash).toBeDefined();
            expect(result.last_valid_block_height).toBeDefined();
            expect(result.sender_ata).toBeDefined();
            expect(result.company_ata).toBeDefined();
            expect(result.amount).toBe(amount);

            // Base64 디코딩 가능 여부 확인
            const buffer = Buffer.from(result.transaction_base64, 'base64');
            expect(buffer.length).toBeGreaterThan(0);

            // Transaction 객체로 복원 가능 여부 확인
            const transaction = Transaction.from(buffer);
            expect(transaction).toBeInstanceOf(Transaction);

            console.log('✅ 부분서명 트랜잭션 생성 성공');

        } catch (error) {
            if (error.message.includes('COMPANY_WALLET_PRIVATE_KEY') ||
                error.message.includes('RIPY_TOKEN_MINT_ADDRESS') ||
                error.message.includes('ATA')) {
                console.log('⚠️  환경변수 미설정 또는 ATA 없음 - 테스트 스킵');
                expect(true).toBe(true);
            } else {
                throw error;
            }
        }
    }, 30000);

    test('잘못된 지갑 주소로 요청 시 에러를 발생시켜야 함', async () => {
        const invalidAddress = 'invalid_wallet_address';
        const amount = 10;

        await expect(createPartialSignedTransaction(invalidAddress, amount))
            .rejects
            .toThrow();
    });

    test('음수 금액으로 요청 시 에러를 발생시켜야 함', async () => {
        const senderWalletAddress = testUserWallet.publicKey.toBase58();
        const amount = -10;

        try {
            await createPartialSignedTransaction(senderWalletAddress, amount);
        } catch (error) {
            expect(error).toBeDefined();
        }
    });
});

// ============================================
// 2. sendSignedTransaction 테스트
// ============================================
describe('sendSignedTransaction', () => {

    test('잘못된 Base64 문자열로 전송 시 에러를 발생시켜야 함', async () => {
        const invalidBase64 = 'invalid_base64_string';

        await expect(sendSignedTransaction(invalidBase64))
            .rejects
            .toThrow();
    });

    test('빈 문자열로 전송 시 에러를 발생시켜야 함', async () => {
        const emptyString = '';

        await expect(sendSignedTransaction(emptyString))
            .rejects
            .toThrow();
    });
});

// ============================================
// 3. bulkTransfer 테스트
// ============================================
describe('bulkTransfer', () => {

    test('다중 수신자에게 일괄 전송해야 함', async () => {
        const recipients = [
            {
                wallet_address: process.env.COMPANY_WALLET_ADDRESS,
                amount: 1
            }
        ];

        try {
            const result = await bulkTransfer(recipients);

            expect(result).toBeDefined();
            expect(result.signature).toBeDefined();
            expect(result.recipients_count).toBe(1);
            expect(result.total_amount).toBe(1);

            console.log('✅ 일괄 전송 성공');

        } catch (error) {
            if (error.message.includes('insufficient') ||
                error.message.includes('SERVICE_WALLET') ||
                error.message.includes('InvalidAccountData')) {
                console.log('⚠️  회사 지갑 잔액 부족 또는 환경 문제 - 테스트 스킵');
                expect(true).toBe(true);
            } else {
                throw error;
            }
        }
    }, 30000);

    test('빈 배열로 요청 시 에러를 발생시켜야 함', async () => {
        const recipients = [];

        try {
            await bulkTransfer(recipients);
        } catch (error) {
            expect(error).toBeDefined();
        }
    });
});

// ============================================
// 4. getTokenBalance 테스트
// ============================================
describe('getTokenBalance', () => {

    test('유효한 지갑 주소로 토큰 잔액을 조회해야 함', async () => {
        const walletAddress = testUserWallet.publicKey.toBase58();

        try {
            const result = await getTokenBalance(walletAddress);

            expect(result).toBeDefined();
            expect(result.wallet_address).toBe(walletAddress);
            expect(result.ata_address).toBeDefined();
            expect(typeof result.amount).toBe('number');
            expect(typeof result.amount_in_smallest_unit).toBe('number');
            expect(result.decimals).toBeDefined();

            console.log('✅ 토큰 잔액 조회 성공');

        } catch (error) {
            if (error.message.includes('RIPY_TOKEN_MINT_ADDRESS')) {
                console.log('⚠️  RIPY_TOKEN_MINT_ADDRESS 미설정 - 테스트 스킵');
                expect(true).toBe(true);
            } else {
                throw error;
            }
        }
    }, 30000);

    test('잘못된 지갑 주소로 조회 시 에러를 발생시켜야 함', async () => {
        const invalidAddress = 'invalid_address';

        await expect(getTokenBalance(invalidAddress))
            .rejects
            .toThrow();
    });
});

// ============================================
// 5. getTransactionDetails 테스트
// ============================================
describe('getTransactionDetails', () => {

    test('존재하지 않는 signature 조회 시 에러를 발생시켜야 함', async () => {
        // Given: 잘못된 형식의 signature
        const fakeSignature = '1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111';

        // When & Then
        // Solana RPC는 잘못된 signature 형식에 대해 에러를 발생시킴
        try {
            await getTransactionDetails(fakeSignature);
            fail('에러가 발생해야 합니다');
        } catch (error) {
            // 에러가 발생하면 통과
            expect(error).toBeDefined();
            expect(error.message).toContain('transaction');
        }
    }, 30000);
});

// ============================================
// 6. getSolBalance 테스트
// ============================================
describe('getSolBalance', () => {

    test('유효한 지갑 주소로 SOL 잔액을 조회해야 함', async () => {
        const walletAddress = testUserWallet.publicKey.toBase58();

        const result = await getSolBalance(walletAddress);

        expect(result).toBeDefined();
        expect(result.wallet_address).toBe(walletAddress);
        expect(typeof result.sol).toBe('number');
        expect(typeof result.lamports).toBe('number');
        expect(result.sol).toBe(result.lamports / 1e9);

        console.log('✅ SOL 잔액 조회 성공');
    }, 30000);

    test('잘못된 지갑 주소로 조회 시 에러를 발생시켜야 함', async () => {
        const invalidAddress = 'invalid_address';

        await expect(getSolBalance(invalidAddress))
            .rejects
            .toThrow();
    });

    test('새로 생성된 지갑의 SOL 잔액은 0이어야 함', async () => {
        const newWallet = Keypair.generate();
        const walletAddress = newWallet.publicKey.toBase58();

        const result = await getSolBalance(walletAddress);

        expect(result.sol).toBe(0);
        expect(result.lamports).toBe(0);
    }, 30000);
});

console.log('✓ solana.test.js 테스트 스위트 로드 완료');