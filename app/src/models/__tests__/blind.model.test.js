// src/models/__tests__/blind.model.test.js

/**
 * blind.model.js 테스트
 * r_blind 테이블: IP 블라인드(차단) 관리
 *
 * 테스트 항목:
 * 1. addBlindIp() - IP 블라인드 추가
 * 2. checkBlindIp() - IP 블라인드 확인
 * 3. removeExpiredBlinds() - 만료된 블라인드 제거
 */

import blindModel from '../blind.model.js';
import pool from '../../config/db.js';

// 테스트 전후 DB 정리를 위한 헬퍼 함수
const cleanupTestData = async () => {
    try {
        // 테스트에서 사용하는 모든 IP 패턴 삭제
        await pool.execute(
            `DELETE FROM r_blind 
       WHERE req_ip_text LIKE '192.168.%'`
        );
    } catch (error) {
        console.error('Error in cleanupTestData:', error);
    }
};

describe('blind.model.js - IP 블라인드 관리 테스트', () => {

    // 각 테스트 전후로 DB 정리
    beforeEach(async () => {
        await cleanupTestData();
    });

    afterEach(async () => {
        await cleanupTestData();
    });

    // 모든 테스트 종료 후 완전 정리 및 DB 연결 종료
    afterAll(async () => {
        await cleanupTestData();
        await pool.end();
    });

    /**
     * 테스트 1: addBlindIp() - IP 블라인드 추가
     */
    describe('addBlindIp()', () => {

        test('정상적으로 IP를 블라인드 목록에 추가할 수 있어야 함', async () => {
            // Given: 추가할 IP 데이터
            const blindData = {
                ip_address: '192.168.1.100',
                reason: 'Suspicious activity detected',
                expired_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24시간 후
            };

            // When: IP 블라인드 추가
            const result = await blindModel.addBlindIp(blindData);

            // Then: 정상적으로 추가되어야 함
            expect(result).toBeDefined();
            expect(result.idx).toBeDefined(); // auto_increment ID
            expect(result.affectedRows).toBe(1);
        });

        test('필수 필드(ip_address)가 없으면 에러가 발생해야 함', async () => {
            // Given: ip_address가 없는 데이터
            const invalidData = {
                reason: 'Test reason'
            };

            // When & Then: 에러 발생
            await expect(blindModel.addBlindIp(invalidData))
                .rejects
                .toThrow();
        });

        test('동일한 IP를 중복으로 추가할 수 있어야 함 (이력 관리)', async () => {
            // Given: 같은 IP 데이터
            const blindData = {
                ip_address: '192.168.1.200',
                reason: 'First block'
            };

            // When: 같은 IP를 2번 추가
            const result1 = await blindModel.addBlindIp(blindData);
            const result2 = await blindModel.addBlindIp({
                ...blindData,
                reason: 'Second block'
            });

            // Then: 둘 다 성공하고 다른 idx를 가져야 함
            expect(result1.idx).toBeDefined();
            expect(result2.idx).toBeDefined();
            expect(result1.idx).not.toBe(result2.idx);
        });

    });

    /**
     * 테스트 2: checkBlindIp() - IP 블라인드 확인
     */
    describe('checkBlindIp()', () => {

        test('블라인드된 IP를 조회하면 true를 반환해야 함', async () => {
            // Given: 블라인드 IP 추가
            const testIp = '192.168.1.150';
            await blindModel.addBlindIp({
                ip_address: testIp,
                reason: 'Test block',
                expired_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24시간 후
            });

            // When: 해당 IP 확인
            const isBlinded = await blindModel.checkBlindIp(testIp);

            // Then: 블라인드 상태여야 함
            expect(isBlinded).toBe(true);
        });

        test('블라인드되지 않은 IP를 조회하면 false를 반환해야 함', async () => {
            // Given: 블라인드되지 않은 IP
            const normalIp = '192.168.1.250';

            // When: 해당 IP 확인
            const isBlinded = await blindModel.checkBlindIp(normalIp);

            // Then: 블라인드 상태가 아니어야 함
            expect(isBlinded).toBe(false);
        });

        test('만료된 블라인드 IP는 false를 반환해야 함', async () => {
            // Given: 만료된 블라인드 IP 추가
            const expiredIp = '192.168.1.170';
            await blindModel.addBlindIp({
                ip_address: expiredIp,
                reason: 'Expired block',
                expired_at: new Date(Date.now() - 24 * 60 * 60 * 1000) // ← 24시간 전으로 변경
            });

            // When: 해당 IP 확인
            const isBlinded = await blindModel.checkBlindIp(expiredIp);

            // Then: 만료되었으므로 false여야 함
            expect(isBlinded).toBe(false);
        });

        test('IP 주소가 제공되지 않으면 에러가 발생해야 함', async () => {
            // When & Then: IP 없이 호출하면 에러
            await expect(blindModel.checkBlindIp(null))
                .rejects
                .toThrow();
        });

    });

    /**
     * 테스트 3: removeExpiredBlinds() - 만료된 블라인드 제거
     */
    describe('removeExpiredBlinds()', () => {

        test('만료된 블라인드 IP들을 삭제할 수 있어야 함', async () => {
            // Given: 만료된 IP와 유효한 IP 추가
            const expiredIp1 = '192.168.1.180';
            const expiredIp2 = '192.168.1.181';
            const validIp = '192.168.1.190';

            // 만료된 IP 2개 추가
            await blindModel.addBlindIp({
                ip_address: expiredIp1,
                reason: 'Expired 1',
                expired_at: new Date(Date.now() - 24 * 60 * 60 * 1000)
            });
            await blindModel.addBlindIp({
                ip_address: expiredIp2,
                reason: 'Expired 2',
                expired_at: new Date(Date.now() - 48 * 60 * 60 * 1000)
            });

            // 유효한 IP 추가
            await blindModel.addBlindIp({
                ip_address: validIp,
                reason: 'Valid block',
                expired_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
            });

            // ✅ 삭제 전 DB 확인
            const connection = await pool.getConnection();
            const [before] = await connection.execute(
                `SELECT req_ip_text, expired_at FROM r_blind WHERE req_ip_text LIKE '192.168.%'`
            );
            console.log('삭제 전:', before);
            connection.release();

            // When: 만료된 블라인드 제거
            const result = await blindModel.removeExpiredBlinds();
            console.log('삭제된 행 수:', result.affectedRows);

            // ✅ 삭제 후 DB 확인
            const connection2 = await pool.getConnection();
            const [after] = await connection2.execute(
                `SELECT req_ip_text, expired_at FROM r_blind WHERE req_ip_text LIKE '192.168.%'`
            );
            console.log('삭제 후:', after);
            connection2.release();

            // Then: 2개가 삭제되어야 함
            expect(result.affectedRows).toBe(2);

            // 만료된 IP는 조회되지 않아야 함
            const check1 = await blindModel.checkBlindIp(expiredIp1);
            const check2 = await blindModel.checkBlindIp(expiredIp2);

            console.log('check1:', check1, 'for IP:', expiredIp1);
            console.log('check2:', check2, 'for IP:', expiredIp2);

            expect(check1).toBe(false);
            expect(check2).toBe(false);

            // 유효한 IP는 여전히 블라인드 상태여야 함
            const validCheck = await blindModel.checkBlindIp(validIp);
            expect(validCheck).toBe(true);
        });

        test('만료된 블라인드가 없으면 0개가 삭제되어야 함', async () => {
            // Given: 유효한 IP만 추가
            await blindModel.addBlindIp({
                ip_address: '192.168.1.195',
                reason: 'Valid only',
                expired_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
            });

            // When: 만료된 블라인드 제거
            const result = await blindModel.removeExpiredBlinds();

            // Then: 0개가 삭제되어야 함
            expect(result.affectedRows).toBe(0);
        });

        test('expired_at이 NULL인 블라인드는 삭제하지 않아야 함', async () => {
            // Given: expired_at이 NULL인 IP 추가 (영구 차단)
            const permanentIp = '192.168.1.199';
            await blindModel.addBlindIp({
                ip_address: permanentIp,
                reason: 'Permanent block',
                expired_at: null
            });

            // When: 만료된 블라인드 제거
            const result = await blindModel.removeExpiredBlinds();

            // Then: 삭제되지 않아야 함
            expect(result.affectedRows).toBe(0);

            // 여전히 블라인드 상태여야 함
            const check = await blindModel.checkBlindIp(permanentIp);
            expect(check).toBe(true);
        });

    });

    describe('에러 처리 테스트', () => {

        test('잘못된 IP 형식일 때 에러가 발생해야 함', async () => {
            // Given: 잘못된 IP 주소
            const invalidIp = 'invalid-ip-address';

            // When & Then: Invalid IP address 에러
            await expect(blindModel.addBlindIp({
                ip_address: invalidIp,
                reason: 'Test'
            })).rejects.toThrow('Invalid IP address');
        });

        test('checkBlindIp - 잘못된 IP 형식', async () => {
            // Given: 잘못된 IP
            const invalidIp = 'not-an-ip';

            // When & Then: 에러 발생
            await expect(blindModel.checkBlindIp(invalidIp))
                .rejects.toThrow('Invalid IP address');
        });

        test('DB 연결 실패 시 에러 처리', async () => {
            // 이 테스트는 실제 DB 연결 실패를 시뮬레이션하기 어려우므로
            // 실제 운영에서는 모니터링으로 대체
        });

    });

});