/**
 * ipHelper.js
 *
 * IP 주소 관련 유틸리티 함수
 */

/**
 * 클라이언트의 실제 IP 주소를 가져오는 함수
 * 프록시 환경에서도 올바른 IP를 추출
 *
 * @param {Object} req - Express request 객체
 * @returns {string} 클라이언트 IP 주소
 */
export function getClientIp(req) {
    // X-Forwarded-For 헤더 확인 (프록시 환경)
    const forwarded = req.headers['x-forwarded-for'];

    if (forwarded) {
        // X-Forwarded-For는 쉼표로 구분된 IP 목록일 수 있음
        // 첫 번째 IP가 실제 클라이언트 IP
        return forwarded.split(',')[0].trim();
    }

    // X-Real-IP 헤더 확인 (Nginx 등)
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
        return realIp;
    }

    // req.ip (Express 기본)
    if (req.ip) {
        // IPv6 형식에서 IPv4 추출 (::ffff:127.0.0.1 -> 127.0.0.1)
        return req.ip.replace(/^::ffff:/, '');
    }

    // req.connection.remoteAddress (구형 방식)
    if (req.connection && req.connection.remoteAddress) {
        return req.connection.remoteAddress.replace(/^::ffff:/, '');
    }

    // 기본값
    return '0.0.0.0';
}

/**
 * IP 주소가 유효한 형식인지 검증
 *
 * @param {string} ip - 검증할 IP 주소
 * @returns {boolean} 유효 여부
 */
export function isValidIp(ip) {
    if (!ip || typeof ip !== 'string') {
        return false;
    }

    // IPv4 정규식
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;

    if (ipv4Regex.test(ip)) {
        // 각 옥텟이 0-255 범위인지 확인
        const octets = ip.split('.');
        return octets.every(octet => {
            const num = parseInt(octet, 10);
            return num >= 0 && num <= 255;
        });
    }

    // IPv6는 간단히 콜론 포함 여부로 확인
    return ip.includes(':');
}

/**
 * IP 주소를 정수로 변환 (MySQL INET_ATON 호환)
 *
 * @param {string} ip - IPv4 주소
 * @returns {number|null} 정수 형태의 IP, 실패 시 null
 */
export function ipToInt(ip) {
    if (!isValidIp(ip) || ip.includes(':')) {
        return null; // IPv6는 지원하지 않음
    }

    const octets = ip.split('.').map(o => parseInt(o, 10));

    // 각 옥텟을 왼쪽으로 시프트하여 합산
    return (octets[0] << 24) + (octets[1] << 16) + (octets[2] << 8) + octets[3];
}

/**
 * 정수를 IP 주소로 변환 (MySQL INET_NTOA 호환)
 *
 * @param {number} int - 정수 형태의 IP
 * @returns {string|null} IPv4 주소, 실패 시 null
 */
export function intToIp(int) {
    if (typeof int !== 'number' || int < 0 || int > 4294967295) {
        return null;
    }

    return [
        (int >>> 24) & 255,
        (int >>> 16) & 255,
        (int >>> 8) & 255,
        int & 255
    ].join('.');
}