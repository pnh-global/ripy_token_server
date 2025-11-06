/**
 * Seed Phrase를 Private Key로 변환하는 스크립트
 */

import { Keypair } from "@solana/web3.js";
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";

async function convertSeedToPrivateKey() {
    try {
        console.log("=== Seed Phrase → Private Key 변환 ===\n");

        // 여기에 Phantom의 12단어 복구 구문 입력
        const seedPhrase = "gasp library involve record news quantum view baby robust disease gravity chalk";

        console.log("입력된 Seed Phrase:", seedPhrase);

        // Seed를 바이너리로 변환
        const seed = await bip39.mnemonicToSeed(seedPhrase);

        // Solana의 기본 derivation path 사용
        const path = "m/44'/501'/0'/0'";
        const derivedSeed = derivePath(path, seed.toString("hex")).key;

        // Keypair 생성
        const keypair = Keypair.fromSeed(derivedSeed);

        // Private Key 배열 추출
        const privateKeyArray = Array.from(keypair.secretKey);

        console.log("\n=== 변환 완료 ===");
        console.log("지갑 주소:", keypair.publicKey.toBase58());
        console.log("\nPrivate Key 배열 (아래를 복사하세요):");
        console.log(JSON.stringify(privateKeyArray));
        console.log("\nPrivate Key 길이:", privateKeyArray.length);

        console.log("\n⚠️ 보안: Private Key를 안전하게 보관하세요!");

    } catch (error) {
        console.error("\n=== 에러 발생 ===");
        console.error("에러:", error.message);
    }
}

convertSeedToPrivateKey();