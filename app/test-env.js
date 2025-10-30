import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('현재 디렉토리:', __dirname);
console.log('.env 파일 경로:', join(__dirname, '.env'));

dotenv.config({ path: join(__dirname, '.env') });

console.log('\n========================================');
console.log('환경 변수 확인');
console.log('========================================\n');

console.log('SERVICE_WALLET_SECRET_KEY:');
console.log('  존재 여부:', !!process.env.SERVICE_WALLET_SECRET_KEY);
console.log('  길이:', process.env.SERVICE_WALLET_SECRET_KEY?.length);
console.log('  처음 20자:', process.env.SERVICE_WALLET_SECRET_KEY?.substring(0, 20));
console.log('  마지막 20자:', process.env.SERVICE_WALLET_SECRET_KEY?.substring(process.env.SERVICE_WALLET_SECRET_KEY.length - 20));

console.log('\nBase58 디코딩 테스트:');
try {
    const decoded = bs58.decode(process.env.SERVICE_WALLET_SECRET_KEY);
    console.log('✅ Base58 디코딩 성공!');
    console.log('  바이트 길이:', decoded.length, '(64여야 정상)');

    // 공개키 생성 및 출력 추가
    console.log('\n========================================');
    console.log('지갑 정보');
    console.log('========================================\n');

    const keypair = Keypair.fromSecretKey(decoded);
    console.log('공개키 (지갑 주소):');
    console.log('  ', keypair.publicKey.toBase58());
    console.log('');

} catch(e) {
    console.error('❌ Base58 디코딩 실패:', e.message);

    // 문자별 확인
    const key = process.env.SERVICE_WALLET_SECRET_KEY;
    console.log('\n문자 검사:');
    for(let i = 0; i < key.length; i++) {
        const char = key[i];
        const code = char.charCodeAt(0);

        // Base58 허용 문자: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
        const validChars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

        if (!validChars.includes(char)) {
            console.log(`  위치 ${i}: '${char}' (코드 ${code}) ← 잘못된 문자!`);
        }
    }
}

console.log('========================================\n');