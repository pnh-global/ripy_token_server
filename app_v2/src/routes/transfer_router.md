# RIPY 토큰 전송 API 가이드

## 개요
- 서버: http://your-server-ip:4000
- API Key 검증: 없음 (웹 전용)
- Feepayer: 회사 지갑이 수수료 부담
- 네트워크: Solana Devnet

## 전송 플로우

### 1단계: 부분 서명 트랜잭션 생성
**Endpoint:** `POST /api/transfer/create`

**Request:**
```json
{
  "from_wallet": "발신자_지갑_주소",
  "to_wallet": "수신자_지갑_주소",
  "amount": "10"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "contract_id": "uuid",
    "partial_transaction": "base64_string",
    "status": "pending"
  }
}
```

### 2단계: 앱에서 사용자 서명
```javascript
// 웹/앱에서 Phantom 지갑 연동
const transaction = Transaction.from(
  Buffer.from(partial_transaction, 'base64')
);

// 사용자 서명 요청
await window.solana.signTransaction(transaction);

// 서명된 트랜잭션 직렬화
const signedTransaction = transaction.serialize().toString('base64');
```

### 3단계: 최종 전송
**Endpoint:** `POST /api/transfer/finalize`

**Request:**
```json
{
  "contract_id": "uuid",
  "user_signature": "signed_base64_string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "signature": "solana_tx_hash",
    "status": "completed",
    "explorer_url": "https://explorer.solana.com/tx/..."
  }
}
```

## 테스트용 지갑 주소
- 발신자: BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh
- 수신자: AiF7NdJKaDxHsfnRzKKH2SR1GJ2u8upvnnVSsrPEikgw

## 에러 코드
- 400: 잘못된 요청 (파라미터 오류)
- 404: 계약을 찾을 수 없음
- 409: 이미 처리된 계약
- 500: 서버 오류 또는 전송 실패
```

---

## 다음 작업

1. **Swagger UI 확인**
```
http://your-server-ip:4000/api-docs