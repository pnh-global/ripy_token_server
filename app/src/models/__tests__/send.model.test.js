/**
 * ============================================
 * send.model.test.js - send.model 테스트
 * ============================================
 *
 * 실행 방법:
 * node src/models/__tests__/send.model.test.js
 */

import { v4 as uuidv4 } from 'uuid';
import {
    createSendRequest,
    getRequestStatus,
    setMasterStatus,
    insertSendDetails,
    listPendingDetails,
    updateDetailResult,
    refreshMasterStats
} from '../send.model.js';

console.log('send.model 테스트 시작\n');

async function runTests() {
    try {
        // 테스트 데이터 준비
        const requestId = uuidv4();
        console.log('테스트 UUID:', requestId, '\n');

        // 테스트 1: 마스터 생성
        console.log('[TEST 1] 일괄 전송 요청 생성');
        await createSendRequest({
            request_id: requestId,
            cate1: 'test',
            cate2: 'model_test',
            total_count: 3
        });
        console.log('성공\n');

        // 테스트 2: 상세 생성 (3명)
        console.log('[TEST 2] 수신자 상세 정보 생성');
        await insertSendDetails(requestId, [
            { wallet_address: 'TestWallet1ABC123', amount: 10 },
            { wallet_address: 'TestWallet2DEF456', amount: 20 },
            { wallet_address: 'TestWallet3GHI789', amount: 15 }
        ]);
        console.log('성공 - 3명의 수신자 정보 생성 (암호화됨)\n');

        // 테스트 3: 마스터 조회
        console.log('[TEST 3] 요청 상태 조회');
        const status = await getRequestStatus(requestId);
        console.log('상태:', status);
        console.log('성공\n');

        // 테스트 4: 전송 대상 조회
        console.log('[TEST 4] 전송 대상 조회 (복호화)');
        const pending = await listPendingDetails(requestId, 10);
        console.log('대상 수:', pending.length);
        console.log('첫 번째 수신자:', pending[0]);
        console.log('성공 - 지갑 주소 복호화됨\n');

        // 테스트 5: 전송 결과 업데이트 (성공)
        console.log('[TEST 5] 전송 성공 처리');
        await updateDetailResult(pending[0].idx, {
            success: true,
            result_code: '200',
            error_message: null
        });
        console.log('성공\n');

        // 테스트 6: 전송 결과 업데이트 (실패)
        console.log('[TEST 6] 전송 실패 처리');
        await updateDetailResult(pending[1].idx, {
            success: false,
            result_code: '500',
            error_message: 'RPC timeout'
        });
        console.log('성공\n');

        // 테스트 7: 통계 갱신
        console.log('[TEST 7] 마스터 통계 갱신');
        await refreshMasterStats(requestId);
        const updatedStatus = await getRequestStatus(requestId);
        console.log('갱신된 통계:');
        console.log('  완료:', updatedStatus.completed_count);
        console.log('  실패:', updatedStatus.failed_count);
        console.log('성공\n');

        // 테스트 8: 상태 변경
        console.log('[TEST 8] 상태 변경');
        await setMasterStatus(requestId, 'PROCESSING');
        const finalStatus = await getRequestStatus(requestId);
        console.log('최종 상태:', finalStatus.status);
        console.log('성공\n');

        console.log('모든 테스트 완료!');
        console.log('\n[정리] 테스트 데이터 삭제:');
        console.log(`DELETE FROM r_send_detail WHERE request_id = '${requestId}';`);
        console.log(`DELETE FROM r_send_request WHERE request_id = '${requestId}';`);

        process.exit(0);

    } catch (error) {
        console.error('[ERROR] 테스트 실패:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

runTests();