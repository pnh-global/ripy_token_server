/**
 * transactionService.test.js
 *
 * Solana Transaction Service 테스트
 * TDD 방식으로 작성
 *
 * 테스트 대상:
 * - createPartialSignedTransaction: 부분 서명 트랜잭션 생성
 * - finalizeTransaction: 최종 서명
 * - sendTransaction: 트랜잭션 전송
 * - getTransactionStatus: 트랜잭션 상태 조회
 * - waitForConfirmation: 컨펌 대기
 */

import {
    createPartialSignedTransaction,
    finalizeTransaction,
    sendTransaction,
    getTransactionStatus,
    waitForConfirmation
} from '../transactionService.js';

// Mock 설정
// jest.mock('@solana/web3.js');
// jest.mock('@solana/spl-token');

describe('TransactionService', () => {

    // ==========================================
    // createPartialSignedTransaction 테스트
    // ==========================================
    describe('createPartialSignedTransaction', () => {

        test('유효한 파라미터로 부분 서명 트랜잭션을 생성해야 함', async () => {
            // Given: 유효한 전송 정보
            const params = {
                fromPubkey: 'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy', // 유효한 Solana 주소 (44자)
                toPubkey: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // 유효한 Solana 주소
                amount: 100, // RIPY 토큰 100개
                tokenMint: '7EqQdEUfxQzQfzDsq7G1n7bW4Dz5RIPYTokenMintAddr' // RIPY 토큰 민트 주소
            };

            // When: 부분 서명 트랜잭션 생성
            const result = await createPartialSignedTransaction(params);

            // Then: 트랜잭션이 올바르게 생성됨
            expect(result).toHaveProperty('transaction');
            expect(result).toHaveProperty('serialized');
            expect(result.transaction).toBeDefined();
            expect(typeof result.serialized).toBe('string');
        });

        test('잘못된 주소로 요청 시 에러를 던져야 함', async () => {
            // Given: 잘못된 주소
            const params = {
                fromPubkey: 'invalid',
                toPubkey: 'UserWalletAddress',
                amount: 100,
                tokenMint: 'RIPYTokenMintAddress'
            };

            // When & Then: 에러 발생
            await expect(
                createPartialSignedTransaction(params)
            ).rejects.toThrow();
        });

        test('0 이하의 금액으로 요청 시 에러를 던져야 함', async () => {
            // Given: 잘못된 금액
            const params = {
                fromPubkey: 'CompanyWalletAddress',
                toPubkey: 'UserWalletAddress',
                amount: 0,
                tokenMint: 'RIPYTokenMintAddress'
            };

            // When & Then: 에러 발생
            await expect(
                createPartialSignedTransaction(params)
            ).rejects.toThrow();
        });

    });

    // ==========================================
    // finalizeTransaction 테스트
    // ==========================================
    describe('finalizeTransaction', () => {

        test('부분 서명된 트랜잭션에 사용자 서명을 추가해야 함', async () => {
            // Given: 먼저 유효한 부분 서명 트랜잭션 생성
            const partialTx = await createPartialSignedTransaction({
                fromPubkey: 'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy', // 유효한 주소
                toPubkey: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // 유효한 주소
                amount: 100
            });

            const userSignature = {
                publicKey: 'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy',
                signature: 'UserSignatureDataBase64Encoded'
            };

            // When: 최종 서명 완료
            const result = await finalizeTransaction(
                partialTx,
                userSignature
            );

            // Then: 서명이 완료된 트랜잭션 반환
            expect(result).toHaveProperty('signedTransaction');
            expect(result).toHaveProperty('serialized');
            expect(result.signedTransaction).toBeDefined();
        });

        test('잘못된 서명으로 요청 시 에러를 던져야 함', async () => {
            // Given: 잘못된 서명
            const partialTransaction = {
                transaction: 'mockTransactionObject',
                serialized: 'base64EncodedTransaction'
            };
            const invalidSignature = {
                publicKey: 'InvalidKey',
                signature: null
            };

            // When & Then: 에러 발생
            await expect(
                finalizeTransaction(partialTransaction, invalidSignature)
            ).rejects.toThrow();
        });

    });

    // ==========================================
    // sendTransaction 테스트 (Mock)
    // ==========================================
    describe('sendTransaction', () => {

        test('서명된 트랜잭션을 Solana 네트워크에 전송해야 함', async () => {
            // Given: 서명 완료된 트랜잭션
            const signedTransaction = {
                signedTransaction: 'mockSignedTx',
                serialized: 'base64EncodedSignedTx'
            };

            // When: 트랜잭션 전송
            const result = await sendTransaction(signedTransaction);

            // Then: 트랜잭션 시그니처 반환
            expect(result).toHaveProperty('signature');
            expect(typeof result.signature).toBe('string');
            expect(result.signature.length).toBeGreaterThan(0);
        });

        test('네트워크 오류 시 적절한 에러를 던져야 함', async () => {
            // Given: 네트워크 오류 상황 Mock
            const signedTransaction = {
                signedTransaction: 'mockSignedTx',
                serialized: 'networkErrorCase'
            };

            // When & Then: 에러 발생
            await expect(
                sendTransaction(signedTransaction)
            ).rejects.toThrow();
        });

    });

    // ==========================================
    // getTransactionStatus 테스트 (Mock)
    // ==========================================
    describe('getTransactionStatus', () => {

        test('트랜잭션 시그니처로 상태를 조회해야 함', async () => {
            // Given: 유효한 트랜잭션 시그니처
            const signature = 'validTransactionSignature';

            // When: 상태 조회
            const result = await getTransactionStatus(signature);

            // Then: 상태 정보 반환
            expect(result).toHaveProperty('status');
            expect(result).toHaveProperty('confirmations');
            expect(['pending', 'confirmed', 'finalized', 'failed']).toContain(result.status);
        });

        test('잘못된 시그니처로 조회 시 에러를 던져야 함', async () => {
            // Given: 잘못된 시그니처
            const invalidSignature = 'invalid';

            // When & Then: 에러 발생
            await expect(
                getTransactionStatus(invalidSignature)
            ).rejects.toThrow();
        });

    });

    // ==========================================
    // waitForConfirmation 테스트
    // ==========================================
    describe('waitForConfirmation', () => {

        test('트랜잭션이 confirmed 될 때까지 대기해야 함', async () => {
            // Given: 트랜잭션 시그니처
            const signature = 'validTransactionSignature';

            // When: 컨펌 대기 (타임아웃 짧게 설정)
            const result = await waitForConfirmation(signature, {
                timeout: 5000,
                commitment: 'confirmed'
            });

            // Then: 컨펌 완료 결과 반환
            expect(result).toHaveProperty('confirmed');
            expect(result.confirmed).toBe(true);
        });

        test('타임아웃 시 에러를 던져야 함', async () => {
            // Given: 컨펌되지 않는 트랜잭션
            const signature = 'timeoutCase';

            // When & Then: 타임아웃 에러 발생
            await expect(
                waitForConfirmation(signature, { timeout: 1000 })
            ).rejects.toThrow('타임아웃'); // 'timeout' 대신 '타임아웃' 사용
        }, 10000); // Jest 타임아웃 10초로 설정

    });

});