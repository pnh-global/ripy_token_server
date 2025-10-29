/**
 * createSign.controller.js
 *
 * POST /api/sign/create 엔드포인트
 * 부분 서명 트랜잭션 생성
 *
 * 프로세스:
 * 1. 웹서버로부터 암호화된 데이터 수신
 * 2. 데이터 복호화 및 검증
 * 3. r_contract 테이블에 계약서 생성
 * 4. Solana 부분 서명 트랜잭션 생성 (feepayer 서명)
 * 5. r_log에 로그 기록
 * 6. 암호화된 응답 반환
 */

import { decrypt, encrypt } from '../utils/encryption.js';
import { isSolanaAddress, isValidAmount } from '../utils/validator.js';
import { createContract } from '../models/contract.model.js';
import { insertLog } from '../models/log.model.js';
import { createPartialSignedTransaction } from '../services/solana/transactionService.js';

/**
 * 입력값 검증 함수
 * @param {Object} data - 검증할 데이터
 * @throws {Error} 검증 실패 시
 */
function validateInput(data) {
    // 필수 필드 검증
    const requiredFields = ['cate1', 'cate2', 'sender', 'recipient', 'ripy'];

    for (const field of requiredFields) {
        if (!data[field]) {
            throw new Error(`필수 필드가 누락되었습니다: ${field}`);
        }
    }

    // Solana 주소 검증
    if (!isSolanaAddress(data.sender)) {
        throw new Error('유효하지 않은 발신자 주소입니다.');
    }

    if (!isSolanaAddress(data.recipient)) {
        throw new Error('유효하지 않은 수신자 주소입니다.');
    }

    // 금액 검증
    if (!isValidAmount(data.ripy)) {
        throw new Error('유효하지 않은 금액입니다.');
    }

    return true;
}

/**
 * 부분 서명 트랜잭션 생성 컨트롤러
 *
 * @param {Object} req - Express request 객체
 * @param {Object} req.body.data - 암호화된 요청 데이터
 * @param {Object} req.serviceKey - API Key 미들웨어에서 주입된 서비스 키 정보
 * @param {string} req.ip - 요청자 IP
 * @param {Object} res - Express response 객체
 */
export async function createSign(req, res) {
    const startTime = Date.now();
    let decryptedData = null;
    let contractIdx = null;

    try {
        // 1. 암호화된 데이터 검증
        if (!req.body || !req.body.data) {
            throw new Error('암호화된 data 필드가 필요합니다.');
        }

        // 2. 데이터 복호화 (웹서버의 service key로 암호화된 데이터)
        const decryptedString = decrypt(req.body.data);
        decryptedData = JSON.parse(decryptedString);

        // 3. 입력값 검증
        validateInput(decryptedData);

        // 4. feepayer 주소 설정 (환경변수에서 가져옴)
        const feepayer = process.env.COMPANY_WALLET_ADDRESS;
        if (!feepayer) {
            throw new Error('회사 지갑 주소가 설정되지 않았습니다.');
        }

        // 5. r_contract 테이블에 계약서 생성
        const contract = await createContract({
            cate1: decryptedData.cate1,
            cate2: decryptedData.cate2,
            sender: decryptedData.sender,
            recipient: decryptedData.recipient,
            feepayer: feepayer,
            ripy: decryptedData.ripy,
            signed_or_not1: 'N',  // 아직 발신자 서명 안됨
            signed_or_not2: 'N'   // 아직 수신자 서명 안됨
        });

        contractIdx = contract.idx;

        // 6. Solana 부분 서명 트랜잭션 생성
        const partialSignedTx = await createPartialSignedTransaction({
            sender: decryptedData.sender,
            recipient: decryptedData.recipient,
            amount: parseFloat(decryptedData.ripy),
            feepayer: feepayer
        });

        // 7. 성공 로그 기록
        const latencyMs = Date.now() - startTime;
        await insertLog({
            cate1: decryptedData.cate1,
            cate2: decryptedData.cate2,
            request_id: null,
            service_key_id: req.serviceKey?.idx || null,
            req_ip_text: req.ip || '0.0.0.0',
            req_server: req.hostname || null,
            req_status: 'Y',
            api_name: '/api/sign/create',
            api_parameter: JSON.stringify({
                sender: decryptedData.sender,
                recipient: decryptedData.recipient,
                amount: decryptedData.ripy
            }),
            result_code: '200',
            latency_ms: latencyMs,
            error_code: null,
            error_message: null,
            content: JSON.stringify({ contract_idx: contractIdx })
        });

        // 8. 응답 데이터 구성
        const responseData = {
            contract_idx: contractIdx,
            partial_signed_transaction: partialSignedTx
        };

        // 9. 응답 암호화 및 반환
        const encryptedResponse = encrypt(JSON.stringify(responseData));

        res.status(200).json({
            ok: true,
            data: {
                contract_idx: contractIdx,
                partial_signed_transaction: partialSignedTx
            }
        });

    } catch (error) {
        // 에러 로그 기록
        const latencyMs = Date.now() - startTime;

        await insertLog({
            cate1: decryptedData?.cate1 || 'UNKNOWN',
            cate2: decryptedData?.cate2 || 'UNKNOWN',
            request_id: null,
            service_key_id: req.serviceKey?.idx || null,
            req_ip_text: req.ip || '0.0.0.0',
            req_server: req.hostname || null,
            req_status: 'N',
            api_name: '/api/sign/create',
            api_parameter: null,
            result_code: '400',
            latency_ms: latencyMs,
            error_code: 'CREATE_SIGN_ERROR',
            error_message: error.message,
            content: null
        });

        // 에러 응답
        res.status(400).json({
            ok: false,
            error: error.message
        });
    }
}