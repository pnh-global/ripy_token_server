# 🚀 RIPY Token Server 배포 가이드

## 📋 배포 전 체크리스트

### 1. 환경 변수 변경 필요 항목

프로덕션 배포 전에 `app/.env` 파일의 다음 항목들을 **반드시** 변경해야 합니다:

#### ✅ 필수 변경 항목

- [ ] `DB_PASSWORD` - 데이터베이스 비밀번호 변경
- [ ] `SOLANA_RPC_URL` - Mainnet URL로 변경
- [ ] `SOLANA_NETWORK` - `mainnet-beta`로 변경
- [ ] `COMPANY_WALLET_ADDRESS` - Mainnet 회사 지갑 공개키
- [ ] `COMPANY_WALLET_PRIVATE_KEY` - Mainnet 회사 지갑 비밀키
- [ ] `RIPY_TOKEN_MINT_ADDRESS` - Mainnet 토큰 민트 주소
- [ ] `ENCRYPTION_KEY` - 새로운 암호화 키 생성
- [ ] `ALLOWED_SERVICE_KEYS` - 프로덕션 Service Key 생성

#### ⚠️ 선택 변경 항목

- [ ] `ALLOWED_IPS` - 웹서버 IP 화이트리스트 설정 (보안 강화)
- [ ] `PORT` - 필요시 포트 변경

---

## 🔐 보안 키 생성 방법

### 1. ENCRYPTION_KEY 생성 (64자 hex)
```bash
openssl rand -hex 32
```

### 2. SERVICE_KEY 생성 (64자 hex)
```bash
openssl rand -hex 32
```

### 3. DB_PASSWORD 생성 (강력한 비밀번호)
```bash
openssl rand -base64 32
```

---

## 🌐 환경별 설정 예시

### 개발 환경 (Devnet)
```bash
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
COMPANY_WALLET_ADDRESS=BLy5EXrh5BNVBuQTCS7XQAGnNfrdNpFuxsxTTgdVxqPh
COMPANY_WALLET_PRIVATE_KEY=3YGF6op6uDsP2UAxKvCeRJJ8JBRuXmrYx9p63GBE6d8KkBaUuhGuwrmmkeknXo264HfxtaZJmYxBpCuS2eDUuyZE
RIPY_TOKEN_MINT_ADDRESS=833QSADX3ErnCNFYXRrWSiLxCBnmr7gY4DZkda1AHeik
```

### 프로덕션 환경 (Mainnet)
```bash
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta
COMPANY_WALLET_ADDRESS=YOUR_MAINNET_PUBLIC_KEY
COMPANY_WALLET_PRIVATE_KEY=YOUR_MAINNET_SECRET_KEY
RIPY_TOKEN_MINT_ADDRESS=YOUR_MAINNET_TOKEN_MINT_ADDRESS
```

---

## 📦 배포 절차

### 1. 환경 변수 백업
```bash
# 현재 .env 파일 백업
cp app/.env app/.env.backup
```

### 2. 프로덕션 환경 변수 설정
```bash
# .env 파일 편집
vi app/.env

# 또는 WebStorm에서 직접 수정
```

### 3. Docker 이미지 빌드
```bash
cd ~/ripy-token-server
docker-compose -f docker-compose.production.yml build
```

### 4. 배포 실행
```bash
# 배포 스크립트 실행
./deploy.sh

# 또는 수동 배포
docker-compose -f docker-compose.production.yml up -d
```

### 5. 배포 확인
```bash
# 헬스 체크
curl http://localhost/health

# 컨테이너 상태 확인
docker-compose -f docker-compose.production.yml ps

# 로그 확인
docker-compose -f docker-compose.production.yml logs -f app
```

---

## 🔄 롤백 절차

문제 발생 시 이전 버전으로 롤백:
```bash
# 1. 컨테이너 중지
docker-compose -f docker-compose.production.yml down

# 2. 백업된 환경 변수 복원
cp app/.env.backup app/.env

# 3. 이전 이미지로 재시작
docker-compose -f docker-compose.production.yml up -d
```

---

## 📊 모니터링

### 로그 확인
```bash
# 실시간 로그
docker-compose -f docker-compose.production.yml logs -f app

# 최근 100줄
docker-compose -f docker-compose.production.yml logs --tail=100 app

# 에러 로그만
docker-compose -f docker-compose.production.yml logs app | grep ERROR
```

### 컨테이너 리소스 확인
```bash
# CPU/메모리 사용량
docker stats

# 디스크 사용량
docker system df
```

---

## ⚠️ 주의사항

1. **비밀키 보안**
    - `.env` 파일은 절대 Git에 커밋하지 않습니다
    - `.gitignore`에 `.env` 파일이 포함되어 있는지 확인

2. **데이터베이스 백업**
    - 배포 전 반드시 백업을 생성합니다
    - 정기적인 백업 스케줄을 설정합니다

3. **Service Key 관리**
    - 프로덕션과 개발 환경의 Service Key를 분리합니다
    - 주기적으로 키를 교체합니다

4. **IP 화이트리스트**
    - 프로덕션에서는 반드시 IP 화이트리스트를 설정합니다
    - 웹서버 IP만 허용합니다

---

## 🆘 문제 해결

### 컨테이너가 시작되지 않을 때
```bash
# 로그 확인
docker-compose -f docker-compose.production.yml logs app

# 컨테이너 재시작
docker-compose -f docker-compose.production.yml restart app
```

### 데이터베이스 연결 실패
```bash
# MariaDB 상태 확인
docker-compose -f docker-compose.production.yml exec mariadb mysql -u root -p -e "SHOW DATABASES;"

# 연결 테스트
docker-compose -f docker-compose.production.yml exec app node -e "const mysql = require('mysql2/promise'); mysql.createConnection({host: 'mariadb', user: 'ripy_user', password: 'ripy_pass', database: 'ripy_token'}).then(() => console.log('OK')).catch(console.error);"
```

### Solana RPC 연결 실패
```bash
# RPC 연결 테스트
curl https://api.mainnet-beta.solana.com -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```