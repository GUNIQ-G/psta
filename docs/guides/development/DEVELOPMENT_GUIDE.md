# PSTA 개발 가이드

**문서 버전**: v1.1.32
**최종 수정**: 2026-06-18
**대상**: 백엔드/프론트엔드 개발자

---

## 📋 목차
1. [프로젝트 구조](#1-프로젝트-구조)
2. [개발 환경 설정](#2-개발-환경-설정)
3. [백엔드 개발](#3-백엔드-개발)
4. [프론트엔드 개발](#4-프론트엔드-개발)
5. [데이터 모델](#5-데이터-모델)
6. [API 개발](#6-api-개발)
7. [인증 시스템](#7-인증-시스템)
8. [코드 스타일 가이드](#8-코드-스타일-가이드)
9. [테스트](#9-테스트)
10. [디버깅](#10-디버깅)

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
│   │   ├── schema.prisma   # 데이터베이스 스키마
│   │   └── migrations/     # 마이그레이션 히스토리
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
└── docs/                   # 문서 (v1.0)
```

### 1.2 백엔드 상세 구조
```
backend/src/
├── config/                 # 설정 모듈
│   ├── database.ts         # Prisma 클라이언트
│   ├── ldap.ts             # LDAP 서비스
│   ├── multer.ts           # 파일 업로드 설정
│   └── slack.ts            # Slack 클라이언트
│
├── controllers/            # 요청 핸들러
│   ├── auth.controller.ts          # 인증 (로그인, me)
│   ├── client.controller.ts        # 클라이언트 CRUD
│   ├── item.controller.ts          # Item CRUD
│   ├── user.controller.ts          # 사용자 관리
│   ├── team.controller.ts          # 팀 관리
│   ├── permission.controller.ts    # 권한 관리
│   ├── comment.controller.ts       # 댓글
│   ├── notification.controller.ts  # 알림
│   ├── file.controller.ts          # 파일 업로드
│   ├── work-request.controller.ts  # 작업 요청
│   └── ...
│
├── services/               # 비즈니스 로직
│   ├── user.service.ts             # 사용자 로직
│   ├── team.service.ts             # 팀 로직
│   ├── slack.service.ts            # Slack 연동
│   ├── notification.service.ts     # 통합 알림
│   ├── notification-slack.service.ts  # Slack 알림
│   ├── item-calculation.service.ts    # 상태/진행률 자동 산정
│   └── settings.service.ts         # 시스템 설정
│
├── middleware/             # 미들웨어
│   ├── auth.middleware.ts  # JWT 인증
│   └── error.middleware.ts # 에러 처리
│
├── routes/                 # 라우트 정의
│   ├── auth.routes.ts
│   ├── item.routes.ts
│   ├── client.routes.ts
│   ├── user.routes.ts
│   └── ...
│
└── index.ts                # Express 앱 초기화
```

### 1.3 프론트엔드 상세 구조
```
frontend/src/
├── api/                    # API 클라이언트
│   ├── axios.ts            # Axios 인스턴스 (인증 헤더 자동 추가)
│   ├── auth.ts             # 인증 API
│   ├── items.ts            # Item API
│   ├── clients.ts          # Client API
│   ├── users.ts            # User API
│   └── ...
│
├── components/             # 재사용 컴포넌트
│   ├── MainLayout.tsx              # 전체 레이아웃 (사이드바, 헤더)
│   ├── ItemTree.tsx                # PSTA 트리 뷰
│   ├── ItemFormModal.tsx           # Item 생성/수정 폼
│   ├── WbsGanttCustom.tsx          # Gantt 차트
│   ├── ProjectWizardModal.tsx      # 프로젝트 위자드
│   ├── ServiceWizardModal.tsx      # 서비스 위자드
│   ├── ActionCreateDrawer.tsx      # 액션 생성 Drawer
│   ├── PstaFilterDropdown.tsx      # PSTA 필터
│   ├── HierarchyToggleButtons.tsx  # 계층 토글 버튼
│   └── ...
│
├── pages/                  # 페이지 컴포넌트
│   ├── LoginPage.tsx               # 로그인
│   ├── Dashboard.tsx               # 대시보드
│   ├── PstaSchedule.tsx            # 일정관리 (PSTA)
│   ├── WbsView.tsx                 # WBS
│   ├── Report.tsx                  # 보고서
│   ├── ClientManagement.tsx        # 클라이언트 관리
│   ├── ProjectManagement.tsx       # 프로젝트 관리
│   ├── ServiceManagement.tsx       # 서비스 관리
│   ├── ActionManagement.tsx        # 액션 관리
│   ├── TeamManagement.tsx          # 팀 관리
│   ├── UserManagement.tsx          # 회원 관리
│   ├── UserApproval.tsx            # 사용자 승인
│   ├── PermissionManagement.tsx    # 권한 관리
│   ├── WorkRequests.tsx            # 작업 요청
│   ├── NotificationAppIntegration.tsx  # 알림앱 연동
│   └── ...
│
├── store/                  # Zustand 스토어
│   ├── authStore.ts        # 인증 상태
│   ├── permissionStore.ts  # 권한 상태
│   └── ...
│
├── types/                  # TypeScript 타입
│   └── index.ts            # 모든 타입 정의
│
├── App.tsx                 # 루트 컴포넌트 (라우팅)
└── main.tsx                # 진입점
```

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
npx prisma generate
npx prisma migrate dev

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
```bash
# 전체 시스템 시작 (권장)
/app/psta/bin/server.sh start

# 또는 개별 실행
cd /app/psta/backend && npm run dev  # 터미널 1 (개발 모드)
cd /app/psta/frontend && npm run dev # 터미널 2 (개발 모드)

# 프로덕션 모드 (nginx Docker 사용)
/app/psta/bin/server.sh start frontend  # 빌드 + nginx Docker 시작
```

### 2.4 개발 서버 포트
- Backend: http://localhost:3001
- Frontend: http://localhost:3000 (nginx Docker 컨테이너)
- Prisma Studio: http://localhost:5555 (수동 시작)

### 2.5 server.sh 스크립트 사용법

**프로덕션 배포 환경**:
- Frontend: nginx Docker 컨테이너 (`psta-frontend`) — `start frontend` 시 자동 빌드 후 컨테이너 시작
- Backend: systemd 서비스 (`psta-backend`) 또는 직접 프로세스 관리

**기본 명령어**:
```bash
# 상태 확인
./bin/server.sh status           # 전체 상태
./bin/server.sh status backend   # 백엔드만
./bin/server.sh status frontend  # 프론트엔드만

# 시작
./bin/server.sh start            # 전체 시작
./bin/server.sh start backend    # 백엔드만
./bin/server.sh start frontend   # 프론트엔드만

# 중지
./bin/server.sh stop backend
./bin/server.sh stop frontend

# 재시작
./bin/server.sh restart backend
./bin/server.sh restart frontend
./bin/server.sh restart all      # 전체 재시작
```

**동작 방식**:
- **systemd 우선**: Backend는 systemd 서비스(`psta-backend`)가 활성화되어 있으면 `systemctl` 사용
- **Frontend**: `npm run build` → `nginx/dist/` 복사 → `docker compose up -d --build`
- **Frontend 재시작 최적화**: 컨테이너가 이미 실행 중이면 dist만 재빌드 (nginx 재시작 없음)
- **Backend**: systemd 서비스 또는 `node dist/index.js` 프로세스 관리

**프로세스 감지**:
- Frontend: `docker ps --filter name=psta-frontend` (Docker 컨테이너)
- Backend: `pgrep -f "node.*dist/index.js"` 또는 systemd 상태

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
`backend/src/controllers/example.controller.ts`:
```typescript
import { Request, Response } from 'express';
import prisma from '../config/database';

export const getExamples = async (req: Request, res: Response) => {
  try {
    const examples = await prisma.example.findMany();
    res.json(examples);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch examples' });
  }
};

export const createExample = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const example = await prisma.example.create({
      data: { name, description },
    });
    res.status(201).json(example);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create example' });
  }
};
```

#### Step 2: Route 정의
`backend/src/routes/example.routes.ts`:
```typescript
import { Router } from 'express';
import { getExamples, createExample } from '../controllers/example.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticateToken, getExamples);
router.post('/', authenticateToken, createExample);

export default router;
```

#### Step 3: App에 등록
`backend/src/index.ts`:
```typescript
import exampleRoutes from './routes/example.routes';

app.use('/api/examples', exampleRoutes);
```

### 3.2 Prisma 스키마 변경

#### Step 1: Schema 수정
`backend/prisma/schema.prisma`:
```prisma
model Example {
  id          String   @id @default(uuid())
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

#### Step 2: 마이그레이션 생성
```bash
cd /app/psta/backend
npx prisma migrate dev --name add_example_model
```

#### Step 3: 클라이언트 재생성
```bash
npx prisma generate
```

#### Step 4: 백엔드 재시작
```bash
/app/psta/bin/server.sh restart backend
```

### 3.3 비즈니스 로직 분리

복잡한 로직은 Service로 분리:

`backend/src/services/example.service.ts`:
```typescript
import prisma from '../config/database';

export class ExampleService {
  static async processExample(data: any) {
    // 복잡한 비즈니스 로직
    const processed = await this.someComplexOperation(data);

    // 데이터베이스 저장
    return await prisma.example.create({
      data: processed,
    });
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

export const createExample = async (req: Request, res: Response) => {
  try {
    const result = await ExampleService.processExample(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
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

#### Step 3: 메뉴 추가
`frontend/src/components/MainLayout.tsx`:
```typescript
{
  key: 'examples',
  icon: <AppstoreOutlined />,
  label: <Link to="/examples">예제</Link>,
}
```

### 4.2 API 클라이언트 작성

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

---

## 5. 데이터 모델

### 5.1 핵심 모델: Item 계층 구조

```
Project (PROJECT)
  └─ Service (SERVICE)
      └─ Team (TEAM)
          └─ Action (ACTION)
```

**Item 모델**:
```prisma
model Item {
  id          String      @id @default(uuid())
  type        ItemType
  name        String
  status      ItemStatus  @default(NOT_STARTED)
  progress    Float       @default(0)
  startDate   DateTime?
  endDate     DateTime?
  description String?
  timeSpent   Int?        // 분 단위
  isOnHold    Boolean     @default(false)

  // 계층 관계
  parentId    String?
  parent      Item?       @relation("ItemHierarchy", fields: [parentId], references: [id])
  children    Item[]      @relation("ItemHierarchy")

  // 외래 키
  clientId    String?
  assigneeId  String?
  createdById String
}

enum ItemType {
  PROJECT
  SERVICE
  TEAM
  ACTION
}

enum ItemStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  ON_HOLD
}
```

### 5.2 상태/진행률 자동 산정

**규칙**:
- **ACTION**: 수동 입력만 (자동 산정 제외)
- **TEAM/SERVICE/PROJECT**: 하위 항목 기반 자동 계산
  1. `isOnHold = true` → 무조건 `ON_HOLD`
  2. 모든 하위 완료 → `COMPLETED`
  3. 모든 하위 시작 전 → `NOT_STARTED`
  4. 혼합 상태 → `IN_PROGRESS`
  5. 진행률 = 하위 항목 진행률의 평균

**자동 산정 서비스**:
`backend/src/services/item-calculation.service.ts`:
- `calculateItemStatus(itemId)` - 상태 계산
- `calculateItemProgress(itemId)` - 진행률 계산
- `updateItemAndParents(itemId)` - 부모 체인 재귀 업데이트

### 5.3 주요 관계

```
User ──┬─ 생성 ─→ Item
       ├─ 할당 ─→ Item (assignee)
       ├─ 소속 ─→ Team
       └─ 작성 ─→ Comment

Client ─── 포함 ─→ Item (Project)

Item ──┬─ 부모/자식 ─→ Item (계층)
       ├─ 댓글 ─→ Comment
       ├─ 파일 ─→ File
       └─ 작업요청 ─→ WorkRequest
```

---

## 6. API 개발

### 6.1 인증 미들웨어

모든 보호된 라우트는 `authenticateToken` 미들웨어 사용:

```typescript
import { authenticateToken } from '../middleware/auth.middleware';

router.get('/protected', authenticateToken, controller);
```

미들웨어가 `req.user`에 사용자 정보 추가:
```typescript
export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: UserRole;
  };
}
```

### 6.2 에러 처리 패턴

```typescript
export const someController = async (req: AuthRequest, res: Response) => {
  try {
    // 입력 검증
    if (!req.body.name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // 권한 체크
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // 비즈니스 로직
    const result = await someService.doSomething(req.body);

    // 성공 응답
    res.json(result);
  } catch (error) {
    console.error('Error in someController:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
```

### 6.3 Pagination 패턴

```typescript
export const getItems = async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.item.count(),
  ]);

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

### 7.1 LDAP 인증 흐름

```
1. 사용자 로그인 (username, password)
   ↓
2. LdapService.authenticate()
   ↓
3. LDAP 서버 검증
   ↓
4. 성공 → 사용자 정보 추출 (displayName, email, phone, groups)
   ↓
5. 데이터베이스에 사용자 생성/업데이트
   ↓
6. LDAP 그룹 → PSTA Team 자동 할당
   ↓
7. JWT 토큰 발급
   ↓
8. 클라이언트에 토큰 반환
```

### 7.2 JWT 토큰 구조

```typescript
{
  id: "user-uuid",
  username: "user123",
  role: "ADMIN" | "PO" | "PM" | "MEMBER"
}
```

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
    await prisma.team.create({ data });
  }
  // 결과는 항상 반환 (미리보기용)
  return { teamsCreated: count, ... };
}
```

---

## 8. 코드 스타일 가이드

### 8.1 네이밍 컨벤션

| 타입 | 컨벤션 | 예시 |
|------|--------|------|
| 파일 (컴포넌트) | PascalCase | `UserManagement.tsx` |
| 파일 (기타) | kebab-case | `auth.service.ts` |
| 함수/변수 | camelCase | `getUserById`, `userName` |
| 클래스/인터페이스 | PascalCase | `UserService`, `AuthRequest` |
| 상수 | UPPER_SNAKE_CASE | `MAX_FILE_SIZE` |
| Enum | PascalCase | `ItemType`, `ItemStatus` |

### 8.2 TypeScript 규칙

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

### 8.3 Import 순서

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

## 9. 테스트

### 9.1 수동 테스트 체크리스트

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

### 9.2 유닛 테스트 (향후 추가 예정)

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

## 10. 로깅 시스템

### 10.1 로깅 구조

PSTA는 Winston 기반의 구조화된 로깅 시스템을 사용합니다.

**로그 저장 위치**: `/log/psta/`

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

### 10.2 로깅 사용법

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

### 10.3 로그 로테이션

- **패턴**: `{category}-YYYY-MM-DD.log`
- **보존 기간**: 30일
- **형식**: JSON (애플리케이션 로그), Plain text (콘솔 로그)
- **압축**: 없음

**자동 로테이션**: 매일 자동으로 새로운 파일 생성

---

## 11. 디버깅

### 11.1 백엔드 디버깅

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

**Prisma 쿼리 로그**:
`.env`에 추가:
```env
DEBUG="prisma:query"
```

### 11.2 프론트엔드 디버깅

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

### 10.3 일반적인 문제 해결

| 문제 | 원인 | 해결 |
|------|------|------|
| "Cannot find module" | 패키지 미설치 | `npm install` |
| "Port already in use" | 포트 충돌 | `lsof -i :3001` → 프로세스 종료 |
| "Prisma Client not found" | 클라이언트 미생성 | `npx prisma generate` |
| "CORS error" | CORS 설정 오류 | `backend/src/index.ts` 확인 |
| "401 Unauthorized" | 토큰 만료/없음 | 재로그인 |

---

## 12. Git 워크플로우

### 11.1 브랜치 전략

```
main         (프로덕션)
  └─ develop (개발)
      ├─ feature/user-profile
      ├─ feature/dashboard
      └─ bugfix/login-error
```

### 11.2 커밋 메시지

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

## 13. 참조 문서

- **[인프라 명세](../../infrastructure/INFRASTRUCTURE.md)** - 시스템 환경 및 요구사항
- **[설치 가이드](../installation/INSTALLATION_GUIDE.md)** - 설치 방법
- **[보안 가이드](../../security/SECURITY_GUIDE.md)** - 보안 모범 사례
- **[사용자 가이드](../user/USER_GUIDE.md)** - 사용자를 위한 가이드
- **[전체 문서 맵](../../../DOCUMENT_MAP.md)** - 모든 문서 네비게이션

---

**문서 끝**
