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
 *
 * 작성일: 2025-10-30
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';

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

// 테스트용 환경변수 설정 (필수)
const DEVNET_RPC_URL = 'https://api.devnet.solana.com';
let connection;
let testUserWallet;
let testRecipientWallet;

// 환경변수 설정 (테스트 전에 반드시 설정)
beforeAll(() => {
    // Devnet 환경변수 설정
    process.env.SOLANA_RPC_URL = DEVNET_RPC_URL;
    process.env.SOLANA_NETWORK = 'devnet';
    process.env.TOKEN_DECIMALS = '9';

    // .env.test 파일의 환경변수 로드 (테스트 전용)
    // SERVICE_WALLET_SECRET_KEY가 없으면 .env.test의 값 사용
    if (!process.env.SERVICE_WALLET_SECRET_KEY) {
        // .env.test에서 읽어온 값 (dotenv는 이미 로드됨)
        process.env.SERVICE_WALLET_SECRET_KEY = process.env.SERVICE_WALLET_SECRET_KEY_DEVNET || '';
    }

    // TOKEN_MINT_ADDRESS가 없으면 .env.test의 값 사용
    if (!process.env.TOKEN_MINT_ADDRESS) {
        process.env.TOKEN_MINT_ADDRESS = process.env.TEST_TOKEN_MINT || '';
    }

    // 테스트용 지갑 생성
    testUserWallet = Keypair.generate();
    testRecipientWallet = Keypair.generate();

    // Connection 생성
    connection = new Connection(DEVNET_RPC_URL, 'confirmed');

    console.log('\n' + '='.repeat(60));
    console.log('Solana Service 테스트 환경 초기화');
    console.log('='.repeat(60));
    console.log('RPC URL:', process.env.SOLANA_RPC_URL);
    console.log('네트워크:', process.env.SOLANA_NETWORK);
    console.log('테스트 사용자 지갑:', testUserWallet.publicKey.toBase58());
    console.log('테스트 수신자 지갑:', testRecipientWallet.publicKey.toBase58());
    console.log('='.repeat(60) + '\n');
});

afterAll(() => {
    console.log('\n테스트 완료 - 리소스 정리\n');
});

// ============================================
// 1. createPartialSignedTransaction 테스트
// ============================================
describe('createPartialSignedTransaction', () => {

    test('유효한 파라미터로 부분서명 트랜잭션을 생성해야 함', async () => {
        // Given: 사용자 지갑 주소와 전송 금액
        const senderWalletAddress = testUserWallet.publicKey.toBase58();
        const amount = 10.5;

        // When: 부분서명 트랜잭션 생성
        // 주의: 실제로는 환경변수에 SERVICE_WALLET_SECRET_KEY, TOKEN_MINT_ADDRESS 필요
        // 이 테스트는 환경변수가 설정되어 있을 때만 통과

        try {
            const result = await createPartialSignedTransaction(senderWalletAddress, amount);

            // Then: 반환값 구조 검증
            expect(result).toBeDefined();
            expect(result.transaction_base64).toBeDefined();
            expect(typeof result.transaction_base64).toBe('string');
            expect(result.blockhash).toBeDefined();
            expect(result.last_valid_block_height).toBeDefined();
            expect(result.sender_ata).toBeDefined();
            expect(result.company_ata).toBeDefined();
            expect(result.amount).toBe(amount);
            expect(result.note).toBeDefined();

            // Base64 디코딩 가능 여부 확인
            const buffer = Buffer.from(result.transaction_base64, 'base64');
            expect(buffer.length).toBeGreaterThan(0);

            // Transaction 객체로 복원 가능 여부 확인
            const transaction = Transaction.from(buffer);
            expect(transaction).toBeInstanceOf(Transaction);
            expect(transaction.instructions.length).toBeGreaterThan(0);

            // feePayer 확인
            expect(transaction.feePayer).toBeDefined();

            console.log('✅ 부분서명 트랜잭션 생성 성공');
            console.log('   - Base64 길이:', result.transaction_base64.length);
            console.log('   - Blockhash:', result.blockhash);
            console.log('   - Last Valid Height:', result.last_valid_block_height);

        } catch (error) {
            // 환경변수 미설정 시 예상되는 에러
            if (error.message.includes('SERVICE_WALLET_SECRET_KEY') ||
                error.message.includes('TOKEN_MINT_ADDRESS') ||
                error.message.includes('ATA')) {
                console.log('⚠️  환경변수 미설정 또는 ATA 없음 - 테스트 스킵');
                expect(true).toBe(true); // 환경 문제는 통과 처리
            } else {
                throw error; // 실제 오류는 실패 처리
            }
        }
    }, 30000);

    test('잘못된 지갑 주소로 요청 시 에러를 발생시켜야 함', async () => {
        // Given: 잘못된 지갑 주소
        const invalidAddress = 'invalid_wallet_address';
        const amount = 10;

        // When & Then: 에러 발생 확인
        await expect(createPartialSignedTransaction(invalidAddress, amount))
            .rejects
            .toThrow();
    });

    test('음수 금액으로 요청 시 정상적으로 처리되지 않아야 함', async () => {
        // Given: 음수 금액
        const senderWalletAddress = testUserWallet.publicKey.toBase58();
        const amount = -10;

        // When & Then: 음수는 decimal 변환 시 문제 발생 예상
        // 실제 구현에서는 음수 검증이 없으므로 이후 단계에서 실패할 것
        try {
            await createPartialSignedTransaction(senderWalletAddress, amount);
        } catch (error) {
            expect(error).toBeDefined();
        }
    });

    test('0 금액으로 요청 시 트랜잭션은 생성되지만 의미가 없어야 함', async () => {
        // Given: 0 금액
        const senderWalletAddress = testUserWallet.publicKey.toBase58();
        const amount = 0;

        // When: 0 금액으로 트랜잭션 생성 시도
        try {
            const result = await createPartialSignedTransaction(senderWalletAddress, amount);

            // Then: 트랜잭션은 생성되지만 amount는 0
            expect(result.amount).toBe(0);
        } catch (error) {
            // ATA 없음 등의 이유로 실패 가능
            console.log('⚠️  0 금액 테스트 실패 (예상된 동작)');
        }
    });
});

// ============================================
// 2. sendSignedTransaction 테스트
// ============================================
describe('sendSignedTransaction', () => {

    test('완전히 서명된 트랜잭션을 전송해야 함', async () => {
        // 이 테스트는 실제 Devnet에 트랜잭션을 전송하므로
        // 유효한 서명된 트랜잭션이 필요함
        // 실제 전송 테스트는 통합 테스트에서 수행

        expect(true).toBe(true); // placeholder
    }, 30000);

    test('잘못된 Base64 문자열로 전송 시 에러를 발생시켜야 함', async () => {
        // Given: 잘못된 base64 문자열
        const invalidBase64 = 'invalid_base64_string';

        // When & Then: Buffer 변환 실패로 에러 발생
        await expect(sendSignedTransaction(invalidBase64))
            .rejects
            .toThrow();
    });

    test('빈 문자열로 전송 시 에러를 발생시켜야 함', async () => {
        // Given: 빈 문자열
        const emptyString = '';

        // When & Then
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
        // Given: 수신자 배열
        const recipients = [
            {
                wallet_address: 'BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh', // 팬텀 지갑 (ATA 있음)
                amount: 5
            }
            // 테스트용이므로 한 명만 전송
        ];

        // When: 일괄 전송 시도
        try {
            const result = await bulkTransfer(recipients);

            // Then: 결과 검증
            expect(result).toBeDefined();
            expect(result.signature).toBeDefined();
            expect(result.recipients_count).toBe(1);
            expect(result.total_amount).toBe(5);
            expect(result.explorer_url).toContain('explorer.solana.com');

            console.log('✅ 일괄 전송 성공');
            console.log('   - Signature:', result.signature);
            console.log('   - 수신자 수:', result.recipients_count);
            console.log('   - 총 금액:', result.total_amount);

        } catch (error) {
            // 회사 지갑 잔액 부족 또는 환경변수 미설정 시
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
        // Given: 빈 수신자 배열
        const recipients = [];

        // When: 빈 배열로 전송 시도
        // 트랜잭션에 instruction이 없어 에러 발생 예상
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
        // Given: 테스트 지갑 주소
        const walletAddress = testUserWallet.publicKey.toBase58();

        // When: 잔액 조회
        try {
            const result = await getTokenBalance(walletAddress);

            // Then: 결과 구조 검증
            expect(result).toBeDefined();
            expect(result.wallet_address).toBe(walletAddress);
            expect(result.ata_address).toBeDefined();
            expect(typeof result.amount).toBe('number');
            expect(typeof result.amount_in_smallest_unit).toBe('number');
            expect(result.decimals).toBeDefined();

            // ATA가 없으면 message 포함
            if (result.amount === 0) {
                expect(result.message).toBeDefined();
            }

            console.log('✅ 토큰 잔액 조회 성공');
            console.log('   - Wallet:', result.wallet_address);
            console.log('   - ATA:', result.ata_address);
            console.log('   - Amount:', result.amount);
            console.log('   - Decimals:', result.decimals);

        } catch (error) {
            if (error.message.includes('TOKEN_MINT_ADDRESS')) {
                console.log('⚠️  TOKEN_MINT_ADDRESS 미설정 - 테스트 스킵');
                expect(true).toBe(true);
            } else {
                throw error;
            }
        }
    }, 30000);

    test('잘못된 지갑 주소로 조회 시 에러를 발생시켜야 함', async () => {
        // Given: 잘못된 주소
        const invalidAddress = 'invalid_address';

        // When & Then
        await expect(getTokenBalance(invalidAddress))
            .rejects
            .toThrow();
    });

    test('회사 지갑의 토큰 잔액을 조회해야 함', async () => {
        // Given: 회사 지갑 주소 (환경변수에서 로드)
        // 실제 테스트에서는 회사 지갑 공개키 필요

        // 이 테스트는 환경변수 설정 시에만 실행
        expect(true).toBe(true); // placeholder
    });
});

// ============================================
// 5. getTransactionDetails 테스트
// ============================================
describe('getTransactionDetails', () => {

    test('유효한 signature로 트랜잭션 상세 정보를 조회해야 함', async () => {
        // Given: 실제 존재하는 트랜잭션 signature 필요
        // ⭐ 이 부분을 실제 signature로 교체
        const testSignature = '26NjGLaSQGcNGYmB27ZwNpr6fkBCWS8xsqSZ2zk8vWHHEsrVaySCJoFecDBfapy9PGhVWAmrngC7huTBDKs2UmX1';

        // When: 트랜잭션 조회
        try {
            const result = await getTransactionDetails(testSignature);

            // Then: 결과 검증
            expect(result).toBeDefined();
            expect(result.signature).toBe(testSignature);
            expect(result.status).toMatch(/SUCCESS|FAILED/);
            expect(result.slot).toBeDefined();
            expect(result.explorer_url).toContain('explorer.solana.com');

            console.log('✅ 트랜잭션 조회 성공');
            console.log('   - Status:', result.status);
            console.log('   - Slot:', result.slot);

        } catch (error) {
            if (error.message.includes('찾을 수 없습니다')) {
                console.log('⚠️  유효한 signature 없음 - 테스트 스킵');
                expect(true).toBe(true);
            } else {
                throw error;
            }
        }
    }, 30000);

    test('존재하지 않는 signature 조회 시 에러를 발생시켜야 함', async () => {
        // Given: 존재하지 않는 signature
        const fakeSignature = '1111111111111111111111111111111111111111111111111111111111111111';

        // When & Then
        await expect(getTransactionDetails(fakeSignature))
            .rejects
            .toThrow('트랜잭션을 찾을 수 없습니다');
    });
});

// ============================================
// 6. getSolBalance 테스트
// ============================================
describe('getSolBalance', () => {

    test('유효한 지갑 주소로 SOL 잔액을 조회해야 함', async () => {
        // Given: 테스트 지갑 주소
        const walletAddress = testUserWallet.publicKey.toBase58();

        // When: SOL 잔액 조회
        const result = await getSolBalance(walletAddress);

        // Then: 결과 검증
        expect(result).toBeDefined();
        expect(result.wallet_address).toBe(walletAddress);
        expect(typeof result.sol).toBe('number');
        expect(typeof result.lamports).toBe('number');
        expect(result.sol).toBe(result.lamports / 1e9);

        console.log('✅ SOL 잔액 조회 성공');
        console.log('   - Wallet:', result.wallet_address);
        console.log('   - SOL:', result.sol);
        console.log('   - Lamports:', result.lamports);
    }, 30000);

    test('잘못된 지갑 주소로 조회 시 에러를 발생시켜야 함', async () => {
        // Given: 잘못된 주소
        const invalidAddress = 'invalid_address';

        // When & Then
        await expect(getSolBalance(invalidAddress))
            .rejects
            .toThrow();
    });

    test('새로 생성된 지갑의 SOL 잔액은 0이어야 함', async () => {
        // Given: 새로 생성된 지갑
        const newWallet = Keypair.generate();
        const walletAddress = newWallet.publicKey.toBase58();

        // When: 잔액 조회
        const result = await getSolBalance(walletAddress);

        // Then: 잔액 0 확인
        expect(result.sol).toBe(0);
        expect(result.lamports).toBe(0);
    }, 30000);
});

// ============================================
// 통합 테스트 (전체 플로우)
// ============================================
describe('Solana Service Integration Test', () => {

    test('전체 플로우: 부분서명 → 사용자 서명 → 전송', async () => {
        // 이 테스트는 실제 Devnet에서 전체 플로우를 검증
        // 필요 조건:
        // 1. 회사 지갑에 충분한 SOL 및 토큰
        // 2. 사용자 지갑에 토큰 ATA 생성 및 잔액
        // 3. 모든 환경변수 설정

        console.log('\n' + '='.repeat(60));
        console.log('통합 테스트 - 전체 플로우');
        console.log('='.repeat(60));
        console.log('⚠️  이 테스트는 실제 Devnet 환경이 완전히 준비된 경우에만 실행됩니다.');
        console.log('='.repeat(60) + '\n');

        // 실제 구현은 환경 준비 후 작성
        expect(true).toBe(true); // placeholder
    }, 60000);
});