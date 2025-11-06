/**
 * encrypt-test-data.js
 *
 * Postman/curl 테스트를 위한 데이터 암호화 헬퍼
 *
 * 사용법:
 * node encrypt-test-data.js create
 * node encrypt-test-data.js finalize <contract_id>
 */

import { encrypt } from './src/utils/encryption.js';
import dotenv from 'dotenv';

dotenv.config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
    console.error('ERROR: ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.');
    process.exit(1);
}

// 명령줄 인자 파싱
const command = process.argv[2];
const contractId = process.argv[3];

if (!command) {
    console.log('사용법:');
    console.log('  node encrypt-test-data.js create');
    console.log('  node encrypt-test-data.js finalize <contract_id>');
    process.exit(1);
}

// createSign 테스트 데이터
const createSignData = {
    cate1: 'test',
    cate2: 'postman',
    sender: 'BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh',
    recipient: '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
    ripy: '100.5'
};

// finalizeSign 테스트 데이터 생성 함수
function getFinalizeSignData(contractId) {
    return {
        contract_id: parseInt(contractId),
        user_signature: {
            publicKey: '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
            signature: 'MockUserSignatureBase64String123456789abcdefghijklmnopqrstuvwxyz'
        }
    };
}

try {
    let data;
    let dataType;
    let apiPath;

    if (command === 'create') {
        data = createSignData;
        dataType = 'createSign';
        apiPath = 'create';
    } else if (command === 'finalize') {
        if (!contractId) {
            console.error('ERROR: contract_id가 필요합니다.');
            console.log('사용법: node encrypt-test-data.js finalize <contract_id>');
            process.exit(1);
        }
        data = getFinalizeSignData(contractId);
        dataType = 'finalizeSign';
        apiPath = 'finalize';
    } else {
        console.error('ERROR: 알 수 없는 명령:', command);
        console.log('지원되는 명령: create, finalize');
        process.exit(1);
    }

    // JSON 문자열로 변환
    const jsonString = JSON.stringify(data);

    // 암호화
    const encrypted = encrypt(jsonString, ENCRYPTION_KEY);

    console.log('\n' + '='.repeat(80));
    console.log(`${dataType} 테스트 데이터 - 암호화 완료`);
    console.log('='.repeat(80));
    console.log('\n[원본 데이터]');
    console.log(JSON.stringify(data, null, 2));
    console.log('\n[암호화된 데이터]');
    console.log(encrypted);
    console.log('\n[curl 명령어]');
    console.log(`curl -X POST http://localhost:4000/api/sign/${apiPath} \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -H "x-api-key: test-api-key-12345" \\`);
    console.log(`  -d '{"data":"${encrypted}"}'`);
    console.log('\n' + '='.repeat(80) + '\n');

} catch (error) {
    console.error('ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
}