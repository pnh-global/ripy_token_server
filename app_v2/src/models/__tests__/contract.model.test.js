import {
    createContract,
    getContractById,
    updateContract,
    listContracts
} from '../contract.model.js';
import { pool } from '../../config/db.js';

describe('Contract Model 테스트', () => {

    beforeAll(async () => {
        await pool.execute(`
            DELETE FROM r_contract
            WHERE cate1 = 'TEST' OR sender LIKE 'TEST%'
        `);
    });

    afterAll(async () => {
        await pool.execute(`
            DELETE FROM r_contract
            WHERE cate1 = 'TEST' OR sender LIKE 'TEST%'
        `);
        await pool.end();
    });

    describe('createContract()', () => {

        test('계약서가 정상적으로 생성되어야 함', async () => {
            const testData = {
                cate1: 'TEST',
                cate2: '1',
                sender: 'TEST_Sender_Address_1234567890',
                recipient: 'TEST_Recipient_Address_0987654321',
                feepayer: 'TEST_Feepayer_Address_1122334455',
                ripy: '100.5',
            };

            const result = await createContract(testData);

            expect(result).toBeDefined();
            expect(result).toHaveProperty('idx');
            expect(typeof result.idx).toBe('number');

            expect(result.cate1).toBe(testData.cate1);
            expect(result.cate2).toBe(testData.cate2);
            expect(result.sender).toBe(testData.sender);
            expect(result.recipient).toBe(testData.recipient);
            expect(result.feepayer).toBe(testData.feepayer);

            // ✅ 수정: DECIMAL 타입은 숫자로 비교
            expect(parseFloat(result.ripy)).toBe(parseFloat(testData.ripy));
        });

        test('signed_or_not1과 signed_or_not2의 기본값은 N이어야 함', async () => {
            const testData = {
                cate1: 'TEST',
                cate2: '2',
                sender: 'TEST_Sender2',
                recipient: 'TEST_Recipient2',
                feepayer: 'TEST_Feepayer2',
                ripy: '50.25',
            };

            const result = await createContract(testData);

            expect(result.signed_or_not1).toBe('N');
            expect(result.signed_or_not2).toBe('N');
        });

        test('signed_or_not1을 Y로 지정하면 Y로 저장되어야 함', async () => {
            const testData = {
                cate1: 'TEST',
                cate2: '3',
                sender: 'TEST_Sender3',
                recipient: 'TEST_Recipient3',
                feepayer: 'TEST_Feepayer3',
                ripy: '75.0',
                signed_or_not1: 'Y',
            };

            const result = await createContract(testData);

            expect(result.signed_or_not1).toBe('Y');
            expect(result.signed_or_not2).toBe('N');
        });
    });

    describe('getContractById()', () => {

        let testContractId;

        beforeEach(async () => {
            const testContract = await createContract({
                cate1: 'TEST',
                cate2: 'GET_TEST',
                sender: 'TEST_Sender_Get',
                recipient: 'TEST_Recipient_Get',
                feepayer: 'TEST_Feepayer_Get',
                ripy: '123.45',
            });

            testContractId = testContract.idx;
        });

        test('존재하는 idx로 조회하면 계약서가 반환되어야 함', async () => {
            const result = await getContractById(testContractId);

            expect(result).toBeDefined();
            expect(result).not.toBeNull();
            expect(result.idx).toBe(testContractId);
            expect(result.cate1).toBe('TEST');
            expect(result.cate2).toBe('GET_TEST');
        });

        test('존재하지 않는 idx로 조회하면 null이 반환되어야 함', async () => {
            const nonExistentId = 999999999;
            const result = await getContractById(nonExistentId);
            expect(result).toBeNull();
        });
    });

    describe('updateContract()', () => {

        let testContractId;

        beforeEach(async () => {
            const testContract = await createContract({
                cate1: 'TEST',
                cate2: 'UPDATE_TEST',
                sender: 'TEST_Sender_Update',
                recipient: 'TEST_Recipient_Update',
                feepayer: 'TEST_Feepayer_Update',
                ripy: '200.0',
                signed_or_not1: 'N',
                signed_or_not2: 'N',
            });

            testContractId = testContract.idx;
        });

        test('signed_or_not1을 Y로 업데이트해야 함', async () => {
            const result = await updateContract(testContractId, {
                signed_or_not1: 'Y'
            });

            expect(result.signed_or_not1).toBe('Y');
            expect(result.signed_or_not2).toBe('N');
        });

        test('여러 필드를 동시에 업데이트해야 함', async () => {
            const result = await updateContract(testContractId, {
                signed_or_not1: 'Y',
                signed_or_not2: 'Y',
                ripy: '300.5'
            });

            expect(result.signed_or_not1).toBe('Y');
            expect(result.signed_or_not2).toBe('Y');

            // ✅ 수정: DECIMAL 타입은 숫자로 비교
            expect(parseFloat(result.ripy)).toBe(300.5);
        });

        test('업데이트 시 updated_at이 변경되어야 함', async () => {
            const original = await getContractById(testContractId);
            const originalUpdatedAt = original.updated_at;

            await new Promise(resolve => setTimeout(resolve, 1000));

            const result = await updateContract(testContractId, {
                ripy: '250.0'
            });

            expect(new Date(result.updated_at).getTime())
                .toBeGreaterThan(new Date(originalUpdatedAt).getTime());
        });
    });

    describe('listContracts()', () => {

        beforeAll(async () => {
            const testContracts = [
                { cate1: 'TEST', cate2: '1', sender: 'TEST_List1', recipient: 'R1', feepayer: 'F1', ripy: '10' },
                { cate1: 'TEST', cate2: '1', sender: 'TEST_List2', recipient: 'R2', feepayer: 'F2', ripy: '20' },
                { cate1: 'TEST', cate2: '2', sender: 'TEST_List3', recipient: 'R3', feepayer: 'F3', ripy: '30' },
                { cate1: 'TEST', cate2: '2', sender: 'TEST_List4', recipient: 'R4', feepayer: 'F4', ripy: '40' },
                { cate1: 'TEST', cate2: '3', sender: 'TEST_List5', recipient: 'R5', feepayer: 'F5', ripy: '50' },
            ];

            await Promise.all(
                testContracts.map(data => createContract(data))
            );
        });

        test('전체 목록을 조회해야 함', async () => {
            const result = await listContracts({
                cate1: 'TEST',
                limit: 100
            });

            expect(result).toBeDefined();
            expect(result.data).toBeDefined();
            expect(Array.isArray(result.data)).toBe(true);
            expect(result.data.length).toBeGreaterThanOrEqual(5);
            expect(result.total).toBeGreaterThanOrEqual(5);
        });

        test('페이징이 제대로 동작해야 함', async () => {
            const page1 = await listContracts({
                cate1: 'TEST',
                page: 1,
                limit: 2
            });

            expect(page1.data.length).toBeLessThanOrEqual(2);
            expect(page1.page).toBe(1);
            expect(page1.limit).toBe(2);

            const page2 = await listContracts({
                cate1: 'TEST',
                page: 2,
                limit: 2
            });

            expect(page2.page).toBe(2);

            if (page1.data.length > 0 && page2.data.length > 0) {
                expect(page1.data[0].idx).not.toBe(page2.data[0].idx);
            }
        });

        test('cate2로 필터링이 제대로 동작해야 함', async () => {
            const result = await listContracts({
                cate1: 'TEST',
                cate2: '1'
            });

            expect(result.data.length).toBeGreaterThanOrEqual(2);

            result.data.forEach(contract => {
                expect(contract.cate2).toBe('1');
            });
        });

        test('idx 내림차순 정렬이 제대로 동작해야 함', async () => {
            const result = await listContracts({
                cate1: 'TEST',
                orderBy: 'idx',
                orderDir: 'DESC',
                limit: 5
            });

            if (result.data.length >= 2) {
                expect(result.data[0].idx).toBeGreaterThan(result.data[1].idx);
            }
        });

        test('totalPages가 제대로 계산되어야 함', async () => {
            const result = await listContracts({
                cate1: 'TEST',
                limit: 2
            });

            expect(result).toHaveProperty('totalPages');
            expect(result.totalPages).toBe(Math.ceil(result.total / result.limit));
        });
    });
});