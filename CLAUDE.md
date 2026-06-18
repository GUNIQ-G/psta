# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ⚠️ 중요: 문서 작성 정책

### 문서 구조 원칙
**이 정책을 반드시 준수하세요!**

```
/app/psta/
├── README.md           # 프로젝트 소개 (최소한) + docs 링크
├── CLAUDE.md          # Claude Code용 요약 (핵심만) + docs 링크
├── DOCUMENT_MAP.md    # 전체 문서 네비게이션 맵
│
└── docs/              # 실제 상세 문서 (여기에 모든 상세 내용 작성!)
    ├── infrastructure/INFRASTRUCTURE.md
    ├── guides/
    │   ├── development/DEVELOPMENT_GUIDE.md
    │   ├── installation/INSTALLATION_GUIDE.md
    │   ├── migration/LDAP_HIERARCHICAL_MIGRATION.md
    │   └── user/USER_GUIDE.md
    ├── features/
    │   ├── FEATURES.md
    │   ├── BACKLOG.md
    │   └── HIERARCHICAL_WORKFLOW.md
    ├── security/SECURITY_GUIDE.md
    └── changelog/CHANGELOG.md
```

### 문서 작성 규칙

1. **루트 파일 (README.md, CLAUDE.md)**
   - ✅ 최소한의 요약만 작성
   - ✅ 상세 내용은 "자세한 내용은 [링크] 참조" 형태로 docs 링크
   - ❌ 상세한 설명, 긴 코드 예제, 전체 명령어 나열 금지

2. **docs/ 하위 파일**
   - ✅ 모든 상세 내용 작성
   - ✅ 코드 예제, 명령어, 튜토리얼 포함
   - ✅ 단계별 가이드, 스크린샷 등

3. **중복 최소화**
   - 같은 내용을 여러 파일에 작성하지 않음
   - 한 곳에 작성하고 다른 곳에서 링크

4. **WORK_LOG_TEMP.md**
   - 필요할 때만 생성
   - 작업 완료 후 즉시 삭제

### md 파일 반영 시 프로세스

사용자가 "md 파일에 반영해줘"라고 요청하면:

1. **모든 md 파일 찾기**: `find /app/psta -name "*.md" -type f | grep -v node_modules`
2. **각 파일 분석**:
   - 루트 파일 (README, CLAUDE, DOCUMENT_MAP) → 최소한으로 요약, docs 링크 추가
   - docs/ 파일 → 상세하게 작성
3. **중복 제거**: 루트 파일에 상세 내용이 있으면 docs/로 이동
4. **링크 추가**: 루트 파일에서 docs 파일로 링크

---

## Project Overview

PSTA is a **Project-Service-Team-Action** hierarchical project management system.

**Key Features**: 3-level hierarchy (Project→Service→Action), Team status overview, Soft delete + restore, Item move, Multi-select filters, LDAP auth, Multi-platform notifications, Excel import/export, WBS/Gantt, File attachments, Role-based permissions

**Architecture**: Monorepo with backend (Express + TypeScript) and frontend (React + TypeScript + Ant Design)

**Latest (v1.1.32)**: 로컬 인증 + 멤버 관리 페이지 (탭 구조, LDAP 통합) 🔐👥

**Recent (v1.1.31)**: WordPress 스타일 웹 설치 마법사 + 경로 환경변수화 🧙

**v1.1.30**: 프론트엔드 nginx Docker 전환 🐳

**자세한 내용**: [기능 소개](docs/features/FEATURES.md) | [변경 이력](docs/changelog/CHANGELOG.md)

---

## Tech Stack

### Backend
- Node.js v24.9.0 + Express + TypeScript
- PostgreSQL v14.x + Prisma ORM
- Winston 로깅 (일별 로테이션)
- LDAP 인증 + JWT

### Frontend
- React v18.2.0 + TypeScript
- Ant Design v5.12.5 + Vite
- Zustand (상태 관리)

### Infrastructure
- OS: Ubuntu 22.04.5 LTS
- Ports: Frontend 3000, Backend 3001
- Data: `/data/psta/uploads/`
- Logs: `/log/psta/` (구조화된 로깅)

**자세한 내용**: [인프라 명세](docs/infrastructure/INFRASTRUCTURE.md)

---

## Common Commands

```bash
# 서버 관리
./bin/server.sh start | stop | restart | status

# 백엔드 코드 수정 후
./bin/server.sh restart backend
```

**자세한 내용**: [개발 가이드 - 서버 관리](docs/guides/development/DEVELOPMENT_GUIDE.md)

---

## Key Development Patterns

- **API 개발**: Controller → Route → Register in index.ts
- **로깅**: 9개 로거 (app, error, access, auth, database, ldap, slack, notification, migration)
- **인증**: JWT 기반, LDAP 통합
- **파일 업로드**: Multer + 계층 정보 자동 추출

**자세한 내용**: [개발 가이드](docs/guides/development/DEVELOPMENT_GUIDE.md)

---

## Data Directories

- **Data**: `/data/psta/uploads/` (client-logos, item-files)
- **Logs**: `/log/psta/` (app, database, external, system)

**자세한 내용**: [인프라 명세 - 파일 시스템](docs/infrastructure/INFRASTRUCTURE.md#10-파일-시스템)

---

## Important Notes

### File Paths
- Always use absolute paths
- Data: `/data/psta/uploads/`
- Logs: `/log/psta/`

### Server Restarts
- **systemd (권장)**: `sudo systemctl restart psta-backend` (자동 시작 설정됨)
- **server.sh**: `/app/psta/bin/server.sh restart backend`
- Never restart manually with pm2 or node

### Logging Best Practices
- Import appropriate logger from `backend/src/config/logger.ts`
- Use structured logging with context objects
- HTTP requests are logged automatically
- Log auth events with userId, username, role, IP
- Log errors with full stack traces

**자세한 내용**: [개발 가이드](docs/guides/development/DEVELOPMENT_GUIDE.md)

---

## Getting Help

- **설치**: [설치 가이드](docs/guides/installation/INSTALLATION_GUIDE.md)
- **개발**: [개발 가이드](docs/guides/development/DEVELOPMENT_GUIDE.md)
- **사용법**: [사용자 가이드](docs/guides/user/USER_GUIDE.md)
- **문서 맵**: [DOCUMENT_MAP.md](DOCUMENT_MAP.md)
- **GitHub Issues**: https://github.com/GUNIQ-G/psta/issues

---

**PSTA v1.1.32 - Project Management Made Easy**
