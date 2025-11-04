/**
 * finalizeSign.controller.test.js
 *
 * finalizeSign 컨트롤러 단위 테스트
 *
 * 테스트 시나리오:
 * 1. 정상 요청 테스트
 * 2. contract_id 없음 테스트
 * 3. 잘못된 user_signature 테스트
 * 4. 중복 서명 테스트
 */

import { jest } from '@jest/globals';
import { finalizeSign } from '../finalizeSign.controller.js';
import * as contractModel from '../../models/contract.model.js';
import * as logModel from '../../models/log.model.js';
import * as transactionService from '../../services/transactionService.js';
import { encrypt, decrypt } from '../../utils/encryption.js';

// Mock 설정
jest.mock('../../models/contract.model.js');
jest.mock('../../models/log.model.js');
jest.mock('../../services/transactionService.js');

describe('finalizeSign.controller.js - 입력값 검증', () => {
    let req, res;
    let encryptionKey;

    beforeAll(() => {
        // 환경변수에서 키 가져오기
        encryptionKey = process.env.ENCRYPTION_KEY;
        process.env.NODE_ENV = 'test';
    });

    beforeEach(() => {
        // Request 객체 모킹
        req = {
            body: {},
            serviceKey: { idx: 1 },
            ip: '127.0.0.1',
            hostname: 'localhost'
        };

        // Response 객체 모킹
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
    });

    describe('contract_id 검증', () => {
        test('contract_id가 없으면 400 에러를 반환해야 함', async () => {
            // Given: contract_id 없는 데이터
            const requestData = {
                user_signature: {
                    publicKey: 'TEST_USER_PUBLIC_KEY',
                    signature: 'TEST_USER_SIGNATURE'
                }
            };

            const encryptedData = encrypt(JSON.stringify(requestData), encryptionKey);
            req.body.data = encryptedData;

            // When: finalizeSign 실행
            await finalizeSign(req, res);

            // Then: 400 에러 응답
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                ok: false,
                error: expect.stringContaining('contract_id')
            });
        });

        test('contract_id가 0이면 400 에러를 반환해야 함', async () => {
            // Given: contract_id = 0
            const requestData = {
                contract_id: 0,
                user_signature: {
                    publicKey: 'TEST_USER_PUBLIC_KEY',
                    signature: 'TEST_USER_SIGNATURE'
                }
            };

            const encryptedData = encrypt(JSON.stringify(requestData), encryptionKey);
            req.body.data = encryptedData;

            // When: finalizeSign 실행
            await finalizeSign(req, res);

            // Then: 400 에러 응답
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                ok: false,
                error: expect.stringContaining('contract_id')
            });
        });

        test('contract_id가 음수면 400 에러를 반환해야 함', async () => {
            // Given: contract_id = -1
            const requestData = {
                contract_id: -1,
                user_signature: {
                    publicKey: 'TEST_USER_PUBLIC_KEY',
                    signature: 'TEST_USER_SIGNATURE'
                }
            };

            const encryptedData = encrypt(JSON.stringify(requestData), encryptionKey);
            req.body.data = encryptedData;

            // When: finalizeSign 실행
            await finalizeSign(req, res);

            // Then: 400 에러 응답
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                ok: false,
                error: expect.stringContaining('양수')
            });
        });
    });

    describe('user_signature 검증', () => {
        test('user_signature가 없으면 400 에러를 반환해야 함', async () => {
            // Given: user_signature 없는 데이터
            const requestData = {
                contract_id: 1
            };

            const encryptedData = encrypt(JSON.stringify(requestData), encryptionKey);
            req.body.data = encryptedData;

            // When: finalizeSign 실행
            await finalizeSign(req, res);

            // Then: 400 에러 응답
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                ok: false,
                error: expect.stringContaining('user_signature')
            });
        });

        test('user_signature에 publicKey가 없으면 400 에러를 반환해야 함', async () => {
            // Given: publicKey 없는 user_signature
            const requestData = {
                contract_id: 1,
                user_signature: {
                    signature: 'TEST_USER_SIGNATURE'
                }
            };

            const encryptedData = encrypt(JSON.stringify(requestData), encryptionKey);
            req.body.data = encryptedData;

            // When: finalizeSign 실행
            await finalizeSign(req, res);

            // Then: 400 에러 응답
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                ok: false,
                error: expect.stringContaining('publicKey')
            });
        });

        test('user_signature에 signature가 없으면 400 에러를 반환해야 함', async () => {
            // Given: signature 없는 user_signature
            const requestData = {
                contract_id: 1,
                user_signature: {
                    publicKey: 'TEST_USER_PUBLIC_KEY'
                }
            };

            const encryptedData = encrypt(JSON.stringify(requestData), encryptionKey);
            req.body.data = encryptedData;

            // When: finalizeSign 실행
            await finalizeSign(req, res);

            // Then: 400 에러 응답
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                ok: false,
                error: expect.stringContaining('signature')
            });
        });
    });

    describe('암호화 검증', () => {
        test('data 필드가 없으면 400 에러를 반환해야 함', async () => {
            // Given: data 필드 없음
            req.body = {};

            // When: finalizeSign 실행
            await finalizeSign(req, res);

            // Then: 400 에러 응답
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                ok: false,
                error: expect.stringContaining('data')
            });
        });
    });
});