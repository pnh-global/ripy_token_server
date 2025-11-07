/**
 * mnemonic-to-privatekey.js
 *
 * Phantom 복구 문구(니모닉)로부터 개인키 생성
 * 위치: app/scripts/mnemonic-to-privatekey.js
 *
 * 실행 방법:
 * node app/scripts/mnemonic-to-privatekey.js
 */

import { Keypair } from '@solana/web3.js';
import bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import bs58 from 'bs58';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            resolve(answer);
        });
    });
}

async function main() {
    console.log('\n========================================');
    console.log('Phantom 복구 문구로 개인키 생성');
    console.log('========================================\n');

    try {
        // 1. 기대하는 지갑 주소
        const expectedAddress = 'BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh';
        console.log('검증할 지갑 주소:');
        console.log(`  ${expectedAddress}\n`);

        // 2. 니모닉 입력
        console.log('Phantom 복구 문구(12개 단어)를 입력하세요:');
        console.log('예: word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12\n');

        const mnemonic = await question('복구 문구: ');

        // 3. 니모닉 검증
        console.log('\n[검증 중...]');
        const mnemonicTrimmed = mnemonic.trim();

        if (!bip39.validateMnemonic(mnemonicTrimmed)) {
            throw new Error('유효하지 않은 복구 문구입니다. 12개 단어를 정확히 입력했는지 확인하세요.');
        }
        console.log('✓ 유효한 복구 문구\n');

        // 4. Phantom의 기본 파생 경로로 시도
        console.log('[개인키 생성 중...]');
        console.log('Phantom 기본 경로 시도: m/44\'/501\'/0\'/0\'\n');

        // 시드 생성
        const seed = await bip39.mnemonicToSeed(mnemonicTrimmed);

        // Phantom의 기본 파생 경로
        const derivationPath = "m/44'/501'/0'/0'";
        const derivedSeed = derivePath(derivationPath, seed.toString('hex')).key;
        const keypair = Keypair.fromSeed(derivedSeed);

        // 5. 공개키 추출
        const publicKey = keypair.publicKey.toBase58();
        const privateKeyBase58 = bs58.encode(keypair.secretKey);

        console.log('========================================');
        console.log('생성 결과');
        console.log('========================================\n');

        console.log('생성된 지갑 주소:');
        console.log(`  ${publicKey}\n`);

        console.log('기대하는 지갑 주소:');
        console.log(`  ${expectedAddress}\n`);

        // 6. 비교
        console.log('========================================');
        if (publicKey === expectedAddress) {
            console.log('✅ 성공: 지갑 주소가 일치합니다!');
            console.log('========================================\n');

            console.log('생성된 개인키 (Base58):');
            console.log(`  ${privateKeyBase58}\n`);

            console.log('.env 파일에 다음 내용을 추가하세요:\n');
            console.log('# 기존 지갑 (검증 완료)');
            console.log(`WALLET_ADDRESS1=${expectedAddress}`);
            console.log(`WALLET_1_PRIVATE_KEY=${privateKeyBase58}\n`);

            console.log('⚠️  보안 주의사항:');
            console.log('  1. .env 파일은 절대 GitHub에 업로드하지 마세요!');
            console.log('  2. .gitignore에 .env가 포함되어 있는지 확인하세요!');
            console.log('  3. 복구 문구와 개인키를 안전하게 보관하세요!');
            console.log('  4. 이 터미널 기록을 삭제하세요! (clear 또는 cls 명령어)\n');

        } else {
            console.log('❌ 주소가 일치하지 않습니다!');
            console.log('========================================\n');

            console.log('다른 파생 경로를 시도해보겠습니다...\n');

            // 다른 계정 경로들 시도
            const paths = [
                "m/44'/501'/1'/0'",  // 두 번째 계정
                "m/44'/501'/2'/0'",  // 세 번째 계정
                "m/44'/501'/3'/0'",  // 네 번째 계정
            ];

            let found = false;
            for (let i = 0; i < paths.length; i++) {
                const path = paths[i];
                const derived = derivePath(path, seed.toString('hex')).key;
                const kp = Keypair.fromSeed(derived);
                const pk = kp.publicKey.toBase58();

                console.log(`시도 ${i + 2}: ${path}`);
                console.log(`  생성 주소: ${pk}`);

                if (pk === expectedAddress) {
                    const privKey = bs58.encode(kp.secretKey);
                    console.log(`\n✅ 성공: 계정 ${i + 2}에서 일치하는 주소를 찾았습니다!\n`);
                    console.log('생성된 개인키 (Base58):');
                    console.log(`  ${privKey}\n`);
                    console.log('.env 파일에 추가할 내용:\n');
                    console.log(`WALLET_ADDRESS1=${expectedAddress}`);
                    console.log(`WALLET_1_PRIVATE_KEY=${privKey}\n`);
                    found = true;
                    break;
                }
            }

            if (!found) {
                console.log('\n❌ 일치하는 주소를 찾지 못했습니다.\n');
                console.log('가능한 원인:');
                console.log('  1. 복구 문구를 잘못 입력했을 가능성');
                console.log('  2. Phantom에서 다른 지갑의 복구 문구를 복사했을 가능성');
                console.log('  3. 더 높은 계정 인덱스 사용 (5번째 이상)\n');
                console.log('해결 방법:');
                console.log('  1. 복구 문구를 다시 확인하세요');
                console.log('  2. Phantom에서 현재 활성 계정이 맞는지 확인하세요\n');
            }
        }

    } catch (error) {
        console.error('\n========================================');
        console.error('❌ 에러 발생');
        console.error('========================================\n');
        console.error(`  ${error.message}\n`);

        if (error.message.includes('bip39')) {
            console.error('힌트: bip39 패키지가 설치되지 않았을 수 있습니다.');
            console.error('다음 명령어로 설치하세요:');
            console.error('  npm install bip39 ed25519-hd-key\n');
        }
    } finally {
        rl.close();
    }
}

main();