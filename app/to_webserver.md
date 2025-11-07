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

문의사항 있으시면 연락 부탁드립니다.