#!/bin/bash
# PSTA 설치 스크립트
# 사용법:
#   curl -fsSL https://raw.githubusercontent.com/GUNIQ-G/psta/main/install.sh | bash
#   PSTA_VERSION=v1.1.30 bash install.sh

set -euo pipefail

# ─── 색상 ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
success() { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
header()  { echo -e "\n${BOLD}━━━ $1 ━━━${NC}"; }

# ─── 기본값 (환경변수로 오버라이드 가능) ──────────────────────────────────────
PSTA_VERSION="${PSTA_VERSION:-latest}"
INSTALL_DIR="${INSTALL_DIR:-/app/psta}"
DATA_DIR="${DATA_DIR:-/data/psta}"
LOG_DIR="${LOG_DIR:-/log/psta}"
NGINX_LOG_DIR="${NGINX_LOG_DIR:-/log/nginx}"
PSTA_USER="${PSTA_USER:-$(whoami)}"
GITHUB_REPO="GUNIQ-G/psta"

# 포트 설정 (환경변수로 오버라이드 가능)
BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_HOST="${BACKEND_HOST:-}"   # 비어 있으면 hostname -I 로 자동 감지

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-psta}"
DB_USER="${DB_USER:-psta_user}"
DB_PASS="${DB_PASS:-}"

JWT_SECRET="${JWT_SECRET:-}"
FRONTEND_URL="${FRONTEND_URL:-}"

NODE_VERSION="24"
PG_VERSION="14"

# ─── OS 확인 ──────────────────────────────────────────────────────────────────
check_os() {
    if ! command -v lsb_release &>/dev/null || [[ "$(lsb_release -si)" != "Ubuntu" ]]; then
        error "이 스크립트는 Ubuntu 전용입니다. (현재: $(uname -s))"
    fi
    local ver; ver=$(lsb_release -sr)
    info "OS: Ubuntu $ver"
}

# ─── 사전 요구사항 확인 ───────────────────────────────────────────────────────
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "설치 스크립트는 sudo로 실행해야 합니다.\n  sudo bash install.sh"
    fi
}

# ─── Node.js 설치 ─────────────────────────────────────────────────────────────
install_nodejs() {
    if command -v node &>/dev/null && node -e "process.exit(parseInt(process.versions.node) >= $NODE_VERSION ? 0 : 1)" 2>/dev/null; then
        success "Node.js $(node --version) 이미 설치됨"
        return
    fi
    info "Node.js v$NODE_VERSION 설치 중..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
    success "Node.js $(node --version) 설치 완료"
}

# ─── PostgreSQL 설치 ──────────────────────────────────────────────────────────
install_postgresql() {
    if systemctl is-active --quiet postgresql 2>/dev/null; then
        success "PostgreSQL 이미 실행 중"
        return
    fi
    info "PostgreSQL $PG_VERSION 설치 중..."
    apt-get install -y postgresql-$PG_VERSION postgresql-client-$PG_VERSION
    systemctl enable postgresql
    systemctl start postgresql
    success "PostgreSQL $PG_VERSION 설치 완료"
}

# ─── Docker 설치 ──────────────────────────────────────────────────────────────
install_docker() {
    if command -v docker &>/dev/null; then
        success "Docker $(docker --version | awk '{print $3}' | tr -d ',') 이미 설치됨"
        return
    fi
    info "Docker 설치 중..."
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    usermod -aG docker "$PSTA_USER"
    success "Docker 설치 완료"
}

# ─── 소스코드 클론 ─────────────────────────────────────────────────────────────
clone_repo() {
    header "소스코드 설치"
    local tag_arg=""

    if [[ "$PSTA_VERSION" != "latest" ]]; then
        tag_arg="--branch $PSTA_VERSION --depth 1"
        info "버전 $PSTA_VERSION 설치 중..."
    else
        tag_arg="--depth 1"
        info "최신 버전 설치 중..."
    fi

    if [[ -d "$INSTALL_DIR/.git" ]]; then
        warn "$INSTALL_DIR 이미 존재합니다. git pull로 업데이트합니다."
        cd "$INSTALL_DIR"
        git pull
    else
        mkdir -p "$(dirname "$INSTALL_DIR")"
        git clone $tag_arg "https://github.com/$GITHUB_REPO.git" "$INSTALL_DIR"
    fi
    success "소스코드 준비 완료: $INSTALL_DIR"
}

# ─── 디렉토리 생성 ─────────────────────────────────────────────────────────────
setup_directories() {
    header "디렉토리 구조 생성"
    mkdir -p "$DATA_DIR/uploads/"{client-logos,item-files,system-logos}
    mkdir -p "$LOG_DIR/"{app/backend,database,external,system}
    mkdir -p "$NGINX_LOG_DIR"
    mkdir -p "$INSTALL_DIR/nginx/dist"

    chown -R "$PSTA_USER":"$PSTA_USER" "$DATA_DIR"
    chown -R "$PSTA_USER":"$PSTA_USER" "$LOG_DIR"
    chown -R "$PSTA_USER":"$PSTA_USER" "$NGINX_LOG_DIR"
    chown -R "$PSTA_USER":"$PSTA_USER" "$INSTALL_DIR"

    success "디렉토리 생성 완료"
}

# ─── DB 설정 ───────────────────────────────────────────────────────────────────
setup_database() {
    header "PostgreSQL 데이터베이스 설정"

    if [[ -z "$DB_PASS" ]]; then
        DB_PASS=$(openssl rand -base64 24 | tr -d '=/+' | head -c 20)
        warn "DB 비밀번호 자동 생성: $DB_PASS"
    fi

    sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

    success "데이터베이스 '$DB_NAME' 준비 완료"
}

# ─── .env 설정 ─────────────────────────────────────────────────────────────────
setup_env() {
    header "환경변수 설정"

    if [[ -z "$JWT_SECRET" ]]; then
        JWT_SECRET=$(openssl rand -base64 48 | tr -d '=/+')
    fi

    local host_ip
    host_ip=$(hostname -I | awk '{print $1}')
    [[ -z "$BACKEND_HOST" ]] && BACKEND_HOST="$host_ip"
    if [[ -z "$FRONTEND_URL" ]]; then
        FRONTEND_URL="http://$host_ip:$FRONTEND_PORT"
    fi

    if [[ -f "$INSTALL_DIR/backend/.env" ]]; then
        warn "backend/.env 이미 존재합니다. 덮어쓰지 않습니다."
        return
    fi

    cat > "$INSTALL_DIR/backend/.env" <<EOF
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME?schema=public"
JWT_SECRET="$JWT_SECRET"
JWT_EXPIRES_IN="24h"
PORT=$BACKEND_PORT
NODE_ENV="production"
FRONTEND_URL="$FRONTEND_URL"
SLACK_BOT_TOKEN=""
SLACK_SIGNING_SECRET=""
SLACK_DEFAULT_CHANNEL="#psta-notifications"
EOF

    chown "$PSTA_USER":"$PSTA_USER" "$INSTALL_DIR/backend/.env"
    chmod 600 "$INSTALL_DIR/backend/.env"
    success ".env 파일 생성 완료"
}

# ─── npm 의존성 설치 ───────────────────────────────────────────────────────────
install_dependencies() {
    header "의존성 설치"
    sudo -u "$PSTA_USER" bash -c "cd $INSTALL_DIR/backend && npm ci --omit=dev"
    sudo -u "$PSTA_USER" bash -c "cd $INSTALL_DIR/frontend && npm ci"
    success "의존성 설치 완료"
}

# ─── 빌드 ──────────────────────────────────────────────────────────────────────
build() {
    header "빌드"
    info "백엔드 빌드 중..."
    sudo -u "$PSTA_USER" bash -c "cd $INSTALL_DIR/backend && npm run build"

    info "프론트엔드 빌드 중..."
    sudo -u "$PSTA_USER" bash -c "cd $INSTALL_DIR/frontend && npm run build"
    rm -rf "$INSTALL_DIR/nginx/dist/"*
    cp -r "$INSTALL_DIR/frontend/dist/." "$INSTALL_DIR/nginx/dist/"
    success "빌드 완료"
}

# ─── DB 마이그레이션 ───────────────────────────────────────────────────────────
run_migrations() {
    header "데이터베이스 마이그레이션"
    sudo -u "$PSTA_USER" bash -c "cd $INSTALL_DIR/backend && npx prisma migrate deploy"
    success "마이그레이션 완료"
}

# ─── systemd 서비스 등록 ────────────────────────────────────────────────────────
setup_systemd() {
    header "systemd 서비스 등록"

    cat > /etc/systemd/system/psta-backend.service <<EOF
[Unit]
Description=PSTA Backend Service
After=network.target postgresql.service

[Service]
Type=simple
User=$PSTA_USER
WorkingDirectory=$INSTALL_DIR/backend
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=append:$LOG_DIR/system/backend-service.log
StandardError=append:$LOG_DIR/system/backend-service-error.log
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable psta-backend
    systemctl restart psta-backend
    success "psta-backend 서비스 등록 및 시작"
}

# ─── nginx Docker 시작 ────────────────────────────────────────────────────────
setup_nginx() {
    header "nginx Docker 시작"
    sudo -u "$PSTA_USER" bash -c "
        cd $INSTALL_DIR/nginx
        BACKEND_HOST=$BACKEND_HOST BACKEND_PORT=$BACKEND_PORT FRONTEND_PORT=$FRONTEND_PORT docker compose up -d --build
    "
    success "nginx 컨테이너(psta-frontend) 시작 (포트: $FRONTEND_PORT → backend: $BACKEND_HOST:$BACKEND_PORT)"
}

# ─── logrotate 설정 ────────────────────────────────────────────────────────────
setup_logrotate() {
    header "logrotate 설정"
    if ! command -v logrotate &>/dev/null; then
        apt-get install -y logrotate
    fi
    chown root:root "$INSTALL_DIR/nginx/logrotate.conf"
    chmod 644 "$INSTALL_DIR/nginx/logrotate.conf"
    ln -sf "$INSTALL_DIR/nginx/logrotate.conf" /etc/logrotate.d/psta-nginx
    success "logrotate 설정 완료"
}

# ─── 완료 메시지 ──────────────────────────────────────────────────────────────
print_summary() {
    local host_ip
    host_ip=$(hostname -I | awk '{print $1}')
    echo -e "\n${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}${BOLD}  PSTA 설치 완료!${NC}"
    echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  접속 URL     : ${BLUE}http://$host_ip:$FRONTEND_PORT${NC}"
    echo -e "  백엔드 포트  : $BACKEND_PORT"
    echo -e "  프론트 포트  : $FRONTEND_PORT"
    echo -e "  설치 경로: $INSTALL_DIR"
    echo -e "  데이터   : $DATA_DIR"
    echo -e "  로그     : $LOG_DIR"
    echo -e ""
    echo -e "  서버 관리:"
    echo -e "    $INSTALL_DIR/bin/server.sh status"
    echo -e "    $INSTALL_DIR/bin/server.sh restart backend"
    echo -e "    $INSTALL_DIR/bin/server.sh restart frontend"
    echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# ─── 메인 ──────────────────────────────────────────────────────────────────────
main() {
    echo -e "${BOLD}PSTA 설치 스크립트 (버전: $PSTA_VERSION)${NC}"
    echo -e "설치 경로: $INSTALL_DIR\n"

    check_root
    check_os

    header "시스템 패키지 업데이트"
    apt-get update -qq

    install_nodejs
    install_postgresql
    install_docker

    clone_repo
    setup_directories
    setup_database
    setup_env
    install_dependencies
    build
    run_migrations
    setup_systemd
    setup_nginx
    setup_logrotate

    print_summary
}

main "$@"
