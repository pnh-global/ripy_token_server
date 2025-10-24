/**
 * ============================================
 * ipHelper.js - IP 주소 변환 유틸리티
 * ============================================
 *
 * 역할:
 * 1. IP 주소(텍스트) -> Binary(VARBINARY) 변환
 * 2. Binary -> IP 주소(텍스트) 변환
 *
 * 왜 필요한가?
 * - r_log, r_blind, service_keys 테이블에서 IP를 VARBINARY(16)로 저장
 * - IPv4/IPv6 모두 지원
 * - 검색 성능 향상
 */

/**
 * IP 주소(텍스트) -> Binary 변환
 *
 * @param {string} ipText - IP 주소 (예: '192.168.1.1')
 * @returns {Buffer} - Binary 형태의 IP
 */
export function ipToBinary(ipText) {
    try {
        // IPv4 처리
        const parts = ipText.split('.').map(Number);
        if (parts.length !== 4 || parts.some(p => p < 0 || p > 255)) {
            throw new Error('유효하지 않은 IPv4 주소');
        }

        // Buffer 생성 (4바이트)
        return Buffer.from(parts);

    } catch (error) {
        console.error('[IP HELPER ERROR] IP -> Binary 변환 실패:', error.message);
        throw error;
    }
}

/**
 * Binary -> IP 주소(텍스트) 변환
 *
 * @param {Buffer} binary - Binary 형태의 IP
 * @returns {string} - IP 주소 텍스트
 */
export function binaryToIp(binary) {
    try {
        if (!Buffer.isBuffer(binary)) {
            throw new Error('Buffer 타입이 아닙니다');
        }

        // IPv4 (4바이트)
        if (binary.length === 4) {
            return Array.from(binary).join('.');
        }

        throw new Error('유효하지 않은 Binary IP 길이');

    } catch (error) {
        console.error('[IP HELPER ERROR] Binary -> IP 변환 실패:', error.message);
        throw error;
    }
}

/**
 * Express Request에서 클라이언트 IP 추출
 *
 * @param {Object} req - Express Request 객체
 * @returns {string} - 클라이언트 IP 주소
 */
export function getClientIp(req) {
    // X-Forwarded-For 헤더 확인 (Nginx 사용 시)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }

    // X-Real-IP 헤더 확인
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
        return realIp;
    }

    // 기본: req.ip
    return req.ip || req.connection?.remoteAddress || '0.0.0.0';
}

/**
 * IP가 CIDR 범위에 포함되는지 확인
 *
 * @param {string} ip - 확인할 IP 주소
 * @param {string} cidr - CIDR 표기 (예: '192.168.1.0/24')
 * @returns {boolean} - 포함 여부
 */
export function isIpInCIDR(ip, cidr) {
    try {
        const [range, bits] = cidr.split('/');
        const mask = ~(2 ** (32 - parseInt(bits)) - 1);

        const ipNum = ipToNumber(ip);
        const rangeNum = ipToNumber(range);

        return (ipNum & mask) === (rangeNum & mask);

    } catch (error) {
        console.error('[IP HELPER ERROR] CIDR 확인 실패:', error.message);
        return false;
    }
}

/**
 * IP 주소를 숫자로 변환 (CIDR 계산용)
 *
 * @param {string} ip - IP 주소
 * @returns {number} - 숫자 형태의 IP
 */
function ipToNumber(ip) {
    return ip.split('.')
        .reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
}