/**
 * 내 Devnet 지갑 등록 스크립트
 */

import { registerWallet } from "../src/utils/registerWallet.util.js";

async function registerMyWallet() {
    try {
        console.log("=== 내 Devnet 지갑 등록 ===");

        const walletAddress = "BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh";

        // 여기에 Phantom에서 내보낸 Private Key 배열을 입력하세요
        const privateKeyArray = [120,100,182,38,104,165,211,190,185,9,94,13,57,176,127,14,48,152,64,202,68,144,206,233,240,41,9,124,146,28,220,169,153,178,78,123,23,153,209,161,8,227,8,191,112,142,57,54,137,0,141,100,119,67,186,250,254,84,86,165,107,66,71,124];

        const privateKey = JSON.stringify(privateKeyArray);

        console.log("등록할 지갑 주소:", walletAddress);
        console.log("Private Key 길이:", privateKeyArray.length);

        if (privateKeyArray.length !== 64) {
            throw new Error(`Private Key는 정확히 64개의 숫자여야 합니다. (현재: ${privateKeyArray.length}개)`);
        }

        const result = await registerWallet(walletAddress, privateKey, "user");

        console.log("\n=== 등록 완료 ===");
        console.log("지갑 ID:", result.wallet_id);
        console.log("지갑 주소:", result.wallet_address);
        console.log("지갑 타입:", result.wallet_type);

        console.log("\n⚠️ 보안: 등록 완료 후 이 파일에서 Private Key를 삭제하세요!");

        process.exit(0);

    } catch (error) {
        console.error("\n=== 에러 발생 ===");
        console.error("에러:", error.message);

        process.exit(1);
    }
}

registerMyWallet();