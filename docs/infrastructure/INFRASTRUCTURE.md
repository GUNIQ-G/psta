# PSTA 인프라 명세서

**문서 버전**: v1.1.3
**작성일**: 2025-10-29
**대상**: 인프라 담당자, 시스템 관리자

---

## 📋 목차
1. [운영 환경](#1-운영-환경)
2. [런타임 환경](#2-런타임-환경)
3. [데이터베이스](#3-데이터베이스)
4. [웹 서버](#4-웹-서버)
5. [필수 시스템 패키지](#5-필수-시스템-패키지)
6. [백엔드 의존성](#6-백엔드-의존성)
7. [프론트엔드 의존성](#7-프론트엔드-의존성)
8. [외부 서비스](#8-외부-서비스)
9. [네트워크 포트](#9-네트워크-포트)
10. [파일 시스템](#10-파일-시스템)
11. [개발 도구](#11-개발-도구)
12. [보안 설정](#12-보안-설정)

---

## 1. 운영 환경

### 1.1 운영 체제
- **OS**: Ubuntu 22.04.5 LTS (Jammy Jellyfish)
- **Architecture**: x86_64
- **Kernel**: Linux 5.15.0-156-generic

### 1.2 테스트 완료 환경
- Ubuntu 22.04 LTS ✅ (권장)
- Ubuntu 20.04 LTS ✅
- CentOS 8 이상 (호환 가능)

### 1.3 시스템 요구사항
| 항목 | 최소 | 권장 |
|------|------|------|
| **CPU** | 2 Core | 4 Core |
| **RAM** | 4 GB | 8 GB |
| **Storage** | 20 GB | 50 GB |
| **Network** | 100 Mbps | 1 Gbps |

---

## 2. 런타임 환경

### 2.1 Node.js
- **버전**: v24.9.0
- **최소 요구사항**: v18.x 이상
- **권장**: v20.x 이상

**설치 방법**:
```bash
# NodeSource 저장소 추가
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2.2 npm
- **버전**: v11.6.0
- **최소 요구사항**: v9.x 이상
- **권장**: v10.x 이상

### 2.3 Python (node-gyp 빌드용)
- **버전**: Python 3.10.x
- **최소 요구사항**: Python 3.8 이상
- **용도**: 네이티브 npm 패키지 빌드

---

## 3. 데이터베이스

### 3.1 PostgreSQL
- **버전**: v14.x
- **최소 요구사항**: v14.0 이상
- **권장**: v15.x 이상

### 3.2 데이터베이스 설정
```
Database Name: psta
User: psta_user
Port: 5432
Encoding: UTF-8
Locale: en_US.UTF-8
```

### 3.3 Prisma ORM
- **버전**: ^5.7.1
- **역할**: Database ORM 및 마이그레이션 도구
- **CLI**: Prisma CLI 포함

**주요 명령어**:
```bash
npx prisma generate      # 클라이언트 생성
npx prisma migrate dev   # 개발 마이그레이션
npx prisma migrate deploy # 프로덕션 마이그레이션
npx prisma studio        # DB GUI (5555 포트)
```

---

## 4. 웹 서버

### 4.1 Backend (Express)
- **프레임워크**: Express v4.18.2
- **언어**: TypeScript v5.3.3
- **포트**: 3001
- **바인딩**: 0.0.0.0 (외부 접근 허용)

### 4.2 Frontend (Vite)
- **빌드 도구**: Vite v5.0.11
- **프레임워크**: React v18.2.0
- **포트**: 3000 (개발), 3000 (프로덕션)
- **바인딩**: 0.0.0.0 (외부 접근 허용)

### 4.3 개발 서버
```
개발 환경:
- Backend: nodemon + ts-node (핫 리로드)
- Frontend: Vite dev server (HMR 비활성화)

프로덕션 환경:
- Backend: Node.js + compiled JavaScript
- Frontend: serve (static file server)
```

### 4.4 Nginx 리버스 프록시 (프로덕션)

#### 서버 정보
| 항목 | 값 |
|------|-----|
| **Nginx 서버** | 192.168.1.151 |
| **App 서버** | 192.168.1.250 |
| **도메인** | psta.dztechwill.com |
| **SSL 인증서** | dztechwill.com (Let's Encrypt) |
| **실행 방식** | Docker Compose |

#### 파일 구조
```
/home/dztechwill/docker-nginx/
├── docker-compose.yml          # Docker Compose 설정
└── conf.d/
    └── 250.conf                # PSTA Nginx 설정 파일
```

#### Nginx 설정 파일
**위치**: `/home/dztechwill/docker-nginx/conf.d/250.conf`

```nginx
server {
    listen 443 ssl;
    server_name psta.dztechwill.com;
    server_tokens off;

    # SSL 인증서 (dztechwill.com 와일드카드)
    ssl_certificate /etc/letsencrypt/live/dztechwill.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dztechwill.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # API 요청 → Backend (192.168.1.250:3001)
    location /api/ {
        proxy_pass http://192.168.1.250:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 업로드 파일 → Backend (192.168.1.250:3001)
    location /uploads/ {
        proxy_pass http://192.168.1.250:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 프론트엔드 → Frontend (192.168.1.250:3000)
    location / {
        proxy_pass http://192.168.1.250:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 프록시 라우팅
| 경로 | 대상 서버 | 설명 |
|------|----------|------|
| `/api/*` | 192.168.1.250:3001 | Backend API |
| `/uploads/*` | 192.168.1.250:3001 | 업로드 파일 |
| `/*` | 192.168.1.250:3000 | Frontend SPA |

#### Nginx 관리 명령어
```bash
# 192.168.1.151 서버에서 실행
cd /home/dztechwill/docker-nginx

# 설정 파일 편집
vi conf.d/250.conf

# 설정 검증 (중요!)
sudo docker-compose exec nginx nginx -t

# 재시작 (설정 반영)
sudo docker-compose down
sudo docker-compose up -d

# 또는 리로드 (무중단)
sudo docker-compose exec nginx nginx -s reload

# 로그 확인
sudo docker-compose logs -f nginx
```

**주의사항**:
- 설정 파일 수정 후 **반드시 `nginx -t`로 검증**
- 검증 실패 시 Docker 재시작하지 말 것 (서비스 중단 방지)
- HTTP → HTTPS 리다이렉트는 별도 설정 없음 (Certbot 자동 처리)

---

## 5. 필수 시스템 패키지

### 5.1 Ubuntu/Debian 패키지
```bash
# 빌드 도구
build-essential          # gcc, g++, make

# 네트워크 도구
curl                     # URL 전송
wget                     # 파일 다운로드
ca-certificates          # SSL 인증서
gnupg                    # GPG 키 관리
lsb-release              # 배포판 정보

# 버전 관리
git                      # Git v2.34.1

# 런타임
python3                  # Python 3.10.x
python3-pip              # Python 패키지 관리자

# 데이터베이스
postgresql               # PostgreSQL 서버
postgresql-contrib       # PostgreSQL 추가 모듈
```

### 5.2 설치 명령어
```bash
sudo apt-get update
sudo apt-get install -y \
  build-essential curl wget git \
  python3 python3-pip \
  ca-certificates gnupg lsb-release \
  postgresql postgresql-contrib
```

---

## 6. 백엔드 의존성

### 6.1 운영 의존성 (dependencies)
| 패키지 | 버전 | 용도 |
|--------|------|------|
| `@prisma/client` | ^5.7.1 | Prisma ORM 클라이언트 |
| `@slack/web-api` | ^7.0.2 | Slack API 클라이언트 |
| `@types/multer` | ^2.0.0 | Multer 타입 정의 |
| `cors` | ^2.8.5 | CORS 미들웨어 |
| `dotenv` | ^16.3.1 | 환경 변수 관리 |
| `express` | ^4.18.2 | 웹 프레임워크 |
| `express-validator` | ^7.0.1 | 입력 검증 |
| `jsonwebtoken` | ^9.0.2 | JWT 인증 |
| `ldapjs` | ^3.0.7 | LDAP 클라이언트 |
| `multer` | ^2.0.2 | 파일 업로드 미들웨어 |
| `passport` | ^0.7.0 | 인증 미들웨어 |
| `passport-jwt` | ^4.0.1 | Passport JWT 전략 |
| `winston` | ^3.17.0 | 로깅 라이브러리 |
| `winston-daily-rotate-file` | ^5.0.0 | Winston 일별 로그 로테이션 |

### 6.2 개발 의존성 (devDependencies)
| 패키지 | 버전 | 용도 |
|--------|------|------|
| `@types/cors` | ^2.8.17 | CORS 타입 정의 |
| `@types/express` | ^4.17.21 | Express 타입 정의 |
| `@types/jsonwebtoken` | ^9.0.5 | JWT 타입 정의 |
| `@types/ldapjs` | ^3.0.6 | LDAP 타입 정의 |
| `@types/node` | ^20.10.6 | Node.js 타입 정의 |
| `@types/passport` | ^1.0.16 | Passport 타입 정의 |
| `@types/passport-jwt` | ^4.0.0 | Passport-JWT 타입 정의 |
| `nodemon` | ^3.0.2 | 개발 서버 핫 리로드 |
| `prisma` | ^5.7.1 | Prisma CLI 도구 |
| `ts-node` | ^10.9.2 | TypeScript 실행 도구 |
| `typescript` | ^5.3.3 | TypeScript 컴파일러 |

### 6.3 설치 명령어
```bash
cd /app/psta/backend
npm install
```

---

## 7. 프론트엔드 의존성

### 7.1 운영 의존성 (dependencies)
| 패키지 | 버전 | 용도 |
|--------|------|------|
| `@ant-design/icons` | ^5.2.6 | Ant Design 아이콘 |
| `antd` | ^5.12.5 | Ant Design UI 라이브러리 |
| `axios` | ^1.6.5 | HTTP 클라이언트 |
| `dayjs` | ^1.11.18 | 날짜/시간 라이브러리 |
| `emoji-picker-react` | ^4.14.1 | 이모지 선택기 |
| `gantt-task-react` | ^0.3.9 | Gantt 차트 컴포넌트 |
| `react` | ^18.2.0 | React 라이브러리 |
| `react-dom` | ^18.2.0 | React DOM 렌더러 |
| `react-markdown` | ^10.1.0 | 마크다운 렌더러 |
| `react-router-dom` | ^6.21.1 | React 라우팅 |
| `xlsx` | ^0.18.5 | Excel 파일 처리 |
| `zustand` | ^4.4.7 | 상태 관리 라이브러리 |

### 7.2 개발 의존성 (devDependencies)
| 패키지 | 버전 | 용도 |
|--------|------|------|
| `@types/react` | ^18.2.47 | React 타입 정의 |
| `@types/react-dom` | ^18.2.18 | React DOM 타입 정의 |
| `@typescript-eslint/eslint-plugin` | ^6.18.1 | TypeScript ESLint 플러그인 |
| `@typescript-eslint/parser` | ^6.18.1 | TypeScript ESLint 파서 |
| `@vitejs/plugin-react` | ^4.2.1 | Vite React 플러그인 |
| `eslint` | ^8.56.0 | JavaScript/TypeScript 린터 |
| `eslint-plugin-react-hooks` | ^4.6.0 | React Hooks 린트 규칙 |
| `eslint-plugin-react-refresh` | ^0.4.5 | React Refresh 린트 규칙 |
| `typescript` | ^5.3.3 | TypeScript 컴파일러 |
| `vite` | ^5.0.11 | 빌드 도구 |

### 7.3 설치 명령어
```bash
cd /app/psta/frontend
npm install
```

---

## 8. 외부 서비스

### 8.1 LDAP 서버 (인증)
- **프로토콜**: LDAP
- **포트**: 389 (LDAP), 636 (LDAPS)
- **설정 위치**: `backend/.env`
- **필수 설정**:
  ```env
  LDAP_URL=ldap://ldap-server:389
  LDAP_BIND_DN=cn=admin,dc=example,dc=com
  LDAP_BIND_PASSWORD=password
  LDAP_SEARCH_BASE=dc=example,dc=com
  ```

### 8.2 Slack API (알림)
- **API 타입**: Slack Web API
- **설정 위치**: `backend/.env` 또는 웹 UI
- **필수 토큰**:
  - Bot Token (xoxb-...)
  - User Token (xapp-..., 선택)
- **권한 필요**:
  - `chat:write` - 메시지 전송
  - `users:read` - 사용자 정보 조회
  - `users:read.email` - 이메일 기반 사용자 조회

### 8.3 Telegram API (알림, 선택)
- **설정 위치**: 웹 UI (알림앱 연동)
- **필수 토큰**: Bot Token

### 8.4 Discord Webhook (알림, 선택)
- **설정 위치**: 웹 UI (알림앱 연동)
- **필수 토큰**: Webhook URL

---

## 9. 네트워크 포트

### 9.1 포트 사용 현황
| 포트 | 서비스 | 프로토콜 | 외부 접근 | 용도 |
|------|--------|---------|----------|------|
| **3000** | Frontend | HTTP | ✅ (0.0.0.0) | 사용자 UI |
| **3001** | Backend | HTTP | ✅ (0.0.0.0) | REST API |
| **5432** | PostgreSQL | PostgreSQL | ❌ (localhost) | 데이터베이스 |
| **5555** | Prisma Studio | HTTP | ❌ (localhost) | DB 관리 GUI |

### 9.2 방화벽 설정
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

### 9.3 접속 URL
- **프로덕션**: http://psta.dztechwill.com (Nginx 프록시)
- **개발 (외부)**: http://192.168.1.250:3000
- **개발 (로컬)**: http://localhost:3000

---

## 10. 파일 시스템

### 10.1 디렉토리 구조
```
/app/psta/                       # 애플리케이션 루트
├── backend/                     # 백엔드 코드
│   ├── src/                     # TypeScript 소스
│   ├── dist/                    # 컴파일된 JavaScript
│   ├── prisma/                  # 데이터베이스 스키마
│   └── node_modules/            # 백엔드 의존성
│
├── frontend/                    # 프론트엔드 코드
│   ├── src/                     # React 소스
│   ├── dist/                    # 빌드 결과물
│   └── node_modules/            # 프론트엔드 의존성
│
├── bin/                         # 서버 관리 스크립트
│   └── server.sh                # 서버 start/stop/restart
│
└── docs/                        # 문서 (v1.0)
    ├── infrastructure/          # 인프라 문서
    ├── guides/                  # 가이드 (개발자/사용자)
    ├── features/                # 기능 소개
    └── changelog/               # 변경 이력

/data/psta/                      # 데이터 저장소 (외부)
├── uploads/                     # 업로드 파일
│   ├── client-logos/            # 클라이언트 로고 (5MB 제한)
│   └── item-files/              # 아이템 첨부 파일 (20MB 제한)
└── database/                    # PostgreSQL 데이터 (선택)

/log/psta/                       # 로그 디렉토리
├── app/
│   ├── backend/                 # 백엔드 로그 (JSON, 일별 로테이션)
│   └── frontend/                # 프론트엔드 로그
├── database/                    # 데이터베이스 로그
├── external/                    # 외부 서비스 로그 (LDAP, Slack)
└── system/                      # 시스템 로그

/tmp/                            # 임시 파일
├── psta-backend.pid             # 백엔드 프로세스 ID
└── psta-frontend.pid            # 프론트엔드 프로세스 ID
```

### 10.2 데이터 저장 위치
```
/data/psta/uploads/
├── client-logos/                # 고객 로고 이미지
│   ├── <uuid>.png
│   └── <uuid>.jpg
└── item-files/                  # 아이템 첨부 파일
    ├── <uuid>.pdf
    ├── <uuid>.docx
    └── <uuid>.zip
```

### 10.3 권한 설정
```bash
# 데이터 디렉토리 생성
sudo mkdir -p /data/psta/uploads/{client-logos,item-files}

# 로그 디렉토리 생성
sudo mkdir -p /log/psta/{app/{backend,frontend},database,external,system}

# 권한 설정 (Node.js 실행 사용자)
sudo chown -R $USER:$USER /data/psta
sudo chown -R $USER:$USER /log/psta
sudo chmod -R 755 /data/psta
sudo chmod -R 755 /log/psta
```

---

## 11. 개발 도구

### 11.1 TypeScript
- **버전**: v5.3.3
- **설정 파일**:
  - `backend/tsconfig.json`
  - `frontend/tsconfig.json`

### 11.2 ts-node
- **버전**: v10.9.2
- **용도**: TypeScript 직접 실행

### 11.3 nodemon
- **버전**: v3.0.2
- **용도**: 개발 서버 핫 리로드

### 11.4 Prisma CLI
- **버전**: ^5.7.1
- **명령어**:
  ```bash
  npx prisma generate       # 클라이언트 생성
  npx prisma migrate dev    # 마이그레이션
  npx prisma studio         # DB GUI
  ```

### 11.5 Git
- **버전**: v2.34.1
- **저장소**: https://github.com/GUNIQ-G/psta.git

---

## 12. 보안 설정

### 12.1 인증
- **방식**: JWT (JSON Web Token)
- **설정**:
  ```env
  JWT_SECRET=<강력한-랜덤-문자열>
  JWT_EXPIRES_IN=24h
  ```

**JWT_SECRET 생성**:
```bash
openssl rand -base64 32
```

### 12.2 LDAP 비밀번호 암호화
- **알고리즘**: AES-256-CBC
- **저장 위치**: PostgreSQL (SystemSetting 테이블)
- **암호화 키**: 환경 변수 또는 하드코딩

### 12.3 파일 업로드 제한
```
클라이언트 로고:
- 허용 타입: JPEG, PNG, GIF, WebP
- 최대 크기: 5 MB

아이템 파일:
- 허용 타입: 이미지, PDF, Office 문서, 텍스트, ZIP
- 최대 크기: 20 MB
```

### 12.4 환경 변수 보안
```bash
# .env 파일 권한 제한
chmod 600 /app/psta/backend/.env

# .env 파일 내용 (예시)
DATABASE_URL="postgresql://psta_user:psta_password@localhost:5432/psta"
JWT_SECRET="<강력한-랜덤-문자열-32자-이상>"
FRONTEND_URL="http://psta.dztechwill.com"
```

### 12.5 방화벽 권장 설정
```
허용:
- 3000/tcp (Frontend)
- 3001/tcp (Backend)

차단:
- 5432/tcp (PostgreSQL, 로컬만 허용)
- 5555/tcp (Prisma Studio, 로컬만 허용)
```

---

## 13. 리소스 사용량 (예상)

### 13.1 개발 환경
| 컴포넌트 | CPU | 메모리 | 디스크 |
|---------|-----|--------|--------|
| PostgreSQL | 5-10% | 100-200 MB | 500 MB+ |
| Backend | 10-20% | 100-150 MB | 50 MB |
| Frontend | 5-10% | 50-100 MB | 100 MB |
| **총계** | **20-40%** | **250-450 MB** | **650 MB+** |

### 13.2 프로덕션 환경
| 컴포넌트 | CPU | 메모리 | 디스크 |
|---------|-----|--------|--------|
| PostgreSQL | 10-20% | 200-500 MB | 1 GB+ |
| Backend | 20-40% | 200-300 MB | 50 MB |
| Nginx | 5-10% | 50-100 MB | 10 MB |
| **총계** | **35-70%** | **450-900 MB** | **1 GB+** |

---

## 14. 백업 및 복구

### 14.1 데이터베이스 백업
```bash
# PostgreSQL 백업
pg_dump -U psta_user -d psta > psta_backup_$(date +%Y%m%d).sql

# 복구
psql -U psta_user -d psta < psta_backup_YYYYMMDD.sql
```

### 14.2 파일 백업
```bash
# 업로드 파일 백업
tar -czf psta_uploads_$(date +%Y%m%d).tar.gz /data/psta/uploads/

# 복구
tar -xzf psta_uploads_YYYYMMDD.tar.gz -C /data/psta/
```

### 14.3 코드 백업
```bash
# Git 저장소 클론
git clone https://github.com/GUNIQ-G/psta.git

# 특정 태그 체크아웃
git checkout v1.0.0
```

---

## 15. 참조 문서

- **[설치 가이드](../guides/installation/INSTALLATION_GUIDE.md)** - 처음 설치 방법
- **[개발 가이드](../guides/development/DEVELOPMENT_GUIDE.md)** - 개발 환경 설정
- **[보안 가이드](../security/SECURITY_GUIDE.md)** - 보안 모범 사례
- **[전체 문서 맵](../../DOCUMENT_MAP.md)** - 모든 문서 네비게이션

---

**문서 끝**
