/**
 * ============================================
 * db.util.js - 데이터베이스 유틸리티
 * ============================================
 *
 * 역할:
 * - Named Parameters(:name) 방식 쿼리 지원
 * - 자동 커넥션 관리
 * - 에러 핸들링
 *
 * 왜 필요한가?
 * - mysql2는 기본적으로 ? 방식만 지원
 * - Named Parameters가 가독성과 유지보수에 유리
 * - SQL Injection 방지
 *
 * 사용 예시:
 * const [rows] = await exec(
 *   'SELECT * FROM users WHERE id = :id AND name = :name',
 *   { id: 1, name: 'John' }
 * );
 */

import { pool } from '../config/db.js';

/**
 * Named Parameters를 지원하는 쿼리 실행 함수
 *
 * @param {string} sql - SQL 쿼리 (Named Parameters 사용)
 * @param {Object} params - 파라미터 객체
 * @returns {Promise<Array>} - [rows, fields] (mysql2 표준 형식)
 */
export async function exec(sql, params = {}) {
    const connection = await pool.getConnection();

    try {
        const { query, values } = convertNamedParams(sql, params);
        const result = await connection.execute(query, values);
        return result;

    } catch (error) {
        console.error('[DB ERROR] 쿼리 실행 실패:');
        console.error('  SQL:', sql);
        console.error('  Params:', params);
        console.error('  Error:', error.message);
        throw error;

    } finally {
        connection.release();
    }
}

/**
 * Named Parameters를 mysql2 형식(?)으로 변환
 */
function convertNamedParams(sql, params) {
    if (!params || Object.keys(params).length === 0) {
        return { query: sql, values: [] };
    }

    const values = [];
    const query = sql.replace(/:(\w+)/g, (match, paramName) => {
        if (paramName in params) {
            values.push(params[paramName]);
            return '?';
        }
        throw new Error(`Missing parameter: ${paramName}`);
    });

    return { query, values };
}

/**
 * 트랜잭션 실행 헬퍼 함수
 */
export async function transaction(callback) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        const result = await callback(connection);
        await connection.commit();
        return result;

    } catch (error) {
        await connection.rollback();
        console.error('[TRANSACTION ERROR]', error.message);
        throw error;

    } finally {
        connection.release();
    }
}

/**
 * 단순 SELECT 조회 헬퍼
 */
export async function query(sql, params = {}) {
    const [rows] = await exec(sql, params);
    return rows;
}

/**
 * 단일 행 조회 헬퍼
 */
export async function queryOne(sql, params = {}) {
    const rows = await query(sql, params);
    return rows[0] || null;
}

/**
 * INSERT 후 생성된 ID 반환
 */
export async function insert(sql, params = {}) {
    const [result] = await exec(sql, params);
    return result.insertId;
}

/**
 * UPDATE/DELETE 후 영향받은 행 개수 반환
 */
export async function update(sql, params = {}) {
    const [result] = await exec(sql, params);
    return result.affectedRows;
}