# PSTA 보안 가이드

**최종 업데이트**: 2025-10-28

이 문서는 PSTA 프로젝트의 보안 모범 사례와 민감 정보 관리 방법을 설명합니다.

---

## 📋 목차

1. [민감 정보 관리](#민감-정보-관리)
2. [Git 보안](#git-보안)
3. [환경변수 관리](#환경변수-관리)
4. [API 토큰 관리](#api-토큰-관리)
5. [데이터베이스 보안](#데이터베이스-보안)
6. [파일 업로드 보안](#파일-업로드-보안)
7. [사고 발생 시 대응](#사고-발생-시-대응)

---

## 민감 정보 관리

### 절대로 코드에 하드코딩하지 말아야 할 정보

❌ **금지 사항**:
- API 토큰 (Slack, Telegram, Discord 등)
- 데이터베이스 비밀번호
- JWT Secret
- LDAP 비밀번호
- OAuth Client Secret
- 암호화 키
- 사용자 개인정보

✅ **올바른 방법**:
- 환경변수 (.env 파일)
- 데이터베이스 (암호화된 형태로)
- 웹 UI를 통한 설정

### 코드 예시

#### ❌ 잘못된 방법
```typescript
const slackToken = 'xoxb-1234567890-abcdefgh'; // 절대 금지!
const dbPassword = 'mypassword123';             // 절대 금지!
```

#### ✅ 올바른 방법
```typescript
// 환경변수 사용
const slackToken = process.env.SLACK_BOT_TOKEN;

// 데이터베이스에서 조회 (암호화된 값)
const config = await prisma.notificationApp.findFirst({
  where: { type: 'SLACK', isActive: true }
});
const slackToken = decrypt(config.botToken);
```

---

## Git 보안

### .gitignore 필수 항목

```gitignore
# Environment variables
.env
.env.local
.env.production
.env.development
.env.*.local

# Security
**/secrets/
**/*secret*.txt
**/*credentials*.txt
**/*token*.txt
**/config/secrets.ts
**/config/credentials.ts

# Database
*.db
*.sqlite

# Uploads (user data)
/data/psta/uploads/

# Logs (may contain sensitive info)
*.log
/log/psta/
```

### 커밋 전 체크리스트

커밋하기 전에 **반드시** 확인:

```bash
# 1. 하드코딩된 토큰 검색
grep -r "xoxb-\|xapp-\|xoxp-" . --exclude-dir=node_modules --exclude-dir=.git

# 2. 비밀번호 검색
grep -r "password.*=.*['\"]" . --exclude-dir=node_modules --exclude-dir=.git

# 3. API 키 검색
grep -r "api.*key.*=.*['\"]" . --exclude-dir=node_modules --exclude-dir=.git

# 4. 스테이징된 파일 확인
git diff --cached

# 5. .env 파일이 추적되지 않는지 확인
git ls-files | grep "\.env$"
```

### Git Hook 설정 (pre-commit)

`/app/psta/.git/hooks/pre-commit` 파일 생성:

```bash
#!/bin/bash

# 민감 정보 패턴 검색
if git diff --cached | grep -E "xoxb-|xapp-|xoxp-|password.*=.*['\"]|api.*key.*=.*['\"]"; then
    echo "❌ ERROR: Sensitive information detected in commit!"
    echo "Please remove tokens, passwords, or API keys from your code."
    exit 1
fi

echo "✓ Pre-commit check passed"
exit 0
```

```bash
chmod +x /app/psta/.git/hooks/pre-commit
```

---

## 환경변수 관리

### .env 파일 구조

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/psta?schema=public"

# JWT (강력한 랜덤 문자열 사용)
JWT_SECRET="CHANGE_THIS_TO_RANDOM_STRING"
JWT_EXPIRES_IN="24h"

# Server
PORT=3001
NODE_ENV="production"

# Frontend URL
FRONTEND_URL="http://your-server-ip:3000"

# Slack (선택사항 - 웹 UI에서 설정 권장)
SLACK_BOT_TOKEN=""
SLACK_DEFAULT_CHANNEL=""
```

### JWT Secret 생성

```bash
# 강력한 랜덤 문자열 생성
openssl rand -base64 32
```

### .env 파일 권한 설정

```bash
# .env 파일 권한 제한 (소유자만 읽기/쓰기)
chmod 600 /app/psta/backend/.env

# 소유자 확인
ls -la /app/psta/backend/.env
```

---

## API 토큰 관리

### 웹 UI를 통한 토큰 설정 (권장)

PSTA는 **웹 UI를 통한 안전한 토큰 관리**를 지원합니다.

#### Slack/Telegram/Discord 토큰 설정

1. 관리자로 로그인
2. **시스템 설정 > 알림앱 연동** 메뉴 접속
3. 플랫폼 선택 (Slack, Telegram, Discord)
4. 토큰 입력 및 저장
5. "연결 테스트" 버튼으로 검증

#### LDAP 비밀번호 설정

1. 관리자로 로그인
2. **시스템 설정 > LDAP 인증** 메뉴 접속
3. LDAP 서버 정보 및 비밀번호 입력
4. 저장 시 자동으로 AES-256-CBC 암호화

### 토큰 저장 방식

PSTA는 민감 정보를 다음과 같이 저장합니다:

- **Slack/Telegram/Discord 토큰**: 데이터베이스 `NotificationApp` 테이블에 JSON 형식으로 저장
- **LDAP 비밀번호**: `LdapConfig` 테이블에 AES-256-CBC 암호화 후 저장
- **JWT Secret**: 환경변수 (.env 파일)

### 토큰 로테이션

정기적으로 토큰을 갱신하세요 (권장: 3-6개월마다):

1. Slack/Discord 앱 설정에서 새 토큰 생성
2. PSTA 웹 UI에서 토큰 업데이트
3. "연결 테스트"로 검증
4. 이전 토큰 무효화

---

## 데이터베이스 보안

### PostgreSQL 보안 설정

#### 1. 강력한 비밀번호 사용

```sql
-- 비밀번호 변경
ALTER USER psta_user WITH PASSWORD 'strong-random-password-here';
```

#### 2. 로컬 접속만 허용 (권장)

`/etc/postgresql/14/main/pg_hba.conf` 편집:

```conf
# IPv4 local connections only
host    all             all             127.0.0.1/32            md5

# IPv6 local connections only
host    all             all             ::1/128                 md5
```

#### 3. 원격 접속 제한 (필요시)

특정 IP만 허용:

```conf
# Allow only specific IP
host    all             all             192.168.1.100/32        md5
```

#### 4. PostgreSQL 재시작

```bash
sudo systemctl restart postgresql
```

### 데이터베이스 백업 보안

```bash
# 백업 파일 생성
pg_dump -U psta_user psta > backup.sql

# 백업 파일 권한 제한
chmod 600 backup.sql

# 백업 파일 암호화 (선택사항)
openssl enc -aes-256-cbc -salt -in backup.sql -out backup.sql.enc
rm backup.sql
```

---

## 파일 업로드 보안

### 업로드 디렉토리 권한

```bash
# 소유자만 읽기/쓰기/실행
chmod 700 /data/psta/uploads/

# 또는 그룹도 읽기 허용
chmod 750 /data/psta/uploads/
```

### 허용 파일 타입

PSTA는 다음 파일만 업로드를 허용합니다:

- **클라이언트 로고**: JPEG, PNG, GIF, WebP (최대 5MB)
- **아이템 첨부파일**: 이미지, PDF, Office 문서, 텍스트, ZIP (최대 20MB)

### 파일 검증 코드

`backend/src/config/multer.ts` 참조:

```typescript
const fileFilter = (req: any, file: Express.Multer.File, cb: FileFilterCallback) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'application/pdf',
    // ...
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'));
  }
};
```

---

## 사고 발생 시 대응

### 토큰이 Git에 커밋된 경우

#### 1. 즉시 토큰 무효화

- **Slack**: https://api.slack.com/apps → App 선택 → "Rotate Tokens"
- **Telegram**: BotFather를 통해 토큰 재발급
- **Discord**: Developer Portal에서 토큰 재생성

#### 2. Git에서 민감 정보 제거

**⚠️ 주의**: 이 작업은 Git 히스토리를 재작성하므로 팀원과 협의 필요

```bash
# BFG Repo-Cleaner 사용 (권장)
# https://rtyley.github.io/bfg-repo-cleaner/

# 1. BFG 다운로드
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar

# 2. 백업 생성
git clone --mirror https://github.com/YOUR_ORG/psta.git psta-backup

# 3. 민감 정보 제거
java -jar bfg-1.14.0.jar --replace-text passwords.txt psta.git

# passwords.txt 내용:
# xoxb-7493581335524-9713675983895-AR7UuBiHf3mjrYrlnJSVqvd1
# xapp-1-A09MJJ70Y4C-9729093521810-29293147455eadaabf29932ac688a2f88efdd368a8416bf49dae8df04f41ab1f
# 67903bbcaeb42820fee68f9d9e67424d
# 56ba0f336e777eee46120e6c661d9ddb

# 4. Garbage collection
cd psta.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 5. Force push (팀원 통지 필수!)
git push --force
```

**또는 git filter-branch 사용** (더 안전):

```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch backend/scripts/add-initial-slack-config.ts backend/scripts/update-slack-credentials.ts" \
  --prune-empty --tag-name-filter cat -- --all

git push --force --all
git push --force --tags
```

#### 3. 팀원에게 알림

```bash
# 팀원들에게 전송할 메시지:
⚠️ Git 히스토리가 재작성되었습니다. 다음 명령어를 실행하세요:

git fetch origin
git reset --hard origin/main
git clean -fdx
```

### GitHub Public Repository에 노출된 경우

1. **즉시 토큰 무효화** (가장 중요!)
2. GitHub에 Secret Scanning Alert 확인
3. 필요시 Repository를 Private로 변경
4. Git 히스토리 재작성
5. 보안 감사 실시

---

## Pre-commit Hook 설치

PSTA는 커밋 전 자동으로 민감 정보를 검사하는 Hook을 제공합니다.

### 설치 방법

```bash
cd /app/psta

# Hook 스크립트 생성
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

echo "🔍 Running security checks..."

# 민감 정보 패턴 검색
PATTERNS=(
  "xoxb-[0-9]+"
  "xapp-[0-9]+"
  "xoxp-[0-9]+"
  "password\s*=\s*['\"](?!.*CHANGE.*)[^'\"]{8,}"
  "secret\s*=\s*['\"][^'\"]{16,}"
  "token\s*=\s*['\"][^'\"]{16,}"
)

for pattern in "${PATTERNS[@]}"; do
  if git diff --cached | grep -E "$pattern" > /dev/null; then
    echo "❌ ERROR: Sensitive information detected!"
    echo "Pattern: $pattern"
    echo ""
    echo "Please remove sensitive data before committing."
    echo "Use environment variables or web UI configuration instead."
    exit 1
  fi
done

echo "✓ Security checks passed"
exit 0
EOF

# 실행 권한 부여
chmod +x .git/hooks/pre-commit

echo "✓ Pre-commit hook installed successfully"
```

---

## 보안 체크리스트

### 개발 시

- [ ] 민감 정보는 환경변수 또는 데이터베이스에 저장
- [ ] 하드코딩된 토큰/비밀번호 없음
- [ ] .env 파일이 .gitignore에 포함됨
- [ ] Pre-commit hook 설치됨
- [ ] 코드 리뷰 시 보안 검토

### 배포 시

- [ ] .env 파일 권한 600으로 설정
- [ ] JWT_SECRET 변경됨
- [ ] 데이터베이스 비밀번호 변경됨
- [ ] PostgreSQL 원격 접속 제한
- [ ] 방화벽 설정 완료
- [ ] HTTPS 사용 (프로덕션)
- [ ] 정기 백업 설정

### 운영 시

- [ ] 토큰 정기 로테이션 (3-6개월)
- [ ] 보안 업데이트 적용
- [ ] 로그 모니터링
- [ ] 접근 권한 정기 검토
- [ ] 사용하지 않는 계정 삭제

---

## 추가 리소스

- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **GitHub Security Best Practices**: https://docs.github.com/en/code-security
- **Slack Token Security**: https://api.slack.com/authentication/rotation
- **PostgreSQL Security**: https://www.postgresql.org/docs/current/auth-pg-hba-conf.html

---

## 지원 및 문의

보안 취약점을 발견한 경우:
- **GitHub Security Advisory**: https://github.com/GUNIQ-G/psta/security/advisories
- **이메일**: security@your-domain.com (설정 필요)

**절대로 공개 Issue에 보안 취약점을 게시하지 마세요!**

---

**최종 업데이트**: 2025-10-28
**버전**: v1.1.2
