/**
 * create-service-key.js
 * Service Key 생성 스크립트
 *
 * 사용법:
 * - 랜덤 키 생성: node scripts/create-service-key.js
 * - 테스트 키 생성: node scripts/create-service-key.js --test
 */

import { executeQuery } from '../src/config/db.js';
import { pool } from '../src/config/db.js';
import crypto from 'crypto';

// 명령줄 인자 확인
const isTestMode = process.argv.includes('--test');

async function createServiceKey() {
    try {
        // 1. API Key 생성
        let originalKey;
        if (isTestMode) {
            // 테스트 모드: 고정된 키
            originalKey = 'test-api-key-12345';
            console.log('\n🧪 테스트 모드: 고정된 키를 사용합니다.');
        } else {
            // 운영 모드: 랜덤 키 생성
            originalKey = crypto.randomBytes(32).toString('hex');
            console.log('\n🔐 운영 모드: 랜덤 키를 생성합니다.');
        }

        // 2. SHA-256 해시 계산
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

        // 3. DB에 저장
        const sql = `
            INSERT INTO service_keys (
                req_ip_text,
                req_server,
                key_hash,
                key_ciphertext,
                key_last4,
                status,
                scopes,
                allow_cidrs,
                allow_hosts,
                created_at,
                updated_at
            ) VALUES (
                :req_ip_text,
                :req_server,
                UNHEX(:key_hash),
                :key_ciphertext,
                :key_last4,
                'ACTIVE',
                :scopes,
                :allow_cidrs,
                :allow_hosts,
                NOW(),
                NOW()
            )
        `;

        const [result] = await executeQuery(sql, {
            req_ip_text: 'localhost',
            req_server: isTestMode ? 'test-server' : 'CompanySend_WebServer',
            key_hash: keyHash,
            key_ciphertext: originalKey,
            key_last4: keyLast4,
            scopes: JSON.stringify(['read', 'write']),
            allow_cidrs: JSON.stringify([]),  // 모든 IP 허용
            allow_hosts: JSON.stringify([])
        });

        console.log('\n✅ 서비스 키 생성 완료!');
        console.log('- idx:', result.insertId);
        console.log('='.repeat(60));

        // 4. 검증
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
        console.log('key_last4:', verifyRows[0].key_last4);
        console.log('status:', verifyRows[0].status);

        if (verifyRows[0].key_hash_hex === keyHash) {
            console.log('\n✅ 해시값 일치! 정상 저장됨');
        } else {
            console.log('\n❌ 해시값 불일치!');
        }
        console.log('='.repeat(60));

        // 5. API 호출 예시
        console.log('\n=== API 테스트 명령어 ===');
        console.log(`curl -X POST http://localhost:4000/api/companysend \\`);
        console.log(`  -H "Content-Type: application/json" \\`);
        console.log(`  -H "x-api-key: ${originalKey}" \\`);
        console.log(`  -d '{`);
        console.log(`    "cate1": "company_send",`);
        console.log(`    "cate2": "test_20251110",`);
        console.log(`    "recipients": [`);
        console.log(`      {`);
        console.log(`        "wallet_address": "AiF7NdJKaDxHsfnRzKKH2SR1GJ2u8upvnnVSsrPEikgw",`);
        console.log(`        "amount": 0.1`);
        console.log(`      }`);
        console.log(`    ]`);
        console.log(`  }'`);
        console.log('='.repeat(60));

        await pool.end();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ 에러 발생:', error.message);
        console.error(error.stack);
        await pool.end();
        process.exit(1);
    }
}

// 실행
createServiceKey();