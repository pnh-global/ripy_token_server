/**
 * Logger Utility 테스트
 *
 * winston 기반 로거 테스트
 * - 로그 레벨별 테스트 (info, warn, error)
 * - 파일 생성 확인
 */

import logger from '../logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname 설정 (ES Module 환경)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 로그 디렉토리 경로
const logsDir = path.join(__dirname, '../../../logs');

describe('Logger Utils', () => {
    describe('logger 객체', () => {
        test('logger가 정의되어 있어야 함', () => {
            expect(logger).toBeDefined();
        });

        test('info 메서드가 존재해야 함', () => {
            expect(typeof logger.info).toBe('function');
        });

        test('warn 메서드가 존재해야 함', () => {
            expect(typeof logger.warn).toBe('function');
        });

        test('error 메서드가 존재해야 함', () => {
            expect(typeof logger.error).toBe('function');
        });
    });

    describe('로그 레벨', () => {
        test('info 로그를 출력할 수 있어야 함', () => {
            expect(() => {
                logger.info('Test info message');
            }).not.toThrow();
        });

        test('warn 로그를 출력할 수 있어야 함', () => {
            expect(() => {
                logger.warn('Test warning message');
            }).not.toThrow();
        });

        test('error 로그를 출력할 수 있어야 함', () => {
            expect(() => {
                logger.error('Test error message');
            }).not.toThrow();
        });

        test('메타데이터와 함께 로그를 출력할 수 있어야 함', () => {
            expect(() => {
                logger.info('Test with metadata', {
                    userId: 123,
                    action: 'test'
                });
            }).not.toThrow();
        });
    });

    describe('로그 파일 생성', () => {
        test('logs 디렉토리가 생성되어야 함', () => {
            logger.info('Creating logs directory test');
            expect(fs.existsSync(logsDir)).toBe(true);
        });

        test('로그 파일이 생성되어야 함', (done) => {
            logger.info('Test log file creation');
            logger.error('Test error log file creation');

            // 파일 생성 대기
            setTimeout(() => {
                const files = fs.readdirSync(logsDir);

                // 로그 파일이 하나 이상 있어야 함
                const hasLogFiles = files.some(file => file.endsWith('.log'));
                expect(hasLogFiles).toBe(true);

                done();
            }, 300);
        });
    });

    describe('로그 포맷', () => {
        test('에러 객체를 로그할 수 있어야 함', () => {
            const testError = new Error('Test error object');

            expect(() => {
                logger.error('Error with stack', {
                    error: testError.message,
                    stack: testError.stack
                });
            }).not.toThrow();
        });
    });
});