# 팀 할당 관리 페이지 구현 계획

**버전**: v1.0.0
**작성일**: 2025-11-28
**상태**: ✅ 완료
**목표 버전**: v1.1.21

---

## 📋 작업 정책

### 단계별 진행 규칙
1. **단계 완료 시**: 이 문서의 해당 Phase 체크박스를 ✅ 완료로 변경
2. **compact 실행**: `/compact` 명령어로 컨텍스트 정리
3. **다음 단계 진행**: 순차적으로 다음 Phase 시작

### 커밋 정책
- 각 Phase 완료 시 커밋 (사용자 요청 시)
- 커밋 메시지: `feat: 팀 할당 관리 Phase X - [설명]`

---

## 🎯 목표

1. **팀 중심 통계 페이지**: 각 팀별 프로젝트/서비스/액션 수 한눈에 파악
2. **데이터 정합성 확인**: 상하위 연결이 끊어진 항목 감지 및 조치
3. **계층 구조 조망**: PSTA 계층에서 팀의 위치와 역할 시각화

---

## 📊 구현 Phase

### Phase 1: 백엔드 API (✅ 완료)

**예상 파일:**
- `backend/src/controllers/team-assignment.controller.ts` (신규)
- `backend/src/routes/team-assignment.routes.ts` (신규)
- `backend/src/index.ts` (라우트 등록)

**API 목록:**

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/api/team-assignments/stats` | 전체 팀 할당 통계 |
| GET | `/api/team-assignments/teams` | 팀별 상세 통계 목록 |
| GET | `/api/team-assignments/teams/:teamId` | 특정 팀 상세 (프로젝트/서비스/액션 계층) |
| GET | `/api/team-assignments/integrity` | 데이터 정합성 체크 결과 |

**응답 스키마:**

```typescript
// GET /api/team-assignments/stats
interface TeamAssignmentStats {
  activeTeams: number;        // 활성 팀 수
  totalAssignments: number;   // 총 서비스-팀 할당 수
  totalActions: number;       // 총 액션 수
  avgActionsPerTeam: number;  // 팀당 평균 액션 수
  integrityIssues: number;    // 정합성 이상 항목 수
}

// GET /api/team-assignments/teams
interface TeamWithStats {
  id: string;
  name: string;
  memberCount: number;
  projectCount: number;       // 참여 프로젝트 수
  serviceCount: number;       // 할당된 서비스 수
  actionCount: number;        // 액션 수
  completedActionCount: number;
  avgProgress: number;        // 평균 진행률
  status: 'normal' | 'warning' | 'unassigned';
}

// GET /api/team-assignments/integrity
interface IntegrityCheckResult {
  unassignedActions: Item[];      // serviceTeamId = null
  orphanActions: Item[];          // parentId = null (ROOT에 노출)
  servicesWithoutTeams: Item[];   // 팀 할당 없는 서비스
  invalidServiceTeams: any[];     // 무효한 ServiceTeam
}
```

**완료 기준:**
- [x] 4개 API 엔드포인트 구현
- [x] 라우트 등록 및 테스트
- [x] API 응답 확인 (인증 미들웨어 작동)

---

### Phase 2: 프론트엔드 페이지 (✅ 완료)

**예상 파일:**
- `frontend/src/pages/TeamAssignmentManagement.tsx` (신규)
- `frontend/src/api/team-assignments.ts` (신규)

**UI 구성:**
1. **통계 카드 영역**: 4개 카드 (활성 팀, 서비스 할당, 총 액션, 연결 이상)
2. **필터 영역**: 검색, 필터, 정렬
3. **테이블 영역**: 팀별 통계 테이블
4. **Drawer**: 팀 상세 정보 (프로젝트/서비스/액션 계층 트리)

**컴포넌트 구조:**
```
TeamAssignmentManagement
├── StatCards (통계 카드 4개)
├── FilterBar (검색, 필터, 정렬)
├── TeamTable (팀 목록 테이블)
├── TeamDetailDrawer (팀 상세 Drawer)
└── IntegrityModal (정합성 이상 모달)
```

**완료 기준:**
- [x] 페이지 컴포넌트 생성
- [x] API 클라이언트 구현
- [x] 통계 카드 표시
- [x] 팀 테이블 표시 (프로젝트/서비스/액션 수, 진행률)

---

### Phase 3: 팀 상세 Drawer (✅ 완료)

**기능:**
- 팀 클릭 시 Drawer 열림
- 참여 프로젝트/서비스 계층 트리 표시
- 해당 팀의 액션 목록 표시

**완료 기준:**
- [x] Drawer 컴포넌트 구현
- [x] 프로젝트/서비스 계층 트리 표시
- [x] 액션 목록 표시

---

### Phase 4: 데이터 정합성 확인 (✅ 완료)

**기능:**
- "연결 이상" 카드 클릭 시 모달 표시
- 이상 항목 유형별 목록 표시
- 조치 버튼 (팀 할당, 계층 설정) - 향후 개선 예정

**정합성 체크 항목:**
| 항목 | 조건 | 심각도 |
|------|------|--------|
| 팀 미할당 액션 | `serviceTeamId = null` | 🔴 높음 |
| 부모 없는 액션 | `parentId = null` (ACTION인데 ROOT에 노출) | 🟠 중간 |
| 팀 할당 없는 서비스 | ServiceTeam 0건 | 🟡 낮음 |

**완료 기준:**
- [x] IntegrityModal 컴포넌트 구현
- [x] 이상 항목 유형별 표시
- [ ] 조치 버튼 연결 (ItemFormModal 열기) - v1.1.22에서 구현 예정

---

### Phase 5: 메뉴 및 라우트 등록 (✅ 완료)

**수정 파일:**
- `frontend/src/components/MainLayout.tsx` - 메뉴 추가
- `frontend/src/App.tsx` - 라우트 추가
- `backend/src/index.ts` - API 라우트 등록 (Phase 1에서 완료)

**메뉴 위치:**
```
데이터 관리
├─ 클라이언트 관리
├─ 프로젝트 관리
├─ 서비스 관리
├─ 팀 할당 관리  ← 신규
├─ 액션 관리
└─ 통합 파일 관리
```

**완료 기준:**
- [x] 메뉴 항목 추가
- [x] 라우트 등록
- [x] 권한 설정 (team-assignments 리소스)

---

### Phase 6: 문서 업데이트 및 마무리 (✅ 완료)

**수정 파일:**
- `CLAUDE.md` - 버전 업데이트
- `DOCUMENT_MAP.md` - 버전 업데이트
- `docs/changelog/CHANGELOG.md` - v1.1.21 항목 추가
- `docs/features/FEATURES.md` - 팀 할당 관리 기능 추가

**완료 기준:**
- [x] CHANGELOG 작성
- [x] 버전 번호 업데이트
- [x] 기능 문서 업데이트
- [x] 이 문서 상태를 "✅ 완료"로 변경

---

## 📁 파일 목록 (예상)

### 신규 파일
```
backend/src/controllers/team-assignment.controller.ts
backend/src/routes/team-assignment.routes.ts
frontend/src/pages/TeamAssignmentManagement.tsx
frontend/src/api/team-assignments.ts
```

### 수정 파일
```
backend/src/index.ts
frontend/src/components/MainLayout.tsx
frontend/src/App.tsx
CLAUDE.md
README.md
DOCUMENT_MAP.md
docs/changelog/CHANGELOG.md
docs/features/FEATURES.md
```

---

## ✅ 진행 상황

| Phase | 상태 | 완료일 |
|-------|------|--------|
| Phase 1: 백엔드 API | ✅ 완료 | 2025-11-28 |
| Phase 2: 프론트엔드 페이지 | ✅ 완료 | 2025-11-28 |
| Phase 3: 팀 상세 Drawer | ✅ 완료 | 2025-11-28 |
| Phase 4: 데이터 정합성 확인 | ✅ 완료 | 2025-11-28 |
| Phase 5: 메뉴 및 라우트 등록 | ✅ 완료 | 2025-11-28 |
| Phase 6: 문서 업데이트 | ✅ 완료 | 2025-11-28 |

---

**최종 업데이트**: 2025-11-28
