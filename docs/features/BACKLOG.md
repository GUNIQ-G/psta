# PSTA 개선 사항 백로그

**최종 업데이트**: 2026-06-19

이 문서는 향후 구현할 개선 사항들을 기록합니다.

---

## ✅ 완료된 주요 기능

### 계층적 워크플로우 (v1.1.22, 버전 표기 수정)
- 📄 **설계 문서**: [HIERARCHICAL_WORKFLOW.md](HIERARCHICAL_WORKFLOW.md)
- **상태**: ✅ **100% 구현 완료** (알림 통합 포함)
- **실제 구현 버전**: v1.1.22 (BACKLOG에 v1.2.0으로 잘못 표기되어 있었음 — 수정됨)
- **구현 확인일**: 2025-11-28
- **목적**: 작업 요청 시 누락된 계층(서비스/팀)을 자동으로 생성하는 워크플로우

**구현 현황**:
- [x] Phase 1: 데이터베이스 및 백엔드 기반 ✅ (100%)
- [x] Phase 2: 계층 생성 요청 API ✅ (100%)
- [x] Phase 3: 프론트엔드 UI ✅ (100%)
- [x] Phase 5: 알림 서비스 통합 ✅ (2025-11-28)
- [ ] Phase 4: 테스트 및 개선 (선택적)

### ItemFormModal.tsx 아이템 이동 기능 (v1.1.x)
- **상태**: ✅ **구현 완료** — `ItemMoveModal.tsx` 컴포넌트로 분리 구현됨
- useItemMove hook 리팩토링 TODO 주석은 코드에서 제거됨 (Line 369 미존재 확인)

### 버그/건의 게시판 + 팀별 그룹화 + 조회 모드 UX 개선 (v1.1.27)
- **상태**: ✅ **구현 완료** (커밋 `10e2dbe`)

### 링크 자동 문서명 + 아이템 알림 + 파일 확장자 확대 (v1.1.28~v1.1.29)
- **상태**: ✅ **구현 완료** (커밋 `9fb70f2`)

### 프론트엔드 nginx Docker 전환 + 설치 스크립트 (v1.1.30)
- **상태**: ✅ **구현 완료** (커밋 `07e99c2`, `7cd41c2`)

### WordPress 스타일 웹 설치 마법사 + 경로 환경변수화 (v1.1.31)
- **상태**: ✅ **구현 완료** (커밋 `bd18570`, `b3549e5`)
- 포트 및 호스트 환경변수 외부 설정 지원 포함

### 로컬 인증(LOCAL auth) + 멤버 관리 페이지 (v1.1.32)
- **상태**: ✅ **구현 완료** (커밋 `9938d79`)
- 탭 구조, LDAP 통합 포함
- 경로 환경변수화 (PSTA_DATA_DIR, PSTA_LOG_DIR)

### Prisma ORM 제거 + 순수 SQL 전환 (v1.1.33)
- **상태**: ✅ **구현 완료** (커밋 `0139a24`, `b8e4918`)
- pg 드라이버 + schema.sql 방식으로 전환

### 메뉴·권한 단일 MENU_CONFIG 통합 (v1.1.33)
- **상태**: ✅ **구현 완료** (커밋 `313aa4a`, `12f98e3`)
- `menuConfig.tsx` 단일 파일로 사이드바·권한체크·권한관리 UI 자동 반영

### 공개 오픈소스 전환 (보안/문서)
- **상태**: ✅ **완료** (커밋 `2ba63eb`, `7f6ba64`, `2686f7d`, `a54c771`)
- 내부 회사 정보 및 하드코딩 값 제거, LICENSE 추가

---

## 🔴 코드 내 TODO 항목 (기술 부채)

### ~~ActionCreateDrawer.tsx~~ ✅ 완료
- [x] ~~**Line 448**: Send notification to team leader~~ - 2025-11-28 완료 (v1.1.23)
  - 미정 프로젝트/서비스에 액션 생성 시 팀장에게 자동 알림
  - 백엔드 item.controller.ts에서 자동 처리

### ~~ItemFormModal.tsx~~ ✅ 완료
- [x] ~~**Lines 22, 92, 253, 392**: useItemMove hook implementation~~ - ItemMoveModal.tsx로 구현 완료

### ~~work-request.controller.ts (계층적 워크플로우)~~ ✅ 완료
- [x] ~~**Line 1424**: Send notification (계층 생성 요청 시)~~ - 2025-11-28 완료
- [x] ~~**Line 1472**: Notify original requester (계층 생성 완료 시)~~ - 2025-11-28 완료

---

## 🔧 기술 부채 / 리팩토링 필요

### 코드 품질
- [ ] **UNASSIGNED UUID 하드코딩**: 코드 곳곳에 UNASSIGNED 관련 UUID가 하드코딩되어 있음 — 상수화 또는 DB 조회 방식으로 전환 필요
- [ ] **favicon 중복 구현**: `App.tsx`와 `GeneralSettings` 양쪽에 favicon 설정 로직 존재 — 단일 소스로 통합 필요
- [ ] **JWT localStorage XSS 취약성**: JWT 토큰을 localStorage에 저장하는 방식은 XSS 공격에 취약 — httpOnly 쿠키 방식 전환 검토
- [ ] **slack-config.ts 레거시 병존**: 신규 알림 시스템과 레거시 Slack 설정 파일이 공존 — 정리 필요
- [ ] **psta-frontend.service 레거시 systemd 유닛 비활성화 필요**: nginx Docker 전환(v1.1.30) 이후 레거시 systemd 유닛 파일 잔존
- [ ] **backend/Dockerfile Prisma 레거시 잔존**: Prisma 완전 제거(v1.1.33) 이후 Dockerfile에 Prisma 관련 설정이 남아 있을 수 있음 — 확인 및 정리 필요
- [ ] **Vite allowedHosts 하드코딩**: `vite.config.ts`에 허용 호스트가 하드코딩되어 있음 — 환경변수 기반으로 전환 필요
- [ ] **nginx.conf 이중 존재**: `frontend/nginx.conf`와 `nginx/nginx.conf` 두 위치에 설정 파일 존재 — 단일 경로로 통합 필요

### 스키마 관리
- [ ] **schema.sql 수작업 관리 취약성**: Prisma 제거 후 마이그레이션 도구 없이 schema.sql 수작업 관리 — 스키마 변경 추적 및 버전 관리 체계 필요
- [ ] **Comment 테이블 마이그레이션 누락 이력** (`d55e927`): 스키마 변경 시 검증 프로세스 부재 — 스키마 diff 검증 자동화 검토

### 버전 관리
- [ ] **package.json version 미관리**: `backend/package.json`과 `frontend/package.json` 모두 `"1.0.0"` 고정 — 실제 버전(v1.1.33)과 불일치, 자동화 배포·패키지 관리에 혼선

### 설치 스크립트
- [ ] **재설치 로직 신뢰성**: git stash → force-reset → 재시도 방식으로 3번 연속 패치 (`64c2181`, `65b25ca`, `af352c9`) — 엣지케이스 처리 완전성 재검토 필요

### 환경변수 초기화
- [ ] **dotenv 로드 순서 의존성** (`c4d1a6c`): ENCRYPTION_KEY 누락 방지 패치 이후에도 환경변수 초기화 순서 의존성 잠재적 취약점 잔존 — 초기화 순서 문서화 및 검증 로직 추가 필요

---

## 🟡 기능 개선 계획

### v1.2.x 후보
- [ ] 댓글 스레드 기능
- [ ] 활동 로그
- [ ] 이메일 알림
- [ ] 즐겨찾기 기능
- [ ] 검색 기능 개선

### v1.3.x 후보
- [ ] 대시보드 위젯 커스터마이징
- [ ] 캘린더 뷰
- [ ] 의존성 관리
- [ ] 다크 모드
- [ ] 모바일 최적화

### v2.0.0 장기 계획
- [ ] AI 기반 일정 예측
- [ ] 자동 리스크 감지
- [ ] 실시간 협업 편집 (WebSocket)
- [ ] 다국어 지원

---

## 📝 참고

이 백로그는 정기적으로 검토하여 우선순위를 조정합니다.

**버전 이력 참고**: [CHANGELOG.md](../changelog/CHANGELOG.md)
