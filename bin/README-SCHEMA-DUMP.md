# PSTA 데이터베이스 스키마 덤프 파일

이 디렉토리에는 PSTA 데이터베이스 스키마를 빠르게 복원할 수 있는 SQL 덤프 파일이 포함되어 있습니다.

---

## 📦 파일

### `psta-schema-only.sql` (34KB) - 권장
- PostgreSQL `pg_dump` 도구로 생성
- 전체 스키마 포함 (테이블, 인덱스, 제약조건, ENUM)
- 프로덕션 배포에 최적

### `psta-prisma-schema.sql` (21KB) - 참고용
- Prisma `migrate diff` 명령어로 생성
- `schema.prisma` 파일 기반

---

## 🚀 빠른 사용법

### 1. 데이터베이스 생성
```bash
sudo -u postgres psql << EOF
CREATE USER psta_user WITH PASSWORD 'psta_password';
CREATE DATABASE psta OWNER psta_user;
GRANT ALL PRIVILEGES ON DATABASE psta TO psta_user;
\q
EOF
```

### 2. 스키마 복원 (권장)
```bash
PGPASSWORD=psta_password psql -U psta_user -d psta -h localhost -f /app/psta/bin/psta-schema-only.sql
```

### 3. Prisma Client 생성
```bash
cd /app/psta/backend
npx prisma generate
```

---

## 📚 상세 가이드

- **전체 설치 과정**: [설치 가이드](../docs/guides/installation/INSTALLATION_GUIDE.md)
- **데이터베이스 설정**: [설치 가이드 - 데이터베이스 설정](../docs/guides/installation/INSTALLATION_GUIDE.md#데이터베이스-설정)
- **문제 해결**: [설치 가이드 - 문제 해결](../docs/guides/installation/INSTALLATION_GUIDE.md#문제-해결)

---

**생성 일자**: 2025-11-04
**PSTA 버전**: v1.1.4
**PostgreSQL 버전**: 16.10 (Docker)
