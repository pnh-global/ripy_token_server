/**
 * ============================================
 * send.model.test.js - send.model.js 테스트
 * ============================================
 *
 * 테스트 범위:
 * 1. 상수 및 에러 클래스
 * 2. 입력값 검증
 * 3. 마스터 테이블 CRUD
 * 4. 상세 테이블 CRUD
 * 5. 트랜잭션 처리
 * 6. 암호화/복호화
 * 7. 통계 및 재시도 로직
 *
 * 변경 이력:
 * - 2025-01-27: tx_signature 관련 테스트 제거 (DB 스키마에 맞춤)
 */




import { describe, test, expect, beforeEach, afterEach, afterAll } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery, closePool } from '../../lib/db.util.js';
import { decryptData } from '../../utils/crypto.js';
import {
    // 상수
    SEND_STATUS,
    SENT_FLAG,
    MAX_RETRY_COUNT,
    BULK_INSERT_LIMIT,

    // 에러 클래스
    SendModelError,

    // 마스터 테이블 함수
    createSendRequest,
    setMasterStatus,
    getRequestStatus,
    refreshMasterStats,

    // 상세 테이블 함수
    insertSendDetails,
    createSendRequestWithDetails,
    listPendingDetails,
    updateDetailResult,
    updateDetailResultsBatch,
    getAllDetails,
    listRetryableDetails,
    getDetailStats
} from '../send.model.js';

// ============================================
// 테스트 데이터 및 헬퍼 함수
// ============================================

/**
 * 테스트용 UUID 생성
 */
function generateTestRequestId() {
    return uuidv4();
}

/**
 * 테스트용 지갑 주소 생성 (Solana 형식)
 */
function generateTestWalletAddress(index = 0) {
    const baseAddress = 'So1anaWa11et1estAddr3ssF0rT3st1ng';
    return baseAddress + String(index).padStart(8, '0');
}

/**
 * 테스트용 수신자 배열 생성
 */
function generateTestRecipients(count = 10) {
    return Array.from({ length: count }, (_, i) => ({
        wallet_address: generateTestWalletAddress(i),
        amount: (i + 1) * 10
    }));
}

/**
 * 테스트 데이터 정리
 */
async function cleanupTestData(request_id) {
    try {
        await executeQuery('DELETE FROM r_send_detail WHERE request_id = :id', { id: request_id });
        await executeQuery('DELETE FROM r_send_request WHERE request_id = :id', { id: request_id });
    } catch (error) {
        console.error('테스트 데이터 정리 실패:', error.message);
    }
}

// ============================================
// 테스트 스위트
// ============================================

describe('send.model.js - 상수 및 에러 클래스', () => {

    test('SEND_STATUS 상수가 정의되어 있어야 함', () => {
        expect(SEND_STATUS).toBeDefined();
        expect(SEND_STATUS.PENDING).toBe('PENDING');
        expect(SEND_STATUS.PROCESSING).toBe('PROCESSING');
        expect(SEND_STATUS.DONE).toBe('DONE');
        expect(SEND_STATUS.ERROR).toBe('ERROR');
    });

    test('SENT_FLAG 상수가 정의되어 있어야 함', () => {
        expect(SENT_FLAG).toBeDefined();
        expect(SENT_FLAG.YES).toBe('Y');
        expect(SENT_FLAG.NO).toBe('N');
    });

    test('MAX_RETRY_COUNT가 3이어야 함', () => {
        expect(MAX_RETRY_COUNT).toBe(3);
    });

    test('BULK_INSERT_LIMIT이 1000이어야 함', () => {
        expect(BULK_INSERT_LIMIT).toBe(1000);
    });

    test('SendModelError가 Error를 상속해야 함', () => {
        const error = new SendModelError('테스트 에러', 'TEST_CODE');

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(SendModelError);
        expect(error.name).toBe('SendModelError');
        expect(error.message).toBe('테스트 에러');
        expect(error.code).toBe('TEST_CODE');
        expect(error.originalError).toBeNull();
    });

    test('SendModelError가 원본 에러를 보존해야 함', () => {
        const originalError = new Error('원본 에러');
        const wrappedError = new SendModelError(
            '래핑된 에러',
            'WRAPPED_ERROR',
            originalError
        );

        expect(wrappedError.originalError).toBe(originalError);
        expect(wrappedError.stack).toBe(originalError.stack);
    });
});

describe('send.model.js - 마스터 테이블 기본 기능', () => {

    let testRequestId;

    beforeEach(() => {
        testRequestId = generateTestRequestId();
    });

    afterEach(async () => {
        await cleanupTestData(testRequestId);
    });

    test('정상적으로 마스터 요청을 생성해야 함', async () => {
        const data = {
            request_id: testRequestId,
            cate1: 'airdrop',
            cate2: '2025_event',
            total_count: 100
        };

        await expect(createSendRequest(data)).resolves.not.toThrow();

        const result = await getRequestStatus(testRequestId);
        expect(result).not.toBeNull();
        expect(result.request_id).toBe(testRequestId);
        expect(result.cate1).toBe('airdrop');
        expect(result.status).toBe(SEND_STATUS.PENDING);
    });

    test('잘못된 UUID 형식은 에러를 발생시켜야 함', async () => {
        const data = {
            request_id: 'invalid-uuid',
            cate1: 'test',
            cate2: 'test',
            total_count: 10
        };

        await expect(createSendRequest(data))
            .rejects
            .toThrow(SendModelError);
    });

    test('마스터 상태를 변경할 수 있어야 함', async () => {
        await createSendRequest({
            request_id: testRequestId,
            cate1: 'test',
            cate2: 'test',
            total_count: 10
        });

        await setMasterStatus(testRequestId, SEND_STATUS.PROCESSING);

        const result = await getRequestStatus(testRequestId);
        expect(result.status).toBe(SEND_STATUS.PROCESSING);
    });
});

describe('send.model.js - 상세 테이블 기본 기능', () => {

    let testRequestId;
    let recipients;

    beforeEach(async () => {
        testRequestId = generateTestRequestId();

        await createSendRequest({
            request_id: testRequestId,
            cate1: 'test',
            cate2: 'test',
            total_count: 10
        });

        recipients = generateTestRecipients(10);
    });

    afterEach(async () => {
        await cleanupTestData(testRequestId);
    });

    test('정상적으로 상세 정보를 일괄 생성해야 함', async () => {
        const insertedCount = await insertSendDetails(testRequestId, recipients);

        expect(insertedCount).toBe(10);

        const details = await getAllDetails(testRequestId);
        expect(details).toHaveLength(10);
    });

    test('지갑 주소가 암호화되어 저장되어야 함', async () => {
        await insertSendDetails(testRequestId, recipients);

        const details = await getAllDetails(testRequestId, { decrypt: false });

        expect(details[0].wallet_address).not.toBe(recipients[0].wallet_address);

        const decrypted = decryptData(details[0].wallet_address);
        expect(decrypted).toBe(recipients[0].wallet_address);
    });

    test('미전송 항목을 조회할 수 있어야 함', async () => {
        await insertSendDetails(testRequestId, recipients);

        const pending = await listPendingDetails(testRequestId);

        expect(pending).toHaveLength(10);
        expect(pending[0].wallet_address).toBe(recipients[0].wallet_address);
    });

    test('전송 결과를 업데이트할 수 있어야 함', async () => {
        await insertSendDetails(testRequestId, recipients);

        const pending = await listPendingDetails(testRequestId);

        // tx_signature 파라미터 제거
        await updateDetailResult(pending[0].idx, {
            success: true,
            result_code: '200'
        });

        const details = await getAllDetails(testRequestId);
        const updated = details.find(d => d.idx === pending[0].idx);

        expect(updated.sent).toBe(SENT_FLAG.YES);
        expect(updated.attempt_count).toBe(1);
        expect(updated.last_result_code).toBe('200');
    });
});

describe('send.model.js - 트랜잭션 기능', () => {

    let testRequestId;

    beforeEach(() => {
        testRequestId = generateTestRequestId();
    });

    afterEach(async () => {
        await cleanupTestData(testRequestId);
    });

    test('마스터와 상세를 원자적으로 생성해야 함', async () => {
        const recipients = generateTestRecipients(10);

        const result = await createSendRequestWithDetails(
            {
                request_id: testRequestId,
                cate1: 'atomic_test',
                cate2: 'transaction'
            },
            recipients
        );

        expect(result.request_id).toBe(testRequestId);
        expect(result.inserted_count).toBe(10);

        const master = await getRequestStatus(testRequestId);
        expect(master).not.toBeNull();

        const details = await getAllDetails(testRequestId);
        expect(details).toHaveLength(10);
    });

    test('통계를 정확하게 갱신해야 함', async () => {
        const recipients = generateTestRecipients(10);

        await createSendRequestWithDetails(
            {
                request_id: testRequestId,
                cate1: 'test',
                cate2: 'test'
            },
            recipients
        );

        const pending = await listPendingDetails(testRequestId);

        // 2개 성공 처리
        await updateDetailResult(pending[0].idx, {
            success: true,
            result_code: '200'
        });

        await updateDetailResult(pending[1].idx, {
            success: true,
            result_code: '200'
        });

        // 나머지 8개 중 일부를 실패 처리 (재시도 횟수 초과)
        for (let i = 2; i < 5; i++) {
            // 3번 시도하여 재시도 횟수 초과시킴
            for (let attempt = 0; attempt < 3; attempt++) {
                await updateDetailResult(pending[i].idx, {
                    success: false,
                    result_code: '500',
                    error_message: 'Test failure'
                });
            }
        }

        const stats = await refreshMasterStats(testRequestId);

        expect(stats.total).toBe(10);
        expect(stats.completed).toBe(2);
        expect(stats.failed).toBe(3);  // 재시도 횟수를 초과한 항목
    });
});

describe('send.model.js - 통계 및 재시도', () => {

    let testRequestId;

    beforeEach(async () => {
        testRequestId = generateTestRequestId();

        const recipients = generateTestRecipients(10);
        await createSendRequestWithDetails(
            {
                request_id: testRequestId,
                cate1: 'test',
                cate2: 'test'
            },
            recipients
        );
    });

    afterEach(async () => {
        await cleanupTestData(testRequestId);
    });

    test('상세 통계를 정확하게 조회해야 함', async () => {
        const stats = await getDetailStats(testRequestId);

        expect(stats).toEqual({
            total: 10,
            completed: 0,
            failed: 0,
            pending: 10,
            retryable: 0,
            success_rate: 0
        });
    });

    test('재시도 가능한 항목을 조회할 수 있어야 함', async () => {
        const pending = await listPendingDetails(testRequestId);

        await updateDetailResult(pending[0].idx, {
            success: false,
            result_code: '500',
            error_message: 'Test failure'
        });

        const retryable = await listRetryableDetails(testRequestId);

        expect(retryable).toHaveLength(1);
        expect(retryable[0].attempt_count).toBe(1);
        expect(retryable[0].attempt_count).toBeLessThan(MAX_RETRY_COUNT);
    });

    test('재시도 횟수 초과 항목은 조회되지 않아야 함', async () => {
        const pending = await listPendingDetails(testRequestId);

        for (let i = 0; i < 3; i++) {
            await updateDetailResult(pending[0].idx, {
                success: false,
                result_code: '500',
                error_message: `Attempt ${i + 1}`
            });
        }

        const retryable = await listRetryableDetails(testRequestId);

        expect(retryable).toHaveLength(0);
    });
});

describe('send.model.js - 배치 처리', () => {

    let testRequestId;

    beforeEach(async () => {
        testRequestId = generateTestRequestId();

        const recipients = generateTestRecipients(10);
        await createSendRequestWithDetails(
            {
                request_id: testRequestId,
                cate1: 'test',
                cate2: 'test'
            },
            recipients
        );
    });

    afterEach(async () => {
        await cleanupTestData(testRequestId);
    });

    test('배치로 여러 결과를 업데이트해야 함', async () => {
        const pending = await listPendingDetails(testRequestId);

        // tx_signature 파라미터 제거
        const results = pending.slice(0, 5).map((detail, index) => ({
            idx: detail.idx,
            success: index % 2 === 0,
            result_code: index % 2 === 0 ? '200' : '500',
            error_message: index % 2 === 0 ? null : `Error ${index}`
        }));

        const updatedCount = await updateDetailResultsBatch(results);

        expect(updatedCount).toBe(5);

        // 결과 확인
        const details = await getAllDetails(testRequestId);
        const updatedDetails = details.filter(d =>
            results.some(r => r.idx === d.idx)
        );

        // 성공한 항목 확인 (index가 짝수인 경우)
        const successDetails = updatedDetails.filter((_, i) => i % 2 === 0);
        successDetails.forEach(detail => {
            expect(detail.sent).toBe(SENT_FLAG.YES);
            expect(detail.last_result_code).toBe('200');
        });

        // 실패한 항목 확인 (index가 홀수인 경우)
        const failedDetails = updatedDetails.filter((_, i) => i % 2 !== 0);
        failedDetails.forEach(detail => {
            expect(detail.sent).toBe(SENT_FLAG.NO);
            expect(detail.last_result_code).toBe('500');
            expect(detail.last_error_message).toContain('Error');
        });
    });
});

afterAll(async () => {
    // DB 연결 풀 종료
    await closePool();
    console.log('DB 연결 풀 정리 완료');
});

console.log('✓ send.model.test.js 테스트 스위트 로드 완료');