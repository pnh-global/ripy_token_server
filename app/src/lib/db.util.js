import { pool } from '../config/db.js';

/**
 * DB 연결 풀에서 연결 객체를 가져오는 함수
 * @returns {Promise<Connection>} MySQL 연결 객체
 * @throws {Error} 연결 실패 시 에러 발생
 *
 * @example
 * const connection = await getConnection();
 * try {
 *   const [rows] = await connection.query('SELECT * FROM users');
 *   return rows;
 * } finally {
 *   connection.release(); // 반드시 연결 해제
 * }
 */
export async function getConnection() {
    try {
        const connection = await pool.getConnection();
        return connection;
    } catch (error) {
        console.error('[DB] Connection error:', error);
        throw new Error('데이터베이스 연결을 가져오는데 실패했습니다.');
    }
}

/**
 * 트랜잭션을 시작하고 연결 객체를 반환하는 함수
 * @returns {Promise<Connection>} 트랜잭션이 시작된 MySQL 연결 객체
 * @throws {Error} 트랜잭션 시작 실패 시 에러 발생
 *
 * @example
 * const connection = await beginTransaction();
 * try {
 *   await connection.query('INSERT INTO users...');
 *   await connection.query('INSERT INTO logs...');
 *   await connection.commit(); // 커밋
 * } catch (error) {
 *   await connection.rollback(); // 롤백
 *   throw error;
 * } finally {
 *   connection.release(); // 연결 해제
 * }
 */
export async function beginTransaction() {
    const connection = await getConnection();
    try {
        await connection.beginTransaction();
        return connection;
    } catch (error) {
        connection.release();
        console.error('[DB] Transaction start error:', error);
        throw new Error('트랜잭션 시작에 실패했습니다.');
    }
}

/**
 * 쿼리를 실행하고 결과를 반환하는 헬퍼 함수
 * @param {string} query - 실행할 SQL 쿼리
 * @param {Array} params - 쿼리 파라미터 배열
 * @returns {Promise<Array>} 쿼리 결과 [rows, fields]
 * @throws {Error} 쿼리 실행 실패 시 에러 발생
 *
 * @example
 * const [rows] = await executeQuery('SELECT * FROM users WHERE id = ?', [userId]);
 */
export async function executeQuery(query, params = []) {
    const connection = await getConnection();
    try {
        const result = await connection.query(query, params);
        return result;
    } catch (error) {
        console.error('[DB] Query execution error:', error);
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * DB 연결 풀의 상태를 확인하는 함수
 * @returns {Promise<Object>} 연결 풀 상태 정보
 *
 * @example
 * const poolStatus = await getPoolStatus();
 * console.log('Active connections:', poolStatus.active);
 */
export async function getPoolStatus() {
    return {
        active: pool._allConnections.length,
        idle: pool._freeConnections.length,
        waiting: pool._connectionQueue.length
    };
}

export async function closePool() {
    if (pool) {
        await pool.end();
        console.log('[DB] 연결 풀 종료');
    }
}