/**
 * ============================================
 * db.util.test.js - DB 유틸리티 테스트
 * ============================================
 *
 * 실행 방법:
 * node src/lib/__tests__/db.util.test.js
 */

import { exec, query, queryOne } from '../db.util.js';

console.log('DB 유틸리티 테스트 시작\n');

async function runTests() {
    try {
        // 테스트 1: 간단한 쿼리
        console.log('[TEST 1] 간단한 쿼리');
        const [result1] = await exec('SELECT NOW() AS now');
        console.log('현재 시간:', result1[0].now);
        console.log('성공\n');

        // 테스트 2: Named Parameters
        console.log('[TEST 2] Named Parameters');
        const [result2] = await exec(
            'SELECT :name AS name, :age AS age',
            { name: 'RIPY', age: 2025 }
        );
        console.log('결과:', result2[0]);
        console.log('성공\n');

        // 테스트 3: query 헬퍼
        console.log('[TEST 3] query 헬퍼');
        const rows = await query('SELECT 1 AS num, 2 AS num2');
        console.log('결과:', rows);
        console.log('성공\n');

        // 테스트 4: queryOne 헬퍼
        console.log('[TEST 4] queryOne 헬퍼');
        const row = await queryOne('SELECT 100 AS value');
        console.log('결과:', row);
        console.log('성공\n');

        // 테스트 5: 실제 테이블 조회
        console.log('[TEST 5] r_send_request 조회');
        const requests = await query(
            'SELECT COUNT(*) AS total FROM r_send_request'
        );
        console.log('총 요청 수:', requests[0].total);
        console.log('성공\n');

        console.log('모든 테스트 완료!');
        process.exit(0);

    } catch (error) {
        console.error('[ERROR] 테스트 실패:', error.message);
        process.exit(1);
    }
}

runTests();