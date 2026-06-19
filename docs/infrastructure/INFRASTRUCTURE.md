# PSTA 인프라 명세서

**문서 버전**: v1.1.36
**최종 수정**: 2026-06-19
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
# NodeSource 저장소 추가 (v24.x)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
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
- **버전**: v16.10 (schema.sql 덤프 기준 실제 버전; CLAUDE.md의 14.x 표기는 오래된 정보)
- **최소 요구사항**: v14.0 이상
- **권장**: v16.x 이상

### 3.2 데이터베이스 설정
```
Database Name: psta
User: psta_user
Port: 5432
Encoding: UTF-8
Locale: en_US.UTF-8
```

### 3.3 pg (node-postgres)

PSTA 백엔드는 ORM 없이 `pg` (node-postgres)를 직접 사용합니다.

- **버전**: pg ^8.21.0
- **연결**: Pool 방식 (max 20 연결)
- **패턴**: `query()`, `queryOne()`, `transaction()` 헬퍼
- **스키마**: `backend/prisma/schema.sql` (pg_dump --schema-only 결과물)

```bash
# 스키마 적용 (설치 시 자동 실행됨)
psql "${DATABASE_URL}" -f backend/prisma/schema.sql
```

Prisma Studio (포트 5555) 는 `server.sh` 에서 수동 시작을 지원하나 `all` 명령에서는 보안상 제외됩니다 (섹션 9.1 포트 현황 참고). DB 관리는 직접 psql 또는 Docker exec 사용:
```bash
docker exec -it psta-db psql -U psta_user -d psta
```

> ⚠️ **컨테이너명 주의**: `docker-compose.yml`의 DB 컨테이너명은 `psta-db`이나, `server.sh`은 `psta-postgres`를 참조합니다. Docker Compose로 전체 스택을 기동한 경우 `server.sh start db`가 컨테이너를 찾지 못할 수 있습니다. `server.sh`을 통한 DB 제어는 `psta-postgres` 이름의 컨테이너를 직접 기동한 경우에만 정상 동작합니다.

> **backend/Dockerfile Prisma 잔존 단계**: `backend/Dockerfile`의 멀티스테이지 빌드에는 `prisma generate` 실행 및 `.prisma/`, `prisma/schema.prisma` 복사 단계가 포함되어 있습니다. 실제 PSTA 백엔드는 Prisma ORM 없이 `pg`를 직접 사용하므로, 이 단계는 마이그레이션 과정의 레거시 잔존으로 추정됩니다. 빌드 시 오류가 발생하지 않는 한 현재 동작에 영향을 주지 않습니다.

---

### 3.4 테이블 목록 (21개)

| 테이블 | 용도 | 주요 특징 |
|--------|------|-----------|
| `Item` | 핵심 계층 엔티티 (PROJECT/SERVICE/TEAM/ACTION) | STI 패턴, 자기참조, 소프트 삭제, 인덱스 7개 |
| `User` | 사용자 계정 | 로컬/LDAP 이중 인증, positionType→역할 자동 계산 |
| `Team` | 팀 정보 | 계층형 자기참조(parentId/level), ldapDn/departmentNumber UNIQUE |
| `Organization` | LDAP 조직 구조 미러링 | 자기참조, 자식 CASCADE 삭제 |
| `Client` | 고객사 정보 | code UNIQUE, logoUrl로 로고 경로 저장 |
| `ServiceTeam` | 서비스-팀 M:N 연결 | (serviceId, teamId) 복합 UNIQUE, CASCADE |
| `WorkRequest` | 계층형 워크플로우 요청 | actionId UNIQUE(1:1), 자기참조, 소프트 삭제, 인덱스 14개 |
| `Comment` | 아이템 댓글 | reactions은 JSON 문자열, 소프트 삭제 |
| `Notification` | 앱 내 알림 | updatedAt 없음, type 자유 문자열 |
| `Message` | 사용자 간 내부 메시지 | readAt으로 읽은 시각 추적, updatedAt 없음 |
| `File` | 파일 메타데이터 | 실제 파일은 /data/psta/uploads/ 저장, 소프트 삭제 |
| `Link` | 외부 링크 관리 | displayName 문서명 자동 표시(v1.1.28), 소프트 삭제 |
| `LdapConfig` | LDAP 서버 연결 설정 | bindPassword는 앱 레벨 AES-256-CBC 암호화 후 저장 |
| `SlackConfig` | Slack 앱 연동 설정 | 레거시 방식 (현재는 NotificationApp 권장) |
| `SlackNotification` | Slack 발송 이력 | FK 없음, sentAt만 존재 |
| `NotificationApp` | 멀티 플랫폼 알림 앱 설정 | config는 JSON 문자열, type enum으로 플랫폼 분기 |
| `Permission` | RBAC 권한 매트릭스 | (role, resource) 복합 UNIQUE |
| `SystemSetting` | KV 형식 시스템 설정 | key UNIQUE, category 그룹화, isEncrypted 플래그 |
| `ReportSnapshot` | 보고서 스냅샷 | clientId FK 제약 없음(고객사 삭제 후에도 보존), data/statistics는 JSON 문자열 |
| `Feedback` | 버그/건의 게시판 | v1.1.27 추가, adminComment로 관리자 답변 |
| `Project` | (레거시 추정) 별도 프로젝트 개념 | Item(type=PROJECT)과 별개 존재, 현재 활용도 불명확 |

> **총 테이블 수**: 21개 (Project 포함)

---

### 3.5 핵심 테이블 관계도

```
User ──┬── Item (createdById, assigneeId, deletedById)
       ├── Comment (userId, deletedById)
       ├── File (uploadedById, deletedById)
       ├── Link (createdById, deletedById)
       ├── WorkRequest (requesterId, assigneeId, approvedById, deletedById)
       ├── Notification (fromUserId, toUserId)
       ├── Message (fromUserId, toUserId)
       ├── ReportSnapshot (createdById)
       └── Feedback (createdById, resolvedById)

Item ──┬── Item (parentId, 자기참조 트리)
       ├── Comment (itemId)
       ├── File (itemId)
       ├── Link (itemId)
       ├── WorkRequest (actionId 1:1 UNIQUE, projectId, serviceId, teamId)
       └── ServiceTeam (serviceId)

Team ──┬── Team (parentId, 자기참조)
       ├── User (teamId)
       ├── ServiceTeam (teamId)
       └── WorkRequest (assigneeTeamId)

Organization ── Organization (parentId, 자기참조, CASCADE)
Client ── Item (clientId, SET NULL on delete)
WorkRequest ── WorkRequest (parentWorkRequestId, 자기참조)
```

---

### 3.6 ENUM 타입 목록

| ENUM | 값 |
|------|-----|
| `ItemType` | `PROJECT`, `SERVICE`, `TEAM`, `ACTION` |
| `ItemStatus` | `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `ON_HOLD` |
| `UserRole` | `ADMIN`, `PO`, `PM`, `MEMBER` |
| `PositionType` | `NONE`, `PART_LEADER`, `TEAM_LEADER`, `DIRECTOR`, `HEAD`, `EXECUTIVE`, `SENIOR_EXEC`, `VICE_PRES` |
| `OrgType` | `COMPANY`, `DIVISION`, `DEPARTMENT`, `TEAM` |
| `WorkRequestPriority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| `WorkRequestStatus` | `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `REJECTED`, `IN_NEGOTIATION` |
| `WorkRequestType` | `ACTION_REQUEST`, `SERVICE_CREATE`, `TEAM_CREATE`, `IN_NEGOTIATION` |
| `NotificationAppType` | `SLACK`, `TELEGRAM`, `DISCORD`, `LINE`, `KAKAOTALK` |
| `FeedbackType` | `BUG`, `FEATURE`, `IMPROVEMENT` |
| `FeedbackStatus` | `PENDING`, `IN_PROGRESS`, `RESOLVED`, `REJECTED` |

---

### 3.7 주요 인덱스 정책

| 테이블 | 인덱스 수 | 주요 인덱스 |
|--------|-----------|-------------|
| `Item` | 9개 | type, status, parentId, assigneeId, clientId, serviceTeamId, isDeleted, deletedById |
| `WorkRequest` | 14개 | actionId(UNIQUE), status, priority, requesterId, assigneeId, assigneeTeamId, projectId, serviceId, teamId, isDeleted 등 |
| `User` | 7개 | username(UNIQUE), email(UNIQUE), teamId, organizationId, role, isVerified, approvalRequested |
| `File` | 7개 | itemId, uploadedById, projectId, serviceId, teamId, isDeleted, deletedById |
| `Link` | 7개 | itemId, createdById, projectId, serviceId, teamId, isDeleted, deletedById |
| `Comment` | 4개 | itemId, userId, isDeleted, deletedById |
| `Team` | 4개 | name(UNIQUE), ldapDn(UNIQUE), departmentNumber(UNIQUE), parentId |
| `ServiceTeam` | 3개 | (serviceId,teamId)(UNIQUE), serviceId, teamId |
| `Permission` | 3개 | (role,resource)(UNIQUE), role, resource |
| `SystemSetting` | 3개 | key(UNIQUE), key, category |

---

### 3.8 설계 패턴 및 주의사항

#### 단일 테이블 상속 (STI) — Item 테이블
`Item` 테이블은 `type` 컬럼(ItemType enum)으로 4가지 계층 엔티티를 단일 테이블에 통합합니다:
- `PROJECT` → 최상위 프로젝트
- `SERVICE` → 서비스 단위 (PROJECT 하위)
- `TEAM` → 팀 단위 (SERVICE 하위)
- `ACTION` → 실행 단위 (TEAM 하위)

`parentId` 자기참조 FK로 트리 구조를 구현합니다.

#### 소프트 삭제 패턴
5개 테이블(`Item`, `WorkRequest`, `Comment`, `File`, `Link`)에 3컬럼 세트로 일관 적용:
```
isDeleted (bool default false)
deletedAt (timestamp?)
deletedById (text? FK→User SET NULL)
```
`isActive` 컬럼(논리적 활성화)은 `Client`, `Team`, `Organization`, `LdapConfig`, `SlackConfig`, `NotificationApp`, `User` 테이블에서 별도 사용됩니다. 두 패턴을 혼용하므로 쿼리 작성 시 주의가 필요합니다.

#### PK 타입
모든 테이블이 `text` 타입 PK를 사용합니다 (UUID 또는 cuid를 앱 레벨에서 생성, DB 시퀀스 미사용). 분산 환경에서 ID 충돌 없이 생성 가능합니다.

#### ON DELETE 동작 패턴
| 동작 | 적용 대상 |
|------|-----------|
| `RESTRICT` | 핵심 데이터 보호 — `User→Item.createdById`, `User→Comment.userId`, `User→WorkRequest.requesterId` 등 |
| `SET NULL` | 선택적 참조 — `assigneeId`, `deletedById`, `clientId` 등 대부분의 선택적 FK |
| `CASCADE` | 연관 데이터 연쇄 삭제 — `ServiceTeam→Item/Team`, `Organization→자식Organization` |

> **주의**: `Organization` 삭제 시 자식 레코드가 CASCADE 삭제되지만, `Team`은 SET NULL입니다. 두 계층 구조 테이블의 삭제 동작이 다릅니다.

#### 비정규화 계층 참조
`File`, `Link` 테이블은 `itemId` 외에 `projectId`, `serviceId`, `teamId`도 중복 저장합니다. 조회 성능 최적화 목적이며, Multer 미들웨어에서 자동 추출합니다.

#### JSON 문자열 컬럼
PostgreSQL `jsonb` 타입 대신 `text` 컬럼에 JSON 문자열로 저장하는 패턴이 사용됩니다:
- `Comment.reactions` — 이모지별 userId 배열 (`{}` 기본값)
- `NotificationApp.config` — 플랫폼별 설정
- `ReportSnapshot.data`, `ReportSnapshot.statistics`

#### 이중 인증 (v1.1.32)
`User.authType` 컬럼('`LOCAL`' | '`LDAP`')으로 인증 방식을 분기합니다. 상세 흐름은 **[개발 가이드 §7.1 이중 인증 흐름](../guides/development/DEVELOPMENT_GUIDE.md#71-이중-인증-흐름-local-우선--ldap-fallback)** 참조.

#### 역할 계산 이중 로직
`User.positionType`(직책 enum)으로 역할을 자동 계산하되, `User.roleOverride`가 non-null이면 수동 재정의가 우선합니다.

#### 보안 주의사항
- `LdapConfig.bindPassword`는 앱 레벨 AES-256-CBC 암호화 후 저장 (`ENCRYPTION_KEY` 환경변수 필수)
- `SlackConfig`의 토큰류(`botToken`, `userToken` 등)는 현재 평문 저장 — 암호화 개선 검토 필요
- `ReportSnapshot.clientId`는 FK 제약 없음 (논리적 참조만) — 고객사 삭제 후에도 스냅샷 보존 설계
- `Project` 테이블은 `Item(type=PROJECT)`과 별개로 존재하며 레거시 여부 확인 필요

---

## 4. 웹 서버

### 4.1 Backend (Express)
- **프레임워크**: Express v4.18.2
- **언어**: TypeScript v5.3.3
- **포트**: 3001
- **바인딩**: 0.0.0.0 (외부 접근 허용)

### 4.2 Frontend (nginx Docker)
- **빌드 도구**: Vite v5.0.11 (빌드 전용)
- **프레임워크**: React v18.2.0
- **서빙 방식**: nginx:alpine Docker 컨테이너
- **포트**: 3000
- **컨테이너명**: `psta-frontend`
- **설정 경로**: `/app/psta/nginx/` (**프로덕션 정본**)
  - `nginx.conf` — nginx 설정 템플릿 (`${BACKEND_HOST}`, `${BACKEND_PORT}` envsubst 치환)
  - `docker-compose.yml` — 컨테이너 정의 (nginx 단독 실행용)
  - `Dockerfile` — nginx:alpine + gettext(envsubst 사용)
  - `entrypoint.sh` — `${BACKEND_HOST}`, `${BACKEND_PORT}` 치환 후 nginx 실행 (`exec nginx -g 'daemon off;'`)
  - `dist/` — 빌드된 정적 파일 (볼륨 마운트: `/app/psta/nginx/dist:/usr/share/nginx/html:ro`)
  - `logrotate.conf` — nginx 로그 로테이션 설정 (**소유자 반드시 root**, 아래 참고)
- **로그**: `/log/nginx/access.log`, `/log/nginx/error.log`

#### Docker Compose 파일 구분

Docker Compose 파일 구분 및 사용법은 **[설치 가이드 §4.9 nginx Docker 컨테이너 시작](../guides/installation/INSTALLATION_GUIDE.md#49-nginx-docker-컨테이너-시작-프론트엔드)** 참조.

요약:
- `/app/psta/docker-compose.yml` — 전체 스택 (db + backend + frontend), 개발/테스트용
- `/app/psta/nginx/docker-compose.yml` — nginx 단독 기동, **프로덕션 권장**

> ⚠️ **nginx.conf 파일 이중 존재**: `frontend/nginx.conf`(구버전, API 주소 `127.0.0.1:3001` 하드코딩, `/uploads` location에 `^~` 누락)와 `nginx/nginx.conf`(현행, envsubst 템플릿, `^~` 적용)가 공존합니다. 프로덕션은 반드시 `nginx/` 디렉토리의 설정을 사용해야 합니다. 루트 `docker-compose.yml`의 frontend 서비스는 `nginx/Dockerfile`을 빌드 컨텍스트로 사용하므로 동일하게 `nginx/nginx.conf`를 사용합니다.

#### logrotate 초기 설정 (최초 1회)
```bash
# 1. logrotate 설치 (없을 경우)
sudo apt install -y logrotate

# 2. symlink 등록
sudo ln -sf /app/psta/nginx/logrotate.conf /etc/logrotate.d/psta-nginx

# 3. 파일 권한/소유자 설정 (logrotate는 root 소유 + 644 필수)
sudo chown root:root /app/psta/nginx/logrotate.conf
sudo chmod 644 /app/psta/nginx/logrotate.conf

# 4. 동작 확인
sudo logrotate --debug /etc/logrotate.d/psta-nginx
```

> ⚠️ `logrotate.conf`를 수정할 때마다 소유자가 일반 사용자로 돌아가므로  
> 수정 후 항상 `sudo chown root:root /app/psta/nginx/logrotate.conf` 실행 필요

#### nginx 핵심 설정 포인트 (`nginx/nginx.conf`)
- 포트 3000 리슨
- `location ^~ /uploads` — 파일 업로드를 백엔드로 프록시 (`^~`로 정적파일 regex location보다 우선 처리)
- `location ~* \.(js|css|png|...)` — Vite 해시 파일 1년 캐싱 (`Cache-Control: public, immutable`)
- `location /` — SPA 라우팅 (`try_files $uri $uri/ /index.html`)
- `location /api/` — 백엔드 API 프록시 (`http://${BACKEND_HOST}:${BACKEND_PORT}/api/`)
- `BACKEND_HOST`, `BACKEND_PORT` 환경변수로 백엔드 주소 동적 주입 (`server.sh`에서 `hostname -I`로 자동 감지)
- `entrypoint.sh`에서 `${BACKEND_HOST}`, `${BACKEND_PORT}`만 선택적으로 envsubst 치환 (nginx 내부 변수 `$host`, `$remote_addr` 등은 보존)
- 프록시 타임아웃: read 300s, connect 60s, send 300s
- gzip 압축 활성화: text/plain, text/css, application/json, application/javascript, text/xml, svg 등
- access_log/error_log: `/var/log/nginx/` (컨테이너 내부, `/log/nginx/`로 볼륨 마운트)

#### Vite 개발 서버 allowedHosts 주의사항 (신규 도메인 배포 시)
`frontend/vite.config.ts`의 `allowedHosts`에 `dztechwill.com` 도메인이 하드코딩되어 있습니다.
```ts
// frontend/vite.config.ts
server: {
  allowedHosts: ['.dztechwill.com', 'psta.dztechwill.com'],
  ...
}
```
다른 도메인 환경에 배포하거나 개발 서버(`vite`)를 해당 도메인으로 접근할 때는 이 목록을 수정해야 합니다. 프로덕션에서는 Vite 개발 서버가 아닌 nginx를 사용하므로, 이 설정은 개발 서버 환경에서만 영향을 미칩니다.

### 4.3 서버 환경
```
프로덕션 환경:
- Backend: Node.js + compiled JavaScript (systemd: psta-backend, User=<실행계정>)
- Frontend: nginx Docker 컨테이너 (docker compose: psta-frontend, nginx/docker-compose.yml)
```

#### systemd 유닛 파일 현황

| 유닛 파일 | 위치 | 상태 | 설명 |
|-----------|------|------|------|
| `psta-backend.service` | `/etc/systemd/system/` | **활성 (enabled)** | `User=<실행계정>`, `WorkingDirectory=/app/psta/backend`, `ExecStart=/usr/bin/node dist/index.js`, `NODE_ENV=production`, `Restart=always`, `RestartSec=10`, 보안: `NoNewPrivileges=true`, `PrivateTmp=true` |
| `psta-frontend.service` | `/etc/systemd/system/` | **비활성 (레거시)** | Vite 개발 서버(`vite --host 0.0.0.0 --port 3000`)를 실행하는 구버전 유닛. 실제 프로덕션은 nginx Docker 컨테이너를 사용하므로 이 유닛은 사용하지 않음. `multi-user.target.wants`에 심볼릭 링크 없음. |

> ⚠️ `psta-backend.service`의 `User=` 값은 서버마다 다릅니다. `install.sh`는 `PSTA_USER` 환경변수(기본: 스크립트 실행 사용자)를 읽어 자동으로 유닛 파일을 생성합니다. 수동 설치 시 `User=` 항목을 실제 서비스 계정으로 반드시 지정하세요.

서버 관리 로그: `/log/psta/system/backend-service.log` (systemd ExecStart 출력)  
server.sh 이벤트 로그: `/log/psta/system/server.log` (모든 start/stop/restart 이벤트)

### 4.4 Nginx 리버스 프록시 (프로덕션)

외부에 HTTPS로 서비스할 때는 별도 Nginx 리버스 프록시를 앞단에 두는 구성이 일반적입니다.

#### 구성 예시
| 항목 | 예시 |
|------|-----|
| **도메인** | psta.your-company.com |
| **SSL 인증서** | Let's Encrypt (Certbot) |
| **Backend** | 127.0.0.1:3001 (psta-backend systemd) |
| **Frontend** | 127.0.0.1:3000 (psta-frontend Docker) |

#### Nginx 설정 예시

```nginx
server {
    listen 443 ssl;
    server_name psta.your-company.com;
    server_tokens off;

    # SSL 인증서 (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/your-company.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-company.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # API 요청 → Backend
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 업로드 파일 → Backend
    location /uploads/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 프론트엔드 → Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 프록시 라우팅
| 경로 | 대상 | 설명 |
|------|------|------|
| `/api/*` | :3001 | Backend API |
| `/uploads/*` | :3001 | 업로드 파일 |
| `/*` | :3000 | Frontend SPA |

#### Nginx 관리 명령어
```bash
# 설정 검증 (중요!)
sudo nginx -t

# 재시작 (설정 반영)
sudo systemctl restart nginx

# 또는 리로드 (무중단)
sudo nginx -s reload

# 로그 확인
sudo tail -f /var/log/nginx/error.log
```

**주의사항**:
- 설정 파일 수정 후 **반드시 `nginx -t`로 검증**
- 검증 실패 시 재시작하지 말 것 (서비스 중단 방지)
- HTTP → HTTPS 리다이렉트는 Certbot 자동 처리

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
| `pg` | ^8.21.0 | PostgreSQL 드라이버 |
| `@slack/web-api` | ^7.0.2 | Slack API 클라이언트 |
| `@types/multer` | ^2.0.0 | Multer 타입 정의 |
| `bcryptjs` | ^3.0.3 | 로컬 계정 비밀번호 해싱 |
| `cors` | ^2.8.5 | CORS 미들웨어 |
| `dotenv` | ^16.3.1 | 환경 변수 관리 |
| `express` | ^4.18.2 | 웹 프레임워크 |
| `express-validator` | ^7.0.1 | 입력 검증 |
| `jsonwebtoken` | ^9.0.2 | JWT 인증 |
| `ldapjs` | ^3.0.7 | LDAP 클라이언트 |
| `multer` | ^2.0.2 | 파일 업로드 미들웨어 |
| `node-cron` | ^4.2.1 | 스케줄러 (크론 작업) |
| `passport` | ^0.7.0 | 인증 미들웨어 |
| `passport-jwt` | ^4.0.1 | Passport JWT 전략 |
| `winston` | ^3.18.3 | 로깅 라이브러리 |
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
| `ts-node` | ^10.9.2 | TypeScript 실행 도구 |
| `typescript` | ^5.3.3 | TypeScript 컴파일러 |

> ⚠️ **@types/node 버전 불일치**: 실제 Node.js 런타임은 v24.9.0이나, `@types/node ^20.10.6`을 사용합니다. v24 이상에서 추가된 최신 Node.js API의 타입 지원이 누락될 수 있습니다. 문제가 발생할 경우 `@types/node`를 `^22.x` 이상으로 업그레이드를 검토하세요.

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
| `@tiptap/react` | ^3.13.0 | Tiptap 리치 텍스트 에디터 |
| `@tiptap/starter-kit` | ^3.13.0 | Tiptap 기본 확장 묶음 |
| `@tiptap/extension-image` | ^3.13.0 | Tiptap 이미지 확장 |
| `@tiptap/extension-link` | ^3.13.0 | Tiptap 링크 확장 |
| `@tiptap/extension-placeholder` | ^3.13.0 | Tiptap 플레이스홀더 확장 |
| `@tiptap/extension-bubble-menu` | ^3.13.0 | Tiptap 버블 메뉴 확장 |
| `@tiptap/extension-mention` | ^3.26.1 | Tiptap 멘션 확장 (버전 불일치 주의) |
| `tippy.js` | ^6.3.7 | Tiptap mention 의존 팝업 라이브러리 |
| `axios` | ^1.6.5 | HTTP 클라이언트 |
| `dayjs` | ^1.11.18 | 날짜/시간 라이브러리 |
| `emoji-picker-react` | ^4.14.1 | 이모지 선택기 |
| `gantt-task-react` | ^0.3.9 | Gantt 차트 컴포넌트 |
| `react` | ^18.2.0 | React 라이브러리 |
| `react-dom` | ^18.2.0 | React DOM 렌더러 |
| `react-markdown` | ^10.1.0 | 마크다운 렌더러 |
| `react-router-dom` | ^6.21.1 | React 라우팅 |
| `xlsx` | ^0.18.5 | Excel 파일 처리 (SheetJS 마지막 MIT 버전) |
| `zustand` | ^4.4.7 | 상태 관리 라이브러리 |

> ⚠️ **Tiptap 버전 불일치**: 대부분의 `@tiptap/*` 패키지는 `^3.13.0`이나, `@tiptap/extension-mention`은 `^3.26.1`로 다릅니다. peer dependency 충돌이 발생할 수 있으므로 `npm install` 시 경고를 확인하세요.
>
> ⚠️ **xlsx 라이선스**: `xlsx ^0.18.5`는 SheetJS의 마지막 MIT 라이선스 버전입니다. 이후 버전은 상용 라이선스로 전환되었으므로 버전 업그레이드 시 라이선스를 반드시 확인하세요.

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
- **설정 위치**: DB (`LdapConfig` 테이블) — 웹 UI에서 동적 관리
- **주의**: LDAP 설정은 `backend/.env`가 **아닌** DB에서 관리합니다. 웹 UI의 LDAP 설정 페이지에서 입력하면 암호화되어 DB에 저장됩니다.
- **필수 환경변수**: `ENCRYPTION_KEY` — LDAP 비밀번호 AES-256-CBC 암호화에 사용. 이 값이 없으면 서버가 FATAL 에러로 시작되지 않습니다.
  ```env
  # backend/.env에 반드시 설정
  ENCRYPTION_KEY=<32바이트-이상-랜덤-문자열>
  ```
  ```bash
  # ENCRYPTION_KEY 생성 예시
  openssl rand -base64 32
  ```

### 8.2 Slack API (알림)
- **API 타입**: Slack Web API
- **설정 경로**: 두 가지 방식이 공존합니다.
  - **레거시 방식**: `SystemSetting` 테이블의 `slack.*` 키 (`settings.controller.ts` 경유, `.env`의 `SLACK_BOT_TOKEN` 등)
  - **신규 방식**: `NotificationApp` 테이블 기반 (`notification-app.controller.ts` 경유, 웹 UI의 알림앱 연동 페이지)
  - 신규 설치에서는 **웹 UI(알림앱 연동 페이지)** 사용을 권장합니다.
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
| **5555** | Prisma Studio | HTTP | ⚠️ 수동 기동 시만 | DB 관리 UI (개발용) |

> ⚠️ **Prisma Studio (5555)**: `server.sh` 의 `all` 명령에서 보안상 제외됩니다. 수동으로 `server.sh start prisma-studio`(또는 `studio`) 명령으로만 기동할 수 있습니다. 외부 망에 노출되지 않도록 방화벽에서 차단하는 것을 권장합니다.

### 9.2 방화벽 설정
```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp
sudo ufw deny 5555/tcp    # Prisma Studio — 외부 차단 권장
sudo ufw reload

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --permanent --remove-port=5555/tcp  # 차단 유지
sudo firewall-cmd --reload
```

### 9.3 접속 URL
- **프로덕션**: https://psta.your-company.com (Nginx 프록시)
- **개발 (외부)**: http://your-server-ip:3000
- **개발 (로컬)**: http://localhost:3000

---

## 10. 파일 시스템

### 10.1 디렉토리 구조
```
/app/psta/                       # 애플리케이션 루트
├── backend/                     # 백엔드 코드
│   ├── src/                     # TypeScript 소스
│   ├── dist/                    # 컴파일된 JavaScript
│   ├── prisma/                  # schema.sql (설치용 스키마 덤프)
│   └── node_modules/            # 백엔드 의존성
│
├── frontend/                    # 프론트엔드 코드
│   ├── src/                     # React 소스
│   ├── dist/                    # 빌드 결과물 (빌드 후 nginx/dist/로 복사)
│   └── node_modules/            # 프론트엔드 의존성
│
├── nginx/                       # nginx Docker 서빙 설정
│   ├── Dockerfile               # nginx:alpine + gettext
│   ├── docker-compose.yml       # 컨테이너 정의 (psta-frontend)
│   ├── nginx.conf               # nginx 설정 템플릿
│   ├── entrypoint.sh            # 환경변수 치환 후 nginx 시작
│   ├── logrotate.conf           # 로그 로테이션 설정
│   └── dist/                    # 정적 파일 (volume mount → 컨테이너 내 /usr/share/nginx/html)
│
├── bin/                         # 서버 관리 스크립트
│   ├── server.sh                # 서버 start/stop/restart/status/logs (v2.0)
│   └── collect-postgres-logs.sh # psta-postgres 컨테이너 로그를 파일로 수집
│
├── install.sh                   # 원클릭 설치 스크립트 (Ubuntu 전용)
│
└── docs/                        # 문서
    ├── infrastructure/          # 인프라 문서
    ├── guides/                  # 가이드 (개발자/사용자)
    ├── features/                # 기능 소개
    └── changelog/               # 변경 이력

/data/psta/                      # 데이터 저장소 (외부)
├── uploads/                     # 업로드 파일
│   ├── client-logos/            # 클라이언트 로고 (5MB 제한)
│   └── item-files/              # 아이템 첨부 파일 (20MB 제한)
└── database/                    # PostgreSQL 데이터 (선택)

/log/psta/                       # 애플리케이션 로그
├── app/
│   └── backend/                 # 백엔드 로그 (JSON, 일별 로테이션)
├── database/                    # 데이터베이스 로그
│   └── postgresql-YYYY-MM-DD.log  # psta-postgres Docker 로그 (collect-postgres-logs.sh 수집)
├── external/                    # 외부 서비스 로그 (LDAP, Slack)
└── system/                      # 시스템 로그
    ├── backend-service.log      # systemd psta-backend.service 출력
    └── server.log               # server.sh 이벤트 로그 (start/stop/restart 타임스탬프)

/log/nginx/                      # nginx 로그 (Docker volume mount)
├── access.log                   # 접근 로그
└── error.log                    # 에러 로그

/tmp/                            # 임시 파일 (개발 모드 전용 PID 파일)
├── psta-backend.pid             # 백엔드 PID (systemd 모드에서는 미사용)
├── psta-frontend.pid            # 프론트엔드 PID (레거시, 미사용)
└── psta-prisma-studio.pid       # Prisma Studio PID
```

### 10.2 데이터 저장 위치
```
/data/psta/uploads/
├── client-logos/                # 고객사 로고 이미지 (5MB 제한)
│   ├── <uuid>.png
│   └── <uuid>.jpg
├── item-files/                  # 아이템 첨부 파일 (20MB 제한)
│   ├── <uuid>.pdf
│   ├── <uuid>.docx
│   └── <uuid>.zip
└── system/                      # 시스템 설정 파일 (system-settings.controller.ts)
    ├── logo.<ext>               # 시스템 로고 이미지
    └── favicon.<ext>            # 파비콘
```

> **참고**: 업로드 경로는 `PSTA_DATA_DIR` 환경변수로 제어됩니다 (기본값: `/data/psta`). Docker Compose 환경에서는 `docker-compose.yml`의 `PSTA_DATA_DIR` 변수를 통해 주입됩니다.

### 10.3 권한 설정
```bash
# 데이터 디렉토리 생성
sudo mkdir -p /data/psta/uploads/{client-logos,item-files,system}

# 로그 디렉토리 생성
sudo mkdir -p /log/psta/{app/backend,database,external,system}
sudo mkdir -p /log/nginx

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

### 11.4 Git
- **버전**: v2.34.1
- **저장소**: https://github.com/GUNIQ-G/psta.git

### 11.5 서버 관리 스크립트 (`bin/server.sh`)

서버 관리 스크립트의 전체 명령어, 컴포넌트 별칭, 시작 모드 분기 설명은 **[설치 가이드 §6 서버 관리](../guides/installation/INSTALLATION_GUIDE.md#6-서버-관리)** 를 참조하세요.

---

## 12. 보안 설정

### 12.1 인증
- **방식**: JWT (JSON Web Token)
- **설정**:
  ```env
  JWT_SECRET=<강력한-랜덤-문자열>
  # JWT_EXPIRES_IN 은 .env.example에 있으나 실제 소스에서 참조하지 않음 (auth.ts에 '24h' 하드코딩)
  ```

**JWT_SECRET 생성**:
```bash
openssl rand -base64 32
```

> ⚠️ **프로덕션 배포 필수 체크리스트**:
> - `JWT_SECRET`을 `docker-compose.yml`의 기본값(`change-this-secret-in-production`)에서 반드시 변경하세요.
> - `backend/.env` 또는 환경변수로 강력한 랜덤 값을 설정해야 합니다. 기본값 사용 시 보안 취약점이 발생합니다.

### 12.2 LDAP 비밀번호 암호화
- **알고리즘**: AES-256-CBC (`iv:encrypted` hex 포맷으로 DB 저장)
- **저장 위치**: PostgreSQL (`LdapConfig.bindPassword` 컬럼)
- **암호화 키**: `ENCRYPTION_KEY` 환경변수 (필수 — 미설정 시 서버 FATAL 에러)

코드 패턴 및 사용 예시는 **[개발 가이드 §3.3 AES-256-CBC 암호화 패턴](../guides/development/DEVELOPMENT_GUIDE.md#33-aes-256-cbc-암호화-패턴)** 참조.

### 12.3 파일 업로드 제한

총 5종의 multer 인스턴스가 사용됩니다:

| 업로드 대상 | 저장 경로 | 허용 타입 | 최대 크기 |
|------------|----------|----------|---------|
| 클라이언트 로고 | `uploads/client-logos/` | JPEG, PNG, GIF, WebP | 5 MB |
| 아이템 첨부 파일 | `uploads/item-files/` | 이미지, PDF, Office, 텍스트, ZIP 등 | 20 MB |
| 시스템 로고 | `uploads/system/` | JPEG, PNG, GIF, WebP, SVG | 5 MB |
| 시스템 파비콘 | `uploads/system/` | ICO, PNG, SVG | 1 MB |
| 피드백/설명 이미지 | (Tiptap 에디터 인라인) | JPEG, PNG, GIF, WebP | 5 MB |

### 12.4 환경 변수 보안
```bash
# .env 파일 권한 제한
chmod 600 /app/psta/backend/.env
```

보안 관점의 핵심 사항:
- `JWT_SECRET`은 `docker-compose.yml` 기본값(`change-this-secret-in-production`)에서 반드시 변경
- `ENCRYPTION_KEY`는 `docker-compose.yml` 환경변수 블록에 포함되지 않으므로 `backend/.env`에 직접 설정 필수
- 프론트엔드는 별도 `.env` 파일 없음 — API URL은 nginx 프록시를 통해 고정 처리

환경변수 전체 목록 및 설명은 **[설치 가이드 §3 환경변수 설정](../guides/installation/INSTALLATION_GUIDE.md#3-환경변수-설정)** 참조.

### 12.5 방화벽 권장 설정
```
허용:
- 3000/tcp (Frontend)
- 3001/tcp (Backend)

차단:
- 5432/tcp (PostgreSQL, 로컬만 허용)
- 5555/tcp (Prisma Studio, 개발용 — 외부 노출 금지)
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
