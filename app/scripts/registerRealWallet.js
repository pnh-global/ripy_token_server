/**
 * 실제 지갑 등록 스크립트
 */

import { registerWallet } from "../src/utils/registerWallet.util.js";

async function registerReal() {
    try {
        console.log("=== 실제 지갑 등록 ===");

        // 실제 지갑 정보 입력
        const walletAddress = "BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh";

        // Phantom에서 내보낸 Private Key를 배열로 입력
        const privateKeyArray = [
            // 64개의 숫자를 쉼표로 구분하여 입력
            // 예: 174,47,154,16,202,193,206,113,...
        ];

        const privateKey = JSON.stringify(privateKeyArray);

        console.log("등록할 지갑 주소:", walletAddress);
        console.log("Private Key 길이:", privateKeyArray.length);

        if (privateKeyArray.length !== 64) {
            throw new Error("Private Key는 정확히 64개의 숫자여야 합니다.");
        }

        const result = await registerWallet(walletAddress, privateKey, "user");

        console.log("\n=== 등록 완료 ===");
        console.log("지갑 ID:", result.wallet_id);
        console.log("지갑 주소:", result.wallet_address);

        process.exit(0);

    } catch (error) {
        console.error("\n=== 에러 발생 ===");
        console.error("에러:", error.message);

        process.exit(1);
    }
}

registerReal();