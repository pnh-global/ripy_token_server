/**
 * 지갑 등록 테스트 스크립트
 */

import { registerWallet } from "../src/utils/registerWallet.util.js";

async function test() {
    try {
        console.log("=== 지갑 등록 테스트 시작 ===");

        const walletAddress = "BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh";

        // 실제 Private Key를 JSON 문자열로 입력
        // Phantom에서 내보낸 Private Key 배열 예시
        const privateKey = JSON.stringify([
            // 여기에 실제 64개의 숫자 배열을 입력
            // 예: 174,47,154,16,202,193,206,113,199,190,53,133,169,175,31,56,
            //     100,165,15,142,129,203,148,194,219,189,92,139,59,201,156,92,
            //     ...
        ]);

        console.log("등록할 지갑 주소:", walletAddress);

        const result = await registerWallet(walletAddress, privateKey, "user");

        console.log("=== 등록 성공 ===");
        console.log(result);

        process.exit(0);

    } catch (error) {
        console.error("=== 등록 실패 ===");
        console.error("에러:", error.message);

        process.exit(1);
    }
}

test();