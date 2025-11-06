# PSTA Changelog

모든 주요 변경사항은 이 파일에 기록됩니다.

---

## v1.1.4 - 2025-11-04

### 🐛 버그 수정

#### 아이템 이동 기능 토스트 메시지 중복 문제 해결
- ✅ **문제**: 아이템 이동 성공 시 "성공적으로 이동되었습니다"와 "이동에 실패했습니다" 메시지가 동시에 표시됨
- ✅ **원인**: ItemFormModal에서 이동 후 `onRefresh()` 호출 시 prop이 전달되지 않아 에러 발생 → catch 블록에서 실패 메시지 표시
- ✅ **해결**:
  - ItemFormModal에 `onRefresh?: () => void` prop 추가
  - PstaSchedule에서 `onRefresh={() => setRefreshKey(prev => prev + 1)}` 전달
  - 이동 성공 시 조건부로 `onRefresh()` 호출하여 ItemTree 새로고침
- **변경된 파일**:
  - `frontend/src/components/ItemFormModal.tsx` (line 18, 70, 1071-1074)
  - `frontend/src/pages/PstaSchedule.tsx` (line 1428)

#### Ant Design message context 경고 해결
- ✅ **문제**: ServiceManagement에서 서비스 생성 시 콘솔 경고 발생
  ```
  Warning: [antd: message] Static function can not consume context like dynamic theme. Please use 'App' component instead.
  ```
- ✅ **원인**: Ant Design 5.x에서 `message` static API는 테마 context를 소비할 수 없음
- ✅ **해결**:
  - App.tsx에 `<App>` 컴포넌트 추가하여 전역 context 제공
  - ServiceManagement.tsx에서 `message` static import를 `App.useApp()` hook으로 변경
  - 이제 모든 페이지에서 context 기반 message/modal/notification 사용 가능
- **변경된 파일**:
  - `frontend/src/App.tsx` (line 3, 131, 307)
  - `frontend/src/pages/ServiceManagement.tsx` (line 4, 39)

**기술 세부사항**:
- onRefresh prop 패턴: 부모 컴포넌트에서 상태 관리, 자식에서 콜백 호출
- Ant Design App 컴포넌트: ConfigProvider 하위에 배치하여 테마와 통합
- useApp() hook: `{ message, modal, notification }` 제공

---

## v1.1.4 - 2025-11-03

### ✨ 일정관리 필터 개선 및 아이템 이동 기능 추가

#### 일정관리 다중 선택 필터
- ✅ **고객/프로젝트 다중 선택 체크박스**
  - 단일 선택 드롭다운 → 체크박스 다중 선택으로 변경
  - 여러 고객/프로젝트를 동시에 필터링 가능
  - 선택된 항목 개수 표시 (예: `고객 선택 (2)`)
- ✅ **팀 필터 제거**
  - 중복 팀 이름 문제로 팀 필터 완전 제거
  - 고객과 프로젝트 필터만 유지
- ✅ **필터 상태 관리**
  - `selectedClientIds`, `selectedProjectIds` 배열 기반 상태 관리
  - 계층 구조 기반 필터링 로직 (ancestorProjectId 전파)
- **변경된 파일**:
  - `frontend/src/pages/PstaSchedule.tsx`
  - `frontend/src/components/ItemTree.tsx`

#### 아이템 이동 기능 (프로젝트/서비스/팀 간 이동)
- ✅ **프로젝트 이동 모달**
  - 수정 화면에서 "프로젝트 이동" 버튼 클릭 시 모달 오픈
  - 아이템 타입별 이동 대상:
    - **액션(ACTION)**: 프로젝트 → 서비스 → 팀 선택 (3단계 cascading)
    - **팀(TEAM)**: 서비스 선택
    - **서비스(SERVICE)**: 프로젝트 선택
  - 현재 부모 항목은 선택 목록에서 자동 제외
- ✅ **Backend API 엔드포인트**
  - `PATCH /api/items/:id/move` 추가
  - 계층 구조 검증:
    - ACTION → TEAM만 허용
    - TEAM → SERVICE만 허용
    - SERVICE → PROJECT만 허용
  - 이동 후 이전/새 부모의 진행률 자동 재계산
- ✅ **Frontend API 연동**
  - `itemsApi.moveItem(id, parentId)` 함수 추가
  - 이동 성공 시 자동 새로고침
- **변경된 파일**:
  - `frontend/src/components/ItemFormModal.tsx` (모달 UI)
  - `frontend/src/api/items.ts` (moveItem API)
  - `backend/src/routes/item.routes.ts` (라우트 추가)
  - `backend/src/controllers/item.controller.ts` (moveItem 컨트롤러)

**기술 세부사항**:
- 다중 선택 필터: Ant Design Dropdown + Checkbox 조합
- 배열 기반 필터링: `array.includes()` 및 `array.length > 0` 체크
- 계층 구조 전파: 재귀 함수에서 `ancestorProjectId` 파라미터 전달
- 진행률 재계산: `updateItemAndParents()` 서비스 함수 활용
- 타입 안전성: TypeScript enum으로 아이템 타입 검증

---

## v1.1.3 - 2025-10-29

### ✨ WBS 페이지 UI/UX 개선

#### WBS 테이블 정보 밀도 향상
- ✅ **PSTA 업무명 필드에 상태 태그 통합**
  - 상태 필드 컬럼 제거로 100px 공간 절약
  - PSTA 업무명에 상태 태그를 inline으로 표시
  - 예: `[P] 2025 현시스템 유지관리 (3) [진행중]`
- ✅ **PSTA 타입 레이블 단축**
  - Project → P, Service → S, Team → T, Action → A
  - 태그 크기 최소화 (10px font, 4px padding)
- ✅ **하위 항목 수 표시**
  - 하위 항목이 있는 경우 괄호로 개수 표시 (예: `(3)`)
  - 회색 작은 글씨로 공간 효율적 표시
- ✅ **담당자 열 최적화**
  - 아바타 아이콘 제거 (공간 활용 우선)
  - 너비 100px → 80px로 축소 (20px 절약)
  - 텍스트만 표시 (12px font)
- ✅ **PSTA 업무명 열 확장**
  - 350px → 450px로 증가 (+100px)
  - 절약된 공간을 재분배하여 가독성 개선
- **변경된 파일**: `frontend/src/components/WbsGanttCustom.tsx`

#### server.sh 스크립트 프로덕션 배포 반영
- ✅ **Vite에서 serve로 전환 반영**
  - `status_frontend()`: `pgrep -f "vite"` → `pgrep -f "serve -s dist"`
  - `start_frontend()`: `npm run dev` → `nohup serve -s dist -l 3000 -n`
  - `stop_frontend()`: `pkill -f "vite"` → `pkill -f "serve -s dist"`
- ✅ **상태 메시지 업데이트**
  - "(Vite Dev)" → "(Production - serve)"
  - "dev mode" → "production mode"
- ✅ **프로세스 감지 정확도 개선**
  - 정확한 serve 명령어로 프로세스 감지
  - 강제 종료 로직도 serve 프로세스 대상으로 변경
- **변경된 파일**: `bin/server.sh`
- **테스트 완료**: status, start, stop, restart 명령 모두 정상 동작

**기술 세부사항**:
- WBS 테이블 레이아웃: Tag 컴포넌트 중첩 사용, flex layout 최적화
- 필드 접근: Prisma 관계 필드 `User_Item_assigneeIdToUser` 정확히 매핑
- server.sh: systemd 서비스 우선, 없으면 직접 프로세스 관리 폴백
- serve 옵션: `-s dist` (SPA), `-l 3000` (포트), `-n` (no clipboard)

---

### ✨ WBS 페이지 대폭 개선

#### WBS 상세보기 일정관리 페이지와 100% 동일화
- ✅ 70/30 레이아웃 적용 (좌측 70% 정보, 우측 30% 댓글)
- ✅ **댓글 기능 완전 구현**
  - 댓글 목록 표시 (아바타, 작성자, 작성일)
  - 댓글 추가 (사용자 멘션 @username, 이모지 지원)
  - 댓글 삭제 (본인 또는 관리자)
  - 실시간 댓글 로딩
- ✅ **관련 문서 섹션 추가**
  - 현재 항목 + 하위 항목의 파일/링크 계층적 표시
  - 파일 크기 포맷팅, 업로드자, 날짜 표시
  - 삭제 기능 (업로더 또는 관리자)
  - 파일/링크 클릭으로 새 탭에서 열기
  - 항목별 태그 표시
- ✅ **하위 항목 리스트 추가**
  - 타입별 하위 항목 표시 (프로젝트→서비스, 서비스→팀, 팀→액션)
  - 타입 태그, 상태 태그, 담당자, 기간, 진행률(원형) 표시
  - 하위 항목 클릭으로 상세보기 전환
- ✅ **연결된 작업 요청 표시**
  - ACTION 타입에 WorkRequest 연결 시 표시
  - 우선순위, 상태, 요청자, 담당자 표시
  - 클릭 시 작업 요청 페이지로 이동
- **변경된 파일**: `frontend/src/components/WbsGanttCustom.tsx`

#### WBS 페이지 공간 활용 최적화
- ✅ 페이지 제목/설명 제거 ("WBS (PSTA)", 설명문 제거)
- ✅ **테이블 열 너비 조정**
  - PSTA 업무명: 250px → **350px** (+100px)
  - 진행률: 120px bar → **80px 원형** (-40px)
- ✅ **진행률 표시 변경**
  - 가로 Progress bar → 원형 Progress (40px)
  - 공간 절약 및 시각적 개선
- ✅ **필터 UI 개선**
  - 2개 행 → 1개 행으로 통합
  - 고객/프로젝트/팀/날짜범위/빠른선택/새로고침 모두 한 줄에 배치
  - `Space wrap` 적용으로 반응형 지원
- **변경된 파일**:
  - `frontend/src/pages/WbsView.tsx` (제목/설명 제거)
  - `frontend/src/components/WbsGanttCustom.tsx` (테이블, 필터 수정)

#### 인프라 문서 개선
- ✅ Nginx 리버스 프록시 설정 상세 문서화
  - 서버 정보 (192.168.1.151 Nginx → 192.168.1.250 App)
  - Docker Compose 경로 및 구조
  - 설정 파일 전체 내용 (`250.conf`)
  - 프록시 라우팅 테이블
  - 관리 명령어 (설정 검증 `-t` 옵션 포함)
- **변경된 파일**: `docs/infrastructure/INFRASTRUCTURE.md`

**기술 세부사항**:
- 새로운 imports: `commentsApi`, `filesApi`, `linksApi`, `EmojiPicker`, `Mentions`, `Popover`
- 새로운 state: `comments`, `commentContent`, `showEmojiPicker`, `relatedDocs`
- Helper functions: `renderCommentContent`, `formatFileSize`, `getPriorityLabel/Color`, `getWorkRequestStatusLabel/Color`
- Handlers: `fetchComments`, `handleAddComment`, `handleDeleteComment`, `loadRelatedDocuments`, `handleDeleteRelatedDoc`, `handleEmojiClick`, `handleGoToWorkRequest`
- Nginx 설정: SSL (Let's Encrypt), 프록시 라우팅 (`/api/`, `/uploads/`, `/`), Docker Compose 관리

---

## v1.1.2 - 2025-10-28

### 🔧 인프라 개선 및 버그 수정

#### server.sh 스크립트 systemd 통합
- ✅ systemd 서비스 자동 감지 및 통합
- ✅ `systemctl` 명령 자동 사용 (서비스 활성화 시)
- ✅ 직접 프로세스 관리 폴백 (서비스 비활성화 시)
- ✅ Backend/Frontend 상태 감지 개선 (Production/Development 모드 구분)
- ✅ passwordless sudo 설정 (`/etc/sudoers.d/dztw`)
- **변경된 파일**: `bin/server.sh`
- **테스트 완료**: restart backend, start/stop backend, restart frontend, restart all

#### psta-postgres 도커 컨테이너 관리 개선
- ✅ server.sh에서 psta-postgres 직접 시작/중지 가능
- ✅ 시스템 PostgreSQL과 독립적으로 관리
- ✅ `docker start/stop` 명령 직접 사용
- ✅ Health check 자동 확인 (pg_isready)
- ✅ 존재하는 컨테이너 재사용 또는 docker-compose로 생성
- **변경된 파일**: `bin/server.sh` (start_db, stop_db, status_db 함수)
- **테스트 완료**: start db, stop db, restart db, restart all with db

#### 로그인 페이지 에러 처리 개선
- ✅ 네트워크 연결 실패 시 명확한 에러 메시지 표시
- ✅ 서버 오류(500) 시 사용자 친화적 메시지
- ✅ 시스템 오류 Alert 컴포넌트 추가
- ✅ 에러 타입별 분기 처리
- **변경된 파일**: `frontend/src/pages/LoginPage.tsx`

#### systemd 서비스 파일 생성
- ✅ psta-backend.service 생성 (PostgreSQL 의존성 포함)
- ✅ Docker 컨테이너 헬스 체크 대기 로직 추가
- ✅ ExecStartPre로 psta-postgres 준비 확인
- **파일**: `/etc/systemd/system/psta-backend.service` (적용 대기)

#### 데이터베이스 자동 재시작 설정
- ✅ psta-postgres 컨테이너 `restart=always` 정책 적용
- ✅ OS 재부팅 시 자동 시작
- **명령**: `docker update --restart=always psta-postgres`

**기술 세부사항**:
- systemd 감지: `systemctl is-enabled <service>`
- 프로세스 감지: `pgrep -f "node dist/index.js"` (Production), `pgrep -f "ts-node src/index.ts"` (Dev)
- Docker 컨테이너 정확한 매칭: `grep -q "^psta-postgres$"`
- sudoers 설정: NOPASSWD for systemctl commands

---

## v1.1.1 - 2025-10-27

### 🐛 버그 수정 및 UI 개선

#### 대시보드 알림 버튼 개선
- ✅ "확인하기" 버튼이 직접 알림 Drawer를 열도록 개선
- ✅ Custom DOM Event 시스템 구현 (`openNotificationDrawer`)
- **변경된 파일**: `MainLayout.tsx`, `Dashboard.tsx`

#### 브라우저 콘솔 에러 수정
- ✅ Vite HMR WebSocket 에러 수정 - HMR 완전 비활성화
- ✅ Mixed Content 에러 수정 - 하드코딩 HTTP URL → 상대 경로
- ✅ Ant Design deprecated 경고 수정 - `bodyStyle` → `styles.body`
- **변경된 파일**: `vite.config.ts`, `Report.tsx`, `Dashboard.tsx`

#### 메시지 전송 슬랙 알림 통합
- ✅ `/messages` 페이지에서 메시지 전송 시 슬랙 알림 자동 발송
- ✅ 'message_received' 알림 타입 추가
- **변경된 파일**: `message.controller.ts`, `notification-slack.service.ts`

#### 도메인 URL 시스템 설정 기능 ⭐
- ✅ "시스템 설정 > 일반 설정"에 "프론트엔드 URL" 필드 추가
- ✅ 슬랙 알림 링크가 도메인(`https://psta.dztechwill.com`)으로 리다이렉트
- ✅ DB 기반 설정 (환경변수 대신)
- ✅ 우선순위: DB 설정 > 환경변수 > 하드코딩 폴백
- **변경된 파일**:
  - `GeneralSettings.tsx` - 프론트엔드 URL 입력 필드 추가
  - `system-settings.ts` - SystemSettings 인터페이스 확장
  - `notification-slack.service.ts` - DB에서 frontendUrl 읽도록 수정

#### 작업 요청 페이지 UI 개선
- ✅ 탭 순서 변경: "받은 요청" → "보낸 요청" 순서로 변경
- ✅ 기본 탭을 "받은 요청"으로 설정
- **변경된 파일**: `WorkRequests.tsx`

**기술 세부사항**:
- Custom Event: `window.dispatchEvent(new Event('openNotificationDrawer'))`
- Vite Config: `hmr: { overlay: false, clientPort: undefined }`
- Async Link Generation: `generateLink()` 메서드를 async로 변경

---

## v1.1.0 - 2025-10-27

### 🔧 인프라 개선

#### 로그 시스템 구축
- ✅ Winston 기반 구조화된 로깅
- ✅ 일별 로그 로테이션 (30일 보존)
- ✅ 9개 카테고리 로거 (app, error, access, auth, database, ldap, slack, notification, migration)
- ✅ JSON 형식 로그 (파싱 용이)
- ✅ HTTP 요청 자동 로깅
- ✅ `/log/psta/` 디렉토리 구조화

**로그 디렉토리 구조**:
```
/log/psta/
├── app/backend/       # 백엔드 로그 (JSON)
├── app/frontend/      # 프론트엔드 로그
├── database/          # DB 로그
├── external/          # LDAP, Slack 로그
└── system/            # 시스템 로그
```

**추가된 패키지**:
- winston@3.17.0
- winston-daily-rotate-file@5.0.0

**변경된 파일**:
- `backend/src/config/logger.ts` (신규)
- `backend/src/index.ts` - HTTP 로깅 미들웨어 추가
- `backend/src/controllers/auth.controller.ts` - 인증 로깅 추가
- `backend/src/config/database.ts` - Prisma 이벤트 로깅 추가
- `bin/server.sh` - 로그 경로 변경 (/tmp → /log/psta)
- `bin/collect-postgres-logs.sh` (신규)

---

## v1.0.0 - 2025-10-27

### 🎉 초기 릴리즈

PSTA 시스템 공식 v1.0 출시

### 주요 기능

#### 프로젝트 관리
- ✅ 계층적 프로젝트 관리 (Project → Service → Team → Action)
- ✅ Notion 스타일 트리 뷰
- ✅ 상태/진행률 자동 산정 (TEAM/SERVICE/PROJECT)
- ✅ Excel Import/Export

#### 인증 및 권한
- ✅ LDAP 인증 통합
- ✅ 사용자 승인 워크플로우
- ✅ 4단계 역할 (ADMIN/PO/PM/MEMBER)
- ✅ 페이지별 CRUD 권한 관리
- ✅ LDAP 그룹 → 팀 자동 할당

#### 작업 관리
- ✅ 작업 요청 시스템
- ✅ 작업 요청 → 액션 자동 변환
- ✅ 파일 첨부 기능 (최대 20MB)
- ✅ 클라이언트 로고 업로드 (최대 5MB)

#### 알림 시스템
- ✅ 멀티 플랫폼 지원 (Slack, Telegram, Discord)
- ✅ 댓글 멘션 시 DM 자동 발송
- ✅ Block Kit 메시지 포맷

#### 시각화
- ✅ WBS Gantt 차트
- ✅ 날짜/프로젝트/팀 필터
- ✅ 보고서 생성 (날짜 범위별 통계)
- ✅ 프로젝트별 그룹화

#### UI/UX
- ✅ 계층 토글 버튼 (P/S/T/A)
- ✅ 통합 필터 드롭다운
- ✅ 3단계 위자드 (프로젝트/서비스)
- ✅ Drawer 확장/축소 기능

### 기술 스택

**Backend**:
- Node.js v24.9.0
- Express v4.18.2
- TypeScript v5.3.3
- PostgreSQL v14.x
- Prisma v5.7.1

**Frontend**:
- React v18.2.0
- Ant Design v5.12.5
- Vite v5.0.11
- TypeScript v5.3.3
- Zustand v4.4.7

**Infrastructure**:
- OS: Ubuntu 22.04.5 LTS
- Architecture: x86_64
- Kernel: Linux 5.15.0-156-generic

### 배포 환경
- 프로덕션 URL: http://psta.dztechwill.com
- 내부 IP: http://192.168.1.250:3000
- Backend: http://192.168.1.250:3001

### 데이터베이스 스키마
- 15개 주요 모델
  - User, Team, Client, Item, File
  - WorkRequest, Comment, Notification, Message
  - Permission, LdapConfig, NotificationApp
  - SystemSetting, ReportSnapshot, Link

### 문서
- ✅ INFRASTRUCTURE.md - 인프라 명세서
- ✅ DEVELOPMENT_GUIDE.md - 개발 가이드
- ✅ USER_GUIDE.md - 사용자 가이드
- ✅ FEATURES.md - 기능 소개서
- ✅ CLAUDE.md - Claude Code 가이드

### 알려진 제한사항
- ❌ IE 브라우저 미지원
- ⚠️ 모바일 최적화 부족
- ⚠️ 실시간 협업 미지원 (WebSocket 없음)

---

## 향후 버전 계획

### v1.1.0 (계획 중)
- [ ] 댓글 스레드 기능
- [ ] 활동 로그
- [ ] 이메일 알림
- [ ] 즐겨찾기 기능
- [ ] 검색 기능 개선

### v1.2.0 (계획 중)
- [ ] 모바일 앱 (React Native)
- [ ] 대시보드 위젯 커스터마이징
- [ ] 캘린더 뷰
- [ ] 의존성 관리
- [ ] 다크 모드

### v2.0.0 (장기 계획)
- [ ] AI 기반 일정 예측
- [ ] 자동 리스크 감지
- [ ] 실시간 협업 편집 (WebSocket)
- [ ] 다국어 지원
- [ ] 모바일 최적화

---

## 참고

### 버전 번호 규칙
- **Major (x.0.0)**: 호환성이 깨지는 변경
- **Minor (0.x.0)**: 새 기능 추가 (하위 호환)
- **Patch (0.0.x)**: 버그 수정

### 변경사항 카테고리
- `Added`: 새로운 기능
- `Changed`: 기존 기능 변경
- `Deprecated`: 곧 제거될 기능
- `Removed`: 제거된 기능
- `Fixed`: 버그 수정
- `Security`: 보안 관련 변경

---

**최종 업데이트**: 2025-10-28
