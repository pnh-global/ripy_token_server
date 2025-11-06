/**
 * create-service-key.js
 * UTF-8 문제 해결을 위한 서비스 키 생성 스크립트
 */

import { pool } from '../src/config/db.js';
import crypto from 'crypto';

// 원본 API Key
const originalKey = 'test-api-key-12345';

// SHA-256 해시 계산
const keyHash = crypto.createHash('sha256')
    .update(originalKey)
    .digest('hex')
    .toUpperCase();

const keyLast4 = originalKey.slice(-4);

console.log('='.repeat(60));
console.log('서비스 키 생성');
console.log('='.repeat(60));
console.log('원본 API Key:', originalKey);
console.log('계산된 Hash:', keyHash);
console.log('Last 4:', keyLast4);
console.log('='.repeat(60));

async function createKey() {
    try {
        // DB 연결 charset 확인
        const [charsetRows] = await pool.execute(
            'SHOW VARIABLES LIKE "character%"'
        );
        console.log('\n=== 현재 DB 문자셋 ===');
        charsetRows.forEach(row => {
            console.log(`${row.Variable_name}: ${row.Value}`);
        });
        console.log('='.repeat(60));

        // 서비스 키 삽입
        const [result] = await pool.execute(
            `INSERT INTO service_keys (
                req_ip_text,
                req_server,
                key_hash,
                key_ciphertext,
                key_last4,
                status,
                scopes,
                allow_cidrs,
                allow_hosts
            ) VALUES (?, ?, UNHEX(?), ?, ?, ?, ?, ?, ?)`,
            [
                'localhost',
                'test-server',
                keyHash,  // HEX 문자열을 UNHEX()로 VARBINARY로 변환
                originalKey,
                keyLast4,
                'ACTIVE',
                JSON.stringify(['read', 'write']),
                JSON.stringify([]),  // 모든 IP 허용
                JSON.stringify([])
            ]
        );

        console.log('\n✅ 서비스 키 생성 완료!');
        console.log('- idx:', result.insertId);
        console.log('='.repeat(60));

        // 검증: 방금 삽입한 데이터 확인
        const [verifyRows] = await pool.execute(
            `SELECT 
                idx,
                HEX(key_hash) as key_hash_hex,
                key_ciphertext,
                key_last4,
                status
            FROM service_keys 
            WHERE idx = ?`,
            [result.insertId]
        );

        console.log('\n=== 삽입된 데이터 검증 ===');
        console.log('idx:', verifyRows[0].idx);
        console.log('key_hash (HEX):', verifyRows[0].key_hash_hex);
        console.log('key_ciphertext:', verifyRows[0].key_ciphertext);
        console.log('key_last4:', verifyRows[0].key_last4);
        console.log('status:', verifyRows[0].status);
        console.log('='.repeat(60));

        // 일치 확인
        if (verifyRows[0].key_hash_hex === keyHash) {
            console.log('\n✅ 해시값 일치! 정상 저장됨');
        } else {
            console.log('\n❌ 해시값 불일치!');
            console.log('저장됨:', verifyRows[0].key_hash_hex);
            console.log('예상값:', keyHash);
        }
        console.log('='.repeat(60));

        // verifyServiceKey 테스트
        console.log('\n=== verifyServiceKey 테스트 ===');
        const [testRows] = await pool.execute(
            `SELECT idx, status FROM service_keys WHERE key_hash = UNHEX(?) LIMIT 1`,
            [keyHash]
        );

        if (testRows.length > 0) {
            console.log('✅ verifyServiceKey 성공! idx:', testRows[0].idx);
        } else {
            console.log('❌ verifyServiceKey 실패!');
        }
        console.log('='.repeat(60));

        console.log('\n=== API 호출 예시 ===');
        console.log(`curl -X POST http://localhost:4001/api/sign/create \\`);
        console.log(`  -H "Content-Type: application/json" \\`);
        console.log(`  -H "X-API-Key: ${originalKey}" \\`);
        console.log(`  -d '{"cate1":"reward","cate2":"event","sender":"addr1","recipient":"addr2","ripy":"100.5"}'`);
        console.log('='.repeat(60));

        await pool.end();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ 에러 발생:', error.message);
        console.error(error);
        await pool.end();
        process.exit(1);
    }
}

// 실행
createKey();