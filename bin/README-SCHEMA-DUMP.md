# PSTA 데이터베이스 스키마 덤프 파일

이 디렉토리에는 PSTA 프로젝트의 데이터베이스 스키마를 새로운 환경에 배포하기 위한 SQL 덤프 파일이 포함되어 있습니다.

---

## 📦 파일 목록

### 1. `psta-schema-only.sql` (34KB)
**생성 방법**: PostgreSQL `pg_dump` 도구 사용
**용도**: **프로덕션 마이그레이션 권장**
**포함 내용**:
- ✅ 전체 데이터베이스 스키마 (테이블, 인덱스, 제약조건)
- ✅ ENUM 타입 정의
- ✅ Foreign Key 관계
- ✅ 시퀀스 및 기본값
- ✅ PostgreSQL 네이티브 객체

**특징**:
- PostgreSQL 공식 도구로 생성되어 가장 완전하고 신뢰성 있음
- 실제 운영 중인 DB에서 직접 추출
- Prisma 외부에서 수동으로 추가된 변경사항도 포함

---

### 2. `psta-prisma-schema.sql` (21KB)
**생성 방법**: Prisma `migrate diff` 명령어 사용
**용도**: **개발/참고용**
**포함 내용**:
- ✅ Prisma가 관리하는 스키마
- ✅ `prisma/schema.prisma` 파일 기반
- ✅ ENUM, 테이블, 인덱스, Foreign Key

**특징**:
- `schema.prisma` 파일과 100% 동기화
- 버전 관리(Git)에 최적화
- Prisma ORM을 사용하는 프로젝트에 적합

---

## 🚀 사용 방법

### 방법 1: PostgreSQL 덤프 파일 사용 (권장)

#### Step 1: 데이터베이스 생성
```bash
# PostgreSQL 접속
sudo -u postgres psql

# 사용자 및 데이터베이스 생성
CREATE USER psta_user WITH PASSWORD 'your-strong-password';
CREATE DATABASE psta OWNER psta_user;
GRANT ALL PRIVILEGES ON DATABASE psta TO psta_user;
\q
```

#### Step 2: 스키마 복원
```bash
# 방법 A: psql 명령어 사용 (권장)
psql -U psta_user -d psta -h localhost -f /app/psta/bin/psta-schema-only.sql

# 방법 B: 비밀번호를 환경변수로 제공
PGPASSWORD=your-password psql -U psta_user -d psta -h localhost -f /app/psta/bin/psta-schema-only.sql

# 방법 C: Docker 컨테이너 사용
docker exec -i psta-postgres psql -U psta_user -d psta < /app/psta/bin/psta-schema-only.sql
```

#### Step 3: 복원 확인
```bash
# 테이블 목록 확인
psql -U psta_user -d psta -h localhost -c "\dt"

# 테이블 수 확인 (15개 테이블 예상)
psql -U psta_user -d psta -h localhost -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

---

### 방법 2: Prisma 덤프 파일 사용 (개발용)

#### Step 1: 데이터베이스 생성 (동일)
```bash
sudo -u postgres psql
CREATE USER psta_user WITH PASSWORD 'your-password';
CREATE DATABASE psta OWNER psta_user;
GRANT ALL PRIVILEGES ON DATABASE psta TO psta_user;
\q
```

#### Step 2: Prisma 스키마 복원
```bash
psql -U psta_user -d psta -h localhost -f /app/psta/bin/psta-prisma-schema.sql
```

#### Step 3: Prisma Client 생성
```bash
cd /app/psta/backend
npx prisma generate
```

---

## 🔄 덤프 파일 재생성 방법

### PostgreSQL 덤프 재생성
```bash
# Docker 컨테이너에서 생성 (권장)
docker exec psta-postgres pg_dump -U psta_user -d psta --schema-only --no-owner --no-acl > /app/psta/bin/psta-schema-only.sql

# 또는 로컬 PostgreSQL 클라이언트 사용 (버전 일치 시)
PGPASSWORD=psta_password pg_dump -U psta_user -d psta --schema-only --no-owner --no-acl -h localhost > /app/psta/bin/psta-schema-only.sql
```

### Prisma 덤프 재생성
```bash
cd /app/psta/backend
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > /app/psta/bin/psta-prisma-schema.sql
```

---

## 📋 두 파일의 차이점

| 항목 | psta-schema-only.sql | psta-prisma-schema.sql |
|------|---------------------|------------------------|
| **생성 도구** | pg_dump (PostgreSQL) | Prisma migrate diff |
| **파일 크기** | 34KB | 21KB |
| **완전성** | 가장 완전함 | Prisma 관리 항목만 |
| **수동 변경 포함** | ✅ 포함 | ❌ 누락 가능 |
| **프로덕션 사용** | ✅ 권장 | ⚠️ 참고용 |
| **개발 참조** | ✅ 가능 | ✅ 최적 |
| **Git 동기화** | △ | ✅ 완벽 |

---

## ⚠️ 주의사항

### 1. 데이터 손실 방지
```bash
# ❌ 위험: 기존 데이터베이스에 직접 실행하지 마세요!
# 덤프 파일은 스키마만 포함하지만, 테이블 생성 시 기존 테이블과 충돌할 수 있습니다.

# ✅ 안전: 항상 새로운 빈 데이터베이스에 복원
CREATE DATABASE psta_new;
psql -U psta_user -d psta_new -f psta-schema-only.sql
```

### 2. 외래 키 순서
- 덤프 파일은 외래 키 의존성 순서를 자동으로 처리합니다.
- `psta-schema-only.sql`: 테이블 생성 → 인덱스 → 외래 키 순서
- `psta-prisma-schema.sql`: Prisma가 최적화된 순서로 생성

### 3. 권한 설정
```bash
# 덤프 파일은 --no-owner --no-acl 옵션으로 생성되었습니다.
# 복원 후 수동으로 권한 설정이 필요할 수 있습니다.

# 모든 테이블 권한 부여
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO psta_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO psta_user;
```

### 4. 환경변수 설정
```bash
# 복원 후 반드시 .env 파일 설정
cd /app/psta/backend
nano .env

# DATABASE_URL 확인
DATABASE_URL="postgresql://psta_user:your-password@localhost:5432/psta?schema=public"
```

---

## 🆚 Prisma Migrate vs SQL 덤프

### Prisma Migrate 사용 (권장 - 개발 환경)
```bash
cd /app/psta/backend
npx prisma migrate deploy
```
**장점**:
- 마이그레이션 히스토리 추적
- 스키마 버전 관리
- 자동 롤백 지원

**단점**:
- 마이그레이션 파일 필요
- 복잡한 마이그레이션 시 수동 개입 필요

---

### SQL 덤프 사용 (권장 - 프로덕션 배포)
```bash
psql -U psta_user -d psta -f psta-schema-only.sql
```
**장점**:
- 빠른 배포
- 단일 파일로 전체 스키마 복원
- 외부 도구 의존성 없음

**단점**:
- 히스토리 추적 없음
- 점진적 마이그레이션 불가

---

## 🔍 복원 후 검증

### 1. 테이블 수 확인
```sql
-- 15개 테이블 예상
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**기대 결과**:
```
Client
Comment
File
Item
LdapConfig
Link
Message
Notification
NotificationApp
Organization
Permission
Project
ReportSnapshot
SlackConfig
SlackNotification
SystemSetting
Team
User
WorkRequest
```

### 2. 외래 키 확인
```sql
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
```

### 3. ENUM 타입 확인
```sql
SELECT n.nspname as schema, t.typname as type
FROM pg_type t
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE (t.typrelid = 0 OR (SELECT c.relkind = 'c' FROM pg_catalog.pg_class c WHERE c.oid = t.typrelid))
AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_type el WHERE el.oid = t.typelem AND el.typarray = t.oid)
AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schema, type;
```

**기대 결과** (7개 ENUM):
```
ItemStatus
ItemType
NotificationAppType
OrgType
UserRole
WorkRequestPriority
WorkRequestStatus
WorkRequestType
```

---

## 📚 관련 문서

- **[설치 가이드](../docs/guides/installation/INSTALLATION_GUIDE.md)** - 전체 설치 과정
- **[인프라 명세](../docs/infrastructure/INFRASTRUCTURE.md)** - 데이터베이스 요구사항
- **[개발 가이드](../docs/guides/development/DEVELOPMENT_GUIDE.md)** - Prisma 사용법

---

## 🆘 문제 해결

### 에러: "relation already exists"
```bash
# 원인: 이미 테이블이 존재하는 DB에 복원 시도
# 해결: 새 데이터베이스 생성 후 복원
DROP DATABASE psta;
CREATE DATABASE psta OWNER psta_user;
psql -U psta_user -d psta -f psta-schema-only.sql
```

### 에러: "role does not exist"
```bash
# 원인: psta_user 사용자가 없음
# 해결: 사용자 생성
sudo -u postgres psql
CREATE USER psta_user WITH PASSWORD 'password';
```

### 에러: "password authentication failed"
```bash
# 원인: 비밀번호 불일치
# 해결 1: 환경변수 사용
PGPASSWORD=correct-password psql -U psta_user -d psta -f psta-schema-only.sql

# 해결 2: .pgpass 파일 생성
echo "localhost:5432:psta:psta_user:your-password" > ~/.pgpass
chmod 600 ~/.pgpass
```

---

## 📊 생성 정보

- **생성 일자**: 2025-11-04
- **PSTA 버전**: v1.1.4
- **PostgreSQL 버전**: 16.10 (Docker)
- **Prisma 버전**: 5.22.0

---

**문서 끝**
