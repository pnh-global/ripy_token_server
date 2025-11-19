/**
 * transfer.controller.js 테스트
 *
 * 웹 서버 전용 토큰 전송 컨트롤러 테스트
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import transferRouter from '../../routes/transfer.routes.js';

// Express 앱 설정
const app = express();
app.use(express.json());
app.use('/api/transfer', transferRouter);

// 테스트용 지갑 주소
const TEST_FROM_WALLET = 'BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh';
const TEST_TO_WALLET = '3vrJfSSTmKzzDszWVPGfffELaaaSZxnuCzHL4P4yYRp5';

describe('POST /api/transfer/create - 부분 서명 트랜잭션 생성', () => {

    test('정상 요청 - 부분 서명 트랜잭션 생성 성공', async () => {
        // Given: 정상적인 전송 요청 데이터
        const requestBody = {
            from_wallet: TEST_FROM_WALLET,
            to_wallet: TEST_TO_WALLET,
            amount: '100'
        };

        // When: API 호출
        const response = await request(app)
            .post('/api/transfer/create')
            .send(requestBody);

        // Then: 응답 검증
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.contract_id).toBeDefined();
        expect(response.body.data.partial_transaction).toBeDefined();
        expect(response.body.data.status).toBe('pending');

        // contract_id가 UUID 형식인지 확인
        expect(response.body.data.contract_id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
    });

    test('from_wallet 누락 - 400 에러', async () => {
        // Given: from_wallet 누락
        const requestBody = {
            to_wallet: TEST_TO_WALLET,
            amount: '100'
        };

        // When: API 호출
        const response = await request(app)
            .post('/api/transfer/create')
            .send(requestBody);

        // Then: 에러 응답 검증
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('발신 지갑 주소가 필요합니다');
    });

    test('to_wallet 누락 - 400 에러', async () => {
        // Given: to_wallet 누락
        const requestBody = {
            from_wallet: TEST_FROM_WALLET,
            amount: '100'
        };

        // When: API 호출
        const response = await request(app)
            .post('/api/transfer/create')
            .send(requestBody);

        // Then: 에러 응답 검증
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('수신 지갑 주소가 필요합니다');
    });

    test('amount 누락 - 400 에러', async () => {
        // Given: amount 누락
        const requestBody = {
            from_wallet: TEST_FROM_WALLET,
            to_wallet: TEST_TO_WALLET
        };

        // When: API 호출
        const response = await request(app)
            .post('/api/transfer/create')
            .send(requestBody);

        // Then: 에러 응답 검증
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('전송 금액이 필요합니다');
    });

    test('잘못된 금액 (0 이하) - 400 에러', async () => {
        // Given: 0 이하의 금액
        const requestBody = {
            from_wallet: TEST_FROM_WALLET,
            to_wallet: TEST_TO_WALLET,
            amount: '0'
        };

        // When: API 호출
        const response = await request(app)
            .post('/api/transfer/create')
            .send(requestBody);

        // Then: 에러 응답 검증
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('전송 금액은 0보다 커야 합니다');
    });

    test('잘못된 지갑 주소 형식 - 400 에러', async () => {
        // Given: 잘못된 형식의 지갑 주소
        const requestBody = {
            from_wallet: 'invalid_wallet_address',
            to_wallet: TEST_TO_WALLET,
            amount: '100'
        };

        // When: API 호출
        const response = await request(app)
            .post('/api/transfer/create')
            .send(requestBody);

        // Then: 에러 응답 검증
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('유효하지 않은 지갑 주소 형식입니다');
    });

    test('JSON 형식이 아닌 요청 - 400 에러', async () => {
        // Given: JSON 형식이 아닌 요청
        // When: API 호출
        const response = await request(app)
            .post('/api/transfer/create')
            .send('invalid json string');

        // Then: 에러 응답 검증
        expect(response.status).toBe(400);
    });
});

describe('POST /api/transfer/finalize - 최종 서명 완료 및 전송', () => {

    let testContractId;

    beforeEach(async () => {
        // 테스트용 부분 서명 트랜잭션 생성
        const createResponse = await request(app)
            .post('/api/transfer/create')
            .send({
                from_wallet: TEST_FROM_WALLET,
                to_wallet: TEST_TO_WALLET,
                amount: '100'
            });

        testContractId = createResponse.body.data.contract_id;
    });

    test('정상 요청 - 최종 서명 및 전송 성공', async () => {
        // Given: 계약 ID와 사용자 서명
        const requestBody = {
            contract_id: testContractId,
            user_signature: 'mock_user_signature_base64_encoded'
        };

        // When: API 호출
        const response = await request(app)
            .post('/api/transfer/finalize')
            .send(requestBody);

        // Then: 응답 검증
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.signature).toBeDefined();
        expect(response.body.data.status).toBe('completed');
    });

    test('contract_id 누락 - 400 에러', async () => {
        // Given: contract_id 누락
        const requestBody = {
            user_signature: 'mock_user_signature'
        };

        // When: API 호출
        const response = await request(app)
            .post('/api/transfer/finalize')
            .send(requestBody);

        // Then: 에러 응답 검증
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('계약 ID가 필요합니다');
    });

    test('user_signature 누락 - 400 에러', async () => {
        // Given: user_signature 누락
        const requestBody = {
            contract_id: testContractId
        };

        // When: API 호출
        const response = await request(app)
            .post('/api/transfer/finalize')
            .send(requestBody);

        // Then: 에러 응답 검증
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('사용자 서명이 필요합니다');
    });

    test('존재하지 않는 contract_id - 404 에러', async () => {
        // Given: 존재하지 않는 contract_id
        const fakeContractId = '00000000-0000-0000-0000-000000000000';
        const requestBody = {
            contract_id: fakeContractId,
            user_signature: 'mock_user_signature'
        };

        // When: API 호출
        const response = await request(app)
            .post('/api/transfer/finalize')
            .send(requestBody);

        // Then: 에러 응답 검증
        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('계약 정보를 찾을 수 없습니다');
    });

    test('이미 완료된 계약 - 409 에러', async () => {
        // Given: 이미 완료된 계약
        // 첫 번째 완료
        await request(app)
            .post('/api/transfer/finalize')
            .send({
                contract_id: testContractId,
                user_signature: 'mock_signature_1'
            });

        // When: 두 번째 완료 시도
        const response = await request(app)
            .post('/api/transfer/finalize')
            .send({
                contract_id: testContractId,
                user_signature: 'mock_signature_2'
            });

        // Then: 에러 응답 검증
        expect(response.status).toBe(409);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('이미 처리된 계약입니다');
    });
});

describe('Transfer API - 응답 형식 검증', () => {

    test('성공 응답 형식 확인', async () => {
        // When: 정상 요청
        const response = await request(app)
            .post('/api/transfer/create')
            .send({
                from_wallet: TEST_FROM_WALLET,
                to_wallet: TEST_TO_WALLET,
                amount: '100'
            });

        // Then: 응답 형식 검증
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('timestamp');
    });

    test('에러 응답 형식 확인', async () => {
        // When: 잘못된 요청
        const response = await request(app)
            .post('/api/transfer/create')
            .send({
                from_wallet: 'invalid'
            });

        // Then: 에러 응답 형식 검증
        expect(response.body).toHaveProperty('success');
        expect(response.body.success).toBe(false);
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('timestamp');
    });
});

describe('Transfer API - IP 주소 기록', () => {

    test('요청 IP 주소가 로그에 기록됨', async () => {
        // Given: 특정 IP에서의 요청
        // When: API 호출
        const response = await request(app)
            .post('/api/transfer/create')
            .set('X-Forwarded-For', '192.168.1.100')
            .send({
                from_wallet: TEST_FROM_WALLET,
                to_wallet: TEST_TO_WALLET,
                amount: '100'
            });

        // Then: 정상 응답
        expect(response.status).toBe(200);
        // Note: IP 기록은 DB에서 별도로 확인 필요
    });
});