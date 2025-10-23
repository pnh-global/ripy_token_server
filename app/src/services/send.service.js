// 회사 지갑 → 다중 수신자 송신 서비스
import crypto from "crypto";
import {
    createSendRequest, insertSendDetails, listPendingDetails,
    updateDetailResult, refreshMasterStats, setMasterStatus, getRequestStatus
} from "../models/send.model.js";
import { insertLog } from "../models/log.model.js"; // 기존 r_log insert 재사용

// (예시) 실제 토큰 전송 호출을 추상화 — 여기서 Solana 트랜잭션 호출/서명 수행
async function transferTokenFromCompany({ toAddressEncrypted, amount }) {
    // TODO: decrypt address, build & sign tx(sender=feepayer=company), submit to Solana
    // 성공/실패를 아래 포맷으로 반환
    return { success: true, txid: "SAMPLE_TXID", code: "200", error: null };
}

/** 요청 생성 + 상세 저장 */
export async function createCompanySendRequest({ cate1, cate2, recipients }) {
    const request_id = crypto.randomUUID();

    await createSendRequest({
        request_id, cate1, cate2, total_count: recipients.length
    });

    // recipients: [{ wallet_address_encrypted, amount }, ...]
    await insertSendDetails(request_id, recipients);

    return { request_id };
}

/** 단일 상세 처리(재시도 포함) */
async function processOneDetail(request_id, detail, reqMeta) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        const r = await transferTokenFromCompany({
            toAddressEncrypted: detail.wallet_address,
            amount: detail.amount
        });

        // 로그(r_log) 저장
        await insertLog({
            cate1: "company_send",
            cate2: "detail",
            request_id,
            service_key_id: null,
            req_ip_text: reqMeta.ip || "0.0.0.0",
            req_server: reqMeta.server || null,
            req_status: "Y",
            api_name: "send/company",
            api_parameter: null,
            result_code: r.code || null,
            latency_ms: null,
            error_code: r.success ? null : "SEND_FAILED",
            error_message: r.error || null,
            content: r.txid ? `txid=${r.txid}` : null
        });

        // 상세 업데이트
        await updateDetailResult(detail.idx, {
            success: r.success,
            result_code: r.code,
            error_message: r.error
        });

        if (r.success) return; // 성공이면 다음 상세로
    }
    // 3회 시도 모두 실패한 경우 그대로 남김(sent='N', attempt_count=3)
}

/** 전체 요청 처리(비동기) */
export async function processCompanySend(request_id, reqMeta) {
    try {
        await setMasterStatus(request_id, "PROCESSING");

        // 페이징/배치로 처리해도 좋음 — 여기선 단순 루프
        // (여러 주소 동시 처리 원하면 p-queue 등으로 동시성 제어)
        let batch;
        do {
            batch = await listPendingDetails(request_id, 100);
            for (const d of batch) {
                await processOneDetail(request_id, d, reqMeta);
            }
            await refreshMasterStats(request_id);
        } while (batch.length > 0);

        await setMasterStatus(request_id, "DONE");
    } catch (e) {
        await setMasterStatus(request_id, "ERROR");
        throw e;
    }
}

/** 상태 조회용 */
export async function getCompanySendStatus(request_id) {
    return getRequestStatus(request_id);
}
