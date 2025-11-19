/**
 * transfer.service.js 테스트
 *
 * 웹 서버 전용 전송 서비스 테스트
 * - API Key 검증 없음
 * - 사용자 서명 기반 전송
 * - feepayer는 회사 지갑
 */

import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import * as TransferService from '../transfer.service.js';
import { pool } from '../../config/db.js';
import { v4 as uuidv4 } from 'uuid';

// 테스트용 지갑 주소
const TEST_FROM_WALLET = 'BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh';
const TEST_TO_WALLET = '3vrJfSSTmKzzDszWVPGfffELaaaSZxnuCzHL4P4yYRp5';
const TEST_AMOUNT = '100';

describe('TransferService - createPartialTransaction', () => {

    test('부분 서명 트랜잭션 생성 - 정상 케이스', async () => {
        // Given: 전송 파라미터
        const params = {
            from_wallet: TEST_FROM_WALLET,
            to_wallet: TEST_TO_WALLET,
            amount: TEST_AMOUNT,
            req_ip: '127.0.0.1'
        };

        // When: 부분 서명 트랜잭션 생성
        const result = await TransferService.createPartialTransaction(params);

        // Then: 결과 검증
        expect(result).toBeDefined();
        expect(result.contract_id).toBeDefined();
        expect(result.partial_transaction).toBeDefined();
        expect(result.status).toBe('pending');

        // contract_id가 UUID 형식인지 확인
        expect(result.contract_id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
    });

    test('부분 서명 트랜잭션 생성 - from_wallet 누락', async () => {
        // Given: from_wallet 누락
        const params = {
            to_wallet: TEST_TO_WALLET,
            amount: TEST_AMOUNT,
            req_ip: '127.0.0.1'
        };

        // When & Then: 에러 발생
        await expect(
            TransferService.createPartialTransaction(params)
        ).rejects.toThrow('발신 지갑 주소가 필요합니다');
    });

    test('부분 서명 트랜잭션 생성 - to_wallet 누락', async () => {
        // Given: to_wallet 누락
        const params = {
            from_wallet: TEST_FROM_WALLET,
            amount: TEST_AMOUNT,
            req_ip: '127.0.0.1'
        };

        // When & Then: 에러 발생
        await expect(
            TransferService.createPartialTransaction(params)
        ).rejects.toThrow('수신 지갑 주소가 필요합니다');
    });

    test('부분 서명 트랜잭션 생성 - amount 누락', async () => {
        // Given: amount 누락
        const params = {
            from_wallet: TEST_FROM_WALLET,
            to_wallet: TEST_TO_WALLET,
            req_ip: '127.0.0.1'
        };

        // When & Then: 에러 발생
        await expect(
            TransferService.createPartialTransaction(params)
        ).rejects.toThrow('전송 금액이 필요합니다');
    });

    test('부분 서명 트랜잭션 생성 - 잘못된 금액 (0 이하)', async () => {
        // Given: 0 이하의 금액
        const params = {
            from_wallet: TEST_FROM_WALLET,
            to_wallet: TEST_TO_WALLET,
            amount: '0',
            req_ip: '127.0.0.1'
        };

        // When & Then: 에러 발생
        await expect(
            TransferService.createPartialTransaction(params)
        ).rejects.toThrow('전송 금액은 0보다 커야 합니다');
    });

    test('부분 서명 트랜잭션 생성 - 잘못된 지갑 주소 형식', async () => {
        // Given: 잘못된 형식의 지갑 주소
        const params = {
            from_wallet: 'invalid_wallet_address',
            to_wallet: TEST_TO_WALLET,
            amount: TEST_AMOUNT,
            req_ip: '127.0.0.1'
        };

        // When & Then: 에러 발생
        await expect(
            TransferService.createPartialTransaction(params)
        ).rejects.toThrow('유효하지 않은 지갑 주소 형식입니다');
    });
});

describe('TransferService - finalizeAndSendTransaction', () => {

    let testContractId;

    beforeAll(async () => {
        // 테스트용 부분 서명 트랜잭션 생성
        const params = {
            from_wallet: TEST_FROM_WALLET,
            to_wallet: TEST_TO_WALLET,
            amount: TEST_AMOUNT,
            req_ip: '127.0.0.1'
        };

        const result = await TransferService.createPartialTransaction(params);
        testContractId = result.contract_id;
    });

    test('최종 서명 및 전송 - 정상 케이스', async () => {
        // Given: 계약 ID와 사용자 서명
        const userSignature = 'mock_user_signature_base64_encoded';

        // When: 최종 서명 및 전송
        const result = await TransferService.finalizeAndSendTransaction({
            contract_id: testContractId,
            user_signature: userSignature,
            req_ip: '127.0.0.1'
        });

        // Then: 결과 검증
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.signature).toBeDefined(); // 트랜잭션 해시
        expect(result.status).toBe('completed');
    });

    test('최종 서명 및 전송 - contract_id 누락', async () => {
        // Given: contract_id 누락
        const userSignature = 'mock_user_signature';

        // When & Then: 에러 발생
        await expect(
            TransferService.finalizeAndSendTransaction({
                user_signature: userSignature,
                req_ip: '127.0.0.1'
            })
        ).rejects.toThrow('계약 ID가 필요합니다');
    });

    test('최종 서명 및 전송 - 존재하지 않는 contract_id', async () => {
        // Given: 존재하지 않는 contract_id
        const fakeContractId = uuidv4();
        const userSignature = 'mock_user_signature';

        // When & Then: 에러 발생
        await expect(
            TransferService.finalizeAndSendTransaction({
                contract_id: fakeContractId,
                user_signature: userSignature,
                req_ip: '127.0.0.1'
            })
        ).rejects.toThrow('계약 정보를 찾을 수 없습니다');
    });

    test('최종 서명 및 전송 - user_signature 누락', async () => {
        // Given: user_signature 누락
        const newContract = await TransferService.createPartialTransaction({
            from_wallet: TEST_FROM_WALLET,
            to_wallet: TEST_TO_WALLET,
            amount: TEST_AMOUNT,
            req_ip: '127.0.0.1'
        });

        // When & Then: 에러 발생
        await expect(
            TransferService.finalizeAndSendTransaction({
                contract_id: newContract.contract_id,
                req_ip: '127.0.0.1'
            })
        ).rejects.toThrow('사용자 서명이 필요합니다');
    });

    test('최종 서명 및 전송 - 이미 완료된 계약', async () => {
        // Given: 이미 완료된 계약
        const completedContract = await TransferService.createPartialTransaction({
            from_wallet: TEST_FROM_WALLET,
            to_wallet: TEST_TO_WALLET,
            amount: TEST_AMOUNT,
            req_ip: '127.0.0.1'
        });

        // 첫 번째 완료
        await TransferService.finalizeAndSendTransaction({
            contract_id: completedContract.contract_id,
            user_signature: 'mock_signature_1',
            req_ip: '127.0.0.1'
        });

        // When & Then: 중복 완료 시도 시 에러
        await expect(
            TransferService.finalizeAndSendTransaction({
                contract_id: completedContract.contract_id,
                user_signature: 'mock_signature_2',
                req_ip: '127.0.0.1'
            })
        ).rejects.toThrow('이미 처리된 계약입니다');
    });
});

describe('TransferService - DB 및 암호화 테스트', () => {

    test('지갑 주소 암호화 저장 확인', async () => {
        // Given: 전송 파라미터
        const params = {
            from_wallet: TEST_FROM_WALLET,
            to_wallet: TEST_TO_WALLET,
            amount: TEST_AMOUNT,
            req_ip: '127.0.0.1'
        };

        // When: 부분 서명 트랜잭션 생성
        const result = await TransferService.createPartialTransaction(params);

        // Then: DB에서 직접 조회하여 암호화 확인
        const [rows] = await pool.query(
            'SELECT from_wallet_address, to_wallet_address FROM r_contract WHERE contract_id = ?',
            [result.contract_id]
        );

        // 암호화된 값은 원본과 달라야 함
        expect(rows[0].from_wallet_address).not.toBe(TEST_FROM_WALLET);
        expect(rows[0].to_wallet_address).not.toBe(TEST_TO_WALLET);

        // 암호화된 값이 존재해야 함
        expect(rows[0].from_wallet_address).toBeDefined();
        expect(rows[0].to_wallet_address).toBeDefined();
    });

    test('r_log 테이블 기록 확인', async () => {
        // Given: 전송 파라미터
        const params = {
            from_wallet: TEST_FROM_WALLET,
            to_wallet: TEST_TO_WALLET,
            amount: TEST_AMOUNT,
            req_ip: '127.0.0.1'
        };

        // When: 부분 서명 트랜잭션 생성
        const result = await TransferService.createPartialTransaction(params);

        // Then: r_log 테이블 확인
        const [logs] = await pool.query(
            'SELECT * FROM r_log WHERE request_id = ? ORDER BY created_at DESC LIMIT 1',
            [result.contract_id]
        );

        expect(logs.length).toBeGreaterThan(0);
        expect(logs[0].cate1).toBe('web_transfer');
        expect(logs[0].cate2).toBe('create');
        expect(logs[0].api_name).toBe('/api/transfer/create');
    });
});

afterAll(async () => {
    // 테스트 후 DB 연결 종료
    await pool.end();
});