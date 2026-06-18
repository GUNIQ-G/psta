# PSTA Changelog

모든 주요 변경사항은 이 파일에 기록됩니다.

---

## v1.1.32 (2026-06-18)

### 🔐 로컬 인증 & 멤버 관리

#### 핵심 변경사항
- ✅ **admin 계정 DB 저장**: User 테이블에 `authType`(LOCAL/LDAP) + `passwordHash` 필드 추가
- ✅ **설치 마법사 Step 3**: admin 비밀번호 직접 입력 (bcrypt 해시 후 DB 저장)
- ✅ **비밀번호 변경**: `POST /api/auth/change-password` — 프로필 페이지에서 변경 가능
- ✅ **프로필 편집**: LOCAL 계정은 이름·이메일·전화번호 직접 수정 가능
- ✅ **멤버 관리 페이지**: 시스템 설정 → 멤버 관리 (탭 구조)
  - 멤버 조회 탭: 로컬 계정 생성·수정·비밀번호 초기화·활성화/비활성화
  - LDAP 인증 탭: LDAP 설정 + 동기화 관리 모달 통합
  - LDAP 활성화 시 로컬 계정 생성 비활성화 + 안내 메시지
- ✅ **권한 관리 동기화**: 누락된 리소스(`members`, `ldap-sync`, `feedback`, `team-status` 등) 추가
- ✅ **메뉴 정리**: LDAP 인증·동기화 별도 메뉴 제거 → 멤버 관리로 통합

#### DB 변경
- Migration: `20260618000000_add_local_auth` — User 테이블 `authType`, `passwordHash` 컬럼 추가

#### API 추가
- `GET/POST /api/admin/members` — 멤버 목록 조회 / 로컬 계정 생성
- `PUT /api/admin/members/:id` — 멤버 정보 수정
- `PUT /api/admin/members/:id/toggle-active` — 활성화/비활성화
- `POST /api/admin/members/:id/reset-password` — 비밀번호 초기화
- `PUT /api/admin/members/profile` — 본인 프로필 수정
- `POST /api/auth/change-password` — 비밀번호 변경

---

## v1.1.31 (2026-06-17)

### 🧙 WordPress 스타일 웹 설치 마법사 + 경로 환경변수화

#### 핵심 변경사항
- ✅ **웹 설치 마법사**: `docker compose up -d` 후 브라우저에서 `/install` 접근하여 초기 설정
- ✅ **경로 환경변수화**: `PSTA_DATA_DIR`, `PSTA_LOG_DIR` 로 모든 경로 설정 가능
- ✅ **기본 로고·파비콘**: Logo_02_color+white, favicon_01_full_colored 기본 적용
- ✅ **포트·호스트 환경변수**: `FRONTEND_PORT`, `BACKEND_PORT`, `BACKEND_HOST` 지원

---

## v1.1.30 (2026-06-16)

### 🐳 프론트엔드 서빙 방식 변경: nginx Docker

#### 핵심 변경사항
- ✅ **프론트엔드 서빙을 `serve`에서 nginx Docker 컨테이너로 교체**
- ✅ **nginx 관련 파일 구조 통합**: `/app/psta/nginx/` 디렉토리 신설
- ✅ **nginx 로그 분리**: `/log/nginx/access.log`, `/log/nginx/error.log`
- ✅ **logrotate 설정**: `/app/psta/nginx/logrotate.conf`

#### 파일 구조
```
/app/psta/nginx/
├── Dockerfile          # nginx:alpine + gettext(envsubst)
├── docker-compose.yml  # psta-frontend 컨테이너 정의
├── nginx.conf          # 설정 템플릿 (${BACKEND_HOST} 변수)
├── entrypoint.sh       # envsubst 치환 후 nginx 기동
├── logrotate.conf      # 로그 로테이션
└── dist/               # 빌드된 정적 파일 (volume mount)
```

#### nginx 설정 주요 포인트
- `location ^~ /uploads` — 업로드 파일 프록시 (`^~`로 정적파일 regex보다 우선 적용)
- `location /api/` — 백엔드 API 프록시
- `BACKEND_HOST` 환경변수로 백엔드 주소 동적 주입

#### server.sh 변경
- `start frontend`: 빌드(`npm run build`) → `nginx/dist/` 복사 → `docker compose up -d --build`
- `restart frontend`: 컨테이너 실행 중이면 dist만 재빌드 (nginx 재시작 없음)
- `stop frontend`: `docker compose down`
- `logs frontend`: `docker logs -f psta-frontend`

#### logrotate 설정 주의사항
- `logrotate.conf`는 소유자 root + 권한 644 필수 (`su root root` 지시어 포함)
- 파일 수정 시마다 `sudo chown root:root /app/psta/nginx/logrotate.conf` 재실행 필요

#### 버그 수정
- **`/uploads` 이미지 404 수정**: `location /uploads`에 `^~` 수식어 추가로 정적파일 regex(`*.png` 등)가 업로드 경로를 가로채던 문제 해결

---

## v1.1.29 (2025-12-31)

### 📎 파일 업로드 확장자 확대

#### 핵심 변경사항
- ✅ **개발/기술 문서 파일 업로드 지원**: .md, .sql, .json, .csv, .xml, .yaml, .yml, .log 확장자 추가

#### 추가된 파일 타입
| 카테고리 | 확장자 | MIME 타입 |
|---------|--------|----------|
| 마크다운 | `.md` | `text/markdown`, `text/x-markdown` |
| SQL | `.sql` | `application/sql`, `text/x-sql` |
| 데이터 | `.json`, `.csv`, `.xml` | `application/json`, `text/csv`, `application/xml` |
| 설정 | `.yaml`, `.yml` | `text/yaml`, `application/x-yaml` |
| 로그 | `.log` | `text/plain` |

#### 백엔드 변경
- ✅ **multer.ts**: `itemFileFilter` 함수 확장
  - MIME 타입 화이트리스트 확대
  - 확장자 기반 추가 허용 (MIME 타입이 정확하지 않은 경우 대비)

---

### 🔄 상태-진행률 양방향 자동 연동

#### 핵심 변경사항
- ✅ **상태 변경 시 진행률 자동 설정**: 완료→100%, 시작전→0%
- ✅ **진행률 변경 시 상태 자동 설정**: 100%→완료, 0%→시작전, 1~99%→진행중
- ✅ **보류 상태 보호**: 보류 상태일 때는 진행률 변경해도 상태 유지

#### 연동 규칙
| 상태 변경 | 진행률 자동 설정 |
|----------|----------------|
| 시작전 | → 0% |
| 완료 | → 100% |
| 진행중/보류 | 유지 |

| 진행률 변경 | 상태 자동 설정 |
|------------|--------------|
| 0% | → 시작전 |
| 100% | → 완료 |
| 1~99% | → 진행중 (보류일 때 제외) |

#### 프론트엔드 변경
- ✅ **ActionCreateDrawer.tsx**: 상태/진행률 Select/InputNumber에 onChange 핸들러 추가
- ✅ **ActionFormSection.tsx**: form prop 추가, 양방향 연동 핸들러 구현
- ✅ **ItemFormModal.tsx**: ActionFormSection에 form prop 전달

#### 백엔드 변경
- ✅ **item.controller.ts createItem**: 생성 시 상태-진행률 연동 로직 추가
- ✅ **item.controller.ts updateItem**: 수정 시 상태-진행률 연동 로직 추가 (ACTION 타입만)

---

## v1.1.28 (2025-12-12)

### 🔗 링크 자동 문서명 추출 기능

#### 핵심 변경사항
- ✅ **Nextcloud 문서명 자동 추출**: 링크 추가 시 URL에서 문서명 자동 가져오기
- ✅ **LinkAddModal 공통 컴포넌트**: 링크 추가 모달을 단일 컴포넌트로 통합
- ✅ **Nextcloud App Password 인증**: 시스템 설정에서 Nextcloud 인증 정보 관리

#### 신규 파일
- ✅ `frontend/src/components/modals/LinkAddModal.tsx` - 링크 추가 공통 모달 컴포넌트

#### 백엔드 변경
- ✅ **link.controller.ts**: `fetchTitle` 함수 추가
  - URL에서 HTML 페이지 가져오기
  - og:title, title 태그에서 문서명 추출
  - Nextcloud URL 감지 시 Basic Auth 자동 적용
  - `getNextcloudSettings()` 함수로 SystemSetting에서 인증 정보 로드
- ✅ **link.routes.ts**: `/fetch-title` GET 라우트 추가

#### 프론트엔드 변경
- ✅ **LinkAddModal.tsx**: 새 공통 컴포넌트
  - URL 입력 후 돋보기 버튼 클릭 또는 blur 시 자동 조회
  - `App.useApp()` 훅으로 Ant Design message API 사용
  - `destroyOnHidden` 속성으로 메모리 누수 방지
- ✅ **links.ts**: `fetchTitle` API 함수 추가
- ✅ **FileAndLinkSection.tsx**: LinkAddModal 사용으로 코드 간소화
- ✅ **ActionCreateDrawer.tsx**: LinkAddModal 사용으로 중복 코드 제거
- ✅ **useItemForm.ts**: `linkForm` 제거, `handleLinkCreate(url, displayName)` 방식으로 변경
- ✅ **useUnifiedItemForm.ts**: `linkForm` 제거

#### 시스템 설정
- ✅ **SystemSetting 테이블**: Nextcloud 인증 정보 저장
  - `nextcloud_url`: Nextcloud 서버 URL
  - `nextcloud_username`: 사용자명
  - `nextcloud_app_password`: 앱 비밀번호

#### 기능 동작
| 링크 유형 | 지원 여부 | 설명 |
|----------|---------|------|
| 공개 공유 링크 (`/s/...`) | ✅ 지원 | og:title에서 파일명 추출 |
| 내부 링크 (`/f/...`) | ⚠️ 제한 | JavaScript 렌더링으로 서버 측 파싱 불가 |
| 일반 웹페이지 | ✅ 지원 | title 태그에서 제목 추출 |

#### 제한사항
- Nextcloud 내부 링크(`/f/...`)는 JavaScript로 렌더링되어 서버 측 title 추출 불가
- 내부 링크 사용 시 문서명 수동 입력 필요

---

### 🧹 레거시 Slack 채널 알림 시스템 제거

#### 핵심 변경사항
- ✅ **레거시 채널 알림 제거**: 사용하지 않는 `#psta-notifications` 채널 알림 시스템 정리
- ✅ **현대식 DM 시스템 유지**: NotificationApp 기반 개인 DM 알림은 정상 유지

#### 삭제된 파일
- ❌ `backend/src/services/slack.service.ts` - 레거시 채널 알림 서비스
- ❌ `backend/src/config/slack.ts` - 레거시 Slack 설정
- ❌ `backend/src/routes/slack.routes.ts` - 레거시 라우트
- ❌ `backend/src/controllers/slack.controller.ts` - 레거시 컨트롤러

#### 백엔드 변경
- ✅ **item.controller.ts**: slackService 호출 제거
- ✅ **index.ts**: `/api/slack-configs` 라우트 제거

#### DB 정리
- ✅ **SlackConfig 테이블**: 레거시 설정 데이터 삭제
- ✅ **SlackNotification 테이블**: 실패 로그 390건 삭제

#### 시스템 비교
| 구분 | 제거됨 (레거시) | 유지됨 (현대식) |
|------|----------------|----------------|
| 설정 테이블 | SlackConfig | NotificationApp |
| 발송 방식 | 채널 포스팅 | 개인 DM |
| API | `/api/slack-configs` | `/api/notification-apps` |
| 기능 | 아이템 생성/변경 알림 | 멘션, 작업요청 등 |

---

### 🔔 아이템 알림 현대식 시스템 연결

#### 핵심 변경사항
- ✅ **업무 할당 알림**: 아이템 생성 시 담당자에게 DM 발송
- ✅ **상태 변경 알림**: 아이템 상태 변경 시 담당자에게 DM 발송
- ✅ **업무 완료 알림**: 아이템 완료 시 생성자에게 DM 발송

#### 백엔드 변경
- ✅ **item.controller.ts createItem**: `NotificationService.notifyItemAssigned` 호출 추가
- ✅ **item.controller.ts updateItem**: `NotificationService.notifyStatusChanged` 호출 추가
- ✅ **item.controller.ts updateItem**: `NotificationService.notifyItemCompleted` 호출 추가

#### 알림 조건
| 이벤트 | 수신자 | 조건 |
|--------|--------|------|
| 업무 할당 | 담당자 | 본인이 할당한 경우 제외 |
| 상태 변경 | 담당자 | 본인이 변경한 경우 제외 |
| 업무 완료 | 생성자 | 본인이 완료한 경우 제외 |

---

## v1.1.27 (2025-12-08)

### 🐛 버그/건의 게시판 및 리치 텍스트 에디터

#### 핵심 변경사항
- ✅ **버그/건의 게시판 기능**: 사용자 피드백 및 버그 신고 시스템 구현
- ✅ **Tiptap 리치 텍스트 에디터**: 이미지 붙여넣기(Ctrl+V), 드래그앤드롭, 버튼 업로드 지원
- ✅ **이미지 서버 저장**: base64 대신 서버에 파일로 저장, URL 반환
- ✅ **메뉴 구조 변경**: "시스템 지원" 그룹 신규 생성, "버그/건의" 메뉴 추가

#### 신규 파일
- ✅ `frontend/src/components/TiptapEditor.tsx` - 리치 텍스트 에디터 컴포넌트
- ✅ `frontend/src/components/TiptapEditor.css` - 에디터 스타일

#### 백엔드 변경
- ✅ **multer.ts**: 피드백 이미지 저장소 설정 추가 (`/data/psta/uploads/feedback-images/`)
- ✅ **feedback.controller.ts**: `uploadImage`, `getImage` 함수 추가
- ✅ **feedback.routes.ts**: 이미지 업로드/조회 라우트 추가 (이미지 조회는 인증 불필요)

#### 프론트엔드 변경
- ✅ **FeedbackList.tsx**: TiptapEditor 통합, 모달 80% 너비, 경로 안내 팁 추가
- ✅ **MainLayout.tsx**: "시스템 지원" 그룹 생성, "버그/건의" 메뉴 추가
- ✅ **feedback.ts**: axios 인스턴스 변경 (상대 경로 `/api` 사용)

#### UI 개선
- ✅ 모달 너비 80% (최대 1200px)
- ✅ 에디터 높이 350px
- ✅ 문제 경로 안내 팁 박스 추가
  - 예: "일정관리 > 서비스 트리에서 항목 클릭 > 상세정보 모달의 관련문서 탭"

#### Tiptap 에디터 기능
| 기능 | 설명 |
|------|------|
| 이미지 붙여넣기 | Ctrl+V로 클립보드 이미지 붙여넣기 |
| 드래그앤드롭 | 파일 드래그하여 에디터에 드롭 |
| 이미지 업로드 버튼 | 툴바에서 이미지 선택 업로드 |
| 서식 지원 | 굵게, 기울임, 취소선, 목록 |
| 실행 취소/다시 실행 | Ctrl+Z/Y 지원 |

#### 메뉴 구조 변경
```
시스템 지원          ← 신규 그룹
└─ 버그/건의         ← 피드백 게시판 → 버그/건의로 이름 변경
```

#### 버그 수정
- ✅ **ERR_CONNECTION_REFUSED**: feedback.ts에서 절대 URL → 상대 경로로 변경
- ✅ **Ant Design message warning**: `App.useApp()` 훅 사용으로 해결
- ✅ **401 Unauthorized 이미지 표시**: 이미지 라우트를 인증 미들웨어 이전으로 이동

---

### 👥 서비스 하위 액션 팀별 그룹화

#### 핵심 변경사항
- ✅ **서비스 클릭 시 하위 액션을 팀별로 그룹화해서 표시**
- ✅ **팀 헤더**: 녹색 배경의 팀 구분 헤더 (팀 이름 + 액션 수)
- ✅ **팀 정렬**: 한글 이름순 정렬 (미배정은 맨 뒤)

#### 백엔드 변경
- ✅ **item.controller.ts**: `getItemById` API에서 children에 생성자 팀 정보 추가
  - `User_Item_createdByIdToUser.Team` 포함

#### 프론트엔드 변경
- ✅ **types/index.ts**: `Item` 타입에 `User_Item_createdByIdToUser` 필드 추가
- ✅ **ItemDetailModal.tsx**: 서비스 클릭 시 하위 액션을 팀별로 그룹화
  - 팀별 그룹화 및 정렬 로직
  - 팀 헤더 UI (녹색 배경, [T] 태그)
  - 액션 목록 들여쓰기

#### UI 표시 형식
```
하위 액션 (5)
┌─────────────────────────────────────────────┐
│ [T] 개발1팀 (2개 액션)                        │
├─────────────────────────────────────────────┤
│   [A] [진행중] 액션 1    담당자  기간  진행률 │
│   [A] [완료]   액션 2    담당자  기간  진행률 │
├─────────────────────────────────────────────┤
│ [T] 개발2팀 (2개 액션)                        │
├─────────────────────────────────────────────┤
│   [A] [시작전] 액션 3    담당자  기간  진행률 │
│   [A] [진행중] 액션 4    담당자  기간  진행률 │
└─────────────────────────────────────────────┘
```

---

### 🧹 서비스 팀 할당 UI 제거

#### 핵심 변경사항
- ✅ **서비스 폼에서 팀 할당 섹션 완전 제거**: 3단계 구조 완성에 따른 불필요 기능 정리
- ✅ **TeamAssignmentSection 컴포넌트 삭제**: 더 이상 사용되지 않는 폼 섹션 제거

#### 삭제된 파일
- ❌ `frontend/src/components/form-sections/TeamAssignmentSection.tsx`

#### 수정된 파일
| 파일 | 변경 내용 |
|------|----------|
| `ItemFormModal.tsx` | TeamAssignment import, props, 렌더링 제거 |
| `useUnifiedItemForm.ts` | `selectedTeamIds`, `setSelectedTeamIds`, `loadAssignedTeams` 제거 |
| `ServiceManagement.tsx` | `showTeamAssignment`, `organizationTeams` prop 제거 |
| `PstaSchedule.tsx` | `showTeamAssignment`, `organizationTeams` prop 제거 |

#### 배경
- v1.1.26에서 3단계 구조(P-S-A)로 전환 완료
- ServiceTeam 테이블 제거로 팀 할당 UI가 불필요해짐
- 팀 정보는 액션 생성자의 팀에서 자동 추출

---

### 👁️ 조회 모드 UX 개선

#### 핵심 변경사항
- ✅ **조회/수정 모드 명확 구분**: disabled 필드 → 텍스트 렌더링으로 변경
- ✅ **좌측 세로선 디자인**: 파란색 세로선 + 연한 회색 배경으로 가독성 향상
- ✅ **레이아웃 통일성 유지**: 조회/수정 모드 전환 시 동일한 레이아웃 유지

#### 변경 전 (문제점)
```
┌─────────────────────────────────────────┐
│ 모바일 앱 개발                          │  ← disabled 필드
└─────────────────────────────────────────┘    색상: rgba(0,0,0,0.25)
                                               너무 흐려서 가독성 떨어짐
```

#### 변경 후 (개선)
```
┃░░░░░░░░░░ 모바일 앱 개발 ░░░░░░░░░░░░░░│  ← 텍스트 렌더링
                                             파란색 세로선 + 회색 배경
                                             가독성 향상
```

#### 수정된 파일
| 파일 | 변경 내용 |
|------|----------|
| `CommonFormFields.tsx` | 업무명, 일정, 설명, 담당자 → 텍스트 렌더링 |
| `ProjectFormSection.tsx` | 고객 → 텍스트 렌더링 |
| `ServiceFormSection.tsx` | 고객, 프로젝트 → 텍스트 렌더링 |
| `ActionFormSection.tsx` | 프로젝트, 서비스, 팀, 상태, 진행률 → 텍스트 렌더링 |

#### 신규 파일
- ✅ `frontend/src/styles/view-field.css` - 조회 모드 필드 스타일

#### CSS 스타일
```css
.view-field {
  border-left: 3px solid #1890ff;  /* 파란색 세로선 */
  background-color: #fafafa;        /* 연한 회색 배경 */
  border-radius: 0 6px 6px 0;
  padding: 8px 12px;
}
```

---

## v1.1.26 (2025-12-06)

### 📊 3단계 구조 완성 및 팀별 현황 조회

#### 핵심 변경사항
- ✅ **ServiceTeam 완전 제거**: 4단계 구조(Project→Service→Team→Action)에서 3단계 구조(Project→Service→Action)로 완전 전환
- ✅ **팀별 현황 조회 메뉴 신규 추가**: 조직도 기반 팀 선택 → 해당 팀의 액션 현황 조회
- ✅ **팀 할당 관리 메뉴 삭제**: ServiceTeam 기반 팀 할당 기능 제거
- ✅ **팀 정보 출처 변경**: ServiceTeam → 액션 생성자의 팀 (createdById → User.teamId → Team)

#### 삭제된 파일
- ❌ `backend/src/controllers/service-team.controller.ts`
- ❌ `backend/src/controllers/team-assignment.controller.ts`
- ❌ `backend/src/routes/service-team.routes.ts`
- ❌ `backend/src/routes/team-assignment.routes.ts`
- ❌ `frontend/src/api/service-teams.ts`
- ❌ `frontend/src/api/team-assignments.ts`
- ❌ `frontend/src/pages/TeamAssignmentManagement.tsx`

#### 신규 파일
- ✅ `frontend/src/pages/TeamStatusOverview.tsx` - 팀별 현황 조회 페이지

#### 백엔드 변경
- ✅ **수정**: `backend/src/index.ts` - ServiceTeam/TeamAssignment 라우트 제거
- ✅ **수정**: `backend/scripts/seed-permissions.ts` - `team-assignments` → `team-status` 권한 변경

#### 프론트엔드 변경
- ✅ **수정**: `frontend/src/App.tsx` - TeamAssignmentManagement 제거, TeamStatusOverview 추가
- ✅ **수정**: `frontend/src/components/MainLayout.tsx` - 팀 할당 메뉴 제거, 팀별 현황 메뉴 추가
- ✅ **수정**: `frontend/src/components/ActionCreateDrawer.tsx` - serviceTeamsApi 참조 및 미사용 함수 제거
- ✅ **수정**: `frontend/src/hooks/useUnifiedItemForm.ts` - serviceTeamsApi 참조 제거
- ✅ **수정**: `frontend/src/pages/ServiceManagement.tsx` - serviceTeamsApi 및 Team Assign Drawer 완전 제거
- ✅ **수정**: `frontend/src/pages/PstaSchedule.tsx` - serviceTeamsApi 참조 제거

#### 팀별 현황 조회 기능
| 영역 | 기능 |
|------|------|
| 좌측 패널 | 조직도 트리 (팀 선택, 액션 수 표시) |
| 우측 상단 | 통계 카드 (전체/진행중/완료/미시작 액션, 프로젝트 수, 평균 진행률) |
| 우측 하단 | 액션 목록 테이블 (프로젝트/서비스 정보, 담당자, 상태, 진행률) |
| 집계 방식 | 상위 팀 선택 시 하위 팀 액션도 포함 |

#### 동작 변경
| 항목 | 이전 | 이후 |
|------|------|------|
| 액션 계층 구조 | Project→Service→Team(Item)→Action | **Project→Service→Action** |
| 팀 정보 출처 | ServiceTeam 테이블 | **액션 생성자의 팀** |
| 팀 할당 방식 | 서비스에 팀 수동 할당 | **자동 (액션 생성자 기준)** |
| 팀별 현황 | 없음 | **신규 메뉴 추가** |

---

## v1.1.25 (2025-12-02)

### 🔐 로그인 시 조직도 유지 및 LDAP 인증 개선

#### 핵심 변경사항
- ✅ **로그인 시 조직도(팀 배정) 유지**: 로그인해도 기존 teamId가 변경되지 않음
- ✅ **LDAP 자동 팀 배정 제거**: 로그인 시 LDAP 그룹 조회 및 자동 팀 배정 로직 완전 제거
- ✅ **시스템 OU 필터링**: LDAP 동기화에서 people, users 등 시스템 OU 제외
- ✅ **displayName 성+이름 조합**: LDAP에 displayName이 없을 때 성(sn)+이름(cn) 자동 조합

#### 문제 원인 및 해결

| 문제 | 원인 | 해결 |
|------|------|------|
| 로그인 시 조직도에서 빠짐 | 매 로그인 시 LDAP 그룹 기반으로 teamId 덮어쓰기 | LDAP 그룹 조회 및 팀 배정 로직 제거 |
| people 팀이 생성됨 | LDAP 필터에서 people OU 미제외 | 필터에 `(!(ou=people))(!(ou=users))` 추가 |
| 이름에서 성이 빠짐 | displayName만 사용, sn 미사용 | displayName 없으면 sn+cn 조합 |

#### 백엔드 변경
- ✅ **수정**: `backend/src/controllers/auth.controller.ts`
  - LDAP 그룹 조회 로직 제거 (`getUserGroups()` 호출 삭제)
  - 자동 팀 배정 로직 제거
  - 신규 사용자: `teamId: null` (관리자가 수동 배정)
  - 기존 사용자: `teamId` 업데이트하지 않음 (기존 값 유지)

- ✅ **수정**: `backend/src/config/ldap.ts`
  - `getOrganizationalUnits()`: 필터에 people, users OU 제외 추가
  - `authenticate()`: displayName 없을 때 `sn + cn` 조합으로 이름 생성

#### 동작 변경
| 항목 | 이전 | 이후 |
|------|------|------|
| 로그인 시 teamId | LDAP 그룹 기반 덮어쓰기 | **기존 값 유지** |
| 신규 사용자 teamId | LDAP 그룹에서 자동 배정 | **null** (수동 배정) |
| 조직도 관리 | LDAP 자동 + 수동 혼용 | **수동 관리만** |
| displayName | displayName 또는 cn | displayName 또는 **sn+cn** |
| people OU | 팀으로 생성됨 | **제외됨** |

---

## v1.1.24 (2025-12-01)

### 🏢 조직도 역할 관리 기능 및 LDAP 동기화 정책 변경

#### 핵심 변경사항
- ✅ **LDAP 자동 동기화 삭제**: 조직 계층 구조 보존을 위해 매일 새벽 2시 자동 동기화 완전 삭제
- ✅ **조직도 역할 변경 기능**: ADMIN이 조직도에서 직접 PO/PM/MEMBER 역할 변경 가능
- ✅ **팀 멤버 정렬**: 역할(PO→PM→MEMBER) > 직급(수석→책임→선임→사원) > 이름순
- ✅ **PO/PM 강조 효과**: 파란 배경 + 테두리로 시각적 구분
- ✅ **조직도 사용자 누락 버그 수정**: 잘못된 Prisma 필터 조건 제거

#### 백엔드 변경
- ❌ **삭제**: `backend/src/jobs/ldap-sync.job.ts` - 자동 동기화 스케줄러 완전 삭제
- ❌ **삭제**: `backend/src/jobs/` 폴더 삭제
- ✅ **수정**: `backend/src/index.ts` - LDAP 동기화 job import 및 호출 제거
- ✅ **수정**: `backend/src/services/team.service.ts` - 잘못된 User 필터 조건 수정
  - 기존: `Team: { name: { notIn: ['퇴사자', '휴직자'] } }` 조건이 사용자 누락 유발
  - 수정: `isActive: true` 조건만 유지

#### 프론트엔드 변경
- ✅ **수정**: `frontend/src/pages/OrganizationManagement.tsx`
  - LDAP 관리 버튼 삭제
  - 역할 변경 Select 추가 (ADMIN 전용)
  - `sortMembers()` 함수 추가 - 역할/직급/이름 정렬
  - PO/PM 카드 강조 스타일 (`#f0f5ff` 배경, `#adc6ff` 테두리)
  - `useNavigate` import 제거 (미사용)

#### 동작 변경
| 항목 | 이전 | 이후 |
|------|------|------|
| LDAP 자동 동기화 | 매일 02:00 실행 | **삭제됨** |
| 조직 계층 구조 | 자동 동기화로 초기화됨 | 수동 설정 유지 |
| 역할 변경 | 사용자 관리에서만 가능 | 조직도에서 직접 가능 |

---

## v1.1.23 (2025-11-28)

### 🔔 미정 액션 생성 시 팀장 알림

#### 핵심 변경사항
- ✅ **미정 프로젝트/서비스에 액션 생성 시 팀장에게 자동 알림**
  - 프로젝트가 "미정"인 경우 알림
  - 서비스가 "미정"인 경우 알림
  - 알림 대상: 팀장(TEAM_LEADER/PART_LEADER) 또는 PM/PO 역할자
  - 팀장이 없는 경우 ADMIN에게 알림

#### 백엔드 변경
- ✅ **NotificationService.notifyUndecidedActionCreated()** 메서드 추가
  - 팀장 자동 조회 (positionType, role 기반)
  - 다중 팀장에게 일괄 알림
  - 생성자 제외 처리
- ✅ **item.controller.ts** createItem 함수에 알림 로직 추가
  - ACTION 생성 완료 후 미정 여부 확인
  - 미정인 경우 NotificationService 호출
  - 알림 실패해도 액션 생성은 성공 처리

#### 프론트엔드 변경
- ✅ **ActionCreateDrawer.tsx** TODO 주석 제거
  - 백엔드 자동 처리로 변경

#### 수정 파일
- `backend/src/services/notification.service.ts` - 알림 메서드 추가
- `backend/src/controllers/item.controller.ts` - 알림 로직 추가
- `frontend/src/components/ActionCreateDrawer.tsx` - TODO 제거
- `docs/features/BACKLOG.md` - TODO 항목 완료 표시

---

## v1.1.22 (2025-11-28)

### 📢 계층적 워크플로우 알림 통합

#### 핵심 변경사항
- ✅ **계층 생성 요청 알림**: 서비스/팀 생성 요청 시 담당자에게 알림 발송
- ✅ **계층 생성 완료 알림**: 서비스/팀 생성 완료 시 원본 요청자에게 알림 발송
- ✅ **100% 구현 완료**: 계층적 워크플로우 Phase 1-3 모두 완료

#### 알림 메서드 추가
- `NotificationService.notifyHierarchyRequest()`: 계층 생성 요청 시 알림
- `NotificationService.notifyHierarchyCreated()`: 계층 생성 완료 시 알림

#### 수정 파일
- `backend/src/services/notification.service.ts` - 2개 알림 메서드 추가
- `backend/src/controllers/work-request.controller.ts` - 알림 호출 연동
- `backend/tsconfig.json` - scripts 폴더 빌드 제외

#### 문서 업데이트
- `docs/features/HIERARCHICAL_WORKFLOW.md` - 상태 100% 완료로 변경
- `docs/features/BACKLOG.md` - TODO 항목 완료 표시

---

## v1.1.21 (2025-11-28)

### 📊 팀 할당 관리 페이지

#### 핵심 변경사항
- ✅ **팀 중심 통계 페이지**: 각 팀별 프로젝트/서비스/액션 수 한눈에 파악
- ✅ **데이터 정합성 확인**: 상하위 연결이 끊어진 항목 감지 및 조치 안내
- ✅ **계층 구조 조망**: PSTA 계층에서 팀의 위치와 역할 시각화
- ✅ **조직 계층 트리**: 상위 조직 → 하위 팀 펼침/접기 지원
- ✅ **상위 조직 통합 정보**: 상위 조직 클릭 시 하위 팀 통합 통계 표시

#### 백엔드 API
- ✅ **4개 신규 엔드포인트**:
  - `GET /api/team-assignments/stats`: 전체 팀 할당 통계
  - `GET /api/team-assignments/teams`: 팀별 상세 통계 목록 (계층 정보 포함)
  - `GET /api/team-assignments/teams/:teamId`: 특정 팀 상세 (계층 트리)
  - `GET /api/team-assignments/integrity`: 데이터 정합성 체크 결과
- ✅ **계층 통계 집계**: 상위 조직의 하위 팀 통계 자동 합산 (중복 제거)

#### 프론트엔드 UI
- ✅ **통계 카드**: 활성 팀 / 서비스 할당 / 총 액션 / 연결 이상 4개 카드
- ✅ **조직 계층 트리 테이블**:
  - 상위 조직 → 하위 팀 펼침/접기 (전체 펼침/접기 버튼)
  - 계층별 아이콘 (🏦 본부, 🏠 팀, 👥 리프)
  - 프로젝트/서비스/액션 수 표시 (중복 제거 Set 방식)
- ✅ **팀 상세 Drawer (아코디언 스타일)**:
  - 프로젝트/서비스/액션 아코디언 패널
  - 상위 조직 클릭 시 하위 팀 통합 정보 표시
  - 소속 팀 태그 표시
- ✅ **정합성 모달**: "연결 이상" 카드 클릭 시 이상 항목 유형별 목록 표시
- ✅ **필터**: 팀명 검색 (트리 구조 유지 필터링)

#### 데이터 정합성 체크 항목
| 항목 | 조건 | 심각도 |
|------|------|--------|
| 팀 미할당 액션 | `serviceTeamId = null` | 🔴 높음 |
| 부모 없는 액션 | `parentId = null` (ROOT에 노출) | 🟠 중간 |
| 팀 할당 없는 서비스 | ServiceTeam 0건 | 🟡 낮음 |

#### 신규 파일
- `backend/src/controllers/team-assignment.controller.ts`
- `backend/src/routes/team-assignment.routes.ts`
- `frontend/src/pages/TeamAssignmentManagement.tsx`
- `frontend/src/api/team-assignments.ts`

#### 수정 파일
- `backend/src/index.ts` - 라우트 등록
- `frontend/src/App.tsx` - 라우트 추가
- `frontend/src/components/MainLayout.tsx` - 메뉴 추가

### 🎨 PSTA 디자인 컨셉 통합

#### 사이드바 메뉴 PSTA 태그
- ✅ **색상 태그 추가**: 프로젝트/서비스/팀 할당/액션 관리 메뉴에 [P]/[S]/[T]/[A] 태그
- ✅ **Flexbox 정렬**: 메뉴명-태그 간 일관된 우측 정렬
- ✅ **PSTA 색상 컨셉**:
  - Project: #722ed1 (보라)
  - Service: #1890ff (파랑)
  - Team: #52c41a (초록)
  - Action: #fa8c16 (주황)

#### 팀 할당 관리 아이콘 색상 통일
- ✅ 통계 카드, 테이블 컬럼, Drawer 아코디언 전체 PSTA 색상 적용
- ✅ 프로젝트(보라), 서비스(파랑), 팀(초록), 액션(주황) 일관성 확보

### 🔐 권한 설정 변경

#### MEMBER 역할 권한 수정
- ✅ **프로젝트 관리**: 읽기만 (canView: true, canCreate/Update/Delete: false)
- ✅ **서비스 관리**: 전체 권한 (canView/Create/Update/Delete: true)
- ✅ **팀 할당 관리**: 읽기만 (canView: true)
- ✅ **액션 관리**: 전체 권한 (canView/Create/Update/Delete: true)
- ✅ `backend/scripts/seed-permissions.ts` 및 DB 권한 테이블 동기화

#### 메뉴 위치
```
데이터 관리
├─ 클라이언트 관리
├─ 프로젝트 관리     [P]
├─ 서비스 관리       [S]
├─ 팀 할당 관리      [T]  ← 신규
├─ 액션 관리         [A]
└─ 통합 파일 관리
```

---

## v1.1.20 (2025-11-28)

### 🎭 직책 기반 역할 매핑 시스템

#### 핵심 변경사항
- ✅ **직책(Position) → 역할(Role) 자동 매핑**: LDAP 동기화 시 직책 정보를 기반으로 역할 자동 할당
- ✅ **roleOverride 수동 설정**: 자동 매핑이 적절하지 않은 경우 관리자가 수동으로 역할 지정 가능

#### 직책-역할 매핑 규칙
| 직책 (Position) | 역할 (Role) |
|----------------|-------------|
| 파트장 (PART_LEADER) | PM |
| 팀장 (TEAM_LEADER) | PM |
| 실장 (DIRECTOR) | PO |
| 본부장 (HEAD) | PO |
| 이사 (EXECUTIVE) | PO |
| 상무 (SENIOR_EXEC) | PO |
| 전무 (VICE_PRES) | PO |
| 일반/없음 (NONE) | MEMBER |

#### 데이터베이스 변경
- ✅ **PositionType enum 추가**:
  ```prisma
  enum PositionType {
    NONE          // 직책 없음 (일반 사원) → MEMBER
    PART_LEADER   // 파트장 → PM
    TEAM_LEADER   // 팀장 → PM
    DIRECTOR      // 실장 → PO
    HEAD          // 본부장 → PO
    EXECUTIVE     // 이사 → PO
    SENIOR_EXEC   // 상무 → PO
    VICE_PRES     // 전무 → PO
  }
  ```
- ✅ **User 모델 확장**:
  ```prisma
  model User {
    positionType  PositionType  @default(NONE)  // 직책 enum
    roleOverride  UserRole?                      // 역할 수동 override
  }
  ```

#### 백엔드 변경
- ✅ **role-mapper.ts** (신규 유틸리티):
  - `POSITION_TO_ROLE`: 직책 → 역할 매핑 테이블
  - `LDAP_POSITION_MAP`: LDAP 직책 문자열 → PositionType 매핑
  - `calculateRoleFromLdap()`: LDAP employeeType에서 역할 계산
  - `getEffectiveRole()`: roleOverride 우선 적용
  - `isPMPosition()`, `isPOPosition()`: 직책 유형 확인
  - `comparePositionLevels()`: 직책 레벨 비교

- ✅ **ldap-sync.service.ts**:
  - `syncTeamMemberships()`: 사용자 동기화 시 positionType, role 자동 계산
  - `applySelectedLdapItems()`: 선택적 동기화에도 직책 기반 역할 적용

#### 프론트엔드 변경
- ✅ **types/user.ts**:
  - `PositionType` enum 추가
  - `POSITION_DISPLAY_NAMES`: 직책 한글 표시명
  - `ROLE_DISPLAY_NAMES`: 역할 한글 표시명
  - `User` 인터페이스에 `positionType`, `roleOverride` 필드 추가

#### 메뉴 구조 변경
- ✅ **"통합 파일 리스트" → "통합 파일 관리"** 이름 변경
- ✅ **"데이터 관리" 그룹으로 이동** (맨 아래 위치)
  - 클라이언트 관리
  - 프로젝트 관리
  - 서비스 관리
  - 액션 관리
  - **통합 파일 관리** (신규 위치)

#### 변경된 파일
- `backend/prisma/schema.prisma`
- `backend/src/utils/role-mapper.ts` (신규)
- `backend/src/services/ldap-sync.service.ts`
- `frontend/src/types/user.ts`
- `frontend/src/components/MainLayout.tsx`

---

## v1.1.19 (2025-11-28)

### 🔗 LDAP departmentNumber 기반 팀 매칭

#### 핵심 변경사항
- ✅ **departmentNumber 기반 안정적인 매칭**: 조직 이름이 변경되어도 사용자-팀 연결 유지
- ✅ **고아 아이템 방지**: LDAP 조직 구조 변경 시에도 기존 데이터 관계 보존

#### 데이터베이스 변경
- ✅ **Team 모델 확장**:
  ```prisma
  model Team {
    departmentNumber String? @unique  // LDAP departmentNumber (DEPT001~DEPT014)
    // ...
  }
  ```
- ✅ Raw SQL로 컬럼 추가 (기존 마이그레이션 충돌 방지)

#### 백엔드 변경
- ✅ **ldap.ts**: `getOrganizationalUnits()`에 departmentNumber 속성 조회 추가
- ✅ **ldap-sync.service.ts**:
  - `syncTeams()`: departmentNumber 우선 매칭, 생성/업데이트 시 저장
  - `syncTeamMemberships()`: 사용자-팀 연결 시 departmentNumber 우선 매칭
  - `applySelectedLdapItems()`: 선택적 동기화에도 departmentNumber 저장

#### 매칭 우선순위
팀 매칭: departmentNumber → ldapDn → name
사용자-팀 매칭: departmentNumber → OU name → Group name

#### 마이그레이션 스크립트
- ✅ **update-team-department-numbers.ts** 생성:
  - LDAP OU에서 departmentNumber 조회
  - 기존 Team 레코드에 departmentNumber 업데이트
  - 실행 결과: 3개 팀 업데이트 (개발팀→DEPT013, 기획디자인팀→DEPT014, 서비스개발본부→DEPT010)

#### 기타 수정
- ✅ **User displayName 수정**: yg.kim "여겸" → "김여겸" (sn+cn 형식으로 수정)

#### 변경된 파일
- `backend/prisma/schema.prisma`
- `backend/src/config/ldap.ts`
- `backend/src/services/ldap-sync.service.ts`
- `backend/src/scripts/update-team-department-numbers.ts` (신규)

---

## v1.1.18 (2025-11-25)

### 📋 LDAP 계층형 마이그레이션 계획 문서 작성

#### 새로운 문서
- ✅ **[LDAP 계층형 마이그레이션 가이드](../guides/migration/LDAP_HIERARCHICAL_MIGRATION.md)** (상세 계획서):
  - **무중단 마이그레이션 전략** (5 Phase, 예상 11시간)
  - 기존 LDAP (3.34.115.117) → 신규 LDAP (192.168.1.212:10389) 전환
  - 평면 구조 → 4단계 계층 구조 (Organizations → Company → Department → Team)

#### 마이그레이션 개요
- ✅ **Phase 1**: 데이터베이스 스키마 확장
  - Team 모델에 `parentId`, `level`, `ldapType` 필드 추가
  - 계층형 관계 지원 (자체 참조 외래 키)
  - 하위 호환성 유지 (기존 팀은 level=0)

- ✅ **Phase 2**: LDAP 동기화 로직 개선
  - OU (`organizationalUnit`) 타입 동기화 지원
  - 계층 구조 정보 자동 추출 (DN 파싱)
  - 상위 레벨부터 순차 처리 (부모-자식 관계 설정)

- ✅ **Phase 3**: LDAP 서버 전환
  - `.env` 파일 수정 (LDAP_SERVER, LDAP_BASE_DN)
  - 백엔드 재시작 및 연결 테스트

- ✅ **Phase 4**: 선택적 동기화 실행
  - 36명의 사용자 안전 마이그레이션
  - 7개 팀 생성 (Organizations, 더존테크윌, 서비스개발본부, 개발팀, 기획디자인팀, 퇴사자, admins)
  - 기존 사용자 username/password 동일 → 로그인 불편 없음

- ✅ **Phase 5**: UI 계층 구조 표시
  - OrganizationManagement 페이지에 Tree 형태 렌더링
  - 부서/팀 계층 시각화

#### 데이터 안전성 보장
- ✅ **Item 소유권 100% 유지**:
  - 프로젝트/서비스/액션은 `User.id`로 직접 참조
  - `User.teamId`, `User.ldapDn` 변경이 Item 관계에 영향 없음
  - `User.username` 동일 → 같은 User 레코드 매칭

- ✅ **사용자 인증 투명성**:
  - 기존 LDAP과 신규 LDAP의 username/password 동일
  - 사용자는 LDAP 서버 전환을 인지하지 못함

#### 롤백 계획
- ✅ Phase별 롤백 방법 상세 기술
- ✅ `.env.backup` 복원으로 긴급 롤백 가능
- ✅ 데이터 무손실 보장

#### 검증 체크리스트
- ✅ Phase별 검증 항목 (5개 섹션, 총 20개 체크포인트)
- ✅ 데이터베이스 스키마 검증
- ✅ LDAP 연결 테스트
- ✅ 사용자 로그인 테스트
- ✅ Item 소유권 검증

#### 문서 업데이트
- ✅ **DOCUMENT_MAP.md**: 새 문서 등록
  - 문서 구조에 `docs/guides/migration/` 폴더 추가
  - 상세 문서 목록에 7-2번으로 추가
  - 시스템 관리자 가이드에 추가
  - 빠른 링크 섹션에 추가

---

## v1.1.17 (2025-11-24)

### ✨ WBS 타임라인 Phase 3 리팩토링 완료

#### 코드 품질 개선
- ✅ **코드 최적화**: 553줄 → 509줄 (8.0% 감소)
- ✅ **전체 누적 최적화**: **912줄 → 509줄 (44.2% 감소)** 🎉
- ✅ **목표 초과 달성**: 목표 550줄 → 실제 509줄 (41줄 초과 달성)

#### 새로운 파일
- ✅ **`constants/wbsStyles.ts`** (~140줄):
  - 반복되는 스타일 객체를 상수로 정의
  - 13개 스타일 상수 및 함수 (ROW_BASE_STYLE, getTreeRowStyle, getEmptyRowStyle 등)
  - 호버 효과, 중앙 정렬, 리사이즈 핸들 스타일 통합

- ✅ **`hooks/useColumnResize.ts`** (~90줄):
  - 컬럼 리사이즈 로직을 재사용 가능한 훅으로 분리
  - 마우스 이벤트 핸들링, 커서 관리, 최소/최대 너비 제한
  - 자동 클린업 및 타입 안전성

#### 리팩토링 개선사항
- ✅ **스타일 상수화**:
  - `renderTreeRow`, `renderEmptyRow`, `renderTimelineRow`: 인라인 스타일 → 상수 참조 (21줄 감소)
  - Loading/Empty/Container 스타일: 상수로 통합 (9줄 감소)
  - 리사이즈 핸들: 상수로 통합 (8줄 감소)

- ✅ **커스텀 훅 분리**:
  - 리사이즈 useEffect 전체 제거 (28줄 감소)
  - state 2개 제거 (useColumnResize 훅으로 대체)
  - `startResize` 함수로 통합

#### 아키텍처 개선
- ✅ **스타일 일관성**: 중앙 집중식 스타일 관리로 유지보수성 향상
- ✅ **코드 재사용**: useColumnResize 훅은 다른 컴포넌트에서도 재사용 가능
- ✅ **타입 안전성**: CSSProperties 타입 사용으로 타입 에러 방지
- ✅ **가독성**: 스타일 로직과 비즈니스 로직 분리

#### 최종 아키텍처
**WbsTimeline.tsx (509줄)** + 분리된 파일 6개:
- Phase 1: wbsHelpers.ts (90줄), timelineCalculator.tsx (178줄)
- Phase 2: viewModeConfig.ts (180줄), WbsTimelineHeader.tsx (80줄)
- Phase 3: wbsStyles.ts (140줄), useColumnResize.ts (90줄)

---

## v1.1.16 (2025-11-24)

### ✨ WBS 타임라인 Phase 2 리팩토링 완료

#### 코드 품질 개선
- ✅ **코드 최적화**: 700줄 → 553줄 (21.0% 감소)
- ✅ **누적 최적화**: Phase 1 (912→698, -23.5%) + Phase 2 (700→553, -21.0%) = **912줄 → 553줄 (39.6% 감소)**

#### 새로운 파일
- ✅ **`utils/viewModeConfig.ts`** (~180줄):
  - ViewMode별 설정 통합 (cellMinWidth, navigationStep, gridGenerator, label)
  - 6개 ViewMode 설정 객체 (week, biweek, month, quarter, year, fiveyear)
  - `navigateTimelineDate()` 함수로 날짜 네비게이션 통합

- ✅ **`components/WbsTimelineHeader.tsx`** (~80줄):
  - 날짜 헤더 렌더링 전용 컴포넌트 분리
  - 오늘 날짜 하이라이트 및 주말 색상 처리
  - cell type별 레이블 포맷팅

#### 리팩토링 개선사항
- ✅ `timelineGrid` useMemo: switch 문 68줄 → config.gridGenerator 3줄
- ✅ `cellMinWidth` useMemo: switch 문 10줄 → config 참조 3줄
- ✅ `navigateTimeline()`: switch 문 19줄 → 함수 호출 3줄
- ✅ 날짜 헤더 렌더링: 57줄 → 컴포넌트 호출 1줄

#### 아키텍처 개선
- ✅ **설정 기반 아키텍처**: ViewMode별 설정을 객체로 통합하여 확장성 향상
- ✅ **컴포넌트 분리**: 관심사 분리로 유지보수성 향상
- ✅ **타입 안전성**: ViewMode, TimelineCell 타입 중앙 관리

---

## v1.1.15 (2025-11-24)

### 🐛 버그 수정 및 코드 품질 개선

#### useForm Warning 완전 해결
- ✅ **문제**: v1.1.14에서 숨겨진 Form element 연결로 해결했으나 근본적인 해결 필요
- ✅ **개선**: Hook 아키텍처 개선으로 불필요한 Form 인스턴스 생성 방지
  - ItemFormModal이 `open=false`일 때 hook 초기화 방지
  - 3-state item 처리 구현:
    - `undefined`: 모달 닫힘 (hook 실행 안함)
    - `null`: 생성 모드 (폼 초기화)
    - `object`: 수정 모드 (기존 값 설정)
  ```tsx
  // ItemFormModal.tsx
  const activeForm = useUnifiedItemForm({
    form: sharedForm,
    linkForm: sharedLinkForm,
    item: open ? item : undefined,  // 모달 닫혔을 때 undefined 전달
    // ...
  });

  // useItemForm.ts
  useEffect(() => {
    if (item === undefined) return;  // 모달 닫혔을 때 early return
    // ...
  }, [item]);
  ```
- ✅ **결과**: 대시보드, 일정관리, 프로젝트/서비스/액션 관리 전체 페이지에서 경고 제거

#### 폼 초기화 문제 해결
- ✅ **문제**: 프로젝트/서비스 관리에서 특정 항목 클릭 후 '+등록' 버튼 클릭 시 이전 값이 남아있음
- ✅ **원인**: v1.1.14에서 useForm Warning 해결을 위해 `resetFields()` 제거
- ✅ **해결**: 3-state 처리로 `item === null`일 때만 `resetFields()` 실행
  - 모달이 닫혔을 때는 실행 안함 (warning 방지)
  - 생성 모드에서는 정상 실행 (폼 초기화)

#### 디버깅 로그 전체 제거
- ✅ 총 33개의 console.log 제거로 프로덕션 코드 품질 향상
- **제거 내역**:
  - `ServiceWizardModal.tsx`: 3개 (handleFinish 디버깅)
  - `ProjectWizardModal.tsx`: 12개 (자동 할당 및 제출 로직)
  - `WbsGanttCustom.tsx`: 2개 (handleItemClick)
  - `ActionCreateDrawer.tsx`: notification 로그
  - `PstaSchedule.tsx`: 1개 (refresh 로그)
  - `Dashboard.tsx`: 4개 (MyTasks 데이터 구조)
  - `Report.tsx`: 11개 (스냅샷 데이터 처리 및 프로젝트 그룹핑)

- **변경된 파일**:
  - `frontend/src/components/ItemFormModal.tsx`
  - `frontend/src/hooks/useItemForm.ts`
  - `frontend/src/components/ServiceWizardModal.tsx`
  - `frontend/src/components/ProjectWizardModal.tsx`
  - `frontend/src/components/WbsGanttCustom.tsx`
  - `frontend/src/components/ActionCreateDrawer.tsx`
  - `frontend/src/pages/PstaSchedule.tsx`
  - `frontend/src/pages/Dashboard.tsx`
  - `frontend/src/pages/Report.tsx`

---

## v1.1.14 (2025-11-24)

### 🐛 버그 수정

#### Duplicate Key Warning 수정
- ✅ **문제**: ACTION 아이템이 프로젝트 트리에서 ROOT와 정상 위치에 중복 출현
  - React 콘솔 경고: "Encountered two children with the same key"
  - 원인: ACTION 생성 시 `parentId`가 null로 저장됨
- ✅ **해결**: 백엔드에서 ACTION 생성 시 parentId 자동 설정
  - ServiceTeam에서 teamId 조회 → Team 이름으로 TEAM Item 찾기 → parentId 설정
  - getItemTree API에 `type: ItemType.PROJECT` 필터 추가 (ROOT는 PROJECT만)
  - 구조화된 로깅 추가 (🔍 요청 수신, ✅ parentId 설정, ✅ 생성 완료)
- **변경된 파일**: `backend/src/controllers/item.controller.ts`

#### useForm Warning 수정
- ✅ **문제**: 모든 페이지에서 콘솔 경고 발생
  ```
  Warning: Instance created by `useForm` is not connected to any Form element
  ```
- ✅ **원인**: ItemFormModal이 4개의 hook 인스턴스 생성 (projectForm, serviceForm, teamForm, actionForm)
  - 각 hook이 linkForm 생성하지만, 실제로 사용되는 것은 activeForm의 linkForm만
  - 사용하지 않는 3개의 linkForm이 Form element에 연결되지 않음
- ✅ **해결**: 숨겨진 div에서 사용하지 않는 linkForm을 Form element에 연결
  ```tsx
  <div style={{ display: 'none' }}>
    {currentType !== ItemType.PROJECT && <Form form={projectForm.linkForm} />}
    {currentType !== ItemType.SERVICE && <Form form={serviceForm.linkForm} />}
    {currentType !== ItemType.TEAM && <Form form={teamForm.linkForm} />}
    {currentType !== ItemType.ACTION && <Form form={(actionForm as any).linkForm} />}
  </div>
  ```
- **변경된 파일**:
  - `frontend/src/components/ItemFormModal.tsx` (line 363-369)
  - `frontend/src/components/form-sections/FileAndLinkSection.tsx` (line 51-58)

---

## v1.1.13 (2025-11-21)

### ✨ WBS 타임라인 Phase 1 리팩토링 완료
- ✅ 코드 최적화: 912줄 → 698줄 (23.5% 감소)
- ✅ 헬퍼 함수 분리: `wbsHelpers.ts` (90줄)
- ✅ 타임라인 계산 로직 분리: `timelineCalculator.tsx` (178줄)
- ✅ UI 개선: 필터 재배치, 컬럼 재구성
- ✅ 버그 수정: WBS 미정 필터 개선

---

## v1.1.12 (2025-11-21)

### 🏗️ API 통합 및 코드 중복 제거
- ✅ Custom Hook 패턴 도입: `useActionItemModal.ts`
- ✅ Items API 통합: `getMyTasks` 제거 (210줄 감소)
- ✅ Work Requests API 통합: 중복 API 2개 제거 (319줄 감소)
- ✅ 총 코드 감소: ~629줄

---

## v1.1.11 (2025-11-21)

### 📊 일정관리 메타 정보 표시 강화
- ✅ 댓글 카운트 표시 (💬 이모지)
- ✅ 관련문서 카운트 표시 (📎 이모지, 파일+링크 합산)
- ✅ 액션 등록 시 계층 정보 반영 버그 수정 (clientId, serviceTeamId 자동 설정)
- ✅ 대시보드 칸반보드 휴지통 액션 필터링

---

## v1.1.10 (2025-11-20)

### 🗑️ 휴지통 기능 대폭 개선
- ✅ 역할 기반 조회 권한 (관리자: 전체, 사용자: 본인 생성/담당 항목)
- ✅ 역할별 복원/삭제 권한 관리
- ✅ 통계 대시보드, 필터, 검색, 일괄 작업 기능
- ✅ 일정관리 필터 개선 (액션 없음 숨김 기본값)
- ✅ 삭제된 항목 필터링 강화 (백엔드 + 프론트엔드 이중 안전장치)

---

## v1.1.9 (2025-11-19)

### 🗑️ Soft Delete & ServiceTeam 시스템
- ✅ Soft Delete 패턴 구현 (데이터 보존, 복원 가능)
- ✅ ServiceTeam Junction Table 도입 (중복 팀 제거)
- ✅ 일정관리 UI 개선 (테이블 2개 컬럼, 고객 정보 표시, 미정 항목 관리)

---

## v1.1.8 (2025-11-16)

### 🔐 작업 요청 관리 기능 강화
- ✅ 관리자 전용 "모든 요청" 탭
- ✅ 담당자 취소 처리 기능
- ✅ 관리자 강제 삭제 기능

---

## v1.1.7 (2025-11-13)

### 🎨 UI/UX 대폭 개선
- ✅ 페이지 타이틀 제거 (9개 페이지, 공간 절약)
- ✅ 관리 페이지 테이블 2단 구조 전면 개편
- ✅ 상위 항목 PSTA 색상 태그화
- ✅ 기간 포맷 개선 및 강조 (`YYYY. MM. DD`)

---

## v1.1.6 (2025-11-13)

### 🎨 ItemFormModal 개선
- ✅ 조회/수정 모드 분리
- ✅ 서비스 관리 팀 할당 기능 추가
- ✅ TypeScript 빌드 에러 14개 → 0개 해결

---

## v1.1.5 (2025-11-12)

### ✨ 조직 관리 통합 및 LDAP 동기화
- ✅ 팀/사용자 통합 트리 뷰
- ✅ LDAP 자동 동기화 시스템 (매일 02:00 KST)
- ✅ 수동 동기화 UI (Dry-run 지원)
- ✅ 통계 대시보드

---

## 이전 버전 (v1.1.0 ~ v1.1.4)

### v1.1.4
- 🐛 아이템 이동 기능 토스트 메시지 중복 문제 해결
- 🐛 Ant Design message context 경고 해결

### v1.1.3
- ✨ WBS 페이지 UI/UX 개선
- 🎨 테이블 정보 밀도 향상 (상태 태그 통합, PSTA 레이블 단축)

### v1.1.2
- 🔧 server.sh 스크립트 systemd 통합
- 🔧 psta-postgres 도커 컨테이너 관리 개선
- 🐛 로그인 페이지 에러 처리 개선

### v1.1.1
- 🐛 대시보드 알림 버튼 개선
- 🐛 브라우저 콘솔 에러 수정 (Vite HMR, Mixed Content, Ant Design deprecated)
- ✨ 도메인 URL 시스템 설정 기능 (슬랙 알림 링크)

### v1.1.0
- 🔧 Winston 기반 구조화된 로깅 시스템 구축
- 📁 `/log/psta/` 디렉토리 구조화
- ✅ 9개 카테고리 로거 (app, error, access, auth, database, ldap, slack, notification, migration)

---

## v1.0.0 (2025-10-27)

### 🎉 초기 릴리즈

**주요 기능**:
- ✅ 계층적 프로젝트 관리 (Project → Service → Team → Action)
- ✅ LDAP 인증 통합 및 4단계 역할 관리 (ADMIN/PO/PM/MEMBER)
- ✅ 작업 요청 시스템 및 파일 첨부
- ✅ 멀티 플랫폼 알림 (Slack, Telegram, Discord)
- ✅ WBS Gantt 차트 및 보고서 생성
- ✅ Notion 스타일 트리 뷰 및 계층 토글 버튼

**기술 스택**:
- Backend: Node.js v24.9.0, Express, TypeScript, PostgreSQL v14.x, Prisma
- Frontend: React v18.2.0, Ant Design v5.12.5, Vite, TypeScript, Zustand
- Infrastructure: Ubuntu 22.04.5 LTS

**데이터베이스**: 15개 주요 모델 (User, Team, Client, Item, File, WorkRequest, Comment, Notification, Message, Permission, LdapConfig, NotificationApp, SystemSetting, ReportSnapshot, Link)

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

**최종 업데이트**: 2025-12-08
