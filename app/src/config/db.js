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
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    namedPlaceholders: true,
});

export default pool;