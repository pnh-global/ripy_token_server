// config/db.js

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 현재 파일의 디렉토리 경로 가져오기
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 테스트 환경이면 .env.test 파일 사용
if (process.env.NODE_ENV === 'test') {
    dotenv.config({ path: join(__dirname, '../../.env.test') });
} else {
    dotenv.config();
}

// Connection Pool 생성
export const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    // UTF-8 문자셋 설정 (utf8mb4 사용)
    // utf8mb4: MySQL/MariaDB에서 완전한 UTF-8 지원 (이모지 포함)
    // utf8mb4_unicode_ci: 대소문자 구분 없는 정렬 (Case Insensitive)
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    namedPlaceholders: true,
});

/**
 * query 함수 추가
 * - pool.query를 래핑한 헬퍼 함수
 * - controller에서 직접 사용 가능
 *
 * @param {string} sql - 실행할 SQL 쿼리
 * @param {Array} params - 쿼리 파라미터
 * @returns {Promise} - 쿼리 실행 결과
 */
export async function query(sql, params) {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.query(sql, params);
        return [rows];
    } finally {
        connection.release();
    }
}

/**
 * executeQuery 함수
 * - namedPlaceholders를 지원하는 쿼리 실행 함수
 * - Model 레이어에서 사용
 *
 * @param {string} sql - 실행할 SQL 쿼리
 * @param {Object} params - Named placeholder 파라미터 객체
 * @returns {Promise<Array>} - [rows, fields]
 */
export async function executeQuery(sql, params = {}) {
    const connection = await pool.getConnection();
    try {
        const result = await connection.query(sql, params);
        return result;
    } catch (error) {
        console.error('[DB] Query execution error:', error.message);
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * getConnection 함수
 * - DB 연결 풀에서 연결 객체를 가져오는 함수
 * - 트랜잭션 사용 시 필요
 *
 * @returns {Promise<Connection>} MySQL 연결 객체
 */
export async function getConnection() {
    try {
        const connection = await pool.getConnection();
        return connection;
    } catch (error) {
        console.error('[DB] Connection error:', error.message);
        throw new Error('데이터베이스 연결을 가져오는데 실패했습니다.');
    }
}

/**
 * beginTransaction 함수
 * - 트랜잭션을 시작하고 연결 객체를 반환하는 함수
 *
 * @returns {Promise<Connection>} 트랜잭션이 시작된 MySQL 연결 객체
 */
export async function beginTransaction() {
    const connection = await getConnection();
    try {
        await connection.beginTransaction();
        return connection;
    } catch (error) {
        connection.release();
        console.error('[DB] Transaction start error:', error.message);
        throw new Error('트랜잭션 시작에 실패했습니다.');
    }
}

/**
 * closePool 함수
 * - 연결 풀 종료 (테스트 환경에서 사용)
 *
 * @returns {Promise<void>}
 */
export async function closePool() {
    if (pool) {
        await pool.end();
        console.log('[DB] 연결 풀 종료');
    }
}

export default pool;