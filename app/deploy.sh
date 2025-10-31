#!/bin/bash

# ========================================
# RIPY Token Server 배포 스크립트
# ========================================

set -e

# 색상
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ========================================
# 1. 환경 확인
# ========================================
log_info "배포 환경 확인 중..."

if [ ! -f "app/.env" ]; then
    log_error ".env 파일이 없습니다!"
    log_info ".env.example을 복사하여 .env 파일을 생성하세요."
    exit 1
fi

# ========================================
# 2. 환경 변수 백업
# ========================================
log_info "환경 변수 백업 중..."
cp app/.env app/.env.backup.$(date +%Y%m%d_%H%M%S)

# ========================================
# 3. 프로덕션 확인
# ========================================
log_warn "========================================="
log_warn "프로덕션 배포를 진행하시겠습니까?"
log_warn "========================================="
log_warn "현재 Solana 네트워크: $(grep SOLANA_NETWORK app/.env | cut -d'=' -f2)"
log_warn ""
read -p "계속하시겠습니까? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    log_info "배포가 취소되었습니다."
    exit 0
fi

# ========================================
# 4. DB 백업
# ========================================
log_info "데이터베이스 백업 생성 중..."
mkdir -p backups

if docker ps | grep -q ripy-mariadb; then
    docker-compose -f docker-compose.production.yml run --rm backup || log_warn "백업 실패 (계속 진행)"
fi

# ========================================
# 5. 배포 실행
# ========================================
log_info "컨테이너 중지 중..."
docker-compose -f docker-compose.production.yml down

log_info "이미지 빌드 중..."
docker-compose -f docker-compose.production.yml build app

log_info "컨테이너 시작 중..."
docker-compose -f docker-compose.production.yml up -d

# ========================================
# 6. 헬스 체크
# ========================================
log_info "서비스 헬스 체크 중..."
sleep 10

for i in {1..30}; do
    if curl -f http://localhost/health > /dev/null 2>&1; then
        log_info "✅ 배포 완료!"
        docker-compose -f docker-compose.production.yml ps
        exit 0
    fi
    log_warn "대기 중... ($i/30)"
    sleep 2
done

log_error "서비스 시작 실패!"
docker-compose -f docker-compose.production.yml logs --tail=50 app
exit 1