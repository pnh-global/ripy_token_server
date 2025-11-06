/**
 * 테스트용 지갑 생성 및 등록 스크립트
 */

import { Keypair } from "@solana/web3.js";
import { registerWallet } from "../src/utils/registerWallet.util.js";

async function generateAndRegister() {
    try {
        console.log("=== 테스트 지갑 생성 및 등록 ===");

        // 1. 새로운 Solana 지갑 생성
        const keypair = Keypair.generate();

        // 2. 지갑 정보 추출
        const walletAddress = keypair.publicKey.toBase58();
        const privateKeyArray = Array.from(keypair.secretKey);
        const privateKey = JSON.stringify(privateKeyArray);

        console.log("생성된 지갑 주소:", walletAddress);
        console.log("Private Key 길이:", privateKeyArray.length);

        // 3. 데이터베이스에 등록
        const result = await registerWallet(walletAddress, privateKey, "user");

        console.log("\n=== 등록 완료 ===");
        console.log("지갑 ID:", result.wallet_id);
        console.log("지갑 주소:", result.wallet_address);
        console.log("지갑 타입:", result.wallet_type);

        console.log("\n=== 중요 정보 ===");
        console.log("이 지갑 주소를 테스트에 사용하세요:", walletAddress);
        console.log("⚠️ 주의: 이 지갑은 테스트용이므로 실제 토큰을 보내지 마세요!");

        process.exit(0);

    } catch (error) {
        console.error("\n=== 에러 발생 ===");
        console.error("에러:", error.message);
        console.error("상세:", error);

        process.exit(1);
    }
}

generateAndRegister();