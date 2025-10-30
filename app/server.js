/**
 * ============================================
 * RIPY Token Server - Main Entry Point
 * ============================================
 *
 * 역할:
 * - Express 서버 초기화
 * - 미들웨어 설정
 * - 라우터 연결
 * - 에러 핸들링
 */

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

// 환경변수 로드
dotenv.config();

// Router 임포트
import solanaRoutes from './src/routes/solana.routes.js';

// Express 앱 생성
const app = express();

// 포트 설정
const PORT = process.env.PORT || 4000;

/**
 * ============================================
 * 미들웨어 설정
 * ============================================
 */

// CORS 설정
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}));

// JSON 파싱
app.use(express.json({ limit: '10mb' }));

// URL-encoded 파싱
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 요청 로깅 (개발 환경)
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
    });
}

/**
 * ============================================
 * 라우터 연결
 * ============================================
 */

// Solana API 라우터
app.use('/api/solana', solanaRoutes);

// 루트 경로
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'RIPY Token Server API',
        version: '1.0.0',
        endpoints: {
            health: '/api/solana/health',
            partial_sign: 'POST /api/solana/partial-sign',
            send_signed: 'POST /api/solana/send-signed',
            bulk_transfer: 'POST /api/solana/bulk-transfer',
            balance: 'GET /api/solana/balance/:wallet_address',
            transaction: 'GET /api/solana/transaction/:signature',
            sol_balance: 'GET /api/solana/sol-balance/:wallet_address'
        }
    });
});

/**
 * ============================================
 * 에러 핸들링
 * ============================================
 */

// 404 핸들러
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '요청하신 엔드포인트를 찾을 수 없습니다.',
        path: req.path
    });
});

// 전역 에러 핸들러
app.use((err, req, res, next) => {
    console.error('서버 에러:', err);

    res.status(err.status || 500).json({
        success: false,
        error: err.name || 'INTERNAL_ERROR',
        message: err.message || '서버 내부 오류가 발생했습니다.',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

/**
 * ============================================
 * 서버 시작
 * ============================================
 */

app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('RIPY Token Server Started');
    console.log('========================================');
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Port: ${PORT}`);
    console.log(`Listening on: 0.0.0.0:${PORT}`);  // 수정됨
    console.log(`Solana Network: ${process.env.SOLANA_NETWORK || 'devnet'}`);
    console.log(`RPC URL: ${process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'}`);
    console.log('========================================');
    console.log(`Server is running on http://0.0.0.0:${PORT}`);  // 수정됨
    console.log(`API Documentation: http://localhost:${PORT}/`);
    console.log(`Health Check: http://localhost:${PORT}/api/solana/health`);
    console.log('========================================');
});

// Graceful Shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM 신호를 받았습니다. 서버를 종료합니다.');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT 신호를 받았습니다. 서버를 종료합니다.');
    process.exit(0);
});

export default app;