#!/bin/bash

# ========================================
# RIPY Token Server 개발 환경 배포 테스트
# ========================================

set -e

# 색상
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

echo ""
log_step "========================================="
log_step "RIPY Token Server 개발 환경 배포 테스트"
log_step "========================================="
echo ""

# ========================================
# 1. 환경 확인
# ========================================
log_step "1. 환경 확인 중..."

if [ ! -f "app/.env" ]; then
    log_error ".env 파일이 없습니다!"
    exit 1
fi

if [ ! -f "nginx/nginx.conf" ]; then
    log_error "nginx/nginx.conf 파일이 없습니다!"
    exit 1
fi

if [ ! -f "docker-compose.yml" ]; then
    log_error "docker-compose.yml 파일이 없습니다!"
    exit 1
fi

log_info "✅ 필수 파일 확인 완료"
echo ""

# ========================================
# 2. 현재 환경 출력
# ========================================
log_step "2. 현재 환경 설정 확인"

SOLANA_NETWORK=$(grep SOLANA_NETWORK app/.env | cut -d'=' -f2)
SOLANA_RPC=$(grep SOLANA_RPC_URL app/.env | cut -d'=' -f2)

log_info "Solana Network: $SOLANA_NETWORK"
log_info "Solana RPC: $SOLANA_RPC"
echo ""

# ========================================
# 3. 로그 디렉토리 생성
# ========================================
log_step "3. 로그 디렉토리 생성"

mkdir -p logs/nginx
mkdir -p logs/mariadb
mkdir -p app/logs
mkdir -p backups

log_info "✅ 디렉토리 생성 완료"
echo ""

# ========================================
# 4. 기존 컨테이너 정리
# ========================================
log_step "4. 기존 컨테이너 중지"

if docker ps -a | grep -q "ripy-"; then
    log_warn "기존 컨테이너를 중지합니다..."
    docker-compose down 2>/dev/null || true
fi

log_info "✅ 정리 완료"
echo ""

# ========================================
# 5. 이미지 빌드
# ========================================
log_step "5. Docker 이미지 빌드"

log_info "빌드 시작... (약 1-2분 소요)"
docker-compose build app

log_info "✅ 빌드 완료"
echo ""

# ========================================
# 6. 컨테이너 시작
# ========================================
log_step "6. 컨테이너 시작"

docker-compose up -d

log_info "컨테이너 시작 대기 중... (약 10초)"
sleep 10

log_info "✅ 컨테이너 시작 완료"
echo ""

# ========================================
# 7. 컨테이너 상태 확인
# ========================================
log_step "7. 컨테이너 상태 확인"

docker-compose ps
echo ""

# ========================================
# 8. 헬스 체크
# ========================================
log_step "8. 서비스 헬스 체크"

MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f http://localhost/health > /dev/null 2>&1; then
        log_info "✅ 서비스 정상 동작 확인!"
        break
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 2
done

echo ""

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_error "서비스 시작 실패!"
    log_error "로그를 확인하세요:"
    docker-compose logs --tail=50 app
    exit 1
fi

echo ""

# ========================================
# 9. API 테스트
# ========================================
log_step "9. API 응답 테스트"

# Health Check
log_info "Health Check 테스트..."
HEALTH_RESPONSE=$(curl -s http://localhost/health)
echo "Response: $HEALTH_RESPONSE"

if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
    log_info "✅ Health Check 성공"
else
    log_error "❌ Health Check 실패"
fi

echo ""

# Solana Health Check
log_info "Solana RPC Health Check 테스트..."
SOLANA_HEALTH=$(curl -s http://localhost/api/solana/health)
echo "Response: $SOLANA_HEALTH"

if echo "$SOLANA_HEALTH" | grep -q "healthy"; then
    log_info "✅ Solana RPC 연결 성공"
else
    log_warn "⚠️  Solana RPC 응답 확인 필요"
fi

echo ""

# ========================================
# 10. 로그 확인
# ========================================
log_step "10. 최근 로그 확인"

log_info "Application 로그 (최근 10줄):"
docker-compose logs --tail=10 app

echo ""

# ========================================
# 11. 완료
# ========================================
log_step "========================================="
log_step "배포 테스트 완료!"
log_step "========================================="
echo ""

log_info "📊 유용한 명령어:"
echo ""
echo "  # 실시간 로그 확인"
echo "  docker-compose logs -f app"
echo ""
echo "  # 컨테이너 상태 확인"
echo "  docker-compose ps"
echo ""
echo "  # 컨테이너 중지"
echo "  docker-compose down"
echo ""
echo "  # API 테스트"
echo "  curl http://localhost/health"
echo "  curl http://localhost/api/solana/health"
echo ""

log_info "🌐 접속 URL:"
echo "  - Health Check: http://localhost/health"
echo "  - Solana Health: http://localhost/api/solana/health"
echo ""