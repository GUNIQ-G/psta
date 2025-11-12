# PSTA 일정 관리 시스템

**P**roject-**S**ervice-**T**eam-**A**ction 계층 구조 기반의 프로젝트 관리 시스템입니다.

## 🚀 Quick Start

```bash
# 전체 시스템 시작
./bin/server.sh start

# 상태 확인
./bin/server.sh status

# 접속
# Frontend: http://192.168.1.250:3000
# Login: admin / proadmin
```

## 📚 문서

- **[설치 가이드](docs/guides/installation/INSTALLATION_GUIDE.md)** - 시스템 설치 방법
- **[개발 가이드](docs/guides/development/DEVELOPMENT_GUIDE.md)** - 개발자를 위한 상세 가이드
- **[사용자 가이드](docs/guides/user/USER_GUIDE.md)** - 시스템 사용 방법
- **[인프라 명세](docs/infrastructure/INFRASTRUCTURE.md)** - 시스템 환경 및 요구사항
- **[기능 소개](docs/features/FEATURES.md)** - 주요 기능 설명
- **[변경 이력](docs/changelog/CHANGELOG.md)** - 버전별 변경사항
- **[문서 맵](DOCUMENT_MAP.md)** - 전체 문서 네비게이션

## 기술 스택

**Backend**: Node.js + Express + TypeScript + PostgreSQL + Prisma
**Frontend**: React + TypeScript + Ant Design + Vite
**Infrastructure**: Ubuntu 22.04, Winston 로깅, LDAP 인증, Slack 알림

## 주요 기능

- ✅ 4단계 계층 구조 (Project → Service → Team → Action)
- ✅ LDAP 인증 + 조직 관리 통합 (v1.1.5)
- ✅ 자동 LDAP 동기화 (매일 02:00 KST)
- ✅ 4단계 권한 관리 (ADMIN/PO/PM/MEMBER)
- ✅ WBS Gantt 차트 + Excel Import/Export
- ✅ 작업 요청 시스템 + 파일 첨부
- ✅ 멀티 플랫폼 알림 (Slack, Telegram, Discord)
- ✅ 댓글 시스템 + 멘션 DM

## 서버 관리

```bash
# 서버 시작/중지/재시작
./bin/server.sh start | stop | restart | status

# 백엔드 코드 수정 후
./bin/server.sh restart backend
```

자세한 내용은 [개발 가이드](docs/guides/development/DEVELOPMENT_GUIDE.md)를 참조하세요.

## 라이선스

MIT License

## 지원

- **GitHub**: https://github.com/GUNIQ-G/psta
- **Issues**: https://github.com/GUNIQ-G/psta/issues

---

**PSTA v1.1.5 - Project Management Made Easy**
