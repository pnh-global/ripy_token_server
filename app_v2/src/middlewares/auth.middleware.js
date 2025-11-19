/**
 * ============================================
 * API 인증 미들웨어
 * ============================================
 *
 * 역할:
 * - 웹서버의 Service Key 검증
 * - API 요청 전에 인증 확인
 * - 허용된 Service Key 목록 관리
 *
 * 사용 방법:
 * import { verifyServiceKey } from '../middlewares/auth.middleware.js';
 * router.post('/api/transfer', verifyServiceKey, transferController);
 */

import crypto from 'crypto';

/**
 * ============================================
 * Service Key 설정
 * ============================================
 *
 * 실제 운영 시에는:
 * 1. NCLOUD Secret Manager에서 가져오기
 * 2. DB의 service_keys 테이블에서 조회
 * 3. Redis 캐시 활용
 *
 * 현재는 환경변수 또는 하드코딩된 목록 사용
 */

/**
 * 허용된 Service Key 목록
 * (실제 운영 시에는 DB 또는 Secret Manager에서 동적으로 로드)
 */
const ALLOWED_SERVICE_KEYS = new Set([
    // 환경변수에서 로드 (여러 개 가능, 쉼표로 구분)
    ...(process.env.ALLOWED_SERVICE_KEYS || '').split(',').filter(key => key.trim()),

    // 개발/테스트용 하드코딩 (운영 환경에서는 제거)
    process.env.NODE_ENV === 'development' ? '6abbc9845aef817022e8ff54fd0c546877795e7d722c42e6a230b04b75111eb8' : null,
].filter(Boolean));

/**
 * Service Key의 해시값 저장 (비교 시 해시 사용 권장)
 * 실제 키를 메모리에 보관하지 않고 해시값만 보관
 */
const ALLOWED_SERVICE_KEY_HASHES = new Set(
    Array.from(ALLOWED_SERVICE_KEYS).map(key =>
        crypto.createHash('sha256').update(key).digest('hex')
    )
);

/**
 * ============================================
 * 1. Service Key 검증 미들웨어
 * ============================================
 *
 * HTTP 요청의 헤더 또는 바디에서 Service Key를 추출하여 검증
 *
 * 검증 방법:
 * 1. 헤더에서 'X-Service-Key' 또는 'Authorization' 추출
 * 2. 바디에서 'service_key' 필드 추출
 * 3. 허용된 키 목록과 비교
 *
 * @param {Object} req - Express Request 객체
 * @param {Object} res - Express Response 객체
 * @param {Function} next - 다음 미들웨어로 진행
 *
 * @example
 * // 라우터에서 사용
 * router.post('/api/transfer', verifyServiceKey, async (req, res) => {
 *   // Service Key 검증 통과한 경우에만 실행됨
 *   res.json({ success: true });
 * });
 */
export function verifyServiceKey(req, res, next) {
    try {
        // 1. Service Key 추출
        let serviceKey = null;

        // 방법 1: 헤더에서 추출 (권장)
        if (req.headers['x-service-key']) {
            serviceKey = req.headers['x-service-key'];
        }
        // 방법 2: Authorization 헤더에서 추출
        else if (req.headers['authorization']) {
            // "Bearer <service_key>" 형식
            const authHeader = req.headers['authorization'];
            if (authHeader.startsWith('Bearer ')) {
                serviceKey = authHeader.substring(7);
            }
        }
        // 방법 3: Request Body에서 추출 (비권장, 하지만 호환성을 위해 지원)
        else if (req.body && req.body.service_key) {
            serviceKey = req.body.service_key;
        }

        // 2. Service Key가 없으면 거부
        if (!serviceKey) {
            return res.status(401).json({
                success: false,
                error: 'UNAUTHORIZED',
                message: 'Service Key가 제공되지 않았습니다.'
            });
        }

        // 3. Service Key 검증
        if (!isValidServiceKey(serviceKey)) {
            return res.status(403).json({
                success: false,
                error: 'FORBIDDEN',
                message: '유효하지 않은 Service Key입니다.'
            });
        }

        // 4. 검증 통과 - 다음 미들웨어로 진행
        // Service Key를 req 객체에 저장 (이후 컨트롤러에서 사용 가능)
        req.serviceKey = serviceKey;
        next();

    } catch (error) {
        console.error('Service Key 검증 중 오류:', error);
        return res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: '인증 처리 중 오류가 발생했습니다.'
        });
    }
}

/**
 * ============================================
 * 2. Service Key 유효성 확인
 * ============================================
 *
 * 제공된 Service Key가 허용 목록에 있는지 확인
 *
 * @param {string} serviceKey - 검증할 Service Key
 * @returns {boolean} 유효성 여부
 *
 * @example
 * if (isValidServiceKey('6abbc9845aef...')) {
 *   console.log('유효한 키입니다.');
 * }
 */
export function isValidServiceKey(serviceKey) {
    if (!serviceKey || typeof serviceKey !== 'string') {
        return false;
    }

    // 방법 1: 직접 비교 (개발 환경)
    if (ALLOWED_SERVICE_KEYS.has(serviceKey)) {
        return true;
    }

    // 방법 2: 해시값 비교 (운영 환경 권장)
    const keyHash = crypto.createHash('sha256').update(serviceKey).digest('hex');
    if (ALLOWED_SERVICE_KEY_HASHES.has(keyHash)) {
        return true;
    }

    return false;
}

/**
 * ============================================
 * 3. Service Key 목록 관리 함수들
 * ============================================
 */

/**
 * Service Key 추가
 * (관리자 API에서 사용)
 *
 * @param {string} newKey - 추가할 Service Key
 * @returns {boolean} 추가 성공 여부
 *
 * @example
 * const newKey = '새로운_서비스키...';
 * addServiceKey(newKey);
 */
export function addServiceKey(newKey) {
    if (!newKey || typeof newKey !== 'string') {
        return false;
    }

    ALLOWED_SERVICE_KEYS.add(newKey);

    const keyHash = crypto.createHash('sha256').update(newKey).digest('hex');
    ALLOWED_SERVICE_KEY_HASHES.add(keyHash);

    return true;
}

/**
 * Service Key 제거
 * (관리자 API에서 사용)
 *
 * @param {string} keyToRemove - 제거할 Service Key
 * @returns {boolean} 제거 성공 여부
 *
 * @example
 * const oldKey = '기존_서비스키...';
 * removeServiceKey(oldKey);
 */
export function removeServiceKey(keyToRemove) {
    if (!keyToRemove) {
        return false;
    }

    ALLOWED_SERVICE_KEYS.delete(keyToRemove);

    const keyHash = crypto.createHash('sha256').update(keyToRemove).digest('hex');
    ALLOWED_SERVICE_KEY_HASHES.delete(keyHash);

    return true;
}

/**
 * 현재 등록된 Service Key 개수 조회
 *
 * @returns {number} Service Key 개수
 *
 * @example
 * console.log('등록된 Service Key:', getServiceKeyCount());
 */
export function getServiceKeyCount() {
    return ALLOWED_SERVICE_KEYS.size;
}

/**
 * ============================================
 * 4. IP 화이트리스트 검증 (선택사항)
 * ============================================
 *
 * 특정 IP에서만 API 호출 허용
 *
 * @param {Object} req - Express Request 객체
 * @param {Object} res - Express Response 객체
 * @param {Function} next - 다음 미들웨어로 진행
 *
 * @example
 * // 라우터에서 사용
 * router.post('/api/transfer', verifyIPWhitelist, verifyServiceKey, transferController);
 */
export function verifyIPWhitelist(req, res, next) {
    try {
        // 허용된 IP 목록 (환경변수에서 로드)
        const allowedIPs = (process.env.ALLOWED_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean);

        // IP 화이트리스트가 설정되지 않은 경우 모두 허용
        if (allowedIPs.length === 0) {
            return next();
        }

        // 클라이언트 IP 추출
        const clientIP = req.ip ||
            req.headers['x-forwarded-for']?.split(',')[0].trim() ||
            req.connection.remoteAddress;

        // IP 검증
        if (!allowedIPs.includes(clientIP)) {
            return res.status(403).json({
                success: false,
                error: 'FORBIDDEN',
                message: '허용되지 않은 IP 주소입니다.'
            });
        }

        next();

    } catch (error) {
        console.error('IP 검증 중 오류:', error);
        return res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'IP 검증 중 오류가 발생했습니다.'
        });
    }
}

/**
 * ============================================
 * 5. Rate Limiting (선택사항)
 * ============================================
 *
 * API 호출 횟수 제한
 * (실제 운영 시에는 express-rate-limit 패키지 권장)
 *
 * @example
 * import rateLimit from 'express-rate-limit';
 *
 * const limiter = rateLimit({
 *   windowMs: 15 * 60 * 1000, // 15분
 *   max: 100, // 최대 100회
 *   message: 'API 호출 한도를 초과했습니다.'
 * });
 *
 * router.post('/api/transfer', limiter, verifyServiceKey, transferController);
 */

/**
 * 기본 export
 */
export default {
    verifyServiceKey,
    isValidServiceKey,
    addServiceKey,
    removeServiceKey,
    getServiceKeyCount,
    verifyIPWhitelist
};