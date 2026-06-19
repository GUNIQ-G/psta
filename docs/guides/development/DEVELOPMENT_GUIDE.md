# PSTA 개발 가이드

**문서 버전**: v1.1.34
**최종 수정**: 2026-06-19
**대상**: 백엔드/프론트엔드 개발자

---

## 목차
1. [프로젝트 구조](#1-프로젝트-구조)
2. [개발 환경 설정](#2-개발-환경-설정)
3. [백엔드 개발](#3-백엔드-개발)
   - 3.1 새 API 엔드포인트 추가 (컨트롤러→라우트→index.ts 패턴)
   - 3.2 DB 쿼리 패턴 (pg query/queryOne/transaction)
   - 3.3 AES-256-CBC 암호화 패턴
   - 3.4 설치 게이트 (isInstalled) 패턴
   - 3.5 멘션 파싱 패턴
   - 3.6 ACTION 타입 부모 해석 패턴
   - 3.7 비즈니스 로직 분리
4. [프론트엔드 개발](#4-프론트엔드-개발)
   - 4.1 새 페이지 추가
   - 4.2 API 클라이언트 작성 (axios 인터셉터, Promise.all)
   - 4.3 Zustand 스토어 사용 (스토어 간 의존성, 폴링, 낙관적 UI)
   - 4.4 커스텀 훅 (refreshKey, useActionItemModal, useItemForm, useColumnResize, race condition)
   - 4.5 UI 패턴 (필터 파이프라인, 드로어 확장, URL 딥링크, 미정 엔티티 등)
   - 4.6 WBS 관련 패턴
   - 4.7 유틸리티 패턴
   - 4.8 알려진 기술 부채
5. [데이터 모델](#5-데이터-모델)
6. [API 개발](#6-api-개발) (미들웨어 체인, 에러 처리, 인증)
7. [인증 시스템](#7-인증-시스템) (이중 인증, JWT, LDAP 동기화)
8. [API 엔드포인트 참조](#8-api-엔드포인트-참조)
9. [코드 스타일 가이드](#9-코드-스타일-가이드)
10. [테스트](#10-테스트)
11. [로깅 시스템](#11-로깅-시스템)
12. [디버깅](#12-디버깅)
13. [Git 워크플로우](#13-git-워크플로우)
14. [참조 문서](#14-참조-문서)

---

## 1. 프로젝트 구조

### 1.1 전체 구조
```
/app/psta/
├── backend/                # 백엔드 (Express + TypeScript)
│   ├── src/
│   │   ├── config/         # 설정 (DB, LDAP, Multer, Slack)
│   │   ├── controllers/    # 요청 핸들러
│   │   ├── services/       # 비즈니스 로직
│   │   ├── middleware/     # 인증, 에러 처리
│   │   ├── routes/         # 라우트 정의
│   │   └── index.ts        # 진입점
│   ├── prisma/
│   │   └── schema.sql      # DB 스키마 (설치 시 psql로 적용)
│   ├── scripts/            # 유틸리티 스크립트
│   ├── dist/               # 컴파일된 JavaScript
│   └── node_modules/
│
├── frontend/               # 프론트엔드 (React + TypeScript)
│   ├── src/
│   │   ├── api/            # API 클라이언트 (axios)
│   │   ├── components/     # 재사용 컴포넌트
│   │   ├── pages/          # 페이지 컴포넌트
│   │   ├── store/          # Zustand 스토어
│   │   ├── types/          # TypeScript 타입 정의
│   │   ├── App.tsx         # 루트 컴포넌트
│   │   └── main.tsx        # 진입점
│   ├── dist/               # 빌드 결과물
│   └── node_modules/
│
├── bin/
│   └── server.sh           # 서버 관리 스크립트
│
└── docs/                   # 문서
```

### 1.2 백엔드 상세 구조
```
backend/src/
├── config/                 # 설정 모듈
│   ├── database.ts         # pg Pool 기반 query/queryOne/transaction 헬퍼
│   ├── ldap.ts             # LDAP 서비스
│   ├── multer.ts           # 파일 업로드 설정 (5종 multer 인스턴스)
│   └── logger.ts           # Winston 9개 로거
│
├── controllers/            # 요청 핸들러 (v1.1.30 라우트 통합 기준)
│   ├── auth.controller.ts              # 인증 (LOCAL 우선, LDAP fallback)
│   ├── client.controller.ts            # 고객사 CRUD
│   ├── item.controller.ts              # Item CRUD + 계층 트리
│   ├── install.controller.ts           # 웹 설치 마법사 (execSync psql)
│   ├── user.controller.ts              # 사용자 관리
│   ├── members.controller.ts           # 멤버 관리 (ADMIN)
│   ├── team.controller.ts              # 팀 관리
│   ├── permission.controller.ts        # 권한 관리
│   ├── comment.controller.ts           # 댓글 + @멘션 알림
│   ├── notification.controller.ts      # 알림 (7일 필터, 최대 50개)
│   ├── notification-app.controller.ts  # 알림 앱 연동 (Slack/Telegram/Discord)
│   ├── file.controller.ts              # 파일 업로드 (한글 파일명 UTF-8 변환)
│   ├── link.controller.ts              # 링크 관리 (페이지 제목 자동 추출)
│   ├── feedback.controller.ts          # 피드백/버그 게시판
│   ├── message.controller.ts           # 내부 메시지
│   ├── work-request.controller.ts      # 작업 요청 상태 머신
│   ├── report-snapshot.controller.ts   # 보고서 스냅샷
│   ├── organization.controller.ts      # 조직도 (LDAP OU 연동)
│   ├── ldap-admin.controller.ts        # LDAP 사용자/그룹 CRUD
│   ├── ldap-sync.controller.ts         # LDAP 동기화 (ADMIN)
│   ├── ldap-config.controller.ts       # LDAP 설정 (AES-256-CBC 암호화)
│   ├── settings.controller.ts          # LDAP/Slack 레거시 설정
│   ├── system-settings.controller.ts   # 시스템 설정 (공개 엔드포인트)
│   ├── trash.controller.ts             # 휴지통 (역할별 복원/영구삭제)
│   └── ...
│
├── services/               # 비즈니스 로직
│   ├── user.service.ts                 # 사용자 로직
│   ├── team.service.ts                 # 팀 로직
│   ├── notification.service.ts         # 통합 알림
│   ├── notification-slack.service.ts   # Slack 알림 (실제 Slack 기능 담당)
│   ├── item-calculation.service.ts     # 상태/진행률 자동 산정
│   └── settings.service.ts             # 시스템 설정
│
├── middleware/             # 미들웨어
│   └── auth.ts             # JWT 인증 (authMiddleware export)
│                           # 글로벌 에러 핸들러는 index.ts 인라인 4-인자 함수
│
├── routes/                 # 라우트 정의 (v1.1.30 통합 라우터)
│   ├── auth.routes.ts              # 인증
│   ├── item.routes.ts              # Item (개발용 /test-count 잔류 주의)
│   ├── client.routes.ts            # 고객사
│   ├── user.routes.ts              # 사용자
│   ├── members.routes.ts           # 멤버 (adminOnly 인라인 미들웨어 포함)
│   ├── assets.routes.ts            # 파일 + 링크 통합
│   ├── boards.routes.ts            # 댓글 + 피드백 통합
│   ├── notifications.routes.ts     # 알림 + 알림앱 + 메시지 통합
│   ├── org.routes.ts               # 팀 + 조직 통합
│   ├── ldap.routes.ts              # LDAP 어드민 + 설정 + 동기화 통합
│   ├── work.routes.ts              # 작업요청 + 스냅샷 통합
│   └── settings.routes.ts          # Slack/시스템 설정 통합
│
└── index.ts                # Express 앱 초기화 (미들웨어 체인, 설치 게이트)
```

> **주의**: `config/slack.ts`와 `services/slack.service.ts`는 존재하지 않습니다. Slack 기능은 `services/notification-slack.service.ts`가 담당합니다.

### 1.3 프론트엔드 상세 구조
```
frontend/src/
├── api/                    # API 클라이언트
│   ├── axios.ts            # Axios 인스턴스 (인증 헤더 자동 추가, 401 리다이렉트)
│   ├── auth.ts             # 인증 API
│   ├── items.ts            # Item API
│   ├── clients.ts          # Client API
│   ├── users.ts            # User API
│   ├── install.ts          # 설치 마법사 API (비인증, 순수 axios 직접 사용)
│   └── ...
│
├── components/             # 재사용 컴포넌트
│   ├── MainLayout.tsx              # 전체 레이아웃 (사이드바, 헤더, 폴링 생명주기)
│   ├── ItemTree.tsx                # PSTA 트리 뷰 (5단계 필터 파이프라인)
│   ├── ItemFormModal.tsx           # Item 생성/수정 폼 (타입별 FormSection 분리)
│   ├── WbsGanttCustom.tsx          # Gantt 차트
│   ├── ProjectWizardModal.tsx      # 프로젝트 위자드 (드로어 확장 토글)
│   ├── ServiceWizardModal.tsx      # 서비스 위자드 (드로어 확장 토글)
│   ├── ActionCreateDrawer.tsx      # 액션 생성 Drawer (드로어 확장 토글)
│   ├── WorkRequestDrawer.tsx       # 작업 요청 Drawer (드로어 확장 토글)
│   ├── PstaFilterDropdown.tsx      # PSTA 필터
│   ├── HierarchyToggleButtons.tsx  # 계층 토글 버튼
│   ├── HierarchyRequestModal.tsx   # 계층 요청 다단계 처리 모달
│   └── ...
│
├── hooks/                  # 커스텀 훅
│   ├── useActionItemModal.ts       # 액션 아이템 모달 상태+CRUD 캡슐화
│   ├── useItemForm.ts              # ItemFormModal 상태 통합 관리
│   ├── useUnifiedItemForm.ts       # useItemForm 확장, 계층 선택 로직 포함
│   ├── useColumnResize.ts          # 마우스 드래그 컬럼 너비 조절
│   └── ...
│
├── pages/                  # 페이지 컴포넌트
│   ├── LoginPage.tsx               # 로그인
│   ├── Dashboard.tsx               # 대시보드
│   ├── PstaSchedule.tsx            # 일정관리 (PSTA, URL 딥링크 패턴)
│   ├── WbsView.tsx                 # WBS
│   ├── Report.tsx                  # 보고서
│   ├── ClientManagement.tsx        # 클라이언트 관리 (드로어 확장 토글)
│   ├── ProjectManagement.tsx       # 프로젝트 관리
│   ├── ServiceManagement.tsx       # 서비스 관리
│   ├── ActionManagement.tsx        # 액션 관리
│   ├── TeamManagement.tsx          # 팀 관리
│   ├── UserManagement.tsx          # 회원 관리
│   ├── UserApproval.tsx            # 사용자 승인
│   ├── PermissionManagement.tsx    # 권한 관리
│   ├── WorkRequests.tsx            # 작업 요청 (URL 딥링크, 동적 footer 버튼)
│   ├── NotificationAppIntegration.tsx  # 알림앱 연동
│   └── ...
│
├── store/                  # Zustand 스토어
│   ├── authStore.ts        # 인증 상태 (permissionStore 체인 연동)
│   ├── permissionStore.ts  # 권한 상태
│   ├── messageStore.ts     # 메시지 상태 (30초 폴링)
│   ├── notificationStore.ts # 알림 상태 (30초 폴링)
│   └── ...
│
├── constants/
│   └── menuConfig.tsx      # 메뉴 단일 진실 공급원 (MENU_ENTRIES)
│
├── utils/                  # 유틸리티 함수
│   ├── recentMoves.ts      # 최근 이동 localStorage 관리
│   └── ...
│
├── types/                  # TypeScript 타입
│   ├── index.ts            # 공통 타입 정의 (Item, Prisma 관계명 반영)
│   └── user.ts             # 사용자 타입 (positionType/roleOverride 등 추가 필드)
│
├── App.tsx                 # 루트 컴포넌트 (라우팅, 전역 favicon/title 설정)
└── main.tsx                # 진입점
```

**타입 파일 주의사항**: `types/user.ts`와 `types/index.ts`에 `User`/`Team` 인터페이스가 별도 정의됨. `user.ts`에는 `positionType`, `roleOverride`, `organizationId`, `title` 등 추가 필드 포함. 임포트 시 올바른 소스 파일 확인 필요.

---

## 2. 개발 환경 설정

### 2.1 초기 설정
```bash
# 프로젝트 클론
git clone https://github.com/GUNIQ-G/psta.git
cd psta

# 백엔드 설정
cd backend
cp .env.example .env
# .env 파일 편집 (DATABASE_URL, JWT_SECRET 등)
npm install
# DB 스키마 적용 (DATABASE_URL이 .env에 설정된 후)
psql "${DATABASE_URL}" -f prisma/schema.sql

# 프론트엔드 설정
cd ../frontend
npm install
```

### 2.2 환경 변수 설정
**backend/.env**:
```env
DATABASE_URL="postgresql://psta_user:psta_password@localhost:5432/psta"
JWT_SECRET="your-strong-secret-key"
JWT_EXPIRES_IN="24h"
PORT=3001
FRONTEND_URL="http://localhost:3000"
```

### 2.3 서버 실행

서버 실행 방법 및 `server.sh` 스크립트 전체 사용법은 **[설치 가이드 §6 서버 관리](../installation/INSTALLATION_GUIDE.md#6-서버-관리)** 참조.

개발 환경 빠른 시작:
```bash
# 전체 시스템 시작 (권장)
/app/psta/bin/server.sh start

# 개발 모드 개별 실행
cd /app/psta/backend && npm run dev  # 터미널 1
cd /app/psta/frontend && npm run dev # 터미널 2
```

### 2.4 개발 서버 포트

포트 정보 원본은 **[인프라 명세 §9.1 포트 사용 현황](../../infrastructure/INFRASTRUCTURE.md#91-포트-사용-현황)** 참조.

- Backend: http://localhost:**3001**
- Frontend: http://localhost:**3000** (nginx Docker 컨테이너)

### 2.6 유틸리티 스크립트

`backend/src/scripts/` 디렉터리에 데이터 관리 및 마이그레이션용 스크립트가 있습니다.

**실행 방법**:
```bash
cd /app/psta/backend
npx ts-node src/scripts/<script-name>.ts
```

**스크립트 목록**:

| 스크립트 | 용도 |
|----------|------|
| `run-full-sync.ts` | LDAP 전체 동기화 실행 |
| `check-ldap-structure.ts` | LDAP 서버 구조 확인 |
| `update-team-department-numbers.ts` | 팀 부서번호 업데이트 |
| `fix-team-names.ts` | 팀 이름 수정 |
| `add-undecided-services.ts` | 미정 서비스 추가 |
| `migrate-to-service-team.ts` | ServiceTeam 관계로 마이그레이션 |
| `restore-service-teams.ts` | ServiceTeam 관계 복원 |
| `cleanup-duplicate-teams.ts` | 중복 팀 정리 |
| `cleanup-orphan-actions.ts` | 고아 액션 정리 |
| `check-duplicate-actions.ts` | 중복 액션 확인 |
| `check-serviceteam-issue.ts` | ServiceTeam 이슈 진단 |
| `check-specific-project.ts` | 특정 프로젝트 상세 확인 |
| `verify-actions.ts` | 액션 데이터 검증 |

**주의**: 프로덕션 환경에서 실행 전 반드시 백업을 권장합니다.

---

## 3. 백엔드 개발

### 3.1 새 API 엔드포인트 추가

#### Step 1: Controller 작성

실제 컨트롤러 패턴을 따릅니다. 에러 처리 시 `errorLogger`를 사용하고, 500 응답은 고정 문자열 `'Internal server error'`를 반환합니다 (에러 메시지 노출 금지).

`backend/src/controllers/example.controller.ts`:
```typescript
import { Response } from 'express';
import { query, queryOne } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { errorLogger } from '../config/logger';

export const getExamples = async (req: AuthRequest, res: Response) => {
  try {
    const examples = await query<Example>('SELECT * FROM "Example" ORDER BY "createdAt" DESC');
    res.json(examples);
  } catch (error) {
    errorLogger.error('Error in getExamples', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createExample = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const example = await queryOne<Example>(
      'INSERT INTO "Example" (id, name, description) VALUES (gen_random_uuid(), $1, $2) RETURNING *',
      [name, description]
    );
    res.status(201).json(example);
  } catch (error) {
    errorLogger.error('Error in createExample', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Internal server error' });
  }
};
```

#### Step 2: Route 정의

인증 미들웨어는 `authMiddleware`로 import합니다 (`middleware/auth.ts`에서 export, `auth.middleware.ts` 아님).

두 가지 패턴이 존재합니다:

**패턴 A — router.use 일괄 적용** (공개 엔드포인트 없을 때 권장):
```typescript
import { Router } from 'express';
import { getExamples, createExample } from '../controllers/example.controller';
import authMiddleware from '../middleware/auth';

const router = Router();

// 진입 시 모든 라우트에 일괄 적용
router.use(authMiddleware);

router.get('/', getExamples);
router.post('/', createExample);

export default router;
```

**패턴 B — 퍼-라우트 개별 적용** (공개 엔드포인트와 혼용 시):
```typescript
import authMiddleware from '../middleware/auth';

router.get('/public', getPublicInfo);           // 공개
router.get('/', authMiddleware, getExamples);   // 인증 필요
router.post('/', authMiddleware, createExample);
```

#### Step 3: App에 등록
`backend/src/index.ts`:
```typescript
import exampleRoutes from './routes/example.routes';

app.use('/api/examples', exampleRoutes);
```

> **설치 게이트 주의**: `index.ts`에는 `isInstalled()` 검사 미들웨어가 있습니다. 미설치 상태에서는 `/api/install` 접두사와 `/health` 외 모든 요청이 503으로 차단됩니다. 웹 설치 마법사(`/api/install/*`) 라우터는 이 게이트보다 먼저 등록되어 설치 전에도 동작합니다.

### 3.2 DB 쿼리 패턴 (pg 드라이버)

PSTA 백엔드는 Prisma ORM 없이 `pg` (node-postgres)를 직접 사용합니다 (Prisma는 스키마 파일 관리용으로만 사용, 런타임 미사용). `config/database.ts`에서 3개의 헬퍼 함수만 export합니다.

**Pool 설정**: max=20 연결, idleTimeoutMillis=30000ms, connectionTimeoutMillis=2000ms. `NODE_ENV !== 'production'`이면 쿼리 실행 시간을 debug 로그로 출력합니다.

**헬퍼 함수 사용법**:

```typescript
import { query, queryOne, transaction } from '../config/database';

// 여러 행 조회 → T[]
const items = await query<Item>('SELECT * FROM "Item" WHERE "isDeleted" = false');

// 단일 행 조회 → T | null (행 없으면 null)
const item = await queryOne<Item>('SELECT * FROM "Item" WHERE id = $1', [id]);
if (!item) return res.status(404).json({ error: 'Not found' });

// 트랜잭션 — BEGIN/COMMIT/ROLLBACK 자동 관리
// fn 실행 중 예외 발생 시 자동 ROLLBACK 후 예외 재throw (원자적 실행 보장)
const result = await transaction(async (client) => {
  await client.query('UPDATE "Item" SET name = $1 WHERE id = $2', [name, id]);
  const updated = await client.query('SELECT * FROM "Item" WHERE id = $1', [id]);
  return updated.rows[0];
});
```

**쿼리 작성 규칙**:
- PostgreSQL camelCase 컬럼은 반드시 큰따옴표: `"isDeleted"`, `"createdAt"`, `"parentId"`
- 파라미터화 필수: `$1`, `$2`, ... 순서 (SQL injection 방지)
- UUID 생성: Node.js `randomUUID()` 또는 SQL `gen_random_uuid()`
- ON CONFLICT upsert: `SystemSetting(key)`, `Permission(role, resource)` 등 설정성 데이터
- 동적 SET 절: `setClauses` 배열 + `params` 배열 순차 push로 변경할 컬럼만 선택적 업데이트
- Promise.all 병렬 쿼리: 독립적 COUNT/조회 쿼리를 병렬 실행 (feedback stats 6개 쿼리 등)
- WITH CTE 패턴: `INSERT ... RETURNING *` 후 JOIN SELECT를 단일 쿼리로 처리 (message, report-snapshot)
- json_agg 집계: 관련 항목을 단일 쿼리로 중첩 반환 (client → projects)
- USER_COLS 보안 패턴: 서브쿼리에서 User 컬럼을 id/username/displayName/email 4개로 제한 (password hash 등 민감 정보 자동 제외)

**소프트 삭제 이중 패턴**:
- `Client`: `isActive = false` (조회 시 `WHERE "isActive" = true`)
- `Item`: `isDeleted = true` (조회 시 `WHERE "isDeleted" = false`)

**스키마 변경 시**:
1. `backend/prisma/schema.sql` 직접 수정 (DDL ALTER TABLE 등)
2. 운영 DB에 수동 적용: `psql "${DATABASE_URL}" -c "ALTER TABLE ..."` 또는 psql로 파일 실행
3. 백엔드 재시작: `./bin/server.sh restart backend`

### 3.3 AES-256-CBC 암호화 패턴

LDAP `bindPassword` 등 민감 정보는 DB에 평문 저장하지 않습니다. `ENCRYPTION_KEY` 환경변수가 없으면 서버 FATAL 에러가 발생합니다. DB에는 `iv:encrypted(hex)` 포맷으로 저장됩니다.

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(ivEncrypted: string): string {
  const [ivHex, encHex] = ivEncrypted.split(':');
  const decipher = createDecipheriv('aes-256-cbc', Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'), Buffer.from(ivHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString();
}
```

### 3.4 설치 게이트 (isInstalled) 패턴

`index.ts` 전역 미들웨어 체인에 설치 상태 검사가 포함되어 있습니다. 미설치 상태에서는 `/api/install` 접두사와 `/health` 외 모든 요청이 503으로 차단됩니다. 웹 설치 마법사(`install.controller.ts`)는 `execSync`로 `psql` CLI를 직접 호출하여 `schema.sql`을 적용합니다. `psql`이 시스템 PATH에 있어야 동작합니다.

### 3.5 멘션 파싱 패턴

댓글과 아이템 설명에서 공통으로 사용하는 멘션 형식:

```typescript
// 멘션 형식: @[displayName](userId)
const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;

// 아이템 정보 커스텀 마크업 (메시지 내 구조화)
// 예: [ITEM_INFO]{"id":"uuid","name":"아이템명"}[/ITEM_INFO]

// 멘션 파싱 예시
const mentions: Array<{ displayName: string; userId: string }> = [];
let match;
while ((match = mentionRegex.exec(content)) !== null) {
  mentions.push({ displayName: match[1], userId: match[2] });
}
// 멘션된 사용자에게 Notification + Message 동시 생성
```

### 3.6 ACTION 타입 부모 해석 패턴

ACTION 생성/이동 시 부모 참조 방식이 두 가지이며 `serviceTeamId`가 `parentId`보다 우선 처리됩니다:
- `serviceTeamId` 있으면: `ServiceTeam` 테이블 경유로 `parentId`(SERVICE ID) 자동 해석
- `serviceTeamId` 없으면: `parentId`를 직접 SERVICE ID로 사용

### 3.7 비즈니스 로직 분리

복잡한 로직은 Service로 분리:

`backend/src/services/example.service.ts`:
```typescript
import { queryOne } from '../config/database';

export class ExampleService {
  static async processExample(data: any) {
    // 복잡한 비즈니스 로직
    const processed = await this.someComplexOperation(data);

    // 데이터베이스 저장
    return await queryOne(
      'INSERT INTO "Example" (id, name, description) VALUES (gen_random_uuid(), $1, $2) RETURNING *',
      [processed.name, processed.description]
    );
  }

  private static async someComplexOperation(data: any) {
    // ...
    return data;
  }
}
```

Controller에서 호출:
```typescript
import { ExampleService } from '../services/example.service';
import { errorLogger } from '../config/logger';

export const createExample = async (req: AuthRequest, res: Response) => {
  try {
    const result = await ExampleService.processExample(req.body);
    res.json(result);
  } catch (error) {
    errorLogger.error('Error in createExample', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
```
---

## 4. 프론트엔드 개발

### 4.1 새 페이지 추가

#### Step 1: 페이지 컴포넌트 작성
`frontend/src/pages/ExamplePage.tsx`:
```typescript
import React, { useEffect, useState } from 'react';
import { Table, Button } from 'antd';
import { exampleApi } from '../api/examples';

const ExamplePage: React.FC = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const result = await exampleApi.getAll();
    setData(result);
  };

  return (
    <div>
      <h1>Example Page</h1>
      <Table dataSource={data} rowKey="id" />
    </div>
  );
};

export default ExamplePage;
```

#### Step 2: 라우트 추가
`frontend/src/App.tsx`:
```typescript
import ExamplePage from './pages/ExamplePage';

<Route path="/examples" element={<ExamplePage />} />
```

#### Step 3: 메뉴 + 권한 등록 (한 파일만 수정)

**`frontend/src/constants/menuConfig.tsx`** — 이 파일 하나만 수정하면 사이드바·라우트 보호·권한관리 UI가 모두 자동 반영됩니다.

```tsx
// MENU_ENTRIES 배열에 항목 추가
{
  route: '/examples',
  resource: 'examples',          // DB Permission 리소스 키
  label: '예제 페이지',
  group: '데이터 관리',           // 사이드바 그룹 (없으면 사이드바에 안 보임)
  icon: <AppstoreOutlined />,    // 사이드바 아이콘 (없으면 사이드바에 안 보임)
  // badge: { text: 'E', color: '#722ed1' },  // 선택: P/S/T/A 같은 배지
  // permGroup: '데이터 관리',   // 권한관리 UI 그룹 (group과 다를 때만)
},
```

| 속성 | 필수 | 설명 |
|---|---|---|
| `route` | ✅ | URL 경로 |
| `resource` | ✅ | DB Permission 리소스 키 |
| `label` | ✅ | 표시 이름 |
| `group` | 선택 | 사이드바 그룹명 (없으면 사이드바 미표시) |
| `icon` | 선택 | 사이드바 아이콘 (없으면 사이드바 미표시) |
| `badge` | 선택 | 우측 배지 태그 (text, color) |
| `permGroup` | 선택 | 권한관리 UI 그룹 (기본값: group) |

**자동 반영되는 곳:**
- `ROUTE_RESOURCE_MAP` → App.tsx ProtectedRoute 권한 체크
- `SIDEBAR_GROUPS` → MainLayout.tsx 사이드바 메뉴
- `PERMISSION_GROUPS` → PermissionManagement.tsx 권한관리 UI

**Step 4: DB Permission 행 추가**

새 resource는 DB에 존재해야 권한관리 UI에서 값을 저장할 수 있습니다.

```sql
-- 역할별 초기 권한 설정 (예: examples는 모든 role이 조회 가능)
INSERT INTO "Permission" (id, role, resource, "canView", "canCreate", "canUpdate", "canDelete", "updatedAt")
VALUES
  (gen_random_uuid(), 'ADMIN',  'examples', true,  true,  true,  true,  NOW()),
  (gen_random_uuid(), 'PO',     'examples', true,  false, false, false, NOW()),
  (gen_random_uuid(), 'PM',     'examples', true,  false, false, false, NOW()),
  (gen_random_uuid(), 'MEMBER', 'examples', true,  false, false, false, NOW())
ON CONFLICT (role, resource) DO NOTHING;
```

또는 관리자가 **권한관리 페이지**에서 역할별 on/off를 직접 설정.

### 4.2 API 클라이언트 작성

#### axios 인터셉터 패턴 (`api/axios.ts`)

공유 `axiosInstance`에는 두 가지 인터셉터가 설정되어 있습니다.

- **요청 인터셉터**: `localStorage.getItem('token')` 값을 `Authorization: Bearer <token>` 헤더로 자동 주입
- **응답 인터셉터**: HTTP 401 수신 시, 현재 경로가 `/login`이 아니고 요청 URL이 `/auth/login`이 아닐 때만 token 삭제 + `/login` 리다이렉트 (무한 루프 방지 조건)

**install.ts 비인증 예외**: 설치 마법사(`install.ts`)는 공유 `axiosInstance` 대신 순수 `axios`(import axios from 'axios')를 직접 사용합니다. `baseURL`은 `/api/install`로 하드코딩되어 있으며, 인증 인터셉터를 우회하여 미설치 상태에서도 API를 호출할 수 있습니다.

**주의**: `work-requests.ts`는 `apiClient`를 named import로 사용하는 반면, 다른 파일들은 default import를 사용합니다. 새 API 파일 작성 시 default import 방식을 권장합니다.

`frontend/src/api/examples.ts`:
```typescript
import axiosInstance from './axios';

export const exampleApi = {
  getAll: async () => {
    const response = await axiosInstance.get('/examples');
    return response.data;
  },

  create: async (data: any) => {
    const response = await axiosInstance.post('/examples', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await axiosInstance.put(`/examples/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await axiosInstance.delete(`/examples/${id}`);
  },
};
```

#### Promise.all 병렬 페치 패턴

여러 독립적인 API를 동시에 호출하여 순차 호출 대비 로딩 시간을 단축합니다.

```typescript
const fetchData = async () => {
  const [users, teams, clients] = await Promise.all([
    usersApi.getAll(),
    teamsApi.getAll(),
    clientsApi.getAll(),
  ]);
  setUsers(users);
  setTeams(teams);
  setClients(clients);
};
```

### 4.3 Zustand 스토어 사용

`frontend/src/store/exampleStore.ts`:
```typescript
import { create } from 'zustand';

interface ExampleState {
  examples: any[];
  setExamples: (examples: any[]) => void;
  addExample: (example: any) => void;
}

export const useExampleStore = create<ExampleState>((set) => ({
  examples: [],
  setExamples: (examples) => set({ examples }),
  addExample: (example) => set((state) => ({
    examples: [...state.examples, example],
  })),
}));
```

사용:
```typescript
import { useExampleStore } from '../store/exampleStore';

const ExamplePage = () => {
  const { examples, setExamples } = useExampleStore();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const data = await exampleApi.getAll();
    setExamples(data);
  };

  return <Table dataSource={examples} />;
};
```

#### 스토어 간 의존성 체인

`authStore`와 `permissionStore`는 직접 연동되어 있습니다.

- `authStore.login()` 성공 후 내부에서 `usePermissionStore.getState().fetchPermissions()` 직접 호출
- `authStore.logout()`에서 `permissionStore.clear()` 연동
- `authStore.fetchUser()` 완료 후도 동일 패턴

#### permissionStore 사용 가이드

```typescript
import { usePermissionStore } from '../store/permissionStore';

const { hasPermission } = usePermissionStore();

// resource 문자열은 menuConfig.tsx의 MENU_ENTRIES[].resource와 동일
const canView   = hasPermission('examples', 'canView');
const canCreate = hasPermission('examples', 'canCreate');
const canUpdate = hasPermission('examples', 'canUpdate');
const canDelete = hasPermission('examples', 'canDelete');
```

`PermissionButton` 컴포넌트 또는 `useHasPermission()` 훅으로도 접근 가능합니다.

#### 폴링 생명주기 관리

`messageStore`와 `notificationStore`는 모듈 스코프 변수(`let pollingInterval`)로 `setInterval`을 관리합니다.

- `startPolling()` 첫 호출 시 즉시 1회 실행 후 30초 간격 반복
- `!pollingInterval` 조건으로 이중 시작 방지
- `MainLayout.tsx`에서 앱 마운트 시 `start`, 언마운트 시 `stop` 호출

#### 낙관적 UI 업데이트 패턴

`markAsRead`, `deleteMessage`, `markNotificationAsRead`, `markAllAsRead`는 API 응답 대기 없이 Zustand 로컬 상태를 즉시 변경합니다. 실패 시 롤백은 없으며, 서버와 일시적 불일치를 허용하는 설계입니다.

### 4.4 커스텀 훅

#### refreshKey 패턴

목록 새로고침이 필요한 페이지에서 `useEffect` 재실행을 강제 트리거합니다.

```typescript
const [refreshKey, setRefreshKey] = useState<number>(0);

useEffect(() => {
  fetchData();
}, [refreshKey]);  // refreshKey 변경 시 fetchData 재실행

// 새로고침이 필요할 때
const handleRefresh = () => setRefreshKey(k => k + 1);
```

#### useActionItemModal

액션 아이템 모달의 상태, 데이터 패치, CRUD를 캡슐화한 훅입니다.

```typescript
import { useActionItemModal } from '../hooks/useActionItemModal';

const { openModal, modalProps } = useActionItemModal({
  onSuccess: handleRefresh,
  options: {
    fixedType: 'ACTION',       // 타입 고정
    nameLabel: '작업명',       // 이름 필드 레이블 변경
    hideClientField: true,     // 고객사 필드 숨김
  },
});

// 모달 열기
openModal(selectedItem);

// JSX에서 사용 — modalProps를 스프레드로 전달
<ItemFormModal {...modalProps} />
```

#### useItemForm / useUnifiedItemForm

`ItemFormModal`의 파일/링크/계층선택/편집모드 상태를 훅으로 완전 위임합니다. 컴포넌트는 렌더링만 담당합니다.

- `useItemForm`: Ant Design `FormInstance`를 받아 파일/링크/relatedDocs 상태, 업로드/삭제 핸들러, 조회-수정 토글(`toggleEditMode`)을 통합 관리. `item`이 `undefined`이면 모달 닫힌 것으로 처리
- `useUnifiedItemForm`: `useItemForm`을 base로 확장. SERVICE 타입은 `clientId`로 프로젝트 목록 필터링, ACTION 타입은 프로젝트→서비스→팀 3단계 계층 선택 로직 포함

#### useColumnResize

마우스 드래그로 컬럼 너비를 조절하는 훅입니다. WBS 타임라인 계층 패널에서 사용합니다.

- `mousedown` 이벤트 시작 → `document` 레벨에 `mousemove`/`mouseup` 이벤트 리스너 등록
- 드래그 중 `cursor: col-resize`, `userSelect: none` 스타일 강제 적용
- `mouseup` 또는 컴포넌트 언마운트 시 이벤트 리스너 cleanup

#### race condition 방지 requestId 패턴

빠른 필터 변경 등으로 API 요청이 중복될 때 이전 응답을 무시합니다. `ItemTree`에서 사용합니다.

```typescript
const latestRequestIdRef = useRef<number>(0);

const fetchData = async () => {
  const requestId = ++latestRequestIdRef.current;
  const result = await someApi.getAll(filters);

  // 현재 최신 ID와 다르면 이전 응답이므로 무시
  if (requestId !== latestRequestIdRef.current) return;
  setData(result);
};
```

### 4.5 UI 패턴

#### 5단계 필터 파이프라인 (ItemTree)

`ItemTree` 컴포넌트는 다음 순서로 재귀 필터 체이닝을 수행합니다. 각 단계는 순수 함수로 분리되어 있습니다.

```
1. 삭제 항목 제거 (isDeleted)
2. 미정 항목 제거 (이름에 '미정' 포함, 옵션)
3. 계층 필터 (고객/프로젝트 선택 기반)
4. 빈 팀 제거 (하위 액션 없는 팀)
5. 검색어 필터
```

#### 드로어 확장 토글 패턴

`ActionCreateDrawer`, `ProjectWizardModal`, `ServiceWizardModal`, `WorkRequestDrawer`, `ClientManagement`에 공통으로 구현된 패턴입니다.

```typescript
const [expanded, setExpanded] = useState(false);

// 드로어 너비: 사이드바(200px) 기준
const drawerWidth = expanded ? 'calc(100vw - 200px)' : '50%';

// 화살표 버튼: position:fixed로 사이드바 우측 엣지에 고정
<Button
  style={{ position: 'fixed', left: expanded ? 200 : '50%', top: '50%' }}
  onClick={() => setExpanded(e => !e)}
  icon={expanded ? <RightOutlined /> : <LeftOutlined />}
/>
```

#### URL 파라미터 딥링크 패턴

`PstaSchedule.tsx`, `WorkRequests.tsx`에서 사용합니다.

```typescript
const [searchParams, setSearchParams] = useSearchParams();
const itemId = searchParams.get('itemId');

useEffect(() => {
  if (itemId) {
    openItemDetail(itemId);
    setSearchParams({});  // 파라미터 제거 (히스토리 오염 방지)
  }
}, [itemId]);
```

#### 동적 footer 버튼 패턴 (WorkRequests)

역할과 상태에 따라 버튼 배열을 런타임에 조건부 구성합니다.

```typescript
const footerButtons = [
  isRequester && status === 'PENDING' && (
    { label: '취소', onClick: handleCancel, danger: true }
  ),
  isAssignee && status === 'IN_PROGRESS' && (
    { label: '완료', onClick: handleComplete }
  ),
  isAdmin && (
    { label: '삭제', onClick: handleDelete, danger: true }
  ),
].filter(Boolean);
```

#### 역할 기반 초기 탭 패턴

```typescript
const { user } = useAuthStore();
const defaultActiveKey = user?.role === 'ADMIN' ? 'all' : 'received';

<Tabs defaultActiveKey={defaultActiveKey} ... />
```

#### 타입별 FormSection 분리 패턴

`ItemFormModal`이 `currentType`에 따라 해당 FormSection 컴포넌트만 렌더링합니다. 각 FormSection은 공통 `CommonFormFields`를 포함하고 타입별 추가 필드를 렌더링합니다.

```typescript
const renderFormSection = () => {
  switch (currentType) {
    case 'PROJECT': return <ProjectFormSection ... />;
    case 'SERVICE': return <ServiceFormSection ... />;
    case 'ACTION':  return <ActionFormSection ... />;
    default:        return null;
  }
};
```

#### 상태↔진행률 양방향 자동 연동

`ActionFormSection`과 `ActionCreateDrawer`에 동일 로직이 구현되어 있습니다.

- 진행률 0% → `NOT_STARTED`
- 진행률 1~99% → `IN_PROGRESS`
- 진행률 100% → `COMPLETED`
- `ON_HOLD` 상태는 예외 보호 (진행률 변경 시 덮어쓰지 않음)

#### 계층 요청 다단계 처리 패턴 (HierarchyRequestModal)

`validationResult.suggestions` 배열을 `currentStep` 인덱스로 순회합니다. 각 단계에서 SELECT(기존 선택)/REQUEST(신규 요청) 라디오 전환, 관리자 우선순위(팀 PO/PM → 전체 PO → 전체 PM) 자동 선택합니다.

#### 미정(未定) 엔티티 컨벤션

이름 문자열에 `'미정'`이 포함되면 자동 처리됩니다. 별도 DB 필드 없이 이름 문자열로만 감지하는 설계입니다.

- 목록 상단 고정
- 노란 배경 표시
- 생성 시 `description`에 메타데이터 자동 기록

#### isUnified 플래그 패턴

`'통합 미정 서비스'` 가상 행을 API 응답 후 클라이언트에서 생성(`push`)합니다. `isUnified: true` 플래그로 편집/삭제 UI를 차단합니다.

```typescript
// API 응답 후 클라이언트에서 가상 행 추가
const unifiedRow = { ...undecidedService, isUnified: true, name: '통합 미정 서비스' };
services.push(unifiedRow);

// 렌더링 시 편집 차단
{!record.isUnified && <Button onClick={() => openEdit(record)}>편집</Button>}
```

#### UNASSIGNED UUID 상수

미정 항목을 식별하는 UUID가 여러 파일에 하드코딩되어 있습니다. 값 변경 시 여러 파일을 동시에 수정해야 하므로 상수 파일로 분리하는 것을 권고합니다.

```typescript
// 현재 하드코딩된 값 (변경 시 전체 검색 필요)
const UNASSIGNED_PROJECT_ID = 'f9c9f2d2-6e0c-4e63-838d-e0a4c5ad4de7';
const UNASSIGNED_SERVICE_ID = 'caeb1542-73bf-4edb-b7c5-073a97771ff1';
```

#### App.tsx 전역 favicon/title 설정

앱 초기화 시 `systemSettingsApi.getSettings()`를 호출하여 `document.title`과 `link[rel=icon]`을 설정합니다.

```typescript
// App.tsx 초기화 시
const settings = await systemSettingsApi.getSettings();
document.title = settings.systemName;
updateFaviconInBrowser(settings.logoUrl);

// updateFaviconInBrowser: DOM 직접 조작
const updateFaviconInBrowser = (url: string) => {
  let link = document.querySelector<HTMLLinkElement>('link[rel=icon]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;
};
```

`GeneralSettings.tsx`(로고 변경 시)와 `App.tsx`(앱 초기화 시) 두 곳에 중복 구현되어 있으므로 유틸 함수화를 권고합니다.

### 4.6 WBS 관련 패턴

#### ViewMode 설정 객체 패턴 (`viewModeConfig.ts`)

각 ViewMode별 설정을 단일 `Record<ViewMode, Config>` 객체로 관리합니다.

```typescript
// VIEW_MODE_CONFIGS 구조
const VIEW_MODE_CONFIGS: Record<ViewMode, ViewModeConfig> = {
  week:     { cellMinWidth: 40,  navigationStep: 7,  gridGenerator: generateDayGrid,    label: '주' },
  biweek:   { cellMinWidth: 40,  navigationStep: 14, gridGenerator: generateDayGrid,    label: '2주' },
  month:    { cellMinWidth: 30,  navigationStep: 30, gridGenerator: generateDayGrid,    label: '월' },
  quarter:  { cellMinWidth: 60,  navigationStep: 90, gridGenerator: generateMonthGrid,  label: '분기' },
  year:     { cellMinWidth: 50,  navigationStep: 365,gridGenerator: generateMonthGrid,  label: '연' },
  fiveyear: { cellMinWidth: 80,  navigationStep: 1825,gridGenerator: generateBiMonthGrid, label: '5년' },
};

// navigateTimelineDate()가 config를 읽어 날짜 계산
navigateTimelineDate(currentDate, direction, viewMode) {
  const { navigationStep } = VIEW_MODE_CONFIGS[viewMode];
  return addDays(currentDate, direction * navigationStep);
}
```

셀 타입은 `day`(주/2주/월), `month`(분기/연), `bimonth`(5년) 세 가지입니다.

#### 타임라인 바 계산 (`timelineCalculator.ts`)

셀 배열을 순회해 시작/종료 셀 인덱스와 셀 내 오프셋 비율을 구한 뒤 `left%`, `width%`로 절대 위치 렌더링합니다.

```typescript
// calculateTimelineBar(item, cells) → { left: string, width: string }
const bar = calculateTimelineBar(item, timelineCells);
<div style={{ position: 'absolute', left: bar.left, width: bar.width }} />
```

#### wbsStyles.ts CSS 상수 패턴

반복되는 `CSSProperties` 객체를 named export 상수로 분리합니다. 새 WBS 컴포넌트 작성 시 이 파일을 먼저 확인하여 중복을 방지합니다.

```typescript
// 정적 스타일 — named export 상수
export const headerCellStyle: CSSProperties = { ... };
export const treeRowBaseStyle: CSSProperties = { ... };

// 동적 스타일 — getter 함수로 인수 받아 반환
export const getTreeRowStyle = (depth: number, isSelected: boolean): CSSProperties => ({
  paddingLeft: depth * 20,
  backgroundColor: isSelected ? '#e6f7ff' : 'transparent',
});
```

### 4.7 유틸리티 패턴

#### recentMoves.ts localStorage 패턴

아이템 이동 기능 구현 시 `moveItem` API 호출 후 `saveRecentMove`를 호출합니다.

```typescript
import { saveRecentMove, getRecentMoves, clearRecentMoves } from '../utils/recentMoves';

// 아이템 이동 후 저장
await itemsApi.moveItem(itemId, targetId);
saveRecentMove(item);  // serviceTeamId 기준 중복 제거, 7일 만료, 최대 3개

// 최근 이동 목록 조회
const recentMoves = getRecentMoves();
```

#### getHierarchyNames() 패턴

아이템의 `parent` 체인을 재귀 순회하여 P/S/T/A 레이블과 이름을 생성합니다. `IntegratedFileList`, `ItemDetailModal` 등에서 계층 위치 태그 표시에 사용합니다.

```typescript
// 반환 예: [{ label: 'P', name: '프로젝트명' }, { label: 'S', name: '서비스명' }, ...]
const hierarchy = getHierarchyNames(item);
```

#### getAllDescendantIds() 재귀 패턴

조직 트리 노드에서 하위 팀 ID를 모두 수집합니다. `TeamStatusOverview`에서 상위 조직 선택 시 하위 팀 액션도 포함 집계할 때 사용합니다.

```typescript
const descendantIds = getAllDescendantIds(organizationNode, orgTree);
// descendantIds: string[] — 선택된 조직 및 모든 하위 팀 ID
```

#### PositionType → UserRole 자동 매핑

```
PART_LEADER, TEAM_LEADER → PM
DIRECTOR, HEAD, EXECUTIVE, SENIOR_EXEC, VICE_PRES → PO
NONE → MEMBER
```

`roleOverride`가 설정된 경우 자동 매핑보다 우선 적용됩니다. `types/user.ts`에 `POSITION_DISPLAY_NAMES`, `ROLE_DISPLAY_NAMES` Record 상수가 정의되어 있어 UI 한글 표시에 활용합니다.

### 4.8 알려진 기술 부채

| 항목 | 위치 | 권고 사항 |
|------|------|-----------|
| UNASSIGNED UUID 하드코딩 | 여러 컴포넌트 | 별도 상수 파일로 분리 |
| `updateFaviconInBrowser()` 중복 | `App.tsx`, `GeneralSettings.tsx` | 공통 유틸 함수화 |
| JWT를 localStorage에 직접 저장 | `api/axios.ts` | httpOnly 쿠키 미사용으로 XSS 취약 가능성 (보안 가이드 참고) |
| `ldap-admin.ts` API 응답 불일치 | `api/ldap-admin.ts` | `response.data` 미추출, 다른 모듈과 일관성 부재 |
| `slack-config.ts`(레거시)와 `notification-app.ts`(신규) 병존 | `pages/` | 레거시 `Settings.tsx`도 공존, deprecated 여부 및 삭제 계획 필요 |
| `work-requests.ts` named import | `api/work-requests.ts` | 다른 파일의 default import 방식과 불통일 |

---

## 5. 데이터 모델

DB 스키마, ENUM 타입, 테이블 관계도, 설계 패턴 전체는 **[인프라 명세 §3 데이터베이스](../../infrastructure/INFRASTRUCTURE.md#3-데이터베이스)** 참조.

### 5.1 개발 필수 개념: Item 계층 구조

실제 UI/코드 기준으로 계층은 3단계입니다. `TEAM` 타입은 DB에 존재하지만 독립 계층이 아닌 Action 소속팀 지정 방식으로만 사용됩니다.

```
Project (PROJECT)
  └─ Service (SERVICE)
      └─ Action (ACTION)  ← 생성 시 Team(소속팀) 지정
```

**소프트 삭제 이중 패턴** (쿼리 작성 시 주의):
- `Client`: `isActive = false` → `WHERE "isActive" = true`
- `Item`: `isDeleted = true` → `WHERE "isDeleted" = false`

**상태 자동 산정**: ACTION은 수동 입력. SERVICE/PROJECT는 하위 ACTION 진행률 평균으로 자동 계산 (`item-calculation.service.ts`의 `updateItemAndParents(itemId)` 호출).

---

## 6. API 개발

### 6.1 인증 미들웨어

실제 파일: `middleware/auth.ts` (auth.middleware.ts 아님).

**동작 순서**: Bearer 토큰 추출 → `jwt.verify(JWT_SECRET)` → DB에서 `User` 재조회 (`isActive` 실시간 검증, 토큰만으로 미신뢰) → `req.user`에 `UserPayload` 주입 → 실패 시 401 반환.

DB 재조회를 통해 토큰 탈취 후 계정 비활성화 시 즉시 차단 가능한 핵심 보안 설계입니다.

```typescript
import authMiddleware from '../middleware/auth';

// 패턴 A: 일괄 적용 (실제 코드에서 많이 사용)
router.use(authMiddleware);

// 패턴 B: 개별 적용
router.get('/protected', authMiddleware, controller);
```

`req.user`에 주입되는 `UserPayload` (실제 인터페이스):
```typescript
export interface UserPayload {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: UserPayload;
}
```

### 6.2 에러 처리 패턴

모든 컨트롤러는 `errorLogger.error()`로 로깅하고 고정 문자열 `'Internal server error'`를 반환합니다 (에러 메시지를 클라이언트에 노출하지 않음). `index.ts`의 글로벌 4-인자 에러 핸들러가 컨트롤러에서 처리되지 않은 예외를 최종 포착합니다.

```typescript
import { errorLogger } from '../config/logger';

export const someController = async (req: AuthRequest, res: Response) => {
  try {
    // 입력 검증
    if (!req.body.name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // 권한 체크 (ADMIN 전용 기능)
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // 비즈니스 로직
    const result = await someService.doSomething(req.body);

    // 성공 응답
    res.json(result);
  } catch (error) {
    errorLogger.error('Error in someController', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Internal server error' });  // 고정 문자열 — 메시지 노출 금지
  }
};
```

### 6.3 전역 미들웨어 체인 (index.ts 순서)

1. `env.ts` import (dotenv 로드, 가장 먼저 실행)
2. `cors()`
3. `express.json()`
4. `isInstalled()` 체크 미들웨어 (미설치 시 `/api/install`, `/health` 외 503 반환)
5. 라우터 등록 (`/api/install`, `/api/auth`, `/api/items`, ... 등 통합 라우터)
6. `/health` 엔드포인트 (공개)
7. 글로벌 에러 핸들러 (4-인자 함수, `NODE_ENV=production`에서 에러 메시지 숨김)

**공개 엔드포인트** (authMiddleware 없음):
- `POST /api/auth/login`
- `GET /api/settings/system`, `GET /api/settings/system/:key`
- `GET /api/boards/feedbacks/images/:filename`
- `GET|POST /api/install/*`
- `GET /health`

### 6.4 Pagination 패턴

```typescript
export const getItems = async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const [items, countResult] = await Promise.all([
    query<Item>(
      'SELECT * FROM "Item" ORDER BY "createdAt" DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    ),
    queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM "Item"'
    ),
  ]);
  const total = Number(countResult?.count ?? 0);

  res.json({
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
};
```

---

## 7. 인증 시스템

### 7.1 이중 인증 흐름 (LOCAL 우선 → LDAP fallback)

`auth.controller.ts`의 로그인은 LOCAL 계정을 먼저 확인하고, LOCAL 계정이 없을 때만 LDAP 인증을 시도합니다. LDAP 인증만 설명한 구버전 문서와 다릅니다.

```
1. 사용자 로그인 (username, password)
   ↓
2. DB에서 LOCAL 계정 조회 (authType = 'LOCAL')
   ↓
3a. LOCAL 계정 존재 → bcrypt.compare(password, hash)
    성공 → JWT 발급
    실패 → 401 반환
   ↓
3b. LOCAL 계정 없음 → LdapService.authenticate()
   ↓
4. LDAP 서버 검증
   ↓
5. LDAP 성공 → 사용자 정보 추출 (displayName, email, phone, groups)
   ↓
6a. 신규 LDAP 사용자: teamId=null로 DB 생성 (isActive=true)
6b. 기존 LDAP 사용자: displayName/email 등 기본 정보 업데이트 (teamId 유지)
   ↓
7. JWT 토큰 발급
   ↓
8. 클라이언트에 토큰 반환
```

**에러 메시지 분기** (한국어):
- LDAP `Invalid Credentials` → "아이디 또는 비밀번호가 올바르지 않습니다"
- LDAP timeout → "LDAP 서버 연결 시간 초과"
- 기타 → "로그인에 실패했습니다"

### 7.2 JWT 토큰 페이로드 (실제 UserPayload)

```typescript
// JWT에 포함되는 실제 페이로드 (id/username/role만 있는 구버전 문서는 오류)
interface UserPayload {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'PO' | 'PM' | 'MEMBER';
}
```

**authMiddleware의 DB 재조회 보안 패턴**: JWT decode 후 DB에서 User를 재조회하여 `isActive`를 실시간 검증합니다. 토큰이 탈취된 후 관리자가 계정을 비활성화하면 다음 요청부터 즉시 차단됩니다.

### 7.3 권한 체크

```typescript
// Controller에서
if (req.user?.role !== 'ADMIN') {
  return res.status(403).json({ error: 'Admin only' });
}

// 또는 Service에서
if (!canUserEdit(req.user, item)) {
  throw new Error('Permission denied');
}
```

### 7.4 LDAP 동기화 시스템 (v1.1.5, 수정: v1.1.24)

> **⚠️ 변경사항 (v1.1.24)**: 자동 동기화(매일 02:00) 삭제됨. 조직 계층 구조 보존을 위해 수동 동기화만 지원.

> **참고 (node-cron 의존성)**: `backend/package.json`에 `node-cron ^4.2.1`이 의존성으로 남아있으나, 현재 백엔드 소스(`backend/src/`)에서 실제로 사용되는 코드는 없습니다. v1.1.24에서 자동 동기화 제거 시 패키지를 삭제하지 않은 레거시 잔존입니다. 향후 정리 시 제거를 권장합니다.

**수동 동기화 방법**:
- LDAP 인증 페이지(`/ldap-auth`)에서 미리보기 후 선택 적용
- 선택한 항목만 동기화되어 기존 계층 구조 보존

**동기화 플로우**:
```
1. LDAP 그룹 조회 (미리보기)
   ↓
2. 사용자가 적용할 항목 선택
   ↓
3. 선택된 팀/사용자만 생성/업데이트
   ↓
4. 기존 계층 구조 유지
```

**Dry-run 패턴**:
```typescript
async syncFromLdap(dryRun: boolean = false) {
  // DB 쓰기 작업을 조건부로 실행
  if (!dryRun) {
    await queryOne('INSERT INTO "Team" (id, name) VALUES ($1, $2) RETURNING *', [id, name]);
  }
  // 결과는 항상 반환 (미리보기용)
  return { teamsCreated: count, ... };
}
```

---

## 8. API 엔드포인트 참조

### 8.1 인증 (auth.routes.ts)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| POST | `/api/auth/login` | LOCAL 우선, LDAP fallback 이중 인증. JWT 발급 | 없음 |
| GET | `/api/auth/me` | 현재 사용자 정보 (no-store 캐시 방지 헤더) | JWT |
| POST | `/api/auth/change-password` | LOCAL 계정 비밀번호 변경 | JWT |
| POST | `/api/auth/request-approval` | 계정 승인 요청 | JWT |

### 8.2 아이템 (item.routes.ts)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/items` | 아이템 목록 (clientId/type/parentId/assigneeId 필터) | JWT |
| GET | `/api/items/tree` | 전체 계층 트리 (userTeamId 필터 지원) | JWT |
| GET | `/api/items/:id` | 아이템 상세 (ServiceTeam, WorkRequest 포함) | JWT |
| POST | `/api/items` | 아이템 생성. PROJECT 생성 시 미정 서비스 자동 생성 | JWT |
| PUT | `/api/items/:id` | 아이템 수정. 상태-진행률 자동 연동 | JWT |
| DELETE | `/api/items/:id` | 소프트 삭제 (isDeleted=true). 타입별 팀 보존 처리 | JWT |
| PATCH | `/api/items/:id/move` | 아이템 이동 (ACTION: serviceTeamId, 기타: parentId) | JWT |

> **주의**: `/api/items`에 `/test-count` 디버그 엔드포인트가 프로덕션 코드에 잔류 중입니다 (하드코딩 UUID 직접 쿼리). 제거를 권장합니다.

### 8.3 고객사 (client.routes.ts)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/clients` | 고객사 목록 (PROJECT 아이템 포함, json_agg) | JWT |
| POST | `/api/clients` | 고객사 생성. unique 제약 위반 시 409 | JWT |
| PUT | `/api/clients/:id` | 고객사 수정 | JWT |
| DELETE | `/api/clients/:id` | 소프트 삭제 (isActive=false) | JWT |
| POST | `/api/clients/:id/logo` | 로고 파일 업로드 | JWT |

### 8.4 파일/링크 (assets.routes.ts)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| POST | `/api/assets/files/upload` | 파일 업로드. latin1→UTF-8 한글 파일명 변환 | JWT |
| GET | `/api/assets/files/item/:itemId` | 아이템 파일 목록 | JWT |
| GET | `/api/assets/files/hierarchical/:itemId` | 하위 계층 파일+링크 통합 조회 | JWT |
| DELETE | `/api/assets/files/:id` | 파일 삭제 (파일시스템 + DB) | JWT |
| POST | `/api/assets/links` | 링크 생성. 계층 정보 자동 추출 | JWT |
| GET | `/api/assets/links/fetch-title` | URL에서 페이지 제목 자동 추출 (Nextcloud Basic Auth 지원) | JWT |
| GET | `/api/assets/links/item/:itemId` | 아이템 링크 목록 | JWT |
| DELETE | `/api/assets/links/:id` | 링크 삭제 | JWT |

### 8.5 게시판 (boards.routes.ts)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/boards/comments/item/:itemId` | 아이템 댓글 목록 | JWT |
| POST | `/api/boards/comments/item/:itemId` | 댓글 생성 + @멘션 알림 | JWT |
| DELETE | `/api/boards/comments/:id` | 댓글 삭제 (작성자만) | JWT |
| POST | `/api/boards/comments/:id/reaction` | 이모지 리액션 토글 | JWT |
| GET | `/api/boards/feedbacks` | 피드백 목록 (페이지네이션, 필터) | JWT |
| POST | `/api/boards/feedbacks` | 피드백 생성 | JWT |
| GET | `/api/boards/feedbacks/stats` | 피드백 통계 (Promise.all 6개 쿼리 병렬) | JWT |
| PUT | `/api/boards/feedbacks/:id` | 수정 (작성자: PENDING만, ADMIN: 항상) | JWT |
| GET | `/api/boards/feedbacks/images/:filename` | 피드백 이미지 서빙 | 없음 |

### 8.6 알림 (notifications.routes.ts)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/notifications` | 내 알림 (7일 이내 읽은 것 + 미읽음, 최대 50개) | JWT |
| GET | `/api/notifications/unread-count` | 미읽음 알림 수 | JWT |
| PUT | `/api/notifications/read-all` | 전체 읽음 처리 | JWT |
| GET | `/api/notifications/apps` | 알림 앱 목록 (민감 정보 끝 8자리만 노출) | JWT |
| POST | `/api/notifications/apps/test` | 알림 앱 연결 테스트 (Slack/Telegram/Discord) | JWT |
| GET | `/api/notifications/messages/received` | 받은 메시지 (unreadOnly 필터) | JWT |
| GET | `/api/notifications/messages/unread-count` | 안 읽은 메시지 수 | JWT |
| POST | `/api/notifications/messages` | 메시지 전송 + Slack 알림 비동기 발송 | JWT |

### 8.7 조직/팀 (org.routes.ts)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/org/teams` | 전체 팀 목록 | JWT |
| GET | `/api/org/teams/hierarchy` | 팀 계층 구조 (사용자 포함) | JWT |
| POST | `/api/org/teams/reset` | 조직 초기화 (ADMIN + 비밀번호 검증) | JWT (ADMIN) |
| GET | `/api/org/units/tree` | 조직도 트리 (회원 및 카운트 포함) | JWT |
| POST | `/api/org/units/sync-from-ldap` | LDAP에서 조직 동기화 | JWT |

### 8.8 LDAP (ldap.routes.ts)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/ldap/admin/users` | LDAP 사용자 전체 조회 | JWT |
| GET | `/api/ldap/configs` | LDAP 설정 목록 (사용자 수 포함) | JWT |
| POST | `/api/ldap/configs/:id/test` | 저장된 설정으로 연결 테스트 | JWT |
| POST | `/api/ldap/configs/test-connection` | 폼 값으로 사전 테스트 (저장 전) | JWT |
| POST | `/api/ldap/sync` | 전체 LDAP 동기화 (dryRun 지원) | JWT (ADMIN) |
| GET | `/api/ldap/sync/preview-hierarchical` | 계층적 LDAP 구조 미리보기 | JWT (ADMIN) |
| GET | `/api/ldap/settings` | LDAP 레거시 설정 조회 (SystemSetting) | JWT |

### 8.9 설정 (settings.routes.ts)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/settings/system` | 전체 시스템 설정 (기본값 fallback) | 없음 |
| GET | `/api/settings/system/:key` | 특정 시스템 설정값 | 없음 |
| PUT | `/api/settings/system` | 다중 설정 일괄 업데이트 (upsert) | JWT |

### 8.10 권한/사용자

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/permissions/my` | 내 권한 (resource를 key로 하는 Map 형태) | JWT |
| PUT | `/api/permissions/role/:role/bulk` | 역할 전체 권한 일괄 업데이트 | JWT (ADMIN) |
| GET | `/api/users/pending-approval` | 승인 대기 사용자 목록 | JWT |
| POST | `/api/users/:id/approve` | 사용자 승인 | JWT |
| POST | `/api/users/:id/reject` | 사용자 반려 | JWT |
| GET | `/api/users/:userId/managers` | 상위 관리자 목록 (팀 PO/PM → 전체 PO → 전체 PM) | JWT |
| GET | `/api/admin/members` | 전체 멤버 목록 + LDAP 활성화 여부 | JWT (ADMIN) |
| POST | `/api/admin/members` | 로컬 멤버 생성 (LDAP 사용 중 차단) | JWT (ADMIN) |
| PUT | `/api/admin/members/profile` | 본인 프로필 수정 (모든 인증 사용자) | JWT |
| PUT | `/api/admin/members/:id/toggle-active` | 활성/비활성 토글 (본인 계정 비활성화 방지) | JWT (ADMIN) |
| POST | `/api/admin/members/:id/reset-password` | 비밀번호 초기화 (LOCAL 계정만) | JWT (ADMIN) |

### 8.11 작업요청/스냅샷 (work.routes.ts)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/work/requests` | 작업 요청 목록 (상태/우선순위/담당자 필터) | JWT |
| POST | `/api/work/requests` | 작업 요청 생성 (assigneeId 또는 assigneeTeamId 필수) | JWT |
| POST | `/api/work/requests/:id/approve` | 작업 요청 승인 | JWT |
| POST | `/api/work/requests/:id/create-action` | 승인 후 ACTION 생성 | JWT |
| GET | `/api/work/requests/:id/validate-action-creation` | 계층 요구사항 검증 | JWT |
| POST | `/api/work/requests/hierarchy-request` | 계층 생성 요청 (SERVICE/TEAM) | JWT |
| POST | `/api/work/requests/:id/forward` | 다른 담당자에게 전달 | JWT |
| DELETE | `/api/work/requests/:id/admin` | 작업 요청 강제 삭제 | JWT (ADMIN) |
| POST | `/api/work/snapshots` | 보고서 스냅샷 생성 (WITH CTE) | JWT |

### 8.12 기타

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/trash` | 휴지통 목록 (type, limit 필터) | JWT |
| POST | `/api/trash/:id/restore` | 항목 복원 (역할별: ADMIN=전체, PO=PROJECT, PM=SERVICE+TEAM, MEMBER=본인 ACTION) | JWT |
| DELETE | `/api/trash/:id` | 영구 삭제 (역할별 권한 차등) | JWT |
| GET | `/install/status` | 설치 여부 확인 + DB 연결 체크 | 없음 |
| POST | `/install/test-db` | DB 연결 테스트 (별도 Pool 생성) | 없음 |
| POST | `/install/run` | 웹 설치 마법사 실행 (psql + schema.sql + admin 생성) | 없음 |
| GET | `/health` | 서버 헬스체크 | 없음 |

---

## 9. 코드 스타일 가이드

### 9.1 네이밍 컨벤션

| 타입 | 컨벤션 | 예시 |
|------|--------|------|
| 파일 (컴포넌트) | PascalCase | `UserManagement.tsx` |
| 파일 (기타) | kebab-case | `auth.service.ts` |
| 함수/변수 | camelCase | `getUserById`, `userName` |
| 클래스/인터페이스 | PascalCase | `UserService`, `AuthRequest` |
| 상수 | UPPER_SNAKE_CASE | `MAX_FILE_SIZE` |
| Enum | PascalCase | `ItemType`, `ItemStatus` |

### 9.2 TypeScript 규칙

```typescript
// ✅ Good
interface User {
  id: string;
  name: string;
  email?: string;  // Optional
}

async function getUser(id: string): Promise<User> {
  // ...
}

// ❌ Bad
function getUser(id) {  // 타입 미지정
  // ...
}
```

### 9.3 Import 순서

```typescript
// 1. 외부 라이브러리
import React from 'react';
import { Button } from 'antd';

// 2. 내부 모듈 (절대 경로)
import { userApi } from '@/api/users';

// 3. 상대 경로
import { SomeComponent } from './components';
```

---

## 10. 테스트

### 10.1 수동 테스트 체크리스트

**백엔드**:
- [ ] API 엔드포인트 테스트 (Postman/curl)
- [ ] 인증 흐름 테스트
- [ ] 에러 케이스 테스트
- [ ] 데이터베이스 변경 확인

**프론트엔드**:
- [ ] 페이지 렌더링 확인
- [ ] 사용자 인터랙션 테스트
- [ ] 에러 메시지 확인
- [ ] 권한별 UI 확인

### 10.2 유닛 테스트 (향후 추가 예정)

```typescript
// 예시 (Jest)
describe('ExampleService', () => {
  it('should process data correctly', async () => {
    const input = { name: 'test' };
    const result = await ExampleService.process(input);
    expect(result.name).toBe('test');
  });
});
```

---

## 11. 로깅 시스템

### 11.1 로깅 구조

PSTA는 Winston 기반의 구조화된 로깅 시스템을 사용합니다.

**로그 저장 위치**: `/log/psta/` (경로 상세 구조 → **[인프라 명세 §10.1](../../infrastructure/INFRASTRUCTURE.md#101-디렉토리-구조)**)

**로그 카테고리** (9개):
- `appLogger` - 애플리케이션 이벤트
- `errorLogger` - 에러 발생
- `accessLogger` - HTTP 요청/응답 (자동)
- `authLogger` - 인증/로그인
- `databaseLogger` - DB 쿼리
- `ldapLogger` - LDAP 작업
- `slackLogger` - Slack 알림
- `notificationLogger` - 기타 알림
- `migrationLogger` - 마이그레이션

### 11.2 로깅 사용법

**Import**:
```typescript
import { appLogger, errorLogger, authLogger } from '../config/logger';
```

**사용 예시**:
```typescript
// 애플리케이션 이벤트
appLogger.info('Server started', { port: 3001, environment: 'development' });

// 에러 로깅
errorLogger.error('Database connection failed', {
  error: err.message,
  stack: err.stack,
  context: 'startup'
});

// 인증 로깅
authLogger.info('Login successful', {
  userId: user.id,
  username: user.username,
  role: user.role,
  ip: req.ip
});
```

**로그 레벨**:
- `error` - 에러 발생 (심각)
- `warn` - 경고 (주의 필요)
- `info` - 일반 정보 (기본)
- `debug` - 디버그 정보 (개발 전용)

### 11.3 로그 로테이션

- **패턴**: `{category}-YYYY-MM-DD.log`
- **보존 기간**: 30일
- **형식**: JSON (애플리케이션 로그), Plain text (콘솔 로그)
- **압축**: 없음

**자동 로테이션**: 매일 자동으로 새로운 파일 생성

---

## 12. 디버깅

### 12.1 백엔드 디버깅

**로그 확인**:
```bash
# 콘솔 로그 (stdout/stderr)
/app/psta/bin/server.sh logs backend
tail -f /log/psta/app/backend/backend-console.log

# 구조화된 로그 (JSON 형식)
tail -f /log/psta/app/backend/access-$(date +%Y-%m-%d).log   # HTTP 요청
tail -f /log/psta/app/backend/app-$(date +%Y-%m-%d).log      # 애플리케이션
tail -f /log/psta/app/backend/auth-$(date +%Y-%m-%d).log     # 인증
tail -f /log/psta/app/backend/error-$(date +%Y-%m-%d).log    # 에러

# 시스템 로그
tail -f /log/psta/system/server.log                           # 서버 관리 스크립트
```

**브레이크포인트**:
```typescript
// 코드에 추가
console.log('Debug:', variable);
debugger;  // Chrome DevTools 연결 시 중단점
```

### 12.2 프론트엔드 디버깅

**React Developer Tools**:
- Chrome 확장 프로그램 설치
- Components 탭에서 상태 확인

**Network 탭**:
- API 요청/응답 확인
- 에러 상태 코드 확인

**Console 로그**:
```typescript
console.log('State:', state);
console.table(data);  // 배열 데이터 시각화
```

### 12.3 일반적인 문제 해결

| 문제 | 원인 | 해결 |
|------|------|------|
| "Cannot find module" | 패키지 미설치 | `npm install` |
| "Port already in use" | 포트 충돌 | `lsof -i :3001` → 프로세스 종료 |
| "CORS error" | CORS 설정 오류 | `backend/src/index.ts` 확인 |
| "401 Unauthorized" | 토큰 만료/없음 | 재로그인 |

---

## 13. Git 워크플로우

### 13.1 브랜치 전략

```
main         (프로덕션)
  └─ develop (개발)
      ├─ feature/user-profile
      ├─ feature/dashboard
      └─ bugfix/login-error
```

### 13.2 커밋 메시지

```
feat: 새 기능 추가
fix: 버그 수정
docs: 문서 변경
style: 코드 포맷팅 (기능 변경 없음)
refactor: 리팩토링
test: 테스트 추가
chore: 빌드, 설정 변경
```

예시:
```bash
git commit -m "feat: 사용자 프로필 페이지 추가"
git commit -m "fix: 로그인 시 토큰 저장 오류 수정"
```

---

## 14. 참조 문서

- **[인프라 명세](../../infrastructure/INFRASTRUCTURE.md)** - 시스템 환경 및 요구사항
- **[설치 가이드](../installation/INSTALLATION_GUIDE.md)** - 설치 방법
- **[보안 가이드](../../security/SECURITY_GUIDE.md)** - 보안 모범 사례
- **[사용자 가이드](../user/USER_GUIDE.md)** - 사용자를 위한 가이드
- **[전체 문서 맵](../../../DOCUMENT_MAP.md)** - 모든 문서 네비게이션

---

**문서 끝**
