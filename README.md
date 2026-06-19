# PSTA — 프로젝트 관리 시스템

**P**roject · **S**ervice · **T**eam · **A**ction 계층 구조 기반의 팀 프로젝트 관리 시스템입니다.

팀의 모든 업무를 하나의 흐름으로 — 프로젝트 계획부터 일일 액션까지, WBS/Gantt·Slack 알림·LDAP 연동을 단일 플랫폼에서 제공합니다.

[![License](https://img.shields.io/badge/license-PSTA%20Source%20Available-blue)](LICENSE)
[![Version](https://img.shields.io/badge/version-v1.1.32-brightgreen)](docs/changelog/CHANGELOG.md)
[![Node](https://img.shields.io/badge/node-%3E%3D18.x-green)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-blue)](https://www.postgresql.org)

---

## 🚀 1분 설치 (Ubuntu)

```bash
curl -fsSL https://raw.githubusercontent.com/GUNIQ-G/psta/main/install.sh | sudo bash
```

설치가 완료되면 브라우저에서 `http://서버IP:3000` 에 접속해 설치 마법사를 실행합니다.

> **요구사항**: Ubuntu 22.04 LTS, RAM 4GB+, Storage 20GB+
> 자세한 내용은 [설치 가이드](docs/guides/installation/INSTALLATION_GUIDE.md)를 참조하세요.

---

## ✨ 주요 기능

### 🗂 계층 구조 관리
| 레벨 | 설명 |
|------|------|
| **Project** | 최상위 프로젝트 단위 |
| **Service** | 프로젝트 하위 서비스/기능 단위 |
| **Action** | 실제 작업 단위 (담당자·기간·진행률) |

### 🔐 인증 & 권한
- **로컬 인증** — admin이 계정을 직접 생성·관리 (bcrypt 해시 저장)
- **LDAP 연동** — Active Directory / OpenLDAP 조직 구조 자동 동기화
- **4단계 역할** — ADMIN / PO / PM / MEMBER (조직도에서 직접 변경)
- **리소스 기반 권한** — 메뉴/기능 단위 세밀한 접근 제어

### 📊 일정 & 시각화
- **WBS Gantt 차트** — 계층 구조 시각화, 날짜 범위 조정
- **팀별 현황 대시보드** — 팀 진행률·담당자별 통계 한눈에
- **Excel Import/Export** — WBS 데이터 일괄 가져오기/내보내기

### 🔔 알림
- **Slack** — 채널 알림, 멘션, 작업 요청 알림
- **Telegram** — 봇 연동 알림
- **Discord** — Webhook 알림
- **인앱 알림** — 멘션, 상태 변경, 승인 요청

### 📁 파일 & 협업
- **파일 첨부** — Action별 파일 업로드 (30종+ 확장자)
- **버그/건의 게시판** — Tiptap 에디터, 이미지 붙여넣기
- **작업 요청 시스템** — 파일 첨부 포함 요청·승인 워크플로우
- **링크 관리** — 자동 문서명 추출

### ⚙️ 시스템 관리
- **웹 설치 마법사** — 브라우저에서 초기 설정 완료
- **멤버 관리** — 로컬 계정 생성·수정·비밀번호 초기화
- **고객사 관리** — 클라이언트별 프로젝트 분리
- **소프트 삭제 & 복원** — 휴지통 기능

---

## 🏗 아키텍처

```
┌─────────────────────────────────────────────┐
│                   Client                    │
│         React 18 + Ant Design 5             │
│         (nginx Docker, Port 3000)           │
└───────────────────┬─────────────────────────┘
                    │ HTTP/REST
┌───────────────────▼─────────────────────────┐
│               Backend API                   │
│    Express + TypeScript + Prisma ORM        │
│         (systemd, Port 3001)                │
└───────┬───────────────────────┬─────────────┘
        │                       │
┌───────▼──────┐       ┌────────▼────────┐
│  PostgreSQL  │       │  External Auth  │
│   (v14+)     │       │  LDAP / LOCAL   │
└──────────────┘       └─────────────────┘
```

**데이터 흐름**
- `GET /api/*` → 인증 미들웨어 → 권한 체크 → 컨트롤러 → Prisma → PostgreSQL
- 파일: `POST /api/upload` → Multer → `/data/psta/uploads/`
- 알림: 이벤트 → NotificationService → Slack / Telegram / Discord

---

## 📦 기술 스택

| 영역 | 기술 |
|------|------|
| **Frontend** | React 18, TypeScript, Ant Design 5, Vite, Zustand |
| **Backend** | Node.js 24, Express, TypeScript, Prisma ORM |
| **Database** | PostgreSQL 14 |
| **Auth** | JWT, bcryptjs, ldapjs |
| **알림** | @slack/web-api, Telegram Bot API, Discord Webhook |
| **로깅** | Winston + Daily Rotate (9개 로거) |
| **인프라** | Ubuntu 22.04, systemd, Docker (nginx) |

---

## 📁 디렉터리 구조

```
psta/
├── backend/    # Express + TypeScript API 서버
├── frontend/   # React 18 + Vite SPA
├── nginx/      # nginx Docker (프론트엔드 서빙)
├── bin/        # 서버 관리 스크립트
└── docs/       # 상세 문서
```

자세한 구조: [개발 가이드 §1](docs/guides/development/DEVELOPMENT_GUIDE.md)

---

## 📚 문서

| 문서 | 내용 |
|------|------|
| [설치 가이드](docs/guides/installation/INSTALLATION_GUIDE.md) | 자동/수동 설치, 업그레이드, 문제 해결 |
| [사용자 가이드](docs/guides/user/USER_GUIDE.md) | 로그인, 프로젝트 관리, 기능 사용법 |
| [개발 가이드](docs/guides/development/DEVELOPMENT_GUIDE.md) | 로컬 개발 환경, API 개발 패턴 |
| [기능 소개](docs/features/FEATURES.md) | 전체 기능 목록 및 스크린샷 |
| [인프라 명세](docs/infrastructure/INFRASTRUCTURE.md) | 서버 요구사항, 포트, 파일 시스템 |
| [보안 가이드](docs/security/SECURITY_GUIDE.md) | 환경변수, 인증, Git 보안 |
| [변경 이력](docs/changelog/CHANGELOG.md) | 버전별 변경사항 |

---

## ⚡ 서버 관리

`./bin/server.sh --help` 또는 [서버 관리 가이드](docs/guides/installation/INSTALLATION_GUIDE.md#6-서버-관리) 참조

---

## 📜 라이선스

PSTA Source Available License v1.0 — [LICENSE](LICENSE) 참조

- ✅ 개인 사용 · 사내 내부 사용 · 비영리 — **무료**
- ❌ 재판매 · SaaS · SI 구축 · OEM — **별도 계약 필요**

문의: gunique.co.kr@gmail.com

---

## 🤝 기여 & 지원

- **버그 리포트**: [GitHub Issues](https://github.com/GUNIQ-G/psta/issues)
- **기능 제안**: [GitHub Issues](https://github.com/GUNIQ-G/psta/issues)

---

*PSTA v1.1.32 · Project Management Made Easy*
