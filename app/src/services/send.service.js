// 회사 지갑 → 다중 수신자 송신 서비스
import crypto from "crypto";
import {
    createSendRequest, insertSendDetails, listPendingDetails,
    updateDetailResult, refreshMasterStats, setMasterStatus, getRequestStatus
} from "../models/send.model.js";
import { insertLog } from "../models/log.model.js";
import { decrypt } from "../utils/encryption.js";

// ===== Solana Transaction Service Import =====
import {
    createPartialSignedTransaction,
    finalizeTransaction,
    sendTransaction
} from "./transactionService.js";

/**
 * 회사 지갑에서 토큰 전송 (실제 Solana 연동)
 *
 * @param {Object} params
 * @param {string} params.toAddressEncrypted - 암호화된 수신자 주소
 * @param {number} params.amount - 전송할 RIPY 토큰 수량
 * @returns {Promise<Object>} { success, txid, code, error }
 */
async function transferTokenFromCompany({ toAddressEncrypted, amount }) {
    try {
        // 1. 암호화된 주소 복호화
        const masterKey = process.env.ENCRYPTION_KEY;
        if (!masterKey) {
            throw new Error('ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.');
        }

        const toAddress = decrypt(toAddressEncrypted, masterKey);

        // 2. 회사 지갑 주소 가져오기
        const companyAddress = process.env.COMPANY_WALLET_ADDRESS;
        if (!companyAddress) {
            throw new Error('COMPANY_WALLET_ADDRESS 환경변수가 설정되지 않았습니다.');
        }

        // 3. 부분 서명 트랜잭션 생성 (회사가 Fee Payer이자 발신자)
        const partialTx = await createPartialSignedTransaction({
            fromPubkey: companyAddress,
            toPubkey: toAddress,
            amount: amount
        });

        // 4. 회사 지갑이 발신자이자 Fee Payer이므로
        //    추가 서명 없이 바로 전송 가능
        //    (실제로는 이미 partialSign에서 회사 서명 완료)

        // 5. 트랜잭션 전송
        const result = await sendTransaction({
            serialized: partialTx.serialized
        });

        // 6. 성공 반환
        return {
            success: true,
            txid: result.signature,
            code: "200",
            error: null
        };

    } catch (error) {
        console.error('[SEND SERVICE] 토큰 전송 실패:', error);

        return {
            success: false,
            txid: null,
            code: "500",
            error: error.message
        };
    }
}

/** 요청 생성 + 상세 저장 */
export async function createCompanySendRequest({ cate1, cate2, recipients }) {
    const request_id = crypto.randomUUID();

    await createSendRequest({
        request_id, cate1, cate2, total_count: recipients.length
    });

    // recipients: [{ wallet_address_encrypted, amount }, ...] 또는
    // recipients: [{ wallet_address, amount }, ...] (암호화 안 된 경우)
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

        if (r.success) {
            console.log(`[SEND SERVICE] 전송 성공: idx=${detail.idx}, txid=${r.txid}`);
            return; // 성공이면 다음 상세로
        }

        console.log(`[SEND SERVICE] 전송 실패 (시도 ${attempt}/3): idx=${detail.idx}, error=${r.error}`);
    }

    // 3회 시도 모두 실패한 경우
    console.error(`[SEND SERVICE] 전송 최종 실패: idx=${detail.idx}`);
}

/**
 * 전체 요청 처리 (비동기 스케줄러)
 *
 * 배치 단위로 처리하며, 각 상세 건에 대해 최대 3회 재시도
 *
 * @param {string} request_id - 요청 UUID
 * @param {Object} reqMeta - 요청 메타 정보 (ip, server)
 * @returns {Promise<void>}
 */
export async function processCompanySend(request_id, reqMeta) {
    try {
        console.log(`[SEND SERVICE] 일괄 전송 시작: ${request_id}`);
        await setMasterStatus(request_id, "PROCESSING");

        // 페이징/배치로 처리
        // 100개씩 가져와서 순차 처리
        let batch;
        let totalProcessed = 0;

        do {
            batch = await listPendingDetails(request_id, 100);

            console.log(`[SEND SERVICE] 배치 처리: ${batch.length}건`);

            for (const detail of batch) {
                await processOneDetail(request_id, detail, reqMeta);
                totalProcessed++;
            }

            // 통계 갱신
            await refreshMasterStats(request_id);

        } while (batch.length > 0);

        console.log(`[SEND SERVICE] 일괄 전송 완료: ${request_id}, 총 ${totalProcessed}건 처리`);
        await setMasterStatus(request_id, "DONE");

    } catch (error) {
        console.error(`[SEND SERVICE] 일괄 전송 오류: ${request_id}`, error);
        await setMasterStatus(request_id, "ERROR");
        throw error;
    }
}

/**
 * 회사 지갑에서 토큰 전송 - Company Send API 전용
 * 새로운 다중 전송 API에서 사용
 *
 * @param {Object} params
 * @param {string} params.toAddressEncrypted - 암호화된 수신자 주소
 * @param {number} params.amount - 전송할 RIPY 토큰 수량
 * @returns {Promise<Object>} { success, txid, code, error }
 */
async function transferTokenFromCompanySend({ toAddressEncrypted, amount }) {
    try {
        // 1. 암호화된 주소 복호화
        const masterKey = process.env.ENCRYPTION_KEY;
        if (!masterKey) {
            throw new Error('ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.');
        }

        const toAddress = decrypt(toAddressEncrypted, masterKey);

        // 2. 회사 지갑 주소 가져오기 (Company Send 전용 환경변수)
        const companyAddress = process.env.COMPANY_SEND_WALLET_ADDRESS;
        if (!companyAddress) {
            throw new Error('COMPANY_SEND_WALLET_ADDRESS 환경변수가 설정되지 않았습니다.');
        }

        console.log('[SEND SERVICE] Company Send - 회사 지갑 주소:', companyAddress);

        // 3. 부분 서명 트랜잭션 생성 (회사가 Fee Payer이자 발신자)
        const partialTx = await createPartialSignedTransaction({
            fromPubkey: companyAddress,
            toPubkey: toAddress,
            amount: amount
        });

        // 4. 회사 지갑이 발신자이자 Fee Payer이므로
        //    추가 서명 없이 바로 전송 가능
        //    (실제로는 이미 partialSign에서 회사 서명 완료)

        // 5. 트랜잭션 전송
        const result = await sendTransaction({
            serialized: partialTx.serialized
        });

        // 6. 성공 반환
        return {
            success: true,
            txid: result.signature,
            code: "200",
            error: null
        };

    } catch (error) {
        console.error('[SEND SERVICE] Company Send 토큰 전송 실패:', error);

        return {
            success: false,
            txid: null,
            code: "500",
            error: error.message
        };
    }
}

/** 상태 조회용 */
export async function getCompanySendStatus(request_id) {
    return getRequestStatus(request_id);
}