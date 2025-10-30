# Solana Service 테스트 가이드

## 📋 목차
1. [사전 준비](#사전-준비)
2. [환경 설정](#환경-설정)
3. [테스트 실행](#테스트-실행)
4. [문제 해결](#문제-해결)

---

## 🔧 사전 준비

### 1. 필수 패키지 설치 확인
```bash
npm install --save-dev @jest/globals
```

### 2. Devnet 테스트 지갑 생성
```bash
# 새 테스트 지갑 생성 및 SOL 에어드랍
npm run generate-wallet
```

실행 결과:
- 새 지갑의 Public Key와 Secret Key 출력
- `.env.test` 파일 자동 업데이트
- Devnet에서 2 SOL 에어드랍 시도

⚠️ **에어드랍 제한**: Devnet은 24시간 에어드랍 제한이 있습니다.
대안: https://faucet.solana.com

---

## ⚙️ 환경 설정

### 1. .env.test 파일 확인

`.env.test` 파일이 다음과 같이 설정되어 있는지 확인:
```env
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
SERVICE_WALLET_SECRET_KEY=YourGeneratedBase58SecretKey
TOKEN_MINT_ADDRESS=YourDevnetTokenMintAddress
TOKEN_DECIMALS=9
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
NODE_ENV=test
```

### 2. 토큰 민트 주소 설정

#### 옵션 A: 기존 Devnet 토큰 사용 (권장)

Devnet에서 사용 가능한 테스트 토큰 주소를 사용합니다.
```env
TOKEN_MINT_ADDRESS=YourExistingDevnetTokenMintAddress
```

#### 옵션 B: 새 테스트 토큰 생성
```bash
# 테스트 토큰 생성 스크립트 실행
node create-test-token.js
```

### 3. ATA (Associated Token Account) 생성

테스트 지갑에 토큰 계정을 생성해야 합니다:
```bash
# ATA 생성 (토큰을 받을 수 있는 계정)
node create-test-token.js --create-ata
```

---

## 🧪 테스트 실행

### 1. Solana Service 테스트만 실행
```bash
npm run test:solana
```

### 2. Watch 모드로 실행 (개발 중)
```bash
npm run test:solana:watch
```

### 3. 전체 테스트 실행
```bash
npm test
```

### 4. 커버리지 리포트 생성
```bash
npm run test:coverage
```

---

## 📊 테스트 결과 해석

### 성공 케이스
```
✅ createPartialSignedTransaction
   ✓ 유효한 파라미터로 부분서명 트랜잭션을 생성해야 함 (1234ms)
   
✅ getTokenBalance
   ✓ 유효한 지갑 주소로 토큰 잔액을 조회해야 함 (987ms)
```

### 예상되는 스킵 케이스

일부 테스트는 환경 준비 상태에 따라 스킵될 수 있습니다:
```
⚠️ 환경변수 미설정 또는 ATA 없음 - 테스트 스킵
⚠️ 회사 지갑 잔액 부족 또는 환경 문제 - 테스트 스킵
```

이는 정상입니다. 환경을 완전히 준비한 후 다시 실행하세요.

---

## 🔍 문제 해결

### 문제 1: "ATA가 존재하지 않습니다"

**원인**: 토큰 계정이 생성되지 않음

**해결**:
```bash
node create-test-token.js --create-ata
```

### 문제 2: "에어드랍 실패"

**원인**: Devnet 에어드랍 제한 (24시간)

**해결**:
1. https://faucet.solana.com 방문
2. 지갑 주소 입력하여 수동 에어드랍
3. 또는 24시간 대기

### 문제 3: "SERVICE_WALLET_SECRET_KEY 환경변수가 설정되지 않았습니다"

**원인**: .env.test 파일 미설정 또는 잘못된 경로

**해결**:
```bash
# 1. .env.test 파일 존재 확인
ls -la .env.test

# 2. 파일이 없으면 생성
npm run generate-wallet

# 3. 파일 내용 확인
cat .env.test
```

### 문제 4: "RPC rate limit exceeded"

**원인**: RPC 호출 제한 초과

**해결**:
- 테스트 간 딜레이 추가 (이미 구현됨)
- 또는 Private RPC 사용 (유료)

### 문제 5: 테스트 타임아웃

**원인**: Devnet 응답 지연

**해결**:
```javascript
// jest.config.js에서 타임아웃 증가
testTimeout: 60000  // 30000 → 60000
```

---

## 📝 테스트 체크리스트

테스트 실행 전 확인:

- [ ] `.env.test` 파일 생성 및 설정 완료
- [ ] Devnet 테스트 지갑에 SOL 보유 (최소 0.1 SOL)
- [ ] `TOKEN_MINT_ADDRESS` 설정 완료
- [ ] 테스트 지갑에 ATA 생성 완료
- [ ] 필요한 경우 토큰 잔액 보유
- [ ] `npm install` 실행 완료

---

## 🎯 테스트 목표

- [x] createPartialSignedTransaction 검증
- [x] sendSignedTransaction 검증
- [x] bulkTransfer 검증
- [x] getTokenBalance 검증
- [x] getTransactionDetails 검증
- [x] getSolBalance 검증
- [ ] 전체 통합 플로우 검증 (환경 준비 후)

---

## 📚 참고 자료

- [Solana Devnet Faucet](https://faucet.solana.com)
- [Solana Explorer (Devnet)](https://explorer.solana.com/?cluster=devnet)
- [Solana Web3.js 문서](https://solana-labs.github.io/solana-web3.js/)
- [Jest 문서](https://jestjs.io/)