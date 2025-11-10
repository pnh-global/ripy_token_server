/**
 * ============================================
 * companySend.service.js - 회사 지갑 다중 전송 Service
 * ============================================
 *
 * 역할:
 * - 회사 지갑에서 여러 수신자에게 RIPY 토큰 전송
 * - DB 트랜잭션 관리 (r_send_request, r_send_detail)
 * - Solana 블록체인 트랜잭션 생성 및 전송
 * - 재시도 로직 (최대 3회)
 * - 로그 기록 (r_log)
 *
 * 특징:
 * - 회사 지갑이 발신자이자 Fee Payer
 * - 부분 서명 없이 회사 지갑만으로 서명 완료
 * - 비동기 백그라운드 처리
 *
 * 작성일: 2025-11-07
 */

import crypto from 'crypto';
import {
    Connection,
    PublicKey,
    Transaction,
    SystemProgram,
    sendAndConfirmTransaction,
    Keypair
} from '@solana/web3.js';
import {
    createTransferInstruction,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    getAccount
} from '@solana/spl-token';
import bs58 from 'bs58';

// Models
import {
    createSendRequest,
    insertSendDetails,
    listPendingDetails,
    updateDetailResult,
    getRequestStatus,
    refreshMasterStats,
    setMasterStatus,
    SEND_STATUS
} from '../models/send.model.js';
import { insertLog } from '../models/log.model.js';

// Utils
import { decrypt } from '../utils/encryption.js';

/**
 * ============================================
 * 환경 변수 로드
 * ============================================
 */

// 회사 지갑 설정 (Company Send 전용)
const COMPANY_WALLET_ADDRESS = process.env.COMPANY_SEND_WALLET_ADDRESS;
const COMPANY_WALLET_PRIVATE_KEY = process.env.COMPANY_SEND_WALLET_PRIVATE_KEY;
const TOKEN_MINT_ADDRESS = process.env.RIPY_TOKEN_MINT_ADDRESS;
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

// 전송 설정
const MAX_RETRY = parseInt(process.env.COMPANY_SEND_MAX_RETRY || '3', 10);
const RETRY_DELAY = parseInt(process.env.COMPANY_SEND_RETRY_DELAY || '1000', 10);

// Solana 연결 객체
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

/**
 * ============================================
 * 초기화 검증
 * ============================================
 */

if (!COMPANY_WALLET_ADDRESS || !COMPANY_WALLET_PRIVATE_KEY) {
    throw new Error(
        '회사 지갑 환경 변수가 설정되지 않았습니다. ' +
        'COMPANY_SEND_WALLET_ADDRESS, COMPANY_SEND_WALLET_PRIVATE_KEY를 확인하세요.'
    );
}

if (!TOKEN_MINT_ADDRESS) {
    throw new Error('RIPY_TOKEN_MINT_ADDRESS 환경 변수가 설정되지 않았습니다.');
}

console.log('[COMPANY SEND SERVICE] 초기화 완료');
console.log(`- 회사 지갑: ${COMPANY_WALLET_ADDRESS}`);
console.log(`- 토큰 민트: ${TOKEN_MINT_ADDRESS}`);
console.log(`- RPC URL: ${SOLANA_RPC_URL}`);

/**
 * ============================================
 * Solana 트랜잭션 함수
 * ============================================
 */

/**
 * 회사 지갑 Keypair 로드
 * @returns {Keypair} 회사 지갑 Keypair
 */
function getCompanyWalletKeypair() {
    try {
        const privateKeyBytes = bs58.decode(COMPANY_WALLET_PRIVATE_KEY);
        return Keypair.fromSecretKey(privateKeyBytes);
    } catch (error) {
        console.error('[COMPANY SEND] 회사 지갑 키 로드 실패:', error);
        throw new Error('회사 지갑 개인키 형식이 올바르지 않습니다.');
    }
}

/**
 * ATA (Associated Token Account) 존재 여부 확인 및 생성
 * @param {PublicKey} walletPubkey - 지갑 공개키
 * @param {PublicKey} mintPubkey - 토큰 민트 공개키
 * @returns {Promise<{ataAddress: PublicKey, needsCreation: boolean}>}
 */
async function ensureTokenAccount(walletPubkey, mintPubkey) {
    try {
        // ATA 주소 계산
        const ataAddress = await getAssociatedTokenAddress(
            mintPubkey,
            walletPubkey
        );

        // ATA 존재 여부 확인
        try {
            await getAccount(connection, ataAddress);
            console.log(`[COMPANY SEND] ATA 이미 존재: ${ataAddress.toBase58()}`);
            return { ataAddress, needsCreation: false };
        } catch (error) {
            // ATA가 없으면 생성 필요
            console.log(`[COMPANY SEND] ATA 생성 필요: ${ataAddress.toBase58()}`);
            return { ataAddress, needsCreation: true };
        }
    } catch (error) {
        console.error('[COMPANY SEND] ATA 확인 오류:', error);
        throw error;
    }
}

/**
 * 단일 수신자에게 RIPY 토큰 전송
 * @param {string} toWalletAddress - 수신자 지갑 주소
 * @param {number} amount - 전송 금액 (decimal 값)
 * @returns {Promise<{success: boolean, signature: string|null, error: string|null}>}
 */
async function transferToken(toWalletAddress, amount) {
    let signature = null;

    try {
        console.log(`[COMPANY SEND] 전송 시작: ${toWalletAddress}, ${amount} RIPY`);

        // 1. Keypair 로드
        const companyKeypair = getCompanyWalletKeypair();
        const companyPubkey = companyKeypair.publicKey;

        // 2. PublicKey 객체 생성
        const toPubkey = new PublicKey(toWalletAddress);
        const mintPubkey = new PublicKey(TOKEN_MINT_ADDRESS);

        // 3. ATA 주소 확인 및 생성
        const fromAta = await getAssociatedTokenAddress(mintPubkey, companyPubkey);
        const { ataAddress: toAta, needsCreation } = await ensureTokenAccount(toPubkey, mintPubkey);

        // 4. 금액 계산 (decimal 9)
        const TOKEN_DECIMALS = 9;
        const amountInSmallestUnit = Math.floor(amount * Math.pow(10, TOKEN_DECIMALS));

        console.log(`[COMPANY SEND] 전송량(lamports): ${amountInSmallestUnit}`);

        // 5. 최신 blockhash 가져오기
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

        // 6. Transaction 생성
        const transaction = new Transaction({
            feePayer: companyPubkey,
            blockhash,
            lastValidBlockHeight
        });

        // 7. ATA 생성 instruction 추가 (필요한 경우)
        if (needsCreation) {
            console.log(`[COMPANY SEND] ATA 생성 instruction 추가`);
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    companyPubkey,  // payer
                    toAta,           // ata
                    toPubkey,        // owner
                    mintPubkey       // mint
                )
            );
        }

        // 8. 토큰 전송 instruction 추가
        transaction.add(
            createTransferInstruction(
                fromAta,              // source
                toAta,                // destination
                companyPubkey,        // owner
                amountInSmallestUnit  // amount
            )
        );

        // 9. 트랜잭션 서명 (회사 지갑만 서명)
        transaction.sign(companyKeypair);

        console.log(`[COMPANY SEND] 트랜잭션 서명 완료`);

        // 10. 트랜잭션 전송 및 확인
        signature = await connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
        });

        console.log(`[COMPANY SEND] 트랜잭션 전송 완료: ${signature}`);

        // 11. 트랜잭션 확인 대기
        await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight
        }, 'confirmed');

        console.log(`[COMPANY SEND] 트랜잭션 확인 완료: ${signature}`);

        return {
            success: true,
            signature,
            error: null
        };

    } catch (error) {
        console.error('[COMPANY SEND] 전송 실패:', error);

        return {
            success: false,
            signature,
            error: error.message || '전송 중 오류가 발생했습니다.'
        };
    }
}

/**
 * ============================================
 * 다중 전송 처리 함수
 * ============================================
 */

/**
 * 요청 생성 (마스터 + 상세 테이블)
 * @param {Object} params
 * @param {string} params.cate1 - 카테고리 1
 * @param {string} params.cate2 - 카테고리 2
 * @param {Array<{wallet_address: string, amount: number}>} params.recipients - 수신자 배열
 * @returns {Promise<{request_id: string}>}
 */
export async function createCompanySendRequest({ cate1, cate2, recipients }) {
    try {
        // 1. request_id 생성
        const request_id = crypto.randomUUID();

        console.log(`[COMPANY SEND] 요청 생성: ${request_id}`);

        // 2. 마스터 테이블에 요청 생성
        await createSendRequest({
            request_id,
            cate1,
            cate2,
            total_count: recipients.length
        });

        // 3. 상세 테이블에 수신자 정보 저장
        await insertSendDetails(request_id, recipients);

        console.log(`[COMPANY SEND] 요청 생성 완료: ${request_id}, 수신자 ${recipients.length}명`);

        return { request_id };

    } catch (error) {
        console.error('[COMPANY SEND] 요청 생성 실패:', error);
        throw error;
    }
}

/**
 * 단일 수신자 처리 (재시도 포함)
 * @param {number} detailIdx - r_send_detail.idx
 * @param {string} walletAddress - 수신자 지갑 주소 (복호화된 값)
 * @param {number} amount - 전송 금액
 * @param {string} request_id - 요청 ID
 * @param {Object} reqMeta - 요청 메타 정보
 * @returns {Promise<{success: boolean, signature: string|null}>}
 */
async function processOneRecipient(detailIdx, walletAddress, amount, request_id, reqMeta) {
    let lastError = null;
    let signature = null;

    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
        console.log(`[COMPANY SEND] 전송 시도 ${attempt}/${MAX_RETRY}: ${walletAddress}`);

        // 1. 토큰 전송
        const result = await transferToken(walletAddress, amount);

        if (result.success) {
            // 2-1. 성공 시
            signature = result.signature;

            // 에러 메시지 길이 제한 (500자)
            const truncatedError = lastError
                ? (lastError.length > 500 ? lastError.substring(0, 500) + '...' : lastError)
                : '전송 실패';

            await updateDetailResult(detailIdx, {
                success: true,
                tx_signature: signature,
                result_code: '200',
                error_message: null
            });

            // 로그 기록
            await insertLog({
                cate1: 'company_send',
                cate2: 'transfer',
                request_id,
                service_key_id: reqMeta.service_key_id || null,
                req_ip_text: reqMeta.ip || '0.0.0.0',
                req_server: reqMeta.server || null,
                req_status: 'Y',
                api_name: 'companySend/transfer',
                api_parameter: null,
                result_code: '200',
                latency_ms: null,
                error_code: null,
                error_message: null,
                content: `signature=${signature}`
            });

            console.log(`[COMPANY SEND] 전송 성공: ${walletAddress}, signature=${signature}`);

            return { success: true, signature };

        } else {
            // 2-2. 실패 시
            lastError = result.error;

            // 마지막 시도가 아니면 재시도
            if (attempt < MAX_RETRY) {
                console.log(`[COMPANY SEND] 재시도 대기 중... (${RETRY_DELAY}ms)`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
        }
    }

    // 3. 모든 재시도 실패
    await updateDetailResult(detailIdx, {
        success: false,
        result_code: '500',
        error_message: lastError || '전송 실패'
    });

    // 로그 기록
    await insertLog({
        cate1: 'company_send',
        cate2: 'transfer',
        request_id,
        service_key_id: reqMeta.service_key_id || null,
        req_ip_text: reqMeta.ip || '0.0.0.0',
        req_server: reqMeta.server || null,
        req_status: 'Y',
        api_name: 'companySend/transfer',
        api_parameter: null,
        result_code: '500',
        latency_ms: null,
        error_code: 'TRANSFER_FAILED',
        error_message: lastError,
        content: null
    });

    console.error(`[COMPANY SEND] 전송 실패 (최종): ${walletAddress}, error=${lastError}`);

    return { success: false, signature: null };
}

/**
 * 다중 전송 처리 (비동기 백그라운드) - 동시 처리 버전
 * @param {string} request_id - 요청 ID
 * @param {Object} reqMeta - 요청 메타 정보
 * @returns {Promise<void>}
 */
export async function processCompanySend(request_id, reqMeta) {
    try {
        console.log(`[COMPANY SEND] 백그라운드 처리 시작: ${request_id}`);

        // 1. 상태를 PROCESSING으로 변경
        await setMasterStatus(request_id, SEND_STATUS.PROCESSING);

        // 2. 미전송 항목 조회
        const pendingDetails = await listPendingDetails(request_id, 1000);

        console.log(`[COMPANY SEND] 미전송 항목: ${pendingDetails.length}개`);

        if (pendingDetails.length === 0) {
            console.log(`[COMPANY SEND] 전송할 항목이 없습니다: ${request_id}`);
            await setMasterStatus(request_id, SEND_STATUS.DONE);
            return;
        }

        // 3. 동시 처리 설정
        const CONCURRENT_LIMIT = parseInt(process.env.COMPANY_SEND_CONCURRENT_LIMIT || '3', 10);

        console.log(`[COMPANY SEND] 동시 처리 개수: ${CONCURRENT_LIMIT}`);

        // 4. 배치 단위로 동시 처리
        for (let i = 0; i < pendingDetails.length; i += CONCURRENT_LIMIT) {
            const batch = pendingDetails.slice(i, i + CONCURRENT_LIMIT);

            console.log(`[COMPANY SEND] 배치 처리 중: ${i + 1}-${Math.min(i + CONCURRENT_LIMIT, pendingDetails.length)}/${pendingDetails.length}`);

            // 배치 내 항목들을 동시에 처리
            await Promise.all(batch.map(detail =>
                processOneRecipient(
                    detail.idx,
                    detail.wallet_address,
                    detail.amount,
                    request_id,
                    reqMeta
                )
            ));

            // 중간 통계 갱신 (매 배치마다)
            await refreshMasterStats(request_id);
        }

        // 5. 최종 통계 갱신
        await refreshMasterStats(request_id);

        // 6. 상태를 DONE으로 변경
        await setMasterStatus(request_id, SEND_STATUS.DONE);

        console.log(`[COMPANY SEND] 백그라운드 처리 완료: ${request_id}`);

    } catch (error) {
        console.error(`[COMPANY SEND] 백그라운드 처리 오류: ${request_id}`, error);

        // 상태를 ERROR로 변경
        await setMasterStatus(request_id, SEND_STATUS.ERROR);

        // 로그 기록
        await insertLog({
            cate1: 'company_send',
            cate2: 'process',
            request_id,
            service_key_id: reqMeta.service_key_id || null,
            req_ip_text: reqMeta.ip || '0.0.0.0',
            req_server: reqMeta.server || null,
            req_status: 'Y',
            api_name: 'companySend/process',
            api_parameter: null,
            result_code: '500',
            latency_ms: null,
            error_code: 'PROCESS_ERROR',
            error_message: error.message,
            content: null
        });
    }
}

/**
 * 전송 상태 조회
 * @param {string} request_id - 요청 ID
 * @returns {Promise<Object>} 상태 정보
 */
export async function getCompanySendStatus(request_id) {
    try {
        const status = await getRequestStatus(request_id);

        if (!status) {
            return null;
        }

        return status;

    } catch (error) {
        console.error('[COMPANY SEND] 상태 조회 실패:', error);
        throw error;
    }
}

/**
 * Export
 */
export default {
    createCompanySendRequest,
    processCompanySend,
    getCompanySendStatus
};