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

CPU/RAM/Storage 스펙 상세 → **[시스템 요구사항](../../infrastructure/INFRASTRUCTURE.md#13-시스템-요구사항)**

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
| 1 | Node.js v24, PostgreSQL (시스템 패키지), Docker 설치 |
| 2 | `/app/psta`에 소스코드 클론 |
| 3 | 디렉터리 생성 (`/data/psta`, `/log/psta`, `/log/nginx`) |
| 4 | PostgreSQL 데이터베이스 및 사용자 생성 |
| 5 | `backend/.env` 파일 자동 생성 (JWT_SECRET, ENCRYPTION_KEY 랜덤 생성) |
| 6 | `npm ci` 의존성 설치 및 빌드 |
| 7 | DB 스키마 적용 (psql로 schema.sql 실행) |
| 8 | systemd 서비스 등록 (`psta-backend`) |
| 9 | nginx Docker 컨테이너 빌드 및 시작 (`psta-frontend`) |
| 10 | logrotate 설정 (`/etc/logrotate.d/psta-nginx` 심볼릭 링크) |

완료 후 출력되는 접속 URL로 브라우저에서 접속하면 [웹 설치 마법사](#2-웹-설치-마법사)가 시작됩니다.

> **참고**: install.sh는 기존 설치를 감지하여 `.git`이 존재하면 `git pull --ff-only`로 업데이트합니다. `backend/.env`가 이미 존재하면 덮어쓰지 않습니다.

### 설치 경로 커스터마이징

환경변수로 모든 경로 및 설정을 변경할 수 있습니다:

```bash
sudo INSTALL_DIR=/opt/psta \
     PSTA_DATA_DIR=/mnt/data/psta \
     PSTA_LOG_DIR=/var/log/psta \
     NGINX_LOG_DIR=/var/log/nginx \
     FRONTEND_PORT=8080 \
     bash install.sh
```

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `INSTALL_DIR` | `/app/psta` | 소스코드 설치 경로 |
| `PSTA_DATA_DIR` | `/data/psta` | 업로드 파일 저장 경로 |
| `PSTA_LOG_DIR` | `/log/psta` | 앱 로그 경로 |
| `NGINX_LOG_DIR` | `/log/nginx` | nginx 컨테이너 로그 경로 |
| `FRONTEND_PORT` | `3000` | 프론트엔드 포트 |
| `BACKEND_PORT` | `3001` | 백엔드 포트 |
| `DB_NAME` | `psta` | 데이터베이스 이름 |
| `DB_USER` | `psta_user` | DB 사용자 |
| `DB_PASS` | 자동 생성 | DB 비밀번호 (`openssl rand -base64 24`) |
| `JWT_SECRET` | 자동 생성 | JWT 서명 키 (`openssl rand -base64 48`) |
| `PG_VERSION` | `16` | 설치할 PostgreSQL 버전 |
| `PSTA_VERSION` | `latest` | 설치할 버전 태그 |
| `PSTA_USER` | 실행 사용자 | 파일 소유자 및 서비스 실행 사용자 |

특정 버전 설치:

```bash
sudo PSTA_VERSION=v1.1.32 bash install.sh
```

---

## 2. 웹 설치 마법사

설치 스크립트 완료 후 브라우저에서 `http://서버IP:3000` 에 접속하면 설치 마법사가 자동으로 시작됩니다.

### Step 1 — 시스템 확인

DB 연결, 마이그레이션 상태 등 환경을 자동으로 점검합니다. 문제가 있으면 이 단계에서 오류가 표시됩니다.

### Step 2 — 관리자 계정 설정

| 항목 | 설명 |
|------|------|
| admin 비밀번호 | 6자 이상, bcrypt 해시로 DB에 저장 |
| 비밀번호 확인 | 동일한 비밀번호 재입력 |

> `admin` 계정(username: `admin`)은 설치 시 자동으로 생성됩니다.

### Step 3 — 기본 설정

| 항목 | 설명 |
|------|------|
| 프론트엔드 URL | 외부 접속 URL (Slack 알림 링크, 댓글 알림 링크 생성에 사용) |

### Step 4 — 설치 완료

설치가 완료되면 로그인 페이지로 이동합니다.

- **Username**: `admin`
- **Password**: Step 2에서 설정한 비밀번호

> 설치 마법사는 `/data/psta/.installed` 플래그 파일이 생성된 후에는 다시 접근할 수 없습니다. 설치 마법사가 반복해서 뜨는 경우 [문제 해결 — 설치 마법사가 다시 뜬다](#설치-마법사가-다시-뜬다)를 참조하세요.

---

## 3. 환경변수 설정

백엔드 환경변수 파일: `backend/.env`

> 프론트엔드는 별도 `.env` 파일이 없습니다. API URL은 nginx 프록시를 통해 고정적으로 처리됩니다.

### 필수 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 | `postgresql://psta_user:password@localhost:5432/psta?schema=public` |
| `JWT_SECRET` | JWT 토큰 서명 비밀키 (32자 이상 권장) | 설치 스크립트 자동 생성 |
| `ENCRYPTION_KEY` | LDAP 비밀번호 AES-256 암호화 키 (hex 64자) | 설치 스크립트 자동 생성 |

> `ENCRYPTION_KEY`를 분실하면 LDAP 비밀번호를 복호화할 수 없습니다. 반드시 안전한 곳에 백업하세요.
> `ENCRYPTION_KEY`가 없으면 백엔드 서버가 시작 시 FATAL 에러로 종료됩니다.

### 선택 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3001` | Express 서버 리슨 포트 |
| `NODE_ENV` | `development` | 실행 환경 (`production` 권장) |
| `FRONTEND_URL` | `http://localhost:3000` | Slack/댓글 알림 링크 생성에 사용 |
| `PSTA_DATA_DIR` | `/data/psta` | 업로드 파일 저장 경로 |
| `PSTA_LOG_DIR` | `/log/psta` | 앱 로그 파일 저장 경로 |
| `LOG_LEVEL` | `info` | Winston 로그 레벨 (`error`/`warn`/`info`/`http`/`verbose`/`debug`/`silly`) |

> `NODE_ENV=development`이면 상세 에러 메시지가 노출되고 DB 쿼리 로그가 활성화됩니다. 프로덕션에서는 반드시 `production`으로 설정하세요.
> `LOG_LEVEL`은 `NODE_ENV=development`이면 자동으로 `debug`로 전환됩니다.

### .env 파일 예제

```env
# 데이터베이스
DATABASE_URL="postgresql://psta_user:your_password@localhost:5432/psta?schema=public"

# 인증
JWT_SECRET="랜덤-문자열-32자-이상"

# 서버
PORT=3001
NODE_ENV="production"
FRONTEND_URL="http://your-server-ip:3000"

# 파일 경로
PSTA_DATA_DIR="/data/psta"
PSTA_LOG_DIR="/log/psta"

# 로그 레벨 (선택)
LOG_LEVEL="info"

# LDAP 비밀번호 암호화 키 (필수, 자동 생성됨)
ENCRYPTION_KEY="랜덤-hex-64자"
```

> **주의**: `.env.example`에 `JWT_EXPIRES_IN`, `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_DEFAULT_CHANNEL`이 정의되어 있으나 실제 백엔드 소스에서 참조하지 않습니다. JWT 만료시간은 코드에서 `24h`로 고정되어 있고, Slack 설정은 DB(NotificationApp 테이블)에서 동적으로 관리됩니다. 이 변수들은 설정해도 동작에 영향을 주지 않습니다.

### Slack 알림 설정

Slack 알림은 `.env` 변수가 아닌 웹 UI에서 설정합니다:

1. [api.slack.com/apps](https://api.slack.com/apps) → 앱 생성
2. **Bot Token Scopes** 추가: `chat:write`, `channels:read`, `users:read`
3. 워크스페이스에 앱 설치 → Bot User OAuth Token 복사
4. 브라우저 → **시스템 설정 → 알림 앱 연동**에서 토큰 및 채널 설정

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

# PostgreSQL (시스템 패키지)
sudo apt-get install -y postgresql postgresql-client
sudo systemctl enable postgresql && sudo systemctl start postgresql

# Docker (nginx 컨테이너 실행에 필요)
# https://docs.docker.com/engine/install/ubuntu/ 참조
```

### 4.2 소스코드 클론

```bash
git clone https://github.com/GUNIQ-G/psta.git /app/psta
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
PORT=3001
NODE_ENV="production"
FRONTEND_URL="http://$HOST_IP:3000"
PSTA_DATA_DIR="/data/psta"
PSTA_LOG_DIR="/log/psta"
LOG_LEVEL="info"
ENCRYPTION_KEY="$ENCRYPTION_KEY"
EOF

chmod 600 /app/psta/backend/.env
```

> **주의**: `ENCRYPTION_KEY`는 Docker Compose 환경변수(`docker-compose.yml` 환경변수 블록)에 포함되어 있지 않습니다. 반드시 `backend/.env` 파일에 설정해야 합니다.

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

# nginx 컨테이너에서 서빙할 빌드 파일 복사
mkdir -p /app/psta/nginx/dist
cp -r /app/psta/frontend/dist/. /app/psta/nginx/dist/
```

### 4.7 DB 스키마 적용

```bash
# backend/.env에서 DATABASE_URL 읽기
source /app/psta/backend/.env

psql "${DATABASE_URL}" -f /app/psta/backend/prisma/schema.sql
```

### 4.8 systemd 서비스 등록 (백엔드)

```bash
CURRENT_USER=$(whoami)

sudo tee /etc/systemd/system/psta-backend.service <<EOF
[Unit]
Description=PSTA Backend Service
After=network.target postgresql.service

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=/app/psta/backend
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=append:/log/psta/system/backend-service.log
StandardError=append:/log/psta/system/backend-service.log

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable psta-backend
sudo systemctl start psta-backend
```

> **주의**: `User=` 항목에 서비스 실행 사용자를 명시해야 합니다. 기존 설치본에서 `dztw`로 하드코딩된 경우 신규 서버에서는 반드시 실제 사용자로 변경하세요.

> `psta-frontend.service` 유닛 파일이 존재할 수 있으나 이는 구버전(Vite 개발서버) 유물입니다. 현재 프론트엔드는 nginx Docker 컨테이너로 실행하므로 `psta-frontend.service`는 활성화하지 마세요.

### 4.9 nginx Docker 컨테이너 시작 (프론트엔드)

프론트엔드는 `nginx/docker-compose.yml`로 관리하는 독립 컨테이너로 실행합니다:

```bash
HOST_IP=$(hostname -I | awk '{print $1}')
cd /app/psta/nginx

BACKEND_HOST=$HOST_IP \
BACKEND_PORT=3001 \
FRONTEND_PORT=3000 \
NGINX_LOG_DIR=/log/nginx \
docker compose up -d --build
```

> **주의**: `nginx/docker-compose.yml`의 `BACKEND_HOST` 기본값이 특정 서버 IP(`10.0.31.71`)로 하드코딩되어 있습니다. 신규 서버 배포 시 반드시 `BACKEND_HOST` 환경변수를 명시적으로 지정하거나 파일을 수정하세요.

> nginx Docker 컨테이너는 `/app/psta/nginx/dist/`를 읽기 전용 볼륨으로 마운트합니다. 프론트엔드 빌드 파일을 이 경로에 복사해야 nginx가 정적 파일을 서빙합니다.

#### Docker Compose 파일 구분

| 파일 | 용도 |
|------|------|
| `/app/psta/docker-compose.yml` | 전체 스택 (DB + 백엔드 + 프론트엔드). 개발/테스트용. 백엔드 이미지를 Docker로 빌드함. |
| `/app/psta/nginx/docker-compose.yml` | nginx 컨테이너 단독. **프로덕션 권장**. 백엔드는 systemd로 실행, 프론트엔드만 Docker. |

프로덕션 환경에서는 백엔드를 systemd로 실행하고 프론트엔드만 nginx Docker로 실행하는 `nginx/docker-compose.yml` 방식을 사용합니다.

### 4.10 logrotate 설정

```bash
sudo ln -sf /app/psta/nginx/logrotate.conf /etc/logrotate.d/psta-nginx
sudo chown root:root /app/psta/nginx/logrotate.conf
```

> logrotate는 `/log/nginx/*.log`를 daily 로테이션하며, 30일 보관 후 압축합니다. 로테이션 후 `docker exec psta-frontend nginx -s reopen`으로 nginx 로그 파일을 재열기합니다.

---

## 5. 업그레이드

### 자동 업그레이드

```bash
cd /app/psta
git pull
./bin/server.sh restart backend   # 백엔드 재빌드 + 재시작
./bin/server.sh restart frontend  # 프론트엔드 재빌드 + nginx 컨테이너 dist 교체
```

`restart frontend`는 nginx 컨테이너를 재시작하지 않고 Vite 빌드 후 `/app/psta/nginx/dist/`만 교체합니다 (nginx hot-reload 불필요).

### DB 스키마 수동 적용

스키마 변경이 있는 경우:

```bash
source /app/psta/backend/.env

# 전체 스키마 재적용 (신규 설치 시)
psql "${DATABASE_URL}" -f /app/psta/backend/prisma/schema.sql

# 특정 컬럼/테이블 변경 (업그레이드 시)
psql "${DATABASE_URL}" -c "ALTER TABLE ..."
```

---

## 6. 서버 관리

`bin/server.sh` 스크립트로 모든 서버 작업을 관리합니다.

### 기본 명령어

```bash
# 상태 확인
./bin/server.sh status

# 전체 시작 / 중지 / 재시작
./bin/server.sh start
./bin/server.sh stop
./bin/server.sh restart

# 컴포넌트 개별 제어
./bin/server.sh start|stop|restart|status backend
./bin/server.sh start|stop|restart|status frontend
./bin/server.sh start|stop|restart|status db
```

### 컴포넌트 별칭

| 인수 | 별칭 | 설명 |
|------|------|------|
| `backend` | `api` | Express 백엔드 서버 |
| `frontend` | `ui` | nginx Docker 컨테이너 |
| `db` | `database`, `postgres` | PostgreSQL (systemd 서비스 또는 Docker 컨테이너, 환경에 따라 다름) |
| `prisma-studio` | `studio` | Prisma Studio (수동 시작만 가능, `all`에서 제외) |
| `all` (기본값) | - | db + backend + frontend |

> **주의**: `stop all`은 v2.0부터 DB(psta-postgres)도 함께 중지합니다. DB를 유지하면서 다른 컴포넌트만 중지하려면 개별 명령어를 사용하세요 (예: `./bin/server.sh stop backend`).

> Prisma Studio는 보안상 `all`에서 의도적으로 제외됩니다. 필요 시 수동으로 시작하세요: `./bin/server.sh start prisma-studio`

### 로그 확인

```bash
# 백엔드 로그 실시간 확인 (파일 tail)
./bin/server.sh logs backend

# 프론트엔드 nginx 로그 실시간 확인 (docker logs)
./bin/server.sh logs frontend

# Prisma Studio 로그
./bin/server.sh logs prisma-studio
```

### backend 시작 모드 자동 분기

`start backend`는 systemd 서비스 유무에 따라 자동으로 분기합니다:

| 조건 | 동작 |
|------|------|
| systemd `psta-backend` enabled | `npm run build` 후 `sudo systemctl start psta-backend` (프로덕션) |
| systemd 없음 | `ts-node src/index.ts` (개발 모드) |

### 헬스체크 엔드포인트

| 서비스 | URL |
|--------|-----|
| 백엔드 | `http://localhost:3001/health` |
| 프론트엔드 | `http://localhost:3000` |
| Prisma Studio | `http://localhost:5555` |

### 로그 파일 위치

로그 경로 전체 구조 → **[인프라 명세 §10.1](../../infrastructure/INFRASTRUCTURE.md#101-디렉토리-구조)**

| 로그 | 경로 |
|------|------|
| 앱 로그 | `/log/psta/app/backend/` |
| 에러 로그 | `/log/psta/app/backend/error-*.log` |
| DB 로그 | `/log/psta/database/` |
| PostgreSQL 컨테이너 로그 | `/log/psta/database/postgresql-YYYY-MM-DD.log` |
| 외부 연동 | `/log/psta/external/` (Slack, LDAP) |
| server.sh 이벤트 | `/log/psta/system/server.log` |
| 백엔드 systemd | `/log/psta/system/backend-service.log` |
| nginx | `/log/nginx/access.log`, `/log/nginx/error.log` |
| systemd 저널 | `journalctl -u psta-backend -f` |

### 포트

포트 사용 현황 원본 → **[인프라 명세 §9.1](../../infrastructure/INFRASTRUCTURE.md#91-포트-사용-현황)**

| 서비스 | 포트 | 설명 |
|--------|------|------|
| Frontend | 3000 | nginx Docker (React SPA) |
| Backend | 3001 | Express API 서버 |

### PostgreSQL 로그 수집

```bash
# psta-postgres Docker 컨테이너 로그를 파일로 수집 (백그라운드 실행)
/app/psta/bin/collect-postgres-logs.sh
```

이 스크립트는 `psta-postgres` 컨테이너 로그를 `/log/psta/database/postgresql-YYYY-MM-DD.log`에 저장합니다. `server.sh`와 독립적으로 실행됩니다.

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
- `ENCRYPTION_KEY 환경변수가 설정되지 않았습니다` → `backend/.env`에 `ENCRYPTION_KEY` 추가 (`openssl rand -hex 32`로 생성)
- `P1001: Can't reach database server` → PostgreSQL 실행 상태 확인 (`sudo systemctl status postgresql`)
- `listen EADDRINUSE :3001` → 3001 포트를 사용 중인 프로세스 종료 (`sudo lsof -i :3001`)
- `User dztw does not exist` → systemd 유닛 파일의 `User=` 항목을 실제 사용자로 변경 후 `sudo systemctl daemon-reload`

### 프론트엔드 접속이 안 된다

```bash
# Docker 컨테이너 상태 확인
docker ps | grep psta-frontend

# nginx 로그 확인
tail -f /log/nginx/error.log

# 컨테이너 재시작
./bin/server.sh restart frontend
```

### nginx가 백엔드에 연결되지 않는다

```bash
# BACKEND_HOST 확인 (nginx/docker-compose.yml 기본값이 10.0.31.71로 하드코딩됨)
docker inspect psta-frontend | grep BACKEND_HOST

# 올바른 HOST_IP로 재시작
HOST_IP=$(hostname -I | awk '{print $1}')
cd /app/psta/nginx
BACKEND_HOST=$HOST_IP docker compose up -d --build
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

파일이 없으면 설치가 완료되지 않은 것입니다. 웹 마법사를 다시 실행하거나, 수동으로 파일을 생성하세요:

```bash
touch /data/psta/.installed
```

### 권한 오류 (403 Forbidden)

관리자 계정으로 로그인 후 **시스템 설정 → 권한 관리**에서 역할별 리소스 권한을 확인하고 저장합니다.

### 빌드 실패

```bash
# Node.js 버전 확인 (v24 필요)
node --version

# 캐시 정리 후 재설치
cd /app/psta/backend && rm -rf node_modules && npm ci --omit=dev
cd /app/psta/frontend && rm -rf node_modules && npm ci
```
