/**
 * Devnet 테스트용 지갑 생성 스크립트
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

console.log('\n========================================');
console.log('Devnet 테스트용 지갑 생성');
console.log('========================================\n');

// 새 키페어 생성
const keypair = Keypair.generate();

console.log('공개키 (Public Key):');
console.log(keypair.publicKey.toBase58());
console.log('');

console.log('시크릿 키 (Secret Key - Base58):');
console.log(bs58.encode(keypair.secretKey));
console.log('');

console.log('⚠️  시크릿 키는 안전하게 보관하세요!');
console.log('⚠️  이 키는 Devnet 테스트 전용입니다.');
console.log('⚠️  절대 운영 환경에서 사용하지 마세요!');
console.log('\n========================================');
console.log('.env 파일 업데이트:');
console.log('========================================\n');
console.log(`COMPANY_WALLET_PRIVATE_KEY=${bs58.encode(keypair.secretKey)}`);
console.log('\n========================================\n');