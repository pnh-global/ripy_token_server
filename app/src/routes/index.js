/**
 * routes/index.js
 *
 * 모든 라우트를 통합하는 메인 라우터
 */

import { Router } from 'express';
import healthRoutes from './health.routes.js';
import signRoutes from './sign.routes.js';
// import contractRoutes from './contract.routes.js';  // 향후 추가
// import solanaRoutes from './solana.routes.js';      // 향후 추가
// import keyRoutes from './key.routes.js';            // 향후 추가
// import logRoutes from './log.routes.js';            // 향후 추가

const router = Router();

/**
 * 라우트 등록
 */
router.use('/health', healthRoutes);
router.use('/api/sign', signRoutes);
// router.use('/api/contract', contractRoutes);
// router.use('/api/solana', solanaRoutes);
// router.use('/api/key', keyRoutes);
// router.use('/api/log', logRoutes);

export default router;