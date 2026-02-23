# PSTA 문서 맵

PSTA 프로젝트의 모든 문서를 한눈에 볼 수 있는 네비게이션 가이드입니다.

**마지막 업데이트**: 2025-12-31 (v1.1.29)

---

## 📂 문서 구조

```
/app/psta/
├── README.md              # 프로젝트 소개 (시작점)
├── CLAUDE.md             # Claude Code용 개발 가이드
├── DOCUMENT_MAP.md       # 이 파일 (전체 문서 맵)
│
└── docs/                 # 상세 문서
    ├── infrastructure/
    │   └── INFRASTRUCTURE.md          # 인프라 명세서
    │
    ├── guides/
    │   ├── installation/
    │   │   └── INSTALLATION_GUIDE.md  # 설치 가이드
    │   ├── development/
    │   │   ├── DEVELOPMENT_GUIDE.md   # 개발 가이드
    │   │   ├── WBS_REFACTORING_PLAN.md # WBS 리팩토링 계획
    │   │   └── TEAM_ASSIGNMENT_PLAN.md # 📦 아카이브 (v1.1.26에서 폐기)
    │   ├── migration/
    │   │   └── LDAP_HIERARCHICAL_MIGRATION.md  # LDAP 계층형 마이그레이션 계획
    │   └── user/
    │       └── USER_GUIDE.md          # 사용자 가이드
    │
    ├── features/
    │   ├── FEATURES.md                # 기능 소개
    │   ├── BACKLOG.md                 # 개선 사항 백로그
    │   └── HIERARCHICAL_WORKFLOW.md   # 계층적 워크플로우 설계
    │
    ├── security/
    │   └── SECURITY_GUIDE.md          # 보안 가이드 (신규)
    │
    └── changelog/
        └── CHANGELOG.md               # 변경 이력
```

---

## 🎯 목적별 문서 가이드

### 처음 시작하는 사람
1. **[README.md](README.md)** - 프로젝트 개요 및 Quick Start
2. **[설치 가이드](docs/guides/installation/INSTALLATION_GUIDE.md)** - 시스템 설치 방법
3. **[사용자 가이드](docs/guides/user/USER_GUIDE.md)** - 기본 사용 방법

### 개발자
1. **[CLAUDE.md](CLAUDE.md)** - 개발 시작점 (핵심 요약)
2. **[개발 가이드](docs/guides/development/DEVELOPMENT_GUIDE.md)** - 상세 개발 가이드
   - 프로젝트 구조
   - 개발 환경 설정
   - API 개발 패턴
   - 로깅 시스템
   - 디버깅 방법
   - 테스트 작성
3. **[보안 가이드](docs/security/SECURITY_GUIDE.md)** - 보안 모범 사례
4. **[인프라 명세](docs/infrastructure/INFRASTRUCTURE.md)** - 시스템 환경 및 요구사항

### 시스템 관리자
1. **[설치 가이드](docs/guides/installation/INSTALLATION_GUIDE.md)** - 전체 설치 과정
2. **[인프라 명세](docs/infrastructure/INFRASTRUCTURE.md)** - 시스템 요구사항, 패키지 목록
3. **[LDAP 계층형 마이그레이션](docs/guides/migration/LDAP_HIERARCHICAL_MIGRATION.md)** - 무중단 LDAP 마이그레이션
4. **[CLAUDE.md - Server Management](CLAUDE.md#common-commands)** - 서버 관리 명령어

### 최종 사용자
1. **[사용자 가이드](docs/guides/user/USER_GUIDE.md)** - 시스템 사용 방법
2. **[기능 소개](docs/features/FEATURES.md)** - 주요 기능 설명

---

## 📚 상세 문서 목록

### 1. [README.md](README.md)
**대상**: 모든 사용자
**내용**: 프로젝트 소개, Quick Start, 기술 스택, 주요 기능 요약

### 2. [CLAUDE.md](CLAUDE.md)
**대상**: 개발자 (Claude Code 사용자)
**내용**:
- ⚠️ **문서 작성 정책** (중요!)
- 프로젝트 개요
- 기술 스택
- 핵심 명령어
- 개발 패턴
- 로깅 사용법

### 3. [설치 가이드](docs/guides/installation/INSTALLATION_GUIDE.md)
**대상**: 시스템 관리자, 개발자
**내용**:
- 시스템 요구사항
- Node.js, PostgreSQL 설치
- 프로젝트 클론 및 설정
- 데이터베이스 마이그레이션
- 서버 실행 및 테스트
- **프로덕션 배포 권장사항**
  - systemd 자동 시작 설정 (OS 재기동 시 자동 실행)
  - PM2 프로세스 관리
  - Nginx 리버스 프록시
  - SSL 인증서 설정
  - 보안 강화
- 문제 해결

### 4. [개발 가이드](docs/guides/development/DEVELOPMENT_GUIDE.md)
**대상**: 개발자
**내용**:
- 프로젝트 구조 (상세)
- 개발 환경 설정
- 백엔드 개발 (Express, Prisma)
- 프론트엔드 개발 (React, Ant Design)
- 데이터 모델
- API 개발 패턴
- 인증 시스템
- 코드 스타일 가이드
- 테스트 작성
- **로깅 시스템** (Winston, 9개 로거)
- 디버깅 방법
- Git 워크플로우

### 5. [사용자 가이드](docs/guides/user/USER_GUIDE.md)
**대상**: 최종 사용자
**내용**:
- 로그인 방법
- 프로젝트 생성 및 관리
- PSTA 계층 구조 사용
- 작업 요청 시스템
- 파일 첨부 방법
- 알림 설정

### 6. [인프라 명세](docs/infrastructure/INFRASTRUCTURE.md)
**대상**: 시스템 관리자, DevOps
**내용**:
- 운영 환경 (OS, 커널 버전)
- 런타임 환경 (Node.js, npm)
- 데이터베이스 (PostgreSQL, Prisma)
- 웹 서버 설정
- 필수 시스템 패키지
- 백엔드/프론트엔드 의존성 (전체 목록)
- 외부 서비스 (LDAP, Slack, Telegram, Discord)
- 네트워크 포트 및 방화벽 설정
- **파일 시스템** (`/data/psta/`, `/log/psta/`)
- 개발 도구
- 보안 설정

### 7. [기능 소개](docs/features/FEATURES.md)
**대상**: 모든 사용자
**내용**:
- PSTA 계층 구조
- 권한 관리 시스템
- 작업 요청 워크플로우
- 파일 업로드 기능
- 알림 시스템
- WBS/Gantt 차트
- Excel Import/Export
- 댓글 및 멘션 기능

### 7-1. [계층적 워크플로우 설계](docs/features/HIERARCHICAL_WORKFLOW.md) 🆕
**대상**: 개발자, 프로젝트 관리자
**상태**: 🟡 설계 완료, 구현 대기
**내용**:
- 문제 정의 (팀 ID 누락 문제)
- 해결 방안 (역방향 작업 요청)
- 상세 시나리오 (3가지)
  - 시나리오 A: 서비스 없음
  - 시나리오 B: 팀 없음
  - 시나리오 C: 연쇄 워크플로우
- 기술 구현 요소
  - 데이터베이스 스키마 확장
  - 백엔드 API 4개
  - 프론트엔드 UI 컴포넌트
  - 알림 시스템 통합
- UI/UX 플로우차트
- 구현 단계 (5 Phase, 9-13일)
- 테스트 시나리오

### 7-2. [LDAP 계층형 마이그레이션](docs/guides/migration/LDAP_HIERARCHICAL_MIGRATION.md) 🆕
**대상**: 시스템 관리자, 개발자
**상태**: 🟢 계획 완료, 구현 준비
**내용**:
- 개요 및 마이그레이션 목표
- 현황 분석 (기존 vs 신규 LDAP 구조)
- 무중단 마이그레이션 전략 (5 Phase)
- 데이터 안전성 보장 (Item 소유권 100% 유지)
- **Phase 1**: 데이터베이스 스키마 확장 (parentId, level, ldapType)
- **Phase 2**: LDAP 동기화 로직 개선 (OU 지원)
- **Phase 3**: LDAP 서버 전환 (.env 수정)
- **Phase 4**: 선택적 동기화 실행 (36명)
- **Phase 5**: UI 계층 구조 표시 (Tree)
- 롤백 계획 및 검증 체크리스트

### 8. [보안 가이드](docs/security/SECURITY_GUIDE.md)
**대상**: 개발자, 시스템 관리자
**내용**:
- 민감 정보 관리 (API 토큰, 비밀번호)
- Git 보안 (커밋 전 체크리스트)
- 환경변수 관리
- 데이터베이스 보안
- 파일 업로드 보안
- 사고 발생 시 대응 절차
- Pre-commit Hook 설치

### 9. [백로그](docs/features/BACKLOG.md)
**대상**: 개발자, 프로젝트 관리자
**내용**:
- 진행 중인 주요 기능
- 코드 내 TODO 항목 (기술 부채)
- 기능 개선 계획 (v1.3.0 ~ v2.0.0)

### 10. [변경 이력](docs/changelog/CHANGELOG.md)
**대상**: 모든 사용자
**내용**:
- 버전별 변경사항
- **v1.1.3**: WBS UI 개선, server.sh 프로덕션 반영
- **v1.1.2**: systemd 통합, 로그인 에러 처리
- **v1.1.1**: 버그 수정 및 UI 개선, 도메인 URL 설정 기능
- **v1.1.0**: 로그 시스템 구축
- **v1.0.0**: 초기 릴리즈

---

## 🔗 빠른 링크

### 자주 찾는 문서
- [프로젝트 시작하기](README.md#-quick-start)
- [서버 관리 명령어](CLAUDE.md#common-commands)
- [보안 가이드](docs/security/SECURITY_GUIDE.md) - **중요!**
- [로깅 시스템](docs/guides/development/DEVELOPMENT_GUIDE.md#10-로깅-시스템)
- [API 개발 패턴](docs/guides/development/DEVELOPMENT_GUIDE.md#6-api-개발)
- [설치 문제 해결](docs/guides/installation/INSTALLATION_GUIDE.md#문제-해결)
- [계층적 워크플로우 설계](docs/features/HIERARCHICAL_WORKFLOW.md) - **신규!**
- [LDAP 계층형 마이그레이션](docs/guides/migration/LDAP_HIERARCHICAL_MIGRATION.md) - **신규!**

### 외부 리소스
- **GitHub**: https://github.com/GUNIQ-G/psta
- **Issues**: https://github.com/GUNIQ-G/psta/issues

---

## 📝 문서 작성 정책

새로운 문서를 작성하거나 기존 문서를 수정할 때는 **[CLAUDE.md - 문서 작성 정책](CLAUDE.md#⚠️-중요-문서-작성-정책)**을 참조하세요.

---

## 📊 문서 버전 이력

- **v1.1.28** (2025-12-12): 링크 자동 문서명 추출 🔗, 아이템 알림 DM 연결 🔔, 레거시 Slack 채널 시스템 제거 🧹
- **v1.1.27** (2025-12-08): 버그/건의 게시판 🐛, 서비스 하위 액션 팀별 그룹화 👥, 서비스 팀 할당 UI 제거 🧹, 조회 모드 UX 개선 (텍스트 렌더링 + 좌측 세로선) 👁️
- **v1.1.26** (2025-12-06): 3단계 구조 완성 - ServiceTeam 완전 제거, 팀별 현황 조회 메뉴 신규 추가 📊
- **v1.1.25** (2025-12-02): 로그인 시 조직도 유지 - 로그인해도 팀 배정 변경 안 됨, LDAP 시스템 OU 제외 🔐
- **v1.1.24** (2025-12-01): 조직도 역할 관리 - ADMIN이 조직도에서 PO/PM/MEMBER 역할 직접 변경, LDAP 자동 동기화 삭제 🏢
- **v1.1.23** (2025-11-28): 미정 액션 생성 시 팀장 알림 - 미정 프로젝트/서비스 액션 생성 시 팀장에게 자동 알림 🔔
- **v1.1.22** (2025-11-28): 계층적 워크플로우 알림 통합 - 서비스/팀 생성 요청 및 완료 시 알림 발송 📢
- **v1.1.21** (2025-11-28): 팀 할당 관리 페이지 - 조직 계층 트리, 팀 중심 통계, PSTA 디자인 컨셉 통합, MEMBER 권한 변경 📊
- **v1.1.20** (2025-11-28): 직책 기반 역할 자동 매핑 - 파트장/팀장→PM, 실장~전무→PO 자동 할당, roleOverride 수동 설정 지원 🎭
- **v1.1.19** (2025-11-28): LDAP departmentNumber 기반 팀 매칭 - 조직 이름 변경 시에도 안정적인 사용자-팀 연결 유지, 고아 아이템 방지 🔗
- **v1.1.18** (2025-11-25): LDAP 계층형 마이그레이션 계획 문서 작성 - 무중단 마이그레이션 전략 (5 Phase, 11시간) 📋
- **v1.1.17** (2025-11-24): WBS 타임라인 Phase 3 완료 - 스타일 상수화, 커스텀 훅 분리, 최종 44.2% 감소 (912→509줄) 🎉
- **v1.1.16** (2025-11-24): WBS 타임라인 Phase 2 완료 - ViewMode 설정 통합, 날짜 헤더 컴포넌트 분리
- **v1.1.15** (2025-11-24): useForm Warning 완전 해결, 폼 초기화 버그 수정, 디버깅 로그 33개 제거
- **v1.1.14** (2025-11-24): 버그 수정 - ACTION parentId 자동 설정, useForm Warning 해결
- **v1.1.13** (2025-11-21): WBS 타임라인 Phase 1 리팩토링 완료
- **v1.1.12** (2025-11-21): API 통합 및 코드 중복 제거
- **v1.1.11** (2025-11-21): 일정관리 메타 정보 표시 강화
- **v1.1.10** (2025-11-20): 휴지통 기능 대폭 개선
- **v1.1.9** (2025-11-19): ServiceTeam 중복 제거, 일정 관리 UI 개선
- **v1.1.8** (2025-11-16): 관리자 전용 작업 요청 관리, 담당자 취소 처리
- **v1.1.7** (2025-11-13): UI/UX 대폭 개선, 테이블 레이아웃 2단 구조
- **v1.1.6** (2025-11-13): ItemFormModal 조회/수정 모드 분리, 서비스 관리 팀 할당
- **v1.1.5** (2025-11-12): 조직 관리 통합, LDAP 자동 동기화
- **v1.1.4** (2025-11-04): 아이템 이동 기능, 일정관리 필터 개선
- **v1.1.3** (2025-10-29): 계층적 워크플로우 설계 문서 추가, WBS UI 개선
- **v1.1.2** (2025-10-28): server.sh systemd 통합, 로그인 에러 처리 개선
- **v1.1.1** (2025-10-27): 버그 수정, 도메인 URL 설정
- **v1.1** (2025-10-27): 문서 구조 재정리, 로그 시스템 추가
- **v1.0** (2025-10-27): 초기 문서 구조 확립
