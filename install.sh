#!/bin/bash
# PSTA 설치 스크립트
# 사용법:
#   curl -fsSL https://raw.githubusercontent.com/GUNIQ-G/psta/main/install.sh | sudo bash
#   sudo PSTA_VERSION=v1.1.31 bash install.sh
#
# 경로 커스터마이징 (모두 환경변수로 오버라이드 가능):
#   sudo INSTALL_DIR=/opt/psta PSTA_DATA_DIR=/mnt/data PSTA_LOG_DIR=/var/log/psta bash install.sh

set -euo pipefail

# ─── 색상 ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
success() { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
header()  { echo -e "\n${BOLD}━━━ $1 ━━━${NC}"; }

# ─── 경로 설정 (환경변수로 오버라이드 가능) ───────────────────────────────────
INSTALL_DIR="${INSTALL_DIR:-/app/psta}"         # 소스코드 설치 경로
PSTA_DATA_DIR="${PSTA_DATA_DIR:-/data/psta}"    # 업로드 파일, .installed 플래그
PSTA_LOG_DIR="${PSTA_LOG_DIR:-/log/psta}"       # 앱 로그
NGINX_LOG_DIR="${NGINX_LOG_DIR:-/log/nginx}"    # nginx 로그

# ─── 기타 설정 ────────────────────────────────────────────────────────────────
PSTA_VERSION="${PSTA_VERSION:-latest}"
PSTA_USER="${PSTA_USER:-$(whoami)}"
GITHUB_REPO="GUNIQ-G/psta"

BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_HOST="${BACKEND_HOST:-}"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-psta}"
DB_USER="${DB_USER:-psta_user}"
DB_PASS="${DB_PASS:-}"

JWT_SECRET="${JWT_SECRET:-}"
FRONTEND_URL="${FRONTEND_URL:-}"

NODE_VERSION="24"
PG_VERSION="${PG_VERSION:-16}"

# ─── OS 확인 ──────────────────────────────────────────────────────────────────
check_os() {
    if ! command -v lsb_release &>/dev/null || [[ "$(lsb_release -si)" != "Ubuntu" ]]; then
        error "이 스크립트는 Ubuntu 전용입니다."
    fi
    info "OS: Ubuntu $(lsb_release -sr)"
}

check_root() {
    [[ $EUID -eq 0 ]] || error "sudo로 실행해야 합니다.\n  sudo bash install.sh"
}

# ─── Node.js 설치 ─────────────────────────────────────────────────────────────
install_nodejs() {
    if command -v node &>/dev/null && node -e "process.exit(parseInt(process.versions.node) >= $NODE_VERSION ? 0 : 1)" 2>/dev/null; then
        success "Node.js $(node --version) 이미 설치됨"; return
    fi
    info "Node.js v$NODE_VERSION 설치 중..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
    success "Node.js $(node --version) 설치 완료"
}

# ─── PostgreSQL 설치 ──────────────────────────────────────────────────────────
install_postgresql() {
    if systemctl is-active --quiet postgresql 2>/dev/null; then
        success "PostgreSQL 이미 실행 중"; return
    fi
    if [[ -n "$PG_VERSION" ]]; then
        local pkg="postgresql-$PG_VERSION postgresql-client-$PG_VERSION"
        info "PostgreSQL $PG_VERSION 설치 중..."
    else
        local pkg="postgresql postgresql-client"
        info "PostgreSQL 최신 버전 설치 중..."
    fi
    apt-get install -y $pkg
    systemctl enable postgresql && systemctl start postgresql
    success "PostgreSQL 설치 완료 ($(psql --version | head -1))"
}

# ─── Docker 설치 ──────────────────────────────────────────────────────────────
install_docker() {
    if command -v docker &>/dev/null; then
        success "Docker 이미 설치됨"; return
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
    systemctl enable docker && systemctl start docker
    usermod -aG docker "$PSTA_USER"
    success "Docker 설치 완료"
}

# ─── 소스코드 클론 ─────────────────────────────────────────────────────────────
clone_repo() {
    header "소스코드 설치"
    local tag_arg="--depth 1"
    [[ "$PSTA_VERSION" != "latest" ]] && tag_arg="--branch $PSTA_VERSION --depth 1"

    if [[ -d "$INSTALL_DIR/.git" ]]; then
        warn "$INSTALL_DIR 이미 존재합니다. git pull로 업데이트합니다."
        cd "$INSTALL_DIR" && git pull
    else
        mkdir -p "$(dirname "$INSTALL_DIR")"
        git clone $tag_arg "https://github.com/$GITHUB_REPO.git" "$INSTALL_DIR"
    fi
    success "소스코드 준비 완료: $INSTALL_DIR"
}

# ─── 디렉토리 생성 ─────────────────────────────────────────────────────────────
setup_directories() {
    header "디렉토리 구조 생성"

    # 데이터 디렉토리
    mkdir -p "$PSTA_DATA_DIR/uploads/"{client-logos,item-files,system-logos,item-images,feedback-images}

    # 로그 디렉토리
    mkdir -p "$PSTA_LOG_DIR/"{app/backend,database,external,system}
    mkdir -p "$NGINX_LOG_DIR"

    # 권한
    chown -R "$PSTA_USER":"$PSTA_USER" "$PSTA_DATA_DIR"
    chown -R "$PSTA_USER":"$PSTA_USER" "$PSTA_LOG_DIR"
    chown -R "$PSTA_USER":"$PSTA_USER" "$NGINX_LOG_DIR"
    chown -R "$PSTA_USER":"$PSTA_USER" "$INSTALL_DIR"

    success "디렉토리 생성 완료"
    info "  소스코드 : $INSTALL_DIR"
    info "  데이터   : $PSTA_DATA_DIR"
    info "  로그     : $PSTA_LOG_DIR"
    info "  nginx 로그: $NGINX_LOG_DIR"
}

# ─── DB 설정 ───────────────────────────────────────────────────────────────────
setup_database() {
    header "PostgreSQL 데이터베이스 설정"
    if [[ -z "$DB_PASS" ]]; then
        DB_PASS=$(openssl rand -base64 24 | tr -d '=/+' | head -c 20)
        warn "DB 비밀번호 자동 생성됨 (아래 .env 파일에서 확인)"
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

    [[ -z "$JWT_SECRET" ]] && JWT_SECRET=$(openssl rand -base64 48 | tr -d '=/+')
    local ENCRYPTION_KEY; ENCRYPTION_KEY=$(openssl rand -hex 32)

    local host_ip; host_ip=$(hostname -I | awk '{print $1}')
    [[ -z "$BACKEND_HOST" ]] && BACKEND_HOST="$host_ip"
    [[ -z "$FRONTEND_URL" ]] && FRONTEND_URL="http://$host_ip:$FRONTEND_PORT"

    if [[ -f "$INSTALL_DIR/backend/.env" ]]; then
        warn "backend/.env 이미 존재합니다. 덮어쓰지 않습니다."; return
    fi

    cat > "$INSTALL_DIR/backend/.env" <<EOF
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME?schema=public"
JWT_SECRET="$JWT_SECRET"
JWT_EXPIRES_IN="24h"
PORT=$BACKEND_PORT
NODE_ENV="production"
FRONTEND_URL="$FRONTEND_URL"
PSTA_DATA_DIR="$PSTA_DATA_DIR"
PSTA_LOG_DIR="$PSTA_LOG_DIR"
SLACK_BOT_TOKEN=""
SLACK_SIGNING_SECRET=""
SLACK_DEFAULT_CHANNEL="#psta-notifications"
ENCRYPTION_KEY="$ENCRYPTION_KEY"
EOF

    chown "$PSTA_USER":"$PSTA_USER" "$INSTALL_DIR/backend/.env"
    chmod 600 "$INSTALL_DIR/backend/.env"
    success ".env 파일 생성 완료"
}

# ─── npm 의존성 설치 ───────────────────────────────────────────────────────────
install_dependencies() {
    header "의존성 설치"
    sudo -u "$PSTA_USER" bash -c "cd $INSTALL_DIR/backend && NODE_ENV=development npm ci"
    sudo -u "$PSTA_USER" bash -c "cd $INSTALL_DIR/frontend && NODE_ENV=development npm ci"
    success "의존성 설치 완료"
}

# ─── 빌드 ──────────────────────────────────────────────────────────────────────
build() {
    header "빌드"
    info "백엔드 빌드 중..."
    sudo -u "$PSTA_USER" bash -c "cd $INSTALL_DIR/backend && NODE_ENV=development npm run build"
    info "프론트엔드 빌드 중..."
    sudo -u "$PSTA_USER" bash -c "cd $INSTALL_DIR/frontend && NODE_ENV=development npm run build"
    rm -rf "$INSTALL_DIR/nginx/dist/"*
    cp -r "$INSTALL_DIR/frontend/dist/." "$INSTALL_DIR/nginx/dist/"
    info "백엔드 devDependencies 정리 중..."
    sudo -u "$PSTA_USER" bash -c "cd $INSTALL_DIR/backend && npm prune --omit=dev"
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
Environment="PSTA_DATA_DIR=$PSTA_DATA_DIR"
Environment="PSTA_LOG_DIR=$PSTA_LOG_DIR"
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=append:$PSTA_LOG_DIR/system/backend-service.log
StandardError=append:$PSTA_LOG_DIR/system/backend-service-error.log
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
    local host_ip; host_ip=$(hostname -I | awk '{print $1}')
    [[ -z "$BACKEND_HOST" ]] && BACKEND_HOST="$host_ip"
    sudo -u "$PSTA_USER" bash -c "
        cd $INSTALL_DIR/nginx
        BACKEND_HOST=$BACKEND_HOST BACKEND_PORT=$BACKEND_PORT FRONTEND_PORT=$FRONTEND_PORT docker compose up -d --build
    "
    success "nginx 컨테이너(psta-frontend) 시작"
}

# ─── logrotate 설정 ────────────────────────────────────────────────────────────
setup_logrotate() {
    header "logrotate 설정"
    command -v logrotate &>/dev/null || apt-get install -y logrotate
    chown root:root "$INSTALL_DIR/nginx/logrotate.conf"
    chmod 644 "$INSTALL_DIR/nginx/logrotate.conf"
    ln -sf "$INSTALL_DIR/nginx/logrotate.conf" /etc/logrotate.d/psta-nginx
    success "logrotate 설정 완료"
}

# ─── 완료 메시지 ──────────────────────────────────────────────────────────────
print_summary() {
    local host_ip; host_ip=$(hostname -I | awk '{print $1}')
    echo -e "\n${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}${BOLD}  PSTA 설치 완료!${NC}"
    echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  접속 URL     : ${BLUE}http://$host_ip:$FRONTEND_PORT${NC}"
    echo -e ""
    echo -e "  디렉토리"
    echo -e "    소스코드   : $INSTALL_DIR"
    echo -e "    데이터     : $PSTA_DATA_DIR"
    echo -e "    로그       : $PSTA_LOG_DIR"
    echo -e "    nginx 로그 : $NGINX_LOG_DIR"
    echo -e ""
    echo -e "  포트"
    echo -e "    프론트엔드 : $FRONTEND_PORT"
    echo -e "    백엔드     : $BACKEND_PORT"
    echo -e ""
    echo -e "  서버 관리"
    echo -e "    $INSTALL_DIR/bin/server.sh status"
    echo -e "    $INSTALL_DIR/bin/server.sh restart backend"
    echo -e "    $INSTALL_DIR/bin/server.sh restart frontend"
    echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# ─── 메인 ──────────────────────────────────────────────────────────────────────
main() {
    echo -e "${BOLD}PSTA 설치 스크립트 (버전: $PSTA_VERSION)${NC}"
    echo -e "소스코드: $INSTALL_DIR  |  데이터: $PSTA_DATA_DIR  |  로그: $PSTA_LOG_DIR\n"

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
