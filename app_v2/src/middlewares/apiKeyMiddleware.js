/**
 * apiKeyMiddleware.js
 *
 * API Key 인증 미들웨어
 * - Service Key 검증
 * - IP 제한 확인 (CIDR 기반)
 * - 사용 기록 업데이트
 */

import crypto from 'crypto';  // 🔥 이 줄 추가!
import { verifyServiceKey, updateLastUsed } from '../models/serviceKeys.model.js';
import { Netmask } from 'netmask';

/**
 * IP 주소가 허용된 CIDR 범위에 포함되는지 확인
 *
 * @param {string} ip - 확인할 IP 주소
 * @param {Array<string>} allowCidrs - 허용된 CIDR 목록
 * @returns {boolean} 허용되면 true, 아니면 false
 */
function isIpAllowed(ip, allowCidrs) {
    // allow_cidrs가 비어있으면 모든 IP 허용
    if (!allowCidrs || allowCidrs.length === 0) {
        return true;
    }

    // CIDR 목록 중 하나라도 일치하면 허용
    for (const cidr of allowCidrs) {
        try {
            const block = new Netmask(cidr);
            if (block.contains(ip)) {
                return true;
            }
        } catch (error) {
            console.error(`Invalid CIDR: ${cidr}`, error);
            continue;
        }
    }

    return false;
}

/**
 * API Key 인증 미들웨어
 *
 * @param {Object} req - Express Request 객체
 * @param {Object} res - Express Response 객체
 * @param {Function} next - Next 미들웨어 함수
 */
export async function apiKeyMiddleware(req, res, next) {
    try {
        // 1. API Key 헤더 확인
        const apiKey = req.headers['x-api-key'];
        console.log('[API KEY DEBUG] Received API Key:', apiKey);

        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'MISSING_API_KEY',
                    message: 'API Key가 필요합니다.'
                }
            });
        }

        // 2. API Key를 SHA-256으로 해싱
        const keyHash = crypto.createHash('sha256')
            .update(apiKey)
            .digest('hex')
            .toUpperCase();

        console.log('[API KEY DEBUG] Calculated Hash:', keyHash);

        // 3. Service Key 검증 (DB 조회)
        const keyInfo = await verifyServiceKey(keyHash);
        console.log('[API KEY DEBUG] Key Info:', keyInfo ? 'FOUND' : 'NOT FOUND');

        if (!keyInfo) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_API_KEY',
                    message: '유효하지 않은 API Key입니다.'
                }
            });
        }

        // 4. IP 주소 확인
        const clientIp = req.ip || req.connection.remoteAddress;

        if (!isIpAllowed(clientIp, keyInfo.allow_cidrs)) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'IP_NOT_ALLOWED',
                    message: '허용되지 않은 IP 주소입니다.'
                }
            });
        }

        // 5. 요청 객체에 키 정보 저장
        req.serviceKey = keyInfo;

        // 6. 사용 기록 업데이트
        if (process.env.NODE_ENV === 'test') {
            await updateLastUsed(keyInfo.idx, clientIp, req.hostname);
        } else {
            updateLastUsed(keyInfo.idx, clientIp, req.hostname).catch(error => {
                console.error('Failed to update last used:', error);
            });
        }

        console.log('[API KEY DEBUG] Authentication SUCCESS');

        // 7. 다음 미들웨어로 진행
        next();

    } catch (error) {
        console.error('apiKeyMiddleware error:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: '서버 내부 오류가 발생했습니다.'
            }
        });
    }
}