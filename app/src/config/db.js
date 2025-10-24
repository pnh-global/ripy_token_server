import mysql from 'mysql2/promise';

// .env 파일을 읽어서 환경변수로 만들어주는 패키지
import dotenv from 'dotenv';

dotenv.config();

// 디버그: 환경변수 확인 (개발 시에만)
if (process.env.NODE_ENV === 'development') {
    console.log('[DB CONFIG] 연결 설정:');
    console.log('  Host:', process.env.DB_HOST || 'localhost');
    console.log('  User:', process.env.DB_USER || 'root');
    console.log('  Password:', process.env.DB_PASSWORD ? '설정됨' : '없음');
    console.log('  Database:', process.env.DB_NAME || 'ripy_token');
}

// 커넥션 풀 생성
export const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ripy_token',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    namedPlaceholders: true  // Named Parameters 지원 추가
});

// 연결 테스트 (선택사항)
pool.getConnection()
    .then(connection => {
        console.log('[DB CONFIG] MariaDB 연결 성공');
        connection.release();
    })
    .catch(error => {
        console.error('[DB CONFIG ERROR] MariaDB 연결 실패:', error.message);
    });