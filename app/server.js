/**
 * ============================================
 * RIPY Token Server - Main Entry Point
 * ============================================
 */
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

// 환경변수 로드
dotenv.config();

// ========================================
// Swagger 설정 임포트 ⭐ 추가
// ========================================
import { setupSwagger } from './src/config/swagger.js';

// ========================================
// Router 임포트 (중요!)
// ========================================
import routes from './src/routes/index.js';

// 에러 핸들러 임포트
import { errorHandler } from './src/middlewares/errorHandler.js';

const app = express();

// ========================================
// 미들웨어 설정
// ========================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 요청 로깅 (개발 환경)
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
    });
}

// ========================================
// Swagger 설정 ⭐ 추가
// ========================================
setupSwagger(app);

// ========================================
// 라우터 연결 ⭐ 중요! ⭐
// ========================================
app.use('/', routes);

// ========================================
// 404 핸들러
// ========================================
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '요청하신 엔드포인트를 찾을 수 없습니다.',
        path: req.path
    });
});

// ========================================
// 에러 핸들러
// ========================================
app.use(errorHandler);

// ========================================
// 서버 시작
// ========================================
const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(50));
    console.log('RIPY Token Server Started');
    console.log('='.repeat(50));
    console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
    console.log(`Port: ${PORT}`);
    console.log(`Listening on: 0.0.0.0:${PORT}`);
    console.log(`Solana Network: ${process.env.SOLANA_RPC_ENDPOINT?.includes('devnet') ? 'devnet' : 'mainnet'}`);
    console.log(`RPC URL: ${process.env.SOLANA_RPC_ENDPOINT}`);
    console.log('='.repeat(50));
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
    console.log(`Health Check: http://localhost:${PORT}/health`);
    console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
    console.log('='.repeat(50));
});

// Graceful Shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    process.exit(0);
});