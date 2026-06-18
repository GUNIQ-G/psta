# PSTA 설치 가이드

---

## 목차

1. [빠른 설치 (Ubuntu, 권장)](#1-빠른-설치-ubuntu-권장)
2. [웹 설치 마법사](#2-웹-설치-마법사)
3. [환경변수 설정](#3-환경변수-설정)
4. [수동 설치 (고급)](#4-수동-설치-고급)
5. [업그레이드](#5-업그레이드)
6. [서버 관리](#6-서버-관리)
7. [문제 해결](#7-문제-해결)

---

## 1. 빠른 설치 (Ubuntu, 권장)

### 요구사항

| 항목 | 최소 | 권장 |
|------|------|------|
| OS | Ubuntu 20.04 LTS | Ubuntu 22.04 LTS |
| RAM | 4GB | 8GB |
| Storage | 20GB | 50GB |
| 네트워크 | 인터넷 연결 필요 | - |

### 설치 명령

```bash
curl -fsSL https://raw.githubusercontent.com/GUNIQ-G/psta/main/install.sh | sudo bash
```

설치 스크립트가 다음 작업을 자동으로 수행합니다:

| 단계 | 내용 |
|------|------|
| 1 | Node.js v24, PostgreSQL 14, Docker 설치 |
| 2 | `/app/psta`에 소스코드 클론 |
| 3 | 디렉터리 생성 (`/data/psta`, `/log/psta`, `/log/nginx`) |
| 4 | PostgreSQL 데이터베이스 및 사용자 생성 |
| 5 | `.env` 파일 자동 생성 (JWT_SECRET, ENCRYPTION_KEY 랜덤 생성) |
| 6 | `npm ci` 의존성 설치 |
| 7 | 백엔드/프론트엔드 빌드 |
| 8 | Prisma DB 마이그레이션 |
| 9 | systemd 서비스 등록 (`psta-backend`) |
| 10 | nginx Docker 컨테이너 시작 (`psta-frontend`) |

완료 후 출력되는 접속 URL로 브라우저에서 접속합니다.

### 설치 경로 커스터마이징

환경변수로 모든 경로를 변경할 수 있습니다:

```bash
sudo INSTALL_DIR=/opt/psta \
     PSTA_DATA_DIR=/mnt/data/psta \
     PSTA_LOG_DIR=/var/log/psta \
     FRONTEND_PORT=8080 \
     bash install.sh
```

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `INSTALL_DIR` | `/app/psta` | 소스코드 설치 경로 |
| `PSTA_DATA_DIR` | `/data/psta` | 업로드 파일 저장 경로 |
| `PSTA_LOG_DIR` | `/log/psta` | 앱 로그 경로 |
| `NGINX_LOG_DIR` | `/log/nginx` | nginx 로그 경로 |
| `FRONTEND_PORT` | `3000` | 프론트엔드 포트 |
| `BACKEND_PORT` | `3001` | 백엔드 포트 |
| `DB_NAME` | `psta` | 데이터베이스 이름 |
| `DB_USER` | `psta_user` | DB 사용자 |
| `PSTA_VERSION` | `latest` | 설치할 버전 태그 |

특정 버전 설치:

```bash
sudo PSTA_VERSION=v1.1.32 bash install.sh
```

---

## 2. 웹 설치 마법사

설치 스크립트 완료 후 브라우저에서 `http://서버IP:3000` 에 접속하면 설치 마법사가 자동으로 시작됩니다.

### Step 1 — 시스템 확인

DB 연결, 마이그레이션 상태 등 환경을 자동으로 점검합니다.

### Step 2 — 관리자 계정 설정

| 항목 | 설명 |
|------|------|
| admin 비밀번호 | 6자 이상, bcrypt 해시로 DB에 저장 |
| 비밀번호 확인 | 동일한 비밀번호 재입력 |

> admin 계정(username: `admin`)은 설치 시 자동으로 생성됩니다.

### Step 3 — 기본 설정

| 항목 | 설명 |
|------|------|
| 프론트엔드 URL | 외부 접속 URL (Slack 알림 링크에 사용) |

### Step 4 — 설치 완료

설치가 완료되면 로그인 페이지로 이동합니다.

- **Username**: `admin`
- **Password**: Step 2에서 설정한 비밀번호

> 설치 마법사는 `.installed` 플래그 파일이 생성되면 더 이상 접근할 수 없습니다.

---

## 3. 환경변수 설정

백엔드 환경변수 파일: `backend/.env`

```env
# 데이터베이스
DATABASE_URL="postgresql://psta_user:your_password@localhost:5432/psta?schema=public"

# 인증
JWT_SECRET="랜덤-문자열-32자-이상"
JWT_EXPIRES_IN="24h"

# 서버
PORT=3001
NODE_ENV="production"
FRONTEND_URL="http://your-server-ip:3000"

# 파일 경로
PSTA_DATA_DIR="/data/psta"
PSTA_LOG_DIR="/log/psta"

# Slack 알림 (선택)
SLACK_BOT_TOKEN=""
SLACK_SIGNING_SECRET=""
SLACK_DEFAULT_CHANNEL="#psta-notifications"

# LDAP 비밀번호 암호화 키 (필수, 자동 생성됨)
ENCRYPTION_KEY="랜덤-hex-64자"
```

> `JWT_SECRET`과 `ENCRYPTION_KEY`는 설치 스크립트가 자동으로 안전한 랜덤 값을 생성합니다.
> `ENCRYPTION_KEY`를 분실하면 LDAP 비밀번호를 복호화할 수 없으므로 반드시 백업하세요.

### Slack 알림 설정

1. [api.slack.com/apps](https://api.slack.com/apps) → 앱 생성
2. **Bot Token Scopes** 추가: `chat:write`, `channels:read`, `users:read`
3. 워크스페이스에 앱 설치 → Bot User OAuth Token 복사
4. `.env`에 `SLACK_BOT_TOKEN` 설정
5. 브라우저 → 시스템 설정 → 알림 앱 연동에서 채널 설정

---

## 4. 수동 설치 (고급)

자동 설치 스크립트를 사용할 수 없는 환경에서의 수동 설치 방법입니다.

### 4.1 사전 준비

```bash
# 필수 패키지
sudo apt-get update
sudo apt-get install -y build-essential curl git ca-certificates gnupg

# Node.js v24
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
sudo apt-get install -y nodejs

# PostgreSQL 14
sudo apt-get install -y postgresql-14 postgresql-client-14
sudo systemctl enable postgresql && sudo systemctl start postgresql
```

### 4.2 소스코드 클론

```bash
git clone https://github.com/GUNIQ-G/psta.git /app/psta
cd /app/psta
```

### 4.3 디렉터리 생성

```bash
sudo mkdir -p /data/psta/uploads/{client-logos,item-files,system-logos,item-images,feedback-images}
sudo mkdir -p /log/psta/{app/backend,database,external,system}
sudo mkdir -p /log/nginx
sudo chown -R $USER:$USER /data/psta /log/psta /log/nginx /app/psta
```

### 4.4 PostgreSQL 설정

```bash
sudo -u postgres psql -c "CREATE USER psta_user WITH PASSWORD 'your_secure_password';"
sudo -u postgres psql -c "CREATE DATABASE psta OWNER psta_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE psta TO psta_user;"
```

### 4.5 환경변수 파일 생성

```bash
JWT_SECRET=$(openssl rand -base64 48 | tr -d '=/+')
ENCRYPTION_KEY=$(openssl rand -hex 32)
HOST_IP=$(hostname -I | awk '{print $1}')

cat > /app/psta/backend/.env <<EOF
DATABASE_URL="postgresql://psta_user:your_secure_password@localhost:5432/psta?schema=public"
JWT_SECRET="$JWT_SECRET"
JWT_EXPIRES_IN="24h"
PORT=3001
NODE_ENV="production"
FRONTEND_URL="http://$HOST_IP:3000"
PSTA_DATA_DIR="/data/psta"
PSTA_LOG_DIR="/log/psta"
SLACK_BOT_TOKEN=""
SLACK_SIGNING_SECRET=""
SLACK_DEFAULT_CHANNEL="#psta-notifications"
ENCRYPTION_KEY="$ENCRYPTION_KEY"
EOF

chmod 600 /app/psta/backend/.env
```

### 4.6 의존성 설치 및 빌드

```bash
# 백엔드
cd /app/psta/backend
npm ci --omit=dev
npm run build

# 프론트엔드
cd /app/psta/frontend
npm ci
npm run build

# nginx로 프론트엔드 빌드 복사
mkdir -p /app/psta/nginx/dist
cp -r /app/psta/frontend/dist/. /app/psta/nginx/dist/
```

### 4.7 DB 마이그레이션

```bash
cd /app/psta/backend
npx prisma migrate deploy
```

### 4.8 systemd 서비스 등록

```bash
sudo tee /etc/systemd/system/psta-backend.service <<EOF
[Unit]
Description=PSTA Backend Service
After=network.target postgresql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/app/psta/backend
Environment="NODE_ENV=production"
Environment="PSTA_DATA_DIR=/data/psta"
Environment="PSTA_LOG_DIR=/log/psta"
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable psta-backend
sudo systemctl start psta-backend
```

### 4.9 nginx Docker 시작

Docker가 필요합니다. [Docker 설치](https://docs.docker.com/engine/install/ubuntu/) 후:

```bash
HOST_IP=$(hostname -I | awk '{print $1}')
cd /app/psta/nginx
BACKEND_HOST=$HOST_IP BACKEND_PORT=3001 FRONTEND_PORT=3000 docker compose up -d --build
```

---

## 5. 업그레이드

### 자동 업그레이드

```bash
cd /app/psta
git pull
./bin/server.sh restart backend   # 백엔드 재빌드 + 재시작
./bin/server.sh restart frontend  # 프론트엔드 재빌드 + 재시작
```

백엔드 재시작 스크립트가 빌드와 DB 마이그레이션을 자동으로 처리합니다.

### DB 마이그레이션 수동 실행

```bash
cd /app/psta/backend
npx prisma migrate deploy
```

---

## 6. 서버 관리

`bin/server.sh` 스크립트로 모든 서버 작업을 관리합니다.

```bash
# 상태 확인
./bin/server.sh status

# 전체 시작 / 중지 / 재시작
./bin/server.sh start
./bin/server.sh stop
./bin/server.sh restart

# 백엔드만 (코드 수정 후 빌드 포함)
./bin/server.sh restart backend

# 프론트엔드만 (nginx Docker 재시작)
./bin/server.sh restart frontend

# 로그 확인
./bin/server.sh logs backend
./bin/server.sh logs frontend
```

### 로그 파일 위치

| 로그 | 경로 |
|------|------|
| 앱 로그 | `/log/psta/app/backend/` |
| 에러 로그 | `/log/psta/app/backend/error-*.log` |
| DB 로그 | `/log/psta/database/` |
| 외부 연동 | `/log/psta/external/` (Slack, LDAP) |
| nginx | `/log/nginx/access.log`, `/log/nginx/error.log` |
| systemd | `journalctl -u psta-backend -f` |

### 포트

| 서비스 | 포트 | 설명 |
|--------|------|------|
| Frontend | 3000 | nginx Docker (React SPA) |
| Backend | 3001 | Express API 서버 |

---

## 7. 문제 해결

### 백엔드가 시작되지 않는다

```bash
# 서비스 상태 확인
sudo systemctl status psta-backend

# 실시간 로그 확인
journalctl -u psta-backend -f

# 직접 실행으로 에러 확인
cd /app/psta/backend && node dist/index.js
```

**자주 나오는 에러**:
- `ENCRYPTION_KEY 환경변수가 설정되지 않았습니다` → `backend/.env`에 `ENCRYPTION_KEY` 추가
- `P1001: Can't reach database server` → PostgreSQL 실행 상태 확인
- `listen EADDRINUSE :3001` → 3001 포트를 사용 중인 프로세스 종료

### 프론트엔드 접속이 안 된다

```bash
# Docker 컨테이너 상태 확인
docker ps | grep psta-frontend

# nginx 로그 확인
tail -f /log/nginx/error.log

# 컨테이너 재시작
./bin/server.sh restart frontend
```

### nginx 로그 권한 오류

```bash
sudo chmod 666 /log/nginx/access.log /log/nginx/error.log
docker restart psta-frontend
```

### DB 연결 오류

```bash
# PostgreSQL 상태 확인
sudo systemctl status postgresql

# 직접 연결 테스트
psql -U psta_user -d psta -h localhost -c "SELECT 1;"
```

### 설치 마법사가 다시 뜬다

`.installed` 플래그 파일을 확인합니다:

```bash
ls /data/psta/.installed
```

파일이 없으면 설치가 완료되지 않은 것입니다. 웹 마법사를 다시 실행하세요.

### 권한 오류 (403 Forbidden)

관리자 계정으로 로그인 후 **시스템 설정 → 권한 관리**에서 역할별 리소스 권한을 확인하고 저장합니다.

### 빌드 실패

```bash
# Node.js 버전 확인 (v18 이상 필요)
node --version

# 캐시 정리 후 재설치
cd /app/psta/backend && rm -rf node_modules && npm ci --omit=dev
cd /app/psta/frontend && rm -rf node_modules && npm ci
```
