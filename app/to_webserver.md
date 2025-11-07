## 웹서버 담당자에게 전달할 내용

## Swagger 문서
http://49.50.130.174:4000/api-docs

## 테스트 범위
Transfer (Web) 섹션만 테스트 부탁드립니다:
1. POST /api/transfer/create
2. POST /api/transfer/finalize  
3. GET /api/transfer/status/:contract_id

## 응답 포맷 (표준)
{
  "result": "success" | "fail",
  "code": "0000",
  "message": "...",
  "detail": { ... }
}

## 주의사항
- Finalize API의 파라미터 이름: partial_transaction
- 이 값은 Create에서 받은 partial_transaction에 앱에서 사용자 서명을 추가한 값입니다

## 테스트 완료 확인
테스트 결과 트랜잭션:
https://explorer.solana.com/tx/LyXbE4dgi4kFfKdhqfmiD6ESgAXFox8NY6Q7mMmcMK1BSNLb4qxoDDxPRb4LcTKpVNnAyvWZntNZyfEu2DfdiRU?cluster=devnet

```
================================================================================
RIPY 토큰 전송 전체 플로우 테스트
================================================================================

[환경 설정]
API URL: http://localhost:4000
Solana RPC: https://api.devnet.solana.com
발신자 (WALLET_1): BLy5EXrh...TgdVxqPh
수신자 (WALLET_2): AiF7NdJK...srPEikgw
Feepayer: 7ZTPH4FY...2PdGQd8H
전송 금액: 10 RIPY

================================================================================
Step 1: 부분 서명 트랜잭션 생성
================================================================================

[요청 정보]
API: http://localhost:4000/api/transfer/create
발신자: BLy5EXrh...TgdVxqPh
수신자: AiF7NdJK...srPEikgw
금액: 10 RIPY

[성공] 부분 서명 트랜잭션 생성 완료!
응답 시간: 22025ms
Contract ID: f69eb20e-d0aa-4585-b348-e1425e5dba18
Status: pending
Message: 사용자 서명이 필요합니다
Transaction Length: 456 bytes

[트랜잭션 상세 정보]
Fee Payer: 7ZTPH4FY...2PdGQd8H
Recent Blockhash: 9qipgpoHfoqo5pchbeQJQ9C4Vnd5hN4MDx8jCZjgtdAo
Instructions: 1개
Total Signatures: 2개

[서명 상태]
1. 7ZTPH4FY...2PdGQd8H (Feepayer)
   서명: ✓ 완료
2. BLy5EXrh...TgdVxqPh (Sender)
   서명: ✗ 대기중

================================================================================
Step 2: 사용자 지갑으로 서명
================================================================================

[서명 프로세스]
실제 환경에서는 앱/웹에서 사용자 지갑(Phantom 등)으로 서명합니다.
테스트 환경에서는 개인키를 직접 사용하여 서명합니다.

1. 부분 서명된 트랜잭션 복원 중...
   ✓ 트랜잭션 복원 완료
2. 사용자 지갑 로드 중...
   ✓ 사용자 지갑: BLy5EXrh...TgdVxqPh
3. 서명 전 상태 확인...
   Feepayer 서명: ✓
   사용자 서명: ✗
4. 사용자 서명 추가 중...
   ✓ 사용자 서명 완료
5. 서명 후 상태 확인...
   ✓ 모든 서명 완료
6. 트랜잭션 직렬화 중...
   ✓ 직렬화 완료 (456 bytes)

[성공] 사용자 서명 완료!

================================================================================
Step 3: 최종 전송
================================================================================

[요청 정보]
API: http://localhost:4000/api/transfer/finalize
Contract ID: f69eb20e-d0aa-4585-b348-e1425e5dba18
Signed Transaction: 456 bytes

[완전히 서명된 트랜잭션 (Postman용)]
Ai0DKBeuCYQ/1nmTpgs43dySvXJOLr01jTjO1eABjmxUMOPu16iEiHqJToo84THylY74oiHwXSJXMyIPCPdoRQ8lCwoGHsvpCqW9BHGZ/vALsiXy9hG8ZBiieP3JAJAmVVlBdRWyAQuQIBAUTc2958XxkZQQ2ig2t0Tn4kLAagsOAgEBBWF2ij8uGYeS+1OE+kOdRlIPzJ34ZjGYmoW4ZKhZhzm+mbJOexeZ0aEI4wi/cI45NokAjWR3Q7r6/lRWpWtCR3yuMvXMOwsjAb7u3+VH/ARCmuV3NwO1YqwjDRWrVMp74NMySdbiqpcBeAWgCzsifGOlf3K+wTesl4oXop0G2lkfBt324ddloZPZy+FGzut5rBy0he1fWzeROoz1hX7/AKmDWKmpTnlomDUK30A5HoH0blAiE/jwtXJtx4tbBFAycAEEAwIDAQkDAOQLVAIAAAA=

[성공] 트랜잭션 전송 완료!
응답 시간: 731ms
Status: completed
Message: 전송이 완료되었습니다
Transaction Signature: uCQDsgPQRxnrqq4P65LwHPeDj5cEVyLUnjqQe65SnmaY3n9FTUgzNdofxuibVs74BGTY7P2mjam7QC85wGEWhUS

[Explorer 링크]
https://explorer.solana.com/tx/uCQDsgPQRxnrqq4P65LwHPeDj5cEVyLUnjqQe65SnmaY3n9FTUgzNdofxuibVs74BGTY7P2mjam7QC85wGEWhUS?cluster=devnet

================================================================================
Step 4: 전송 상태 확인
================================================================================

[요청 정보]
API: http://localhost:4000/api/transfer/status/f69eb20e-d0aa-4585-b348-e1425e5dba18

[계약 정보]
Contract ID: f69eb20e-d0aa-4585-b348-e1425e5dba18
Status: completed
Transaction Signature: uCQDsgPQRxnrqq4P65LwHPeDj5cEVyLUnjqQe65SnmaY3n9FTUgzNdofxuibVs74BGTY7P2mjam7QC85wGEWhUS
Created At: 2025-11-07T06:25:33.000Z
Updated At: 2025-11-07T06:25:35.000Z

================================================================================
테스트 완료
================================================================================

[최종 결과]
✓ Contract ID: f69eb20e-d0aa-4585-b348-e1425e5dba18
✓ Status: completed
✓ Transaction: uCQDsgPQRxnrqq4P65LwHPeDj5cEVyLUnjqQe65SnmaY3n9FTUgzNdofxuibVs74BGTY7P2mjam7QC85wGEWhUS
✓ Explorer: https://explorer.solana.com/tx/uCQDsgPQRxnrqq4P65LwHPeDj5cEVyLUnjqQe65SnmaY3n9FTUgzNdofxuibVs74BGTY7P2mjam7QC85wGEWhUS?cluster=devnet

모든 테스트를 성공적으로 완료했습니다!
```