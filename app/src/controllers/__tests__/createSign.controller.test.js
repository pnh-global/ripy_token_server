/**
 * createSign.controller.test.js
 *
 * POST /api/sign/create 엔드포인트 테스트
 */

// ============================================
// 테스트 환경변수 설정 (반드시 import보다 먼저!)
// ============================================
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.NODE_ENV = 'test';
process.env.COMPANY_WALLET_ADDRESS = 'CompanyWallet1234567890123456789012345';
process.env.RIPY_RIPY_TOKEN_MINT_ADDRESS = 'RIPYTokenMint1234567890123456789012345';
process.env.SOLANA_RPC_URL = 'https://api.devnet.solana.com';

// ============================================
// Mock 설정 (반드시 모든 import보다 먼저!)
// ============================================
import { jest } from '@jest/globals';

const mockCreatePartialSignedTransaction = jest.fn(async ({ sender, recipient, amount, feepayer }) => {
    // Mock 함수가 호출되었는지 로그 출력
    console.log('[MOCK] createPartialSignedTransaction 호출됨');
    return {
        transaction: 'MOCK_BASE64_TRANSACTION_STRING',
        feepayer: feepayer,
        sender: sender,
        recipient: recipient,
        amount: amount,
        blockhash: 'MOCK_BLOCKHASH_1234567890',
        lastValidBlockHeight: 123456789
    };
});

jest.unstable_mockModule('../../services/transactionService.js', () => ({
    createPartialSignedTransaction: mockCreatePartialSignedTransaction
}));

// ============================================
// 모듈 Import (Mock 이후에!)
// ============================================
import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Dynamic import로 컨트롤러 로드
const { createSign } = await import('../createSign.controller.js');
const { asyncHandler } = await import('../../middlewares/asyncHandler.js');
const { errorHandler } = await import('../../middlewares/errorHandler.js');
const { pool } = await import('../../config/db.js');
const { encrypt } = await import('../../utils/encryption.js');

// Express 앱 생성 (테스트용)
const app = express();
app.use(express.json());

// 간단한 API Key 미들웨어 (테스트용)
const mockApiKeyMiddleware = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey === 'test-valid-key') {
        req.serviceKey = { idx: 1, service_name: 'Test Service' };
        next();
    } else {
        res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
};

// 라우트 등록
app.post('/api/sign/create', mockApiKeyMiddleware, asyncHandler(createSign));
app.use(errorHandler);

describe('POST /api/sign/create - 부분 서명 트랜잭션 생성', () => {

    // 테스트 데이터 정리
    beforeEach(async () => {
        await pool.execute(`
            DELETE FROM r_contract
            WHERE cate1 = 'TEST' OR sender LIKE 'TEST%'
        `);
        await pool.execute(`
            DELETE FROM r_log
            WHERE cate1 = 'TEST' OR api_name = '/api/sign/create'
        `);
    });

    afterAll(async () => {
        await pool.execute(`
            DELETE FROM r_contract
            WHERE cate1 = 'TEST' OR sender LIKE 'TEST%'
        `);
        await pool.execute(`
            DELETE FROM r_log
            WHERE cate1 = 'TEST' OR api_name = '/api/sign/create'
        `);
        await pool.end();
    });

    // 1. 정상 요청 테스트
    test('정상 요청 시 부분 서명된 트랜잭션을 반환해야 함', async () => {
        // 웹서버에서 암호화하여 보내는 데이터
        const testData = {
            cate1: 'TEST',
            cate2: '1',
            sender: 'TEST_Sender_1111111111111111111111111111',
            recipient: 'TEST_Recipient_0987654321098765432109',
            ripy: '100.5'
        };

        const encryptedData = encrypt(JSON.stringify(testData), process.env.ENCRYPTION_KEY);

        const response = await request(app)
            .post('/api/sign/create')
            .set('x-api-key', 'test-valid-key')
            .send({ data: encryptedData })
            .expect(200);

        expect(response.body).toHaveProperty('ok', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('contract_idx');
        expect(response.body.data).toHaveProperty('partial_signed_transaction');

        // 트랜잭션 데이터 검증
        const txData = response.body.data.partial_signed_transaction;
        expect(txData).toHaveProperty('transaction');
        expect(txData).toHaveProperty('feepayer');
        expect(txData.sender).toBe(testData.sender);
        expect(txData.recipient).toBe(testData.recipient);
    });

    // 2. 필수 필드 누락 테스트
    test('필수 필드 누락 시 400 에러를 반환해야 함', async () => {
        // sender 필드 누락
        const testData = {
            cate1: 'TEST',
            cate2: '1',
            recipient: 'TEST_Recipient_0987654321098765432109',
            ripy: '100.5'
        };

        const encryptedData = encrypt(JSON.stringify(testData), process.env.ENCRYPTION_KEY);

        const response = await request(app)
            .post('/api/sign/create')
            .set('x-api-key', 'test-valid-key')
            .send({ data: encryptedData })
            .expect(400);

        expect(response.body).toHaveProperty('ok', false);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('sender');
    });

    // 3. 유효하지 않은 주소 테스트
    test('유효하지 않은 Solana 주소 시 400 에러를 반환해야 함', async () => {
        const testData = {
            cate1: 'TEST',
            cate2: '1',
            sender: 'invalid_address',  // 잘못된 주소
            recipient: 'TEST_Recipient_0987654321098765432109',
            ripy: '100.5'
        };

        const encryptedData = encrypt(JSON.stringify(testData), process.env.ENCRYPTION_KEY);

        const response = await request(app)
            .post('/api/sign/create')
            .set('x-api-key', 'test-valid-key')
            .send({ data: encryptedData })
            .expect(400);

        expect(response.body).toHaveProperty('ok', false);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('주소');
    });

    // 4. 유효하지 않은 금액 테스트
    test('유효하지 않은 금액 시 400 에러를 반환해야 함', async () => {
        const testData = {
            cate1: 'TEST',
            cate2: '1',
            sender: 'TestSender1111111111111111111111111111',
            recipient: 'TEST_Recipient_0987654321098765432109',
            ripy: '-100'  // 음수 금액
        };

        const encryptedData = encrypt(JSON.stringify(testData), process.env.ENCRYPTION_KEY);

        const response = await request(app)
            .post('/api/sign/create')
            .set('x-api-key', 'test-valid-key')
            .send({ data: encryptedData })
            .expect(400);

        expect(response.body).toHaveProperty('ok', false);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('금액');
    });

    // 5. data 필드 누락 테스트
    test('암호화된 data 필드 누락 시 400 에러를 반환해야 함', async () => {
        const response = await request(app)
            .post('/api/sign/create')
            .set('x-api-key', 'test-valid-key')
            .send({})  // data 필드 없음
            .expect(400);

        expect(response.body).toHaveProperty('ok', false);
        expect(response.body).toHaveProperty('error');
    });

    // 6. API Key 인증 실패 테스트
    test('유효하지 않은 API Key 시 401 에러를 반환해야 함', async () => {
        const testData = {
            cate1: 'TEST',
            cate2: '1',
            sender: 'TestSender1111111111111111111111111111',
            recipient: 'TEST_Recipient_0987654321098765432109',
            ripy: '100.5'
        };

        const encryptedData = encrypt(JSON.stringify(testData), process.env.ENCRYPTION_KEY);

        const response = await request(app)
            .post('/api/sign/create')
            .set('x-api-key', 'invalid-key')  // 잘못된 키
            .send({ data: encryptedData })
            .expect(401);

        expect(response.body).toHaveProperty('ok', false);
    });

    // 7. r_contract 생성 확인
    test('r_contract 테이블에 데이터가 저장되어야 함', async () => {
        const testData = {
            cate1: 'TEST',
            cate2: '1',
            sender: 'TEST_Sender_DB_Check_1234567890123',
            recipient: 'TEST_Recipient_DB_Check_09876543',
            ripy: '200.75'
        };

        const encryptedData = encrypt(JSON.stringify(testData), process.env.ENCRYPTION_KEY);

        const response = await request(app)
            .post('/api/sign/create')
            .set('x-api-key', 'test-valid-key')
            .send({ data: encryptedData })
            .expect(200);

        const contractIdx = response.body.data.contract_idx;

        // DB에서 조회
        const [rows] = await pool.execute(
            'SELECT * FROM r_contract WHERE idx = :idx',
            { idx: contractIdx }
        );

        expect(rows.length).toBe(1);
        expect(rows[0].cate1).toBe(testData.cate1);
        expect(rows[0].sender).toBe(testData.sender);
        expect(rows[0].signed_or_not1).toBe('N');  // 아직 서명 안됨
    });

    // 8. r_log 기록 확인
    test('r_log 테이블에 로그가 기록되어야 함', async () => {
        const testData = {
            cate1: 'TEST',
            cate2: '1',
            sender: 'TEST_Sender_Log_Check_123456789012',
            recipient: 'TEST_Recipient_Log_Check_0987651',
            ripy: '50.25'  // 이 줄 추가!
        };

        const encryptedData = encrypt(JSON.stringify(testData), process.env.ENCRYPTION_KEY);

        await request(app)
            .post('/api/sign/create')
            .set('x-api-key', 'test-valid-key')
            .send({ data: encryptedData })
            .expect(200);

        // r_log에서 확인
        const [logs] = await pool.execute(`
            SELECT * FROM r_log
            WHERE api_name = '/api/sign/create'
              AND cate1 = 'TEST'
            ORDER BY created_at DESC
                LIMIT 1
        `);

        expect(logs.length).toBe(1);
        expect(logs[0].req_status).toBe('Y');
        expect(logs[0].result_code).toBe('200');
    });
});