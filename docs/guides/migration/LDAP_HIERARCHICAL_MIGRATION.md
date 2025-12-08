# LDAP 계층형 구조 마이그레이션 계획 (방안 B)

**문서 버전**: v1.0
**작성일**: 2025-11-25
**목표**: 기존 LDAP에서 신규 계층형 LDAP으로 **무중단 마이그레이션**

---

## 📋 목차

1. [개요](#1-개요)
2. [현황 분석](#2-현황-분석)
3. [마이그레이션 전략](#3-마이그레이션-전략)
4. [데이터 안전성 보장](#4-데이터-안전성-보장)
5. [Phase 1: 데이터베이스 스키마 확장](#phase-1-데이터베이스-스키마-확장)
6. [Phase 2: LDAP 동기화 로직 개선](#phase-2-ldap-동기화-로직-개선)
7. [Phase 3: LDAP 서버 전환](#phase-3-ldap-서버-전환)
8. [Phase 4: 선택적 동기화 실행](#phase-4-선택적-동기화-실행)
9. [Phase 5: UI 계층 구조 표시](#phase-5-ui-계층-구조-표시)
10. [롤백 계획](#10-롤백-계획)
11. [검증 체크리스트](#11-검증-체크리스트)

---

## 1. 개요

### 1.1 마이그레이션 목표

- ✅ **무중단 마이그레이션**: 사용자가 불편을 느끼지 못하도록
- ✅ **데이터 보존**: 기존 프로젝트/서비스/액션 소유권 100% 유지
- ✅ **계층형 구조 지원**: 조직 → 회사 → 부서 → 팀 4단계 표현
- ✅ **하위 호환성**: 기존 평면 구조도 계속 지원

### 1.2 핵심 원칙

1. **사용자 식별은 `username` 기반** (DN 독립적)
2. **Item 소유권은 `User.id` 직접 참조** (팀 변경과 무관)
3. **기존 LDAP과 새 LDAP은 username/password 동일** (사용자 입장에서 투명)

---

## 2. 현황 분석

### 2.1 기존 LDAP 구조 (3.34.115.117)

```
dc=dztechwill,dc=com
├─ ou=더존테크윌
│  ├─ cn=admins (Group)
│  ├─ cn=개발팀 (Group)
│  └─ cn=기획디자인팀 (Group)
└─ Users
   ├─ cn=김지훈,ou=더존테크윌,... (36명)
   └─ ...
```

**특징**:
- 평면 구조 (Flat)
- `groupOfNames` 타입만 Team으로 동기화
- 36명의 활성 사용자

### 2.2 신규 LDAP 구조 (192.168.1.212:10389)

```
dc=ldap,dc=dztechwill,dc=com
├─ ou=Organizations (Level 0)
│  ├─ ou=더존테크윌 (Level 1 - Company)
│  │  └─ ou=서비스개발본부 (Level 2 - Department)
│  │     ├─ ou=개발팀 (Level 3 - Team, 20명)
│  │     └─ ou=기획디자인팀 (Level 3 - Team, 16명)
│  └─ ou=퇴사자 (Level 1 - Retired)
└─ ou=Groups (Level 0)
   └─ cn=admins (groupOfNames, 1그룹)
```

**특징**:
- **계층형 구조** (4단계: Organizations → Company → Department → Team)
- **팀은 OU** (`organizationalUnit`), 그룹 아님
- 기존 사용자 36명 모두 포함 (username/password 동일)

### 2.3 호환성 분석

| 항목 | 기존 LDAP | 신규 LDAP | 호환 여부 |
|-----|----------|----------|---------|
| **사용자 계정명** | uid=jihoon.kim | uid=jihoon.kim | ✅ 동일 |
| **비밀번호** | userPassword | userPassword | ✅ 동일 |
| **팀 타입** | groupOfNames | organizationalUnit | ❌ 불일치 |
| **팀 구조** | 평면 (1단계) | 계층 (4단계) | ❌ 불일치 |
| **팀 개수** | 3개 (admins, 개발팀, 기획디자인팀) | 7개 (OUs 포함) | ⚠️ 증가 |

**결론**:
- ✅ 사용자 인증은 100% 호환 (username 기반)
- ❌ 현재 동기화 로직은 `groupOfNames`만 처리 → **개선 필요**
- ❌ 계층 구조 미지원 → **스키마 확장 필요**

---

## 3. 마이그레이션 전략

### 3.1 전체 로드맵

```
Phase 1: 데이터베이스 스키마 확장 (기존 LDAP 사용 중)
   ↓
Phase 2: LDAP 동기화 로직 개선 (기존 LDAP 사용 중)
   ↓
Phase 3: LDAP 서버 전환 (.env 수정)
   ↓
Phase 4: 선택적 동기화 실행 (36명)
   ↓
Phase 5: UI 계층 구조 표시
```

### 3.2 예상 소요 시간

| Phase | 작업 내용 | 예상 시간 |
|-------|---------|---------|
| Phase 1 | 스키마 마이그레이션 | 2시간 |
| Phase 2 | 동기화 로직 개선 | 4시간 |
| Phase 3 | 서버 전환 | 10분 |
| Phase 4 | 선택적 동기화 | 30분 |
| Phase 5 | UI 개선 | 4시간 |
| **합계** | | **약 11시간** |

---

## 4. 데이터 안전성 보장

### 4.1 Item 소유권 구조

```prisma
model Item {
  id          String  @id
  type        ItemType  // PROJECT, SERVICE, TEAM, ACTION
  assigneeId  String?   // 담당자 (User.id 직접 참조)
  createdById String    // 생성자 (User.id 직접 참조) ← 필수!

  User_Item_assigneeIdToUser  User?  @relation("Item_assigneeIdToUser")
  User_Item_createdByIdToUser User   @relation("Item_createdByIdToUser")
}

model User {
  id       String @id      // UUID - 절대 변경되지 않음
  username String @unique  // LDAP 인증 핵심 (동일 유지)
  teamId   String?         // 팀 소속 (변경 가능, Item 무관)
  ldapDn   String?         // LDAP DN (변경 가능, Item 무관)
}
```

### 4.2 왜 안전한가?

1. **Item ↔ User 관계는 `User.id`로 직접 연결**
   - `User.id` = UUID (Primary Key, 절대 변경 안됨)
   - `Item.createdById`, `Item.assigneeId`는 이 UUID 참조

2. **사용자 매칭은 `username` 기반**
   - 기존 LDAP: `uid=jihoon.kim`
   - 새 LDAP: `uid=jihoon.kim`
   - 동일한 username → 동일한 User 레코드 매칭

3. **Team 변경이 Item에 영향 없음**
   - `User.teamId` 변경되어도 `Item.createdById`는 그대로
   - Foreign Key 관계가 Team을 거치지 않음

4. **LDAP DN 변경이 Item에 영향 없음**
   - DN은 LDAP 서버 내부 식별자일 뿐
   - PSTA는 username으로 식별

### 4.3 보존되는 데이터

| 데이터 | 보존 여부 | 이유 |
|-------|---------|-----|
| ✅ 프로젝트 소유권 | 100% | User.id 직접 참조 |
| ✅ 서비스 소유권 | 100% | User.id 직접 참조 |
| ✅ 액션 소유권 | 100% | User.id 직접 참조 |
| ✅ 담당자 정보 | 100% | User.id 직접 참조 |
| ✅ 코멘트 | 100% | User.id 직접 참조 |
| ✅ 파일 업로드 | 100% | User.id 직접 참조 |
| ✅ 작업 요청 | 100% | User.id 직접 참조 |

---

## Phase 1: 데이터베이스 스키마 확장

### 1.1 목표

기존 평면 Team 구조에 **계층형 필드 추가** (하위 호환성 유지)

### 1.2 스키마 변경

**변경 전** (현재):
```prisma
model Team {
  id          String   @id
  name        String   @unique
  ldapDn      String?  @unique
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime

  User                User[]
  AssignedWorkRequests WorkRequest[] @relation("WorkRequestAssigneeTeam")
  ServiceTeams        ServiceTeam[]
}
```

**변경 후**:
```prisma
model Team {
  id          String   @id
  name        String   @unique

  // 🆕 계층형 구조 필드 (하위 호환)
  parentId    String?              // 상위 팀 ID (null = 최상위)
  level       Int      @default(0) // 계층 깊이 (0=최상위, 1=회사, 2=부서, 3=팀)
  ldapType    String?              // "OU" or "Group" (null = 수동 생성 팀)

  ldapDn      String?  @unique
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime

  // 🆕 계층형 관계
  Parent      Team?    @relation("TeamHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  Children    Team[]   @relation("TeamHierarchy")

  // 기존 관계 (변경 없음)
  User                User[]
  AssignedWorkRequests WorkRequest[] @relation("WorkRequestAssigneeTeam")
  ServiceTeams        ServiceTeam[]

  @@index([parentId])
}
```

### 1.3 마이그레이션 SQL

```sql
-- 1. 새 컬럼 추가 (NULL 허용)
ALTER TABLE "Team" ADD COLUMN "parentId" TEXT;
ALTER TABLE "Team" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Team" ADD COLUMN "ldapType" TEXT;

-- 2. 외래 키 제약 조건 추가
ALTER TABLE "Team" ADD CONSTRAINT "Team_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Team"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. 인덱스 추가
CREATE INDEX "Team_parentId_idx" ON "Team"("parentId");

-- 4. 기존 팀은 level=0, ldapType=NULL (수동 생성 간주)
UPDATE "Team" SET "level" = 0, "ldapType" = NULL WHERE "ldapType" IS NULL;
```

### 1.4 실행 명령

```bash
cd /app/psta/backend

# 1. 마이그레이션 파일 생성
npx prisma migrate dev --name add_team_hierarchy_fields --create-only

# 2. 생성된 파일 확인 및 검토
# backend/prisma/migrations/YYYYMMDDHHMMSS_add_team_hierarchy_fields/migration.sql

# 3. 마이그레이션 적용
npx prisma migrate deploy

# 4. Prisma Client 재생성
npx prisma generate
```

### 1.5 검증

```bash
# PostgreSQL 직접 확인
psql -U psta_user -d psta_db -c "\d \"Team\""

# 기대 결과:
# - parentId 컬럼 존재
# - level 컬럼 존재 (기본값 0)
# - ldapType 컬럼 존재
# - Team_parentId_idx 인덱스 존재
```

### 1.6 롤백 방법

```sql
-- 긴급 롤백이 필요한 경우
ALTER TABLE "Team" DROP CONSTRAINT "Team_parentId_fkey";
DROP INDEX "Team_parentId_idx";
ALTER TABLE "Team" DROP COLUMN "parentId";
ALTER TABLE "Team" DROP COLUMN "level";
ALTER TABLE "Team" DROP COLUMN "ldapType";
```

---

## Phase 2: LDAP 동기화 로직 개선

### 2.1 목표

- OU (`organizationalUnit`) 타입도 Team으로 동기화
- 계층 구조 정보 자동 추출 및 저장
- 기존 평면 구조 동기화도 계속 지원

### 2.2 코드 수정 위치

**파일**: `/app/psta/backend/src/services/ldap-sync.service.ts`

### 2.3 변경 사항

#### 2.3.1 fetchAllLdapGroups() 수정

**변경 전** (현재):
```typescript
private async fetchAllLdapGroups(): Promise<any[]> {
  const opts = {
    filter: '(objectClass=groupOfNames)',  // 그룹만
    scope: 'sub' as const,
    attributes: ['cn', 'member', 'description'],
  };
  // ...
}
```

**변경 후**:
```typescript
private async fetchAllLdapGroups(): Promise<any[]> {
  // 1. 그룹 조회 (기존 로직)
  const groupOpts = {
    filter: '(objectClass=groupOfNames)',
    scope: 'sub' as const,
    attributes: ['cn', 'member', 'description'],
  };
  const groups = await this.searchLdap(baseDN, groupOpts);

  // 🆕 2. OU 조회 (신규 로직)
  const ouOpts = {
    filter: '(&(objectClass=organizationalUnit)(!(ou=Organizations))(!(ou=Groups)))',
    scope: 'sub' as const,
    attributes: ['ou', 'description'],
  };
  const ous = await this.searchLdap(baseDN, ouOpts);

  // 🆕 3. 그룹과 OU 병합
  const combined = [
    ...groups.map(g => ({ ...g, ldapType: 'Group' })),
    ...ous.map(o => ({ ...o, ldapType: 'OU', cn: o.ou })),
  ];

  return combined;
}
```

#### 2.3.2 extractLdapTeamInfo() 추가

```typescript
/**
 * LDAP DN에서 계층 정보 추출
 * 예: "ou=개발팀,ou=서비스개발본부,ou=더존테크윌,ou=Organizations,dc=ldap,dc=dztechwill,dc=com"
 * → { level: 3, parentDn: "ou=서비스개발본부,ou=더존테크윌,..." }
 */
private extractLdapTeamInfo(dn: string): {
  level: number;
  parentDn: string | null;
} {
  const parts = dn.split(',').filter(p =>
    p.trim().toLowerCase().startsWith('ou=') ||
    p.trim().toLowerCase().startsWith('cn=')
  );

  const level = parts.length - 1; // Organizations 제외
  const parentDn = parts.length > 1 ? parts.slice(1).join(',') : null;

  return { level, parentDn };
}
```

#### 2.3.3 syncTeamsFromLdap() 수정

**변경 전**:
```typescript
private async syncTeamsFromLdap(ldapGroups: any[]): Promise<{
  teamsCreated: string[];
  teamsDeactivated: string[];
}> {
  for (const group of ldapGroups) {
    const teamName = group.cn;
    const ldapDn = group.dn;

    // Team 생성/업데이트 (평면 구조)
    await prisma.team.upsert({
      where: { ldapDn },
      update: { name: teamName, isActive: true },
      create: { id: uuidv4(), name: teamName, ldapDn, isActive: true },
    });
  }
}
```

**변경 후**:
```typescript
private async syncTeamsFromLdap(ldapGroups: any[]): Promise<{
  teamsCreated: string[];
  teamsDeactivated: string[];
}> {
  // 🆕 1단계: 계층 정보 추출 및 정렬 (상위 팀부터)
  const teamsWithHierarchy = ldapGroups.map(group => {
    const { level, parentDn } = this.extractLdapTeamInfo(group.dn);
    return {
      name: group.cn,
      ldapDn: group.dn,
      ldapType: group.ldapType,
      level,
      parentDn,
      description: group.description,
    };
  });

  // 상위 레벨부터 처리 (level 0 → 1 → 2 → 3)
  teamsWithHierarchy.sort((a, b) => a.level - b.level);

  // 🆕 2단계: DN → Team ID 매핑 (부모 찾기용)
  const dnToTeamId = new Map<string, string>();

  for (const teamInfo of teamsWithHierarchy) {
    // 부모 Team 찾기
    let parentId: string | null = null;
    if (teamInfo.parentDn) {
      parentId = dnToTeamId.get(teamInfo.parentDn) || null;

      // 부모가 아직 없으면 DB에서 찾기
      if (!parentId) {
        const parentTeam = await prisma.team.findUnique({
          where: { ldapDn: teamInfo.parentDn },
          select: { id: true },
        });
        if (parentTeam) {
          parentId = parentTeam.id;
          dnToTeamId.set(teamInfo.parentDn, parentId);
        }
      }
    }

    // 🆕 Team 생성/업데이트 (계층 정보 포함)
    const team = await prisma.team.upsert({
      where: { ldapDn: teamInfo.ldapDn },
      update: {
        name: teamInfo.name,
        parentId,
        level: teamInfo.level,
        ldapType: teamInfo.ldapType,
        description: teamInfo.description,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        id: uuidv4(),
        name: teamInfo.name,
        ldapDn: teamInfo.ldapDn,
        parentId,
        level: teamInfo.level,
        ldapType: teamInfo.ldapType,
        description: teamInfo.description,
        isActive: true,
      },
    });

    // DN → ID 매핑 저장
    dnToTeamId.set(teamInfo.ldapDn, team.id);
    teamsCreated.push(teamInfo.name);
  }

  // 나머지 로직 동일...
}
```

### 2.4 테스트 방법

```bash
# 1. 코드 수정 후 빌드
cd /app/psta/backend
npm run build

# 2. 백엔드 재시작
./bin/server.sh restart backend

# 3. 테스트용 스크립트 작성
node -e "
const { ldapSyncService } = require('./dist/services/ldap-sync.service');
(async () => {
  const result = await ldapSyncService.syncAllFromLdap(true); // dryRun
  console.log(JSON.stringify(result, null, 2));
})();
"

# 4. 기대 결과
# - 7개의 Team 생성 (Organizations, 더존테크윌, 서비스개발본부, 개발팀, 기획디자인팀, 퇴사자, admins)
# - parentId, level, ldapType 정상 설정 확인
```

---

## Phase 3: LDAP 서버 전환

### 3.1 목표

`.env` 파일의 LDAP 서버 정보를 **기존 → 신규**로 변경

### 3.2 현재 설정 확인

```bash
grep "LDAP" /app/psta/backend/.env
```

**기대 출력**:
```
LDAP_SERVER=3.34.115.117
LDAP_PORT=10389
LDAP_BASE_DN=dc=dztechwill,dc=com
LDAP_BIND_DN=cn=admin,dc=dztechwill,dc=com
LDAP_BIND_PASSWORD=xxxxxxxx
```

### 3.3 신규 설정으로 변경

```bash
# 백업 생성
cp /app/psta/backend/.env /app/psta/backend/.env.backup.$(date +%Y%m%d_%H%M%S)

# 설정 변경
cd /app/psta/backend
```

**수정 내용**:
```diff
- LDAP_SERVER=3.34.115.117
+ LDAP_SERVER=192.168.1.212

- LDAP_BASE_DN=dc=dztechwill,dc=com
+ LDAP_BASE_DN=dc=ldap,dc=dztechwill,dc=com

- LDAP_BIND_DN=cn=admin,dc=dztechwill,dc=com
+ LDAP_BIND_DN=cn=admin,dc=ldap,dc=dztechwill,dc=com
```

**LDAP_PORT**, **LDAP_BIND_PASSWORD**는 동일 유지 (10389, 비밀번호)

### 3.4 연결 테스트

```bash
# 백엔드 재시작
./bin/server.sh restart backend

# 로그 확인
tail -f /log/psta/backend/app.log

# LDAP 연결 테스트 (Web UI)
# 1. https://psta.dztechwill.com/ldap-auth 접속
# 2. 신규 LDAP 설정 행에서 "테스트" 버튼 클릭
# 3. "LDAP 연결 테스트 성공" 메시지 확인
```

### 3.5 롤백 방법

```bash
# 긴급 롤백
cp /app/psta/backend/.env.backup.YYYYMMDD_HHMMSS /app/psta/backend/.env
./bin/server.sh restart backend
```

---

## Phase 4: 선택적 동기화 실행

### 4.1 목표

신규 LDAP에서 **36명의 사용자**를 안전하게 PSTA로 동기화

### 4.2 사전 확인

```bash
# 1. 현재 PSTA 사용자 수
psql -U psta_user -d psta_db -c "SELECT COUNT(*) FROM \"User\" WHERE \"isActive\" = true;"

# 2. LDAP 사용자 수 (예상: 36명)
# Web UI에서 "LDAP 미리보기" 클릭하여 확인
```

### 4.3 실행 절차

#### 4.3.1 Web UI에서 실행

1. **LDAP Auth 페이지 접속**
   ```
   https://psta.dztechwill.com/ldap-auth
   ```

2. **LDAP 미리보기 클릭**
   - 36명의 사용자 목록 확인
   - 각 사용자의 상태 확인:
     - `PSTA 활성`: 기존 활성 사용자
     - `PSTA 비활성`: 기존 비활성 사용자
     - `신규`: PSTA에 없는 사용자

3. **전체 선택 클릭**
   - 36명 모두 선택

4. **선택한 사용자 동기화 클릭**
   - 확인 모달에서 내용 검토
   - "동기화 실행" 클릭

5. **결과 확인**
   - 동기화 완료 모달:
     ```
     팀 생성: 7개
     사용자 생성/업데이트: 36개
     오류: 0개
     ```

#### 4.3.2 API로 실행 (선택사항)

```bash
# 1. 미리보기로 사용자 DN 목록 가져오기
curl -X GET https://psta.dztechwill.com/api/ldap-sync/preview \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -o preview.json

# 2. DN 목록 추출
cat preview.json | jq -r '.ldapUsers[].dn' > user_dns.txt

# 3. 선택적 동기화 실행
curl -X POST https://psta.dztechwill.com/api/ldap-sync/selective \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "selectedUserDns": [
      "cn=김지훈,ou=개발팀,ou=서비스개발본부,ou=더존테크윌,ou=Organizations,dc=ldap,dc=dztechwill,dc=com",
      ...
    ],
    "dryRun": false
  }'
```

### 4.4 검증

```bash
# 1. User 테이블 확인
psql -U psta_user -d psta_db -c "
  SELECT
    COUNT(*) as total_users,
    COUNT(CASE WHEN \"isActive\" = true THEN 1 END) as active_users,
    COUNT(CASE WHEN \"isActive\" = false THEN 1 END) as inactive_users
  FROM \"User\";
"

# 기대 결과:
# total_users: 36
# active_users: 36
# inactive_users: 0

# 2. Team 테이블 확인
psql -U psta_user -d psta_db -c "
  SELECT
    id, name, \"parentId\", level, \"ldapType\", \"isActive\"
  FROM \"Team\"
  ORDER BY level, name;
"

# 기대 결과:
# level 0: Organizations
# level 1: 더존테크윌, 퇴사자
# level 2: 서비스개발본부
# level 3: 개발팀, 기획디자인팀
# + Groups: admins

# 3. 사용자-팀 매핑 확인
psql -U psta_user -d psta_db -c "
  SELECT
    t.name as team_name,
    COUNT(u.id) as user_count
  FROM \"Team\" t
  LEFT JOIN \"User\" u ON u.\"teamId\" = t.id AND u.\"isActive\" = true
  WHERE t.\"isActive\" = true
  GROUP BY t.name
  ORDER BY user_count DESC;
"

# 기대 결과:
# 개발팀: 20명
# 기획디자인팀: 16명
# admins: 1명 (중복 가능)
```

### 4.5 사용자 로그인 테스트

```bash
# 테스트 계정으로 로그인 시도
curl -X POST https://psta.dztechwill.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "jihoon.kim",
    "password": "기존비밀번호"
  }'

# 기대 결과:
# {
#   "success": true,
#   "token": "eyJhbGciOiJIUzI1NiIs...",
#   "user": {
#     "id": "...",
#     "username": "jihoon.kim",
#     "displayName": "김지훈",
#     "team": "개발팀"
#   }
# }
```

### 4.6 기존 데이터 확인

```bash
# Item 소유권 검증
psql -U psta_user -d psta_db -c "
  SELECT
    u.username,
    u.\"displayName\",
    COUNT(i.id) as total_items,
    COUNT(CASE WHEN i.type = 'PROJECT' THEN 1 END) as projects,
    COUNT(CASE WHEN i.type = 'SERVICE' THEN 1 END) as services,
    COUNT(CASE WHEN i.type = 'ACTION' THEN 1 END) as actions
  FROM \"User\" u
  LEFT JOIN \"Item\" i ON i.\"createdById\" = u.id AND i.\"isDeleted\" = false
  WHERE u.\"isActive\" = true
  GROUP BY u.username, u.\"displayName\"
  HAVING COUNT(i.id) > 0
  ORDER BY total_items DESC;
"

# 기대 결과:
# - 기존 사용자가 생성한 모든 Item이 그대로 유지
# - createdById가 변경되지 않음
```

---

## Phase 5: UI 계층 구조 표시

### 5.1 목표

조직 관리 페이지에서 **계층형 팀 구조를 Tree 형태로 표시**

### 5.2 UI 수정 위치

**파일**: `/app/psta/frontend/src/pages/OrganizationManagement.tsx`

### 5.3 변경 사항

#### 5.3.1 API 응답 타입 확장

```typescript
interface Team {
  id: string;
  name: string;
  parentId: string | null;  // 🆕
  level: number;             // 🆕
  ldapType: string | null;   // 🆕
  ldapDn: string | null;
  description: string | null;
  isActive: boolean;
  _count: {
    User: number;
    ServiceTeams: number;
  };
}
```

#### 5.3.2 Tree 데이터 구조 변환

```typescript
/**
 * 평면 Team 배열을 계층형 Tree 구조로 변환
 */
const buildTeamTree = (teams: Team[]): TreeNode[] => {
  const teamMap = new Map<string, TreeNode>();

  // 1. 모든 팀을 Map에 저장
  teams.forEach(team => {
    teamMap.set(team.id, {
      key: team.id,
      title: team.name,
      level: team.level,
      ldapType: team.ldapType,
      userCount: team._count.User,
      isActive: team.isActive,
      children: [],
    });
  });

  // 2. 부모-자식 관계 설정
  const rootNodes: TreeNode[] = [];
  teams.forEach(team => {
    const node = teamMap.get(team.id)!;

    if (team.parentId) {
      const parent = teamMap.get(team.parentId);
      if (parent) {
        parent.children!.push(node);
      } else {
        rootNodes.push(node); // 부모가 없으면 root
      }
    } else {
      rootNodes.push(node); // parentId가 null이면 root
    }
  });

  return rootNodes;
};
```

#### 5.3.3 Tree UI 렌더링

```typescript
import { Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';

// Tree 컴포넌트 사용
<Tree
  treeData={treeData}
  defaultExpandAll
  showLine
  titleRender={(nodeData: any) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontWeight: nodeData.level <= 2 ? 'bold' : 'normal' }}>
        {nodeData.title}
      </span>
      {nodeData.ldapType && (
        <Tag size="small" color={nodeData.ldapType === 'OU' ? 'blue' : 'green'}>
          {nodeData.ldapType}
        </Tag>
      )}
      <Tag size="small">{nodeData.userCount}명</Tag>
      <Tag size="small" color={nodeData.isActive ? 'success' : 'default'}>
        {nodeData.isActive ? '활성' : '비활성'}
      </Tag>
    </div>
  )}
/>
```

### 5.4 예상 UI 구조

```
📁 Organizations (0명)
  📁 더존테크윌 (0명)
    📁 서비스개발본부 (0명)
      👥 개발팀 (20명) [OU] [활성]
      👥 기획디자인팀 (16명) [OU] [활성]
  📁 퇴사자 (0명)
📁 Groups (0명)
  👥 admins (1명) [Group] [활성]
```

---

## 10. 롤백 계획

### 10.1 Phase별 롤백 방법

| Phase | 롤백 방법 | 영향 범위 |
|-------|---------|---------|
| Phase 1 | 스키마 롤백 SQL 실행 | DB만 (데이터 무손실) |
| Phase 2 | 이전 버전 코드로 복원 | Backend만 |
| Phase 3 | `.env.backup` 복원 | LDAP 연결만 |
| Phase 4 | 사용자 `isActive=false` 처리 | 사용자 목록만 |
| Phase 5 | 이전 UI 코드로 복원 | Frontend만 |

### 10.2 긴급 롤백 시나리오

**상황**: Phase 4 동기화 후 문제 발견

```bash
# 1. LDAP 서버를 기존으로 복원
cp /app/psta/backend/.env.backup.YYYYMMDD_HHMMSS /app/psta/backend/.env
./bin/server.sh restart backend

# 2. 신규 동기화된 사용자 비활성화 (필요시)
psql -U psta_user -d psta_db -c "
  UPDATE \"User\"
  SET \"isActive\" = false
  WHERE \"ldapDn\" LIKE '%dc=ldap,dc=dztechwill,dc=com';
"

# 3. 기존 사용자 재활성화
psql -U psta_user -d psta_db -c "
  UPDATE \"User\"
  SET \"isActive\" = true
  WHERE \"ldapDn\" LIKE '%dc=dztechwill,dc=com'
    AND \"ldapDn\" NOT LIKE '%dc=ldap,dc=dztechwill,dc=com';
"

# 4. 확인
psql -U psta_user -d psta_db -c "
  SELECT \"isActive\", COUNT(*) FROM \"User\" GROUP BY \"isActive\";
"
```

---

## 11. 검증 체크리스트

### 11.1 Phase 1 완료 후

- [ ] `Team` 테이블에 `parentId`, `level`, `ldapType` 컬럼 존재
- [ ] 기존 Team 레코드의 `level=0`, `ldapType=NULL` 확인
- [ ] Foreign Key 제약 조건 정상 작동 (`parentId` → `Team.id`)
- [ ] 인덱스 생성 확인 (`Team_parentId_idx`)

### 11.2 Phase 2 완료 후

- [ ] 코드 빌드 성공 (`npm run build`)
- [ ] TypeScript 컴파일 에러 없음
- [ ] 백엔드 재시작 성공
- [ ] 로그에 에러 없음 (`tail -f /log/psta/backend/app.log`)

### 11.3 Phase 3 완료 후

- [ ] `.env` 파일의 LDAP 설정 변경 확인
- [ ] 백엔드 재시작 성공
- [ ] LDAP 연결 테스트 성공 (Web UI)
- [ ] 로그에 신규 LDAP 연결 로그 확인

### 11.4 Phase 4 완료 후

- [ ] 36명의 사용자 동기화 완료
- [ ] 7개의 Team 생성 확인 (Organizations, 더존테크윌, 서비스개발본부, 개발팀, 기획디자인팀, 퇴사자, admins)
- [ ] Team 계층 구조 정상 (`parentId`, `level` 정확)
- [ ] 사용자-팀 매핑 정상 (개발팀 20명, 기획디자인팀 16명)
- [ ] 기존 사용자 로그인 성공 (동일 username/password)
- [ ] 기존 Item 소유권 유지 (`createdById` 불변)

### 11.5 Phase 5 완료 후

- [ ] 조직 관리 페이지에 Tree 구조 표시
- [ ] 계층 구조 정상 렌더링
- [ ] 각 노드에 사용자 수, ldapType 표시
- [ ] Tree 확장/축소 정상 작동

---

## 12. 문의 및 지원

### 12.1 관련 문서

- [LDAP 인증 설정 가이드](../installation/INSTALLATION_GUIDE.md#ldap-인증)
- [조직 관리 사용자 가이드](../user/USER_GUIDE.md#조직-관리)
- [개발 가이드](../development/DEVELOPMENT_GUIDE.md)

### 12.2 기술 지원

- **GitHub Issues**: https://github.com/GUNIQ-G/psta/issues
- **문서 위치**: `/app/psta/docs/guides/migration/`

---

**문서 작성**: Claude Code
**최종 검토일**: 2025-11-25
**다음 리뷰 예정일**: 마이그레이션 완료 후
