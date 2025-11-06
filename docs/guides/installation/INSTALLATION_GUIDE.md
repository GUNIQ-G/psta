# PSTA 프로젝트 설치 가이드

이 문서는 PSTA 프로젝트를 새로운 서버에 설치하는 방법을 단계별로 설명합니다.

## 📋 목차
1. [시스템 요구사항](#시스템-요구사항)
2. [사전 준비](#사전-준비)
3. [프로젝트 복제](#프로젝트-복제)
4. [데이터베이스 설정](#데이터베이스-설정)
   - [방법 1: Prisma 마이그레이션 (권장)](#방법-1-prisma-마이그레이션-권장)
   - [방법 2: SQL 덤프 파일 (빠른 설치)](#방법-2-sql-덤프-파일-빠른-설치)
5. [백엔드 설정](#백엔드-설정)
6. [프론트엔드 설정](#프론트엔드-설정)
7. [서버 실행](#서버-실행)
8. [초기 데이터 설정](#초기-데이터-설정)
9. [문제 해결](#문제-해결)

---

## 시스템 요구사항

### 테스트된 환경
- **OS**: Ubuntu 22.04.5 LTS (Jammy Jellyfish)
- **Architecture**: x86_64
- **Node.js**: v24.9.0 (v18.x 이상 호환)
- **npm**: v11.6.0 (v9.x 이상 호환)
- **Git**: v2.34.1

### 필수 소프트웨어
- **Node.js**: v18.x 이상 (권장: v20.x 이상)
- **npm**: v9.x 이상 (권장: v10.x 이상)
- **PostgreSQL**: v14.x 이상
- **Git**: v2.x 이상
- **Python3**: v3.10.x 이상 (일부 npm 패키지 빌드용)

### 권장 사양
- **OS**: Ubuntu 22.04 LTS (테스트 완료) / Ubuntu 20.04 LTS / CentOS 8 이상
- **RAM**: 최소 4GB (권장 8GB)
- **Storage**: 최소 20GB 여유 공간
- **Network**: 인터넷 연결 필요

---

## 사전 준비

### 0. 시스템 패키지 업데이트 및 필수 도구 설치

**Ubuntu 22.04 LTS 기준으로 작성되었습니다.**

```bash
# 패키지 목록 업데이트
sudo apt-get update

# 필수 빌드 도구 및 라이브러리 설치
sudo apt-get install -y \
  build-essential \
  curl \
  wget \
  git \
  python3 \
  python3-pip \
  ca-certificates \
  gnupg \
  lsb-release

# 설치 확인
python3 --version  # Python 3.10.x
gcc --version      # gcc (Ubuntu 11.x.x)
make --version     # GNU Make 4.3
```

**설치되는 패키지 설명**:
- `build-essential`: gcc, g++, make 등 컴파일러 도구
- `curl`, `wget`: 파일 다운로드 도구
- `git`: 버전 관리 시스템
- `python3`, `python3-pip`: Python 런타임 (node-gyp가 필요)
- `ca-certificates`, `gnupg`, `lsb-release`: SSL 인증서 및 GPG 키 관리

### 1. Node.js 설치

```bash
# NodeSource 저장소 추가 (Ubuntu 22.04)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.js 설치 (npm 자동 포함)
sudo apt-get install -y nodejs

# 설치 확인
node --version  # v20.x.x 이상
npm --version   # v10.x.x 이상

# npm 글로벌 패키지 디렉토리 권한 설정 (선택사항)
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.profile
source ~/.profile
```

### 2. PostgreSQL 설치

```bash
# Ubuntu 22.04 - PostgreSQL 14 설치
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

# PostgreSQL 서비스 시작 및 자동 시작 설정
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 설치 확인
psql --version  # psql (PostgreSQL) 14.x

# PostgreSQL 서비스 상태 확인
sudo systemctl status postgresql
```

**PostgreSQL 15 이상 설치 (선택사항)**:
```bash
# PostgreSQL 공식 저장소 추가
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# 업데이트 및 설치
sudo apt-get update
sudo apt-get install -y postgresql-15 postgresql-contrib-15
```

### 3. Git 설치 확인

Git은 이미 "시스템 패키지 업데이트" 단계에서 설치되었습니다.

```bash
# 설치 확인
git --version  # git version 2.34.1

# Git 사용자 정보 설정 (처음 사용하는 경우)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

## 프로젝트 복제

### 1. 작업 디렉토리 생성

```bash
# 프로젝트를 설치할 디렉토리로 이동
cd /app

# 또는 원하는 위치에 생성
mkdir -p /app
cd /app
```

### 2. GitHub에서 프로젝트 복제

```bash
git clone https://github.com/GUNIQ-G/psta.git
cd psta
```

---

## 데이터베이스 설정

PSTA 데이터베이스 스키마를 설정하는 방법은 두 가지가 있습니다:
- **방법 1**: Prisma 마이그레이션 (권장 - 개발 환경)
- **방법 2**: SQL 덤프 파일 (빠른 설치 - 프로덕션 환경)

### 공통: PostgreSQL 사용자 및 데이터베이스 생성

먼저 빈 데이터베이스를 생성합니다:

```bash
# PostgreSQL에 접속 (root 사용자로)
sudo -u postgres psql
```

PostgreSQL 프롬프트에서 다음 명령 실행:

```sql
-- 사용자 생성
CREATE USER psta_user WITH PASSWORD 'psta_password';

-- 데이터베이스 생성
CREATE DATABASE psta OWNER psta_user;

-- 권한 부여
GRANT ALL PRIVILEGES ON DATABASE psta TO psta_user;

-- 종료
\q
```

### 방법 1: Prisma 마이그레이션 (권장)

**장점**: 마이그레이션 히스토리 추적, 점진적 업데이트 가능
**단점**: 마이그레이션 파일 필요, 시간 소요

```bash
cd /app/psta/backend

# Prisma Client 생성
npx prisma generate

# 데이터베이스 마이그레이션 실행
npx prisma migrate deploy

# 마이그레이션 확인
npx prisma migrate status
```

### 방법 2: SQL 덤프 파일 (빠른 설치)

**장점**: 빠른 설치, 단일 파일로 전체 스키마 복원
**단점**: 마이그레이션 히스토리 없음

PSTA는 두 가지 스키마 덤프 파일을 제공합니다:
- `bin/psta-schema-only.sql` (34KB) - **PostgreSQL 공식 도구로 생성 (권장)**
- `bin/psta-prisma-schema.sql` (21KB) - Prisma 기반 생성 (참고용)

#### Step 1: 스키마 복원

```bash
# 방법 A: PostgreSQL 덤프 사용 (권장)
psql -U psta_user -d psta -h localhost -f /app/psta/bin/psta-schema-only.sql

# 방법 B: Prisma 덤프 사용 (개발용)
psql -U psta_user -d psta -h localhost -f /app/psta/bin/psta-prisma-schema.sql

# 또는 비밀번호를 환경변수로 제공
PGPASSWORD=psta_password psql -U psta_user -d psta -h localhost -f /app/psta/bin/psta-schema-only.sql
```

#### Step 2: 복원 확인

```bash
# 테이블 목록 확인 (15개 테이블 예상)
psql -U psta_user -d psta -h localhost -c "\dt"

# 테이블 수 확인
psql -U psta_user -d psta -h localhost -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

**예상 결과**:
```
Client, Comment, File, Item, LdapConfig, Link, Message, Notification,
NotificationApp, Organization, Permission, Project, ReportSnapshot,
SlackConfig, SlackNotification, SystemSetting, Team, User, WorkRequest
```

#### Step 3: Prisma Client 생성

```bash
cd /app/psta/backend
npx prisma generate
```

**참고**: 덤프 파일의 상세한 사용법은 `/app/psta/bin/README-SCHEMA-DUMP.md` 문서를 참조하세요.

### 외부 접속 허용 (선택사항)

다른 서버에서 접속이 필요한 경우:

```bash
# PostgreSQL 설정 파일 편집
sudo nano /etc/postgresql/14/main/postgresql.conf

# 다음 라인 수정 또는 추가
listen_addresses = '*'

# pg_hba.conf 편집
sudo nano /etc/postgresql/14/main/pg_hba.conf

# 다음 라인 추가 (모든 IP 허용 - 프로덕션에서는 특정 IP만 허용 권장)
host    all             all             0.0.0.0/0               md5

# PostgreSQL 재시작
sudo systemctl restart postgresql
```

### 연결 테스트

```bash
psql -U psta_user -d psta -h localhost -W
# 비밀번호 입력: psta_password

# 성공하면:
# psta=>

# 종료
\q
```

---

## 백엔드 설정

### 1. 백엔드 디렉토리로 이동

```bash
cd /app/psta/backend
```

### 2. 환경변수 파일 생성

```bash
# .env.example을 복사하여 .env 생성
cp .env.example .env

# .env 파일 편집
nano .env
```

### 3. .env 파일 설정

```env
# Database
DATABASE_URL="postgresql://psta_user:psta_password@localhost:5432/psta?schema=public"

# JWT (보안을 위해 강력한 키로 변경)
JWT_SECRET="your-strong-secret-key-here-change-this"
JWT_EXPIRES_IN="24h"

# Server
PORT=3001
NODE_ENV="production"

# Frontend URL (실제 서버 IP로 변경)
FRONTEND_URL="http://your-server-ip:3000"

# Slack (선택사항 - 나중에 웹 UI에서 설정 가능)
SLACK_BOT_TOKEN=""
SLACK_SIGNING_SECRET=""
SLACK_DEFAULT_CHANNEL=""
```

**중요**: 
- `JWT_SECRET`을 강력한 랜덤 문자열로 변경하세요
- `FRONTEND_URL`을 실제 서버 IP 주소로 변경하세요

### 4. 의존성 패키지 설치

```bash
# npm 캐시 정리 (선택사항, 문제 발생 시)
npm cache clean --force

# 의존성 패키지 설치 (약 2-5분 소요)
npm install

# 설치 확인
npm list --depth=0
```

**설치되는 주요 패키지**:
- `@prisma/client@5.22.0` - Prisma ORM 클라이언트
- `express@4.21.2` - Node.js 웹 프레임워크
- `typescript@5.9.3` - TypeScript 컴파일러
- `@slack/web-api@7.10.0` - Slack API 클라이언트
- `ldapjs@3.0.7` - LDAP 클라이언트
- `jsonwebtoken@9.0.2` - JWT 인증
- `multer@2.0.2` - 파일 업로드 미들웨어
- `prisma@5.22.0` - Prisma CLI 도구

**설치 중 발생할 수 있는 경고**:
- `npm WARN deprecated` - 일부 패키지의 deprecated 경고는 무시해도 됩니다
- `node-gyp` 관련 경고 - Python3와 build-essential이 설치되어 있으면 자동 해결됩니다

**문제 해결**:
```bash
# node-gyp 에러 발생 시
sudo apt-get install -y python3 build-essential

# 권한 문제 발생 시
sudo chown -R $USER:$USER ~/.npm
sudo chown -R $USER:$USER /app/psta/backend/node_modules
```

### 5. 데이터베이스 스키마 설정 (방법 1 사용 시만)

**주의**: 이미 "데이터베이스 설정" 섹션에서 **방법 2 (SQL 덤프 파일)**를 사용했다면 이 단계를 건너뛰세요.

**방법 1 (Prisma 마이그레이션)**을 사용하는 경우에만 실행:

```bash
# Prisma Client 생성
npx prisma generate

# 데이터베이스 마이그레이션 실행
npx prisma migrate deploy

# 마이그레이션 확인
npx prisma migrate status
```

### 6. 초기 권한 데이터 생성

```bash
# 권한 시스템 초기화
npx ts-node scripts/seed-permissions.ts
```

### 7. 빌드

```bash
npm run build
```

---

## 프론트엔드 설정

### 1. 프론트엔드 디렉토리로 이동

```bash
cd /app/psta/frontend
```

### 2. 의존성 패키지 설치

```bash
# npm 캐시 정리 (선택사항, 문제 발생 시)
npm cache clean --force

# 의존성 패키지 설치 (약 3-7분 소요)
npm install

# 설치 확인
npm list --depth=0
```

**설치되는 주요 패키지**:
- `react@18.3.1` - React 라이브러리
- `react-dom@18.3.1` - React DOM 렌더러
- `antd@5.27.4` - Ant Design UI 컴포넌트
- `@ant-design/icons@5.6.1` - Ant Design 아이콘
- `axios@1.12.2` - HTTP 클라이언트
- `react-router-dom@6.30.1` - React 라우팅
- `zustand@4.5.7` - 상태 관리
- `dayjs@1.11.18` - 날짜/시간 라이브러리
- `xlsx@0.18.5` - Excel 파일 처리
- `vite@5.4.20` - 빌드 도구
- `typescript@5.9.3` - TypeScript 컴파일러

**설치 중 발생할 수 있는 경고**:
- `npm WARN deprecated` - 일부 패키지의 deprecated 경고는 무시해도 됩니다
- peer dependencies 경고 - 자동으로 해결됩니다

**문제 해결**:
```bash
# 권한 문제 발생 시
sudo chown -R $USER:$USER ~/.npm
sudo chown -R $USER:$USER /app/psta/frontend/node_modules

# 특정 패키지 설치 실패 시
rm -rf node_modules package-lock.json
npm install
```

### 3. Vite 설정 확인

`vite.config.ts` 파일에서 프록시 설정 확인:

```bash
cat vite.config.ts | grep -A 5 "proxy"
```

**기본 프록시 설정**:
```typescript
proxy: {
  '/api': {
    target: 'http://0.0.0.0:3001',
    changeOrigin: true,
  },
  '/uploads': {
    target: 'http://0.0.0.0:3001',
    changeOrigin: true,
  },
}
```

백엔드 주소가 올바른지 확인 (기본값: `http://0.0.0.0:3001`)

**다른 서버 주소 사용 시**:
```bash
# vite.config.ts 수정
nano vite.config.ts

# target을 실제 백엔드 주소로 변경
# 예: target: 'http://192.168.1.250:3001'
```

### 4. 빌드

```bash
# 프로덕션 빌드 (약 1-3분 소요)
npm run build

# 빌드 결과 확인
ls -lh dist/
```

**빌드 출력**:
- `dist/` 디렉토리에 정적 파일 생성
- HTML, CSS, JavaScript 파일들이 최적화되어 생성됨
- 약 5-10MB 크기의 빌드 결과물

---

## 서버 실행

### 방법 1: 서버 스크립트 사용 (권장)

```bash
cd /app/psta

# 모든 서비스 시작 (DB + Backend + Frontend)
./bin/server.sh start

# 상태 확인
./bin/server.sh status

# 로그 확인
./bin/server.sh logs backend
./bin/server.sh logs frontend
```

### 방법 2: 수동 실행

#### 백엔드 실행

```bash
cd /app/psta/backend

# 개발 모드
npm run dev

# 또는 프로덕션 모드
npm start
```

#### 프론트엔드 실행

```bash
cd /app/psta/frontend

# 개발 모드
npm run dev

# 또는 프로덕션 빌드 후 서빙
npm run build
npm run preview
```

### 서비스 포트

- **Frontend**: http://your-server-ip:3000
- **Backend**: http://your-server-ip:3001

### 방화벽 설정

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp
sudo ufw reload

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload
```

---

## 초기 데이터 설정

### 1. 기본 관리자 계정

**첫 로그인 시 자동으로 생성됩니다:**
- Username: `admin`
- Password: `proadmin`
- Role: `SUPER_ADMIN`

### 2. 미정 프로젝트/서비스 생성

```bash
cd /app/psta/backend

# 미정 항목 생성 스크립트 실행
npx ts-node scripts/create-client-and-seed.ts
```

### 3. LDAP 설정 (선택사항)

웹 UI에서 설정:
1. 관리자로 로그인
2. 시스템 설정 > LDAP 인증 메뉴 접속
3. LDAP 서버 정보 입력 및 저장

### 4. 알림앱 연동 (선택사항)

웹 UI에서 설정:
1. 관리자로 로그인
2. 시스템 설정 > 알림앱 연동 메뉴 접속
3. Slack, Telegram 등 플랫폼 설정

---

## 데이터 디렉토리 설정

PSTA는 모든 업로드 파일과 데이터를 `/data/psta` 경로에, 로그를 `/log/psta` 경로에 저장합니다.

### 1. 데이터 및 로그 디렉토리 생성

```bash
# 데이터 디렉토리 생성
sudo mkdir -p /data/psta/uploads/client-logos
sudo mkdir -p /data/psta/uploads/item-files

# 로그 디렉토리 생성
sudo mkdir -p /log/psta/app/backend
sudo mkdir -p /log/psta/app/frontend
sudo mkdir -p /log/psta/database
sudo mkdir -p /log/psta/external
sudo mkdir -p /log/psta/system

# 권한 설정 (Node.js 실행 사용자로 변경)
sudo chown -R $USER:$USER /data/psta
sudo chown -R $USER:$USER /log/psta
sudo chmod -R 755 /data/psta
sudo chmod -R 755 /log/psta
```

### 2. 디렉토리 구조

```
/data/psta/
├── uploads/
│   ├── client-logos/     # 클라이언트 로고 이미지
│   └── item-files/       # 아이템 첨부 파일
└── database/             # PostgreSQL 데이터 (선택사항)

/log/psta/
├── app/
│   ├── backend/          # 백엔드 로그 (JSON 형식, 일별 로테이션)
│   └── frontend/         # 프론트엔드 로그
├── database/             # 데이터베이스 로그
├── external/             # 외부 서비스 로그 (LDAP, Slack)
└── system/               # 시스템 로그
```

---

## 접속 및 테스트

### 1. 웹 브라우저로 접속

```
http://your-server-ip:3000
```

### 2. 로그인

- Username: `admin`
- Password: `proadmin`

### 3. 첫 실행 체크리스트

- [ ] 로그인 성공
- [ ] 대시보드 표시
- [ ] 일정관리(PSTA) 페이지 접속
- [ ] 클라이언트 추가 테스트
- [ ] 프로젝트 생성 테스트
- [ ] LDAP 설정 (해당하는 경우)
- [ ] 알림앱 연동 (해당하는 경우)

---

## 문제 해결

### 1. 백엔드가 시작되지 않음

```bash
# 로그 확인
cd /app/psta/backend
npm run dev

# 또는
tail -f /tmp/psta-backend.log

# 데이터베이스 연결 확인
psql -U psta_user -d psta -h localhost
```

**해결 방법**:
- `.env` 파일의 `DATABASE_URL` 확인
- PostgreSQL 서비스 실행 확인: `sudo systemctl status postgresql`
- 포트 3001이 사용 중인지 확인: `sudo lsof -i :3001`

### 2. 프론트엔드가 시작되지 않음

```bash
# 로그 확인
cd /app/psta/frontend
npm run dev

# 또는
tail -f /tmp/psta-frontend.log

# 포트 확인
sudo lsof -i :3000
```

**해결 방법**:
- 백엔드가 먼저 실행되었는지 확인
- `vite.config.ts`의 프록시 설정 확인
- 방화벽 포트 개방 확인

### 3. 데이터베이스 마이그레이션 실패

```bash
# 마이그레이션 상태 확인
cd /app/psta/backend
npx prisma migrate status

# 마이그레이션 재실행
npx prisma migrate deploy

# 또는 초기화 (주의: 모든 데이터 삭제됨)
npx prisma migrate reset
```

### 4. 파일 업로드 실패

```bash
# 디렉토리 권한 확인
ls -la /data/psta/uploads/

# 권한 수정
sudo chown -R $USER:$USER /data/psta
sudo chmod -R 755 /data/psta
```

### 5. LDAP 연결 실패

- LDAP 서버 주소와 포트 확인
- Bind DN과 비밀번호 확인
- 네트워크 방화벽 확인
- 시스템 설정 > LDAP 인증 페이지에서 "연결 테스트" 실행

### 6. Prisma Client 에러

```bash
cd /app/psta/backend

# Prisma Client 재생성
npx prisma generate

# 재빌드
npm run build
```

---

## 프로덕션 배포 권장사항

### 1. systemd로 자동 시작 설정 (권장)

PSTA는 systemd 서비스로 설정되어 OS 재기동 시 자동으로 시작됩니다.

**서비스 파일 위치**:
- Backend: `/etc/systemd/system/psta-backend.service`
- Frontend: `/etc/systemd/system/psta-frontend.service`

**주요 명령어**:
```bash
# 서비스 상태 확인
sudo systemctl status psta-backend psta-frontend

# 서비스 시작/중지/재시작
sudo systemctl start psta-backend
sudo systemctl stop psta-backend
sudo systemctl restart psta-backend

# 자동 시작 활성화/비활성화
sudo systemctl enable psta-backend
sudo systemctl disable psta-backend

# 로그 확인
sudo journalctl -u psta-backend -f
sudo journalctl -u psta-frontend -f

# 또는 파일 로그 확인
tail -f /log/psta/system/backend-service.log
tail -f /log/psta/system/frontend-service.log
```

**서비스 파일 수정 후**:
```bash
sudo systemctl daemon-reload
sudo systemctl restart psta-backend psta-frontend
```

### 2. PM2로 프로세스 관리 (대안)

```bash
# PM2 설치
npm install -g pm2

# 백엔드 실행
cd /app/psta/backend
pm2 start dist/index.js --name psta-backend

# 프론트엔드 실행
cd /app/psta/frontend
pm2 start node_modules/vite/bin/vite.js --name psta-frontend -- --host 0.0.0.0 --port 3000

# 부팅 시 자동 시작
pm2 startup
pm2 save
```

### 3. Nginx 리버스 프록시 설정 (선택사항)

```bash
sudo apt-get install -y nginx

# Nginx 설정 파일 생성
sudo nano /etc/nginx/sites-available/psta
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/psta /etc/nginx/sites-enabled/

# Nginx 테스트 및 재시작
sudo nginx -t
sudo systemctl restart nginx
```

### 4. SSL 인증서 설정 (Let's Encrypt)

```bash
# Certbot 설치
sudo apt-get install -y certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d your-domain.com

# 자동 갱신 테스트
sudo certbot renew --dry-run
```

### 5. 보안 강화

```bash
# JWT_SECRET을 강력한 랜덤 문자열로 변경
openssl rand -base64 32

# .env 파일 권한 제한
chmod 600 /app/psta/backend/.env

# PostgreSQL 원격 접속 제한 (로컬만 허용)
sudo nano /etc/postgresql/14/main/pg_hba.conf
# host    all    all    127.0.0.1/32    md5
```

---

## 빠른 설치 명령어 (Ubuntu 22.04)

처음부터 끝까지 한 번에 복사해서 실행할 수 있는 명령어 모음입니다.

**두 가지 방법 중 선택**:
- **방법 A**: Prisma 마이그레이션 (개발 환경)
- **방법 B**: SQL 덤프 파일 **(프로덕션 환경 권장, 더 빠름)**

---

### 방법 A: Prisma 마이그레이션

#### 1단계: 시스템 준비

```bash
# 시스템 업데이트 및 필수 패키지 설치
sudo apt-get update
sudo apt-get install -y build-essential curl wget git python3 python3-pip ca-certificates gnupg lsb-release

# Node.js 20.x 설치
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 14 설치
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 설치 확인
node --version && npm --version && psql --version && git --version
```

#### 2단계: 데이터베이스 설정

```bash
# PostgreSQL 사용자 및 데이터베이스 생성
sudo -u postgres psql << EOF
CREATE USER psta_user WITH PASSWORD 'psta_password';
CREATE DATABASE psta OWNER psta_user;
GRANT ALL PRIVILEGES ON DATABASE psta TO psta_user;
\q
EOF
```

#### 3단계: 프로젝트 복제 및 설정

```bash
# 프로젝트 디렉토리 생성 및 복제
sudo mkdir -p /app
sudo chown -R $USER:$USER /app
cd /app
git clone https://github.com/GUNIQ-G/psta.git
cd psta

# 데이터 및 로그 디렉토리 생성
sudo mkdir -p /data/psta/uploads/{client-logos,item-files}
sudo mkdir -p /log/psta/{app/{backend,frontend},database,external,system}
sudo chown -R $USER:$USER /data/psta
sudo chown -R $USER:$USER /log/psta

# 백엔드 설정
cd backend
cp .env.example .env
nano .env  # DATABASE_URL, JWT_SECRET, FRONTEND_URL 수정
npm install
npx prisma generate
npx prisma migrate deploy
npx ts-node scripts/seed-permissions.ts
npm run build

# 프론트엔드 설정
cd ../frontend
npm install
npm run build

# 서버 실행
cd ..
./bin/server.sh start
```

#### 4단계: 접속 확인

```bash
# 브라우저에서 접속
# http://your-server-ip:3000
# Username: admin
# Password: proadmin
```

---

### 방법 B: SQL 덤프 파일 (권장)

#### 1단계: 시스템 준비 (동일)

```bash
# 시스템 업데이트 및 필수 패키지 설치
sudo apt-get update
sudo apt-get install -y build-essential curl wget git python3 python3-pip ca-certificates gnupg lsb-release postgresql-client

# Node.js 20.x 설치
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 14 설치
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 설치 확인
node --version && npm --version && psql --version && git --version
```

#### 2단계: 데이터베이스 설정 (SQL 덤프 사용)

```bash
# PostgreSQL 사용자 및 데이터베이스 생성
sudo -u postgres psql << EOF
CREATE USER psta_user WITH PASSWORD 'psta_password';
CREATE DATABASE psta OWNER psta_user;
GRANT ALL PRIVILEGES ON DATABASE psta TO psta_user;
\q
EOF
```

#### 3단계: 프로젝트 복제 및 스키마 복원

```bash
# 프로젝트 디렉토리 생성 및 복제
sudo mkdir -p /app
sudo chown -R $USER:$USER /app
cd /app
git clone https://github.com/GUNIQ-G/psta.git
cd psta

# 데이터 및 로그 디렉토리 생성
sudo mkdir -p /data/psta/uploads/{client-logos,item-files}
sudo mkdir -p /log/psta/{app/{backend,frontend},database,external,system}
sudo chown -R $USER:$USER /data/psta
sudo chown -R $USER:$USER /log/psta

# SQL 덤프로 스키마 복원 (빠름!)
PGPASSWORD=psta_password psql -U psta_user -d psta -h localhost -f bin/psta-schema-only.sql

# 백엔드 설정
cd backend
cp .env.example .env
nano .env  # DATABASE_URL, JWT_SECRET, FRONTEND_URL 수정
npm install
npx prisma generate  # Prisma Client 생성만
npx ts-node scripts/seed-permissions.ts
npm run build

# 프론트엔드 설정
cd ../frontend
npm install
npm run build

# 서버 실행
cd ..
./bin/server.sh start
```

#### 4단계: 접속 확인 (동일)

```bash
# 브라우저에서 접속
# http://your-server-ip:3000
# Username: admin
# Password: proadmin
```

**차이점**: 방법 B는 `npx prisma migrate deploy` 대신 SQL 덤프 파일로 스키마를 복원하여 **설치 시간이 크게 단축**됩니다.

---

## 필수 패키지 전체 목록

### 시스템 레벨 패키지 (apt)

```bash
# 빌드 도구
build-essential      # gcc, g++, make
python3              # Python 3.10.x
python3-pip          # Python 패키지 관리자

# 네트워크 도구
curl                 # URL 전송 도구
wget                 # 파일 다운로드 도구
ca-certificates      # SSL 인증서
gnupg               # GPG 키 관리
lsb-release         # Linux 배포판 정보

# 버전 관리
git                  # Git 버전 관리 시스템

# 데이터베이스
postgresql           # PostgreSQL 서버
postgresql-contrib   # PostgreSQL 추가 모듈
```

### Node.js 패키지 (npm) - 백엔드

```
@prisma/client@5.22.0          # Prisma ORM 클라이언트
@slack/web-api@7.10.0          # Slack API 클라이언트
@types/cors@2.8.19             # CORS 타입 정의
@types/express@4.17.23         # Express 타입 정의
@types/jsonwebtoken@9.0.10     # JWT 타입 정의
@types/ldapjs@3.0.6            # LDAP 타입 정의
@types/multer@2.0.0            # Multer 타입 정의
@types/node@20.19.18           # Node.js 타입 정의
cors@2.8.5                     # CORS 미들웨어
dotenv@16.6.1                  # 환경변수 관리
express-validator@7.2.1        # 입력 검증
express@4.21.2                 # 웹 프레임워크
jsonwebtoken@9.0.2             # JWT 인증
ldapjs@3.0.7                   # LDAP 클라이언트
multer@2.0.2                   # 파일 업로드
passport-jwt@4.0.1             # Passport JWT 전략
passport@0.7.0                 # 인증 미들웨어
prisma@5.22.0                  # Prisma CLI
ts-node@10.9.2                 # TypeScript 실행 도구
typescript@5.9.3               # TypeScript 컴파일러
winston@3.17.0                 # 로깅 라이브러리
winston-daily-rotate-file@5.0.0 # Winston 일별 로그 로테이션
```

### Node.js 패키지 (npm) - 프론트엔드

```
@ant-design/icons@5.6.1        # Ant Design 아이콘
antd@5.27.4                    # Ant Design UI 라이브러리
axios@1.12.2                   # HTTP 클라이언트
dayjs@1.11.18                  # 날짜/시간 라이브러리
emoji-picker-react@4.14.1      # 이모지 선택기
gantt-task-react@0.3.9         # Gantt 차트
react-dom@18.3.1               # React DOM
react-markdown@10.1.0          # 마크다운 렌더러
react-router-dom@6.30.1        # React 라우팅
react@18.3.1                   # React 라이브러리
typescript@5.9.3               # TypeScript 컴파일러
vite@5.4.20                    # 빌드 도구
xlsx@0.18.5                    # Excel 파일 처리
zustand@4.5.7                  # 상태 관리
```

---

## 추가 리소스

- **프로젝트 문서**: `/app/psta/CLAUDE.md`
- **컴포넌트 가이드**: `/app/psta/COMPONENTS.md`
- **데이터베이스 설정**: `/app/psta/DATABASE_SETUP.md`
- **변경 이력**: `/app/psta/CHANGELOG_SERVER_SCRIPT.md`

---

## 지원 및 문의

문제가 발생하거나 도움이 필요하면 GitHub Issues를 통해 문의하세요:
https://github.com/GUNIQ-G/psta/issues

---

**설치 완료!** 🎉

PSTA 프로젝트를 성공적으로 설치하셨습니다. 즐거운 프로젝트 관리 되세요!
