/**
 * Logger Utility
 *
 * Winston 기반 로거
 * - 콘솔 + 파일 로그 저장
 * - 로그 레벨별 분리 (info, warn, error)
 * - 날짜별 로그 파일 로테이션
 *
 * @module utils/logger
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// __dirname 설정 (ES Module 환경)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 로그 디렉토리 경로
const logsDir = path.join(__dirname, '../../logs');

// logs 디렉토리가 없으면 생성
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * 로그 포맷 정의
 * - timestamp: 타임스탬프 추가
 * - errors: 에러 스택 트레이스 포함
 * - json: JSON 형식
 * - printf: 커스텀 포맷
 */
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;

        // 메타데이터가 있으면 추가
        if (Object.keys(meta).length > 0) {
            logMessage += ` ${JSON.stringify(meta)}`;
        }

        return logMessage;
    })
);

/**
 * Daily Rotate File Transport 설정 (Combined 로그)
 * - 모든 레벨의 로그를 저장
 * - 날짜별로 파일 로테이션
 * - 최대 14일 보관
 */
const combinedFileTransport = new DailyRotateFile({
    filename: path.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d', // 14일간 보관
    format: logFormat,
    level: 'info'
});

/**
 * Daily Rotate File Transport 설정 (Error 로그)
 * - error 레벨 로그만 저장
 * - 날짜별로 파일 로테이션
 * - 최대 30일 보관
 */
const errorFileTransport = new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '30d', // 30일간 보관
    format: logFormat,
    level: 'error'
});

/**
 * Console Transport 설정
 * - 개발 환경에서 콘솔 출력
 * - 컬러 포맷 적용
 */
const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            let logMessage = `${timestamp} [${level}]: ${message}`;

            // 메타데이터가 있으면 추가
            if (Object.keys(meta).length > 0) {
                logMessage += ` ${JSON.stringify(meta)}`;
            }

            return logMessage;
        })
    )
});

/**
 * Winston Logger 인스턴스 생성
 *
 * @example
 * import logger from './utils/logger.js';
 *
 * logger.info('Server started', { port: 3000 });
 * logger.warn('Deprecated API used', { endpoint: '/old-api' });
 * logger.error('Database connection failed', { error: err.message });
 */
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info', // 환경변수로 로그 레벨 설정
    format: logFormat,
    transports: [
        combinedFileTransport,
        errorFileTransport,
        consoleTransport
    ],
    // 처리되지 않은 예외 및 거부된 Promise 로깅
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log')
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'rejections.log')
        })
    ]
});

/**
 * 개발 환경이 아닌 경우 콘솔 로그 비활성화
 */
if (process.env.NODE_ENV === 'production') {
    logger.remove(consoleTransport);
}

/**
 * 기본 export
 */
export default logger;