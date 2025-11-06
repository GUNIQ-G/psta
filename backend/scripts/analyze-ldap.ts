import { LdapService } from '../src/config/ldap';

const ldapService = new LdapService();

async function analyzeLdapData() {
  try {
    console.log('===========================================');
    console.log('   LDAP 인사 데이터 분석 보고서');
    console.log('===========================================\n');

    // 1. 사용자 데이터 분석
    const users = await ldapService.getAllUsers();
    console.log('📊 1. 사용자 현황');
    console.log('-------------------------------------------');
    console.log(`전체 사용자 수: ${users.length}명\n`);

    // 사용자 상세 정보 분석
    let usersWithEmail = 0;
    let usersWithPhone = 0;
    let usersWithTitle = 0;
    let usersWithDept = 0;
    let usersWithDisplayName = 0;

    console.log('사용자 목록:\n');
    users.forEach((user: any, index: number) => {
      console.log(`  ${index + 1}. ${user.cn || user.uid}`);
      console.log(`     - UID: ${user.uid}`);
      console.log(`     - 이메일: ${user.mail || '(없음)'}`);
      console.log(`     - 전화번호: ${user.telephoneNumber || '(없음)'}`);
      console.log(`     - 직책: ${user.title || '(없음)'}`);
      console.log(`     - 부서: ${user.departmentNumber || '(없음)'}`);
      console.log(`     - 표시명: ${user.displayName || '(없음)'}`);
      console.log('');

      if (user.mail) usersWithEmail++;
      if (user.telephoneNumber) usersWithPhone++;
      if (user.title) usersWithTitle++;
      if (user.departmentNumber) usersWithDept++;
      if (user.displayName) usersWithDisplayName++;
    });

    // 2. 그룹 데이터 분석
    const groups = await ldapService.getGroups();
    console.log('\n📊 2. 그룹(조직) 현황');
    console.log('-------------------------------------------');
    console.log(`전체 그룹 수: ${groups.length}개\n`);

    console.log('그룹 목록:\n');
    groups.forEach((group: any, index: number) => {
      console.log(`  ${index + 1}. ${group.name}`);
      console.log(`     - 멤버 수: ${group.members?.length || 0}명`);
      console.log(`     - 설명: ${group.description || '(없음)'}`);
      if (group.members && group.members.length > 0) {
        console.log(`     - 멤버 목록:`);
        group.members.forEach((memberDn: string) => {
          const uidMatch = memberDn.match(/uid=([^,]+)/);
          const uid = uidMatch ? uidMatch[1] : memberDn;
          console.log(`       * ${uid}`);
        });
      }
      console.log('');
    });

    // 3. 데이터 품질 분석
    console.log('\n📊 3. 데이터 품질 분석');
    console.log('-------------------------------------------');
    console.log(`이메일 입력률: ${usersWithEmail}/${users.length} (${(usersWithEmail/users.length*100).toFixed(1)}%)`);
    console.log(`전화번호 입력률: ${usersWithPhone}/${users.length} (${(usersWithPhone/users.length*100).toFixed(1)}%)`);
    console.log(`직책 입력률: ${usersWithTitle}/${users.length} (${(usersWithTitle/users.length*100).toFixed(1)}%)`);
    console.log(`부서 입력률: ${usersWithDept}/${users.length} (${(usersWithDept/users.length*100).toFixed(1)}%)`);
    console.log(`표시명 입력률: ${usersWithDisplayName}/${users.length} (${(usersWithDisplayName/users.length*100).toFixed(1)}%)`);

    // 4. 조직 구조 분석
    console.log('\n\n📊 4. 조직 구조 분석');
    console.log('-------------------------------------------');

    // 그룹별 멤버 분포
    const groupMemberCounts = groups.map((g: any) => ({
      name: g.name,
      count: g.members?.length || 0
    })).sort((a, b) => b.count - a.count);

    console.log('그룹별 인원 분포:\n');
    groupMemberCounts.forEach(g => {
      const bar = '█'.repeat(Math.max(1, Math.floor(g.count / 1)));
      console.log(`  ${g.name.padEnd(20)} : ${g.count}명 ${bar}`);
    });

    // 5. 종합 평가
    console.log('\n\n===========================================');
    console.log('   📋 종합 평가');
    console.log('===========================================\n');

    const issues: string[] = [];
    const strengths: string[] = [];

    // 강점 평가
    if (groups.length >= 3) {
      strengths.push('✅ 조직이 세분화되어 있습니다 (그룹 ' + groups.length + '개)');
    }

    if (usersWithEmail / users.length >= 0.8) {
      strengths.push('✅ 대부분의 사용자가 이메일 정보를 가지고 있습니다');
    }

    if (usersWithPhone / users.length >= 0.8) {
      strengths.push('✅ 대부분의 사용자가 전화번호 정보를 가지고 있습니다');
    }

    if (usersWithDisplayName / users.length >= 0.8) {
      strengths.push('✅ 대부분의 사용자가 표시명을 가지고 있습니다');
    }

    // 문제점 평가
    if (usersWithEmail / users.length < 0.5) {
      issues.push('⚠️  이메일 정보가 부족합니다 (' + (usersWithEmail/users.length*100).toFixed(1) + '%)');
    }

    if (usersWithPhone / users.length < 0.5) {
      issues.push('⚠️  전화번호 정보가 부족합니다 (' + (usersWithPhone/users.length*100).toFixed(1) + '%)');
    }

    if (usersWithTitle / users.length < 0.3) {
      issues.push('⚠️  직책 정보가 매우 부족합니다 (' + (usersWithTitle/users.length*100).toFixed(1) + '%)');
    }

    if (usersWithDept / users.length < 0.3) {
      issues.push('⚠️  부서 정보가 매우 부족합니다 (' + (usersWithDept/users.length*100).toFixed(1) + '%)');
    }

    if (usersWithDisplayName / users.length < 0.5) {
      issues.push('⚠️  표시명 정보가 부족합니다 (' + (usersWithDisplayName/users.length*100).toFixed(1) + '%)');
    }

    if (groups.some((g: any) => !g.description)) {
      issues.push('⚠️  일부 그룹에 설명이 없습니다');
    }

    const emptyGroups = groups.filter((g: any) => !g.members || g.members.length === 0);
    if (emptyGroups.length > 0) {
      issues.push('⚠️  멤버가 없는 그룹이 ' + emptyGroups.length + '개 있습니다');
    }

    // 그룹 계층 구조 확인
    const hasHierarchy = groups.some((g: any) =>
      g.name.includes('본부') && groups.some((g2: any) => g2.name.includes('팀'))
    );

    if (!hasHierarchy) {
      issues.push('⚠️  조직 계층 구조가 명확하지 않습니다');
    } else {
      strengths.push('✅ 본부 > 팀 형태의 계층 구조가 있습니다');
    }

    // 중복 사용자 확인
    const uidSet = new Set();
    const duplicateUids: string[] = [];
    users.forEach((u: any) => {
      if (uidSet.has(u.uid)) {
        duplicateUids.push(u.uid);
      }
      uidSet.add(u.uid);
    });

    if (duplicateUids.length > 0) {
      issues.push('⚠️  중복된 UID가 있습니다: ' + duplicateUids.join(', '));
    }

    console.log('강점:\n');
    if (strengths.length > 0) {
      strengths.forEach(s => console.log('  ' + s));
    } else {
      console.log('  (없음)');
    }

    console.log('\n개선이 필요한 부분:\n');
    if (issues.length > 0) {
      issues.forEach(i => console.log('  ' + i));
    } else {
      console.log('  (없음)');
    }

    // 최종 점수
    const totalScore = 100;
    let deductions = 0;

    if (usersWithEmail / users.length < 0.5) deductions += 15;
    else if (usersWithEmail / users.length < 0.8) deductions += 5;

    if (usersWithPhone / users.length < 0.5) deductions += 15;
    else if (usersWithPhone / users.length < 0.8) deductions += 5;

    if (usersWithTitle / users.length < 0.3) deductions += 20;
    else if (usersWithTitle / users.length < 0.7) deductions += 10;

    if (usersWithDept / users.length < 0.3) deductions += 20;
    else if (usersWithDept / users.length < 0.7) deductions += 10;

    if (usersWithDisplayName / users.length < 0.5) deductions += 10;
    else if (usersWithDisplayName / users.length < 0.8) deductions += 5;

    if (emptyGroups.length > 0) deductions += 10;
    if (!hasHierarchy) deductions += 10;
    if (duplicateUids.length > 0) deductions += 15;

    const finalScore = Math.max(0, totalScore - deductions);

    console.log('\n-------------------------------------------');
    console.log(`종합 점수: ${finalScore}/100점\n`);

    if (finalScore >= 80) {
      console.log('평가: ⭐⭐⭐⭐⭐ 우수');
      console.log('인사 관리가 체계적으로 잘 되고 있습니다.');
    } else if (finalScore >= 60) {
      console.log('평가: ⭐⭐⭐ 보통');
      console.log('기본적인 인사 관리는 되고 있으나 개선이 필요합니다.');
    } else if (finalScore >= 40) {
      console.log('평가: ⭐⭐ 미흡');
      console.log('많은 부분에서 개선이 필요합니다.');
    } else {
      console.log('평가: ⭐ 불량');
      console.log('인사 데이터 정비가 시급합니다.');
    }

    console.log('\n===========================================\n');

    // 개선 제안
    if (issues.length > 0) {
      console.log('💡 개선 제안:\n');

      if (usersWithEmail / users.length < 0.8) {
        console.log('  1. 모든 사용자의 이메일 주소를 입력하세요');
      }

      if (usersWithPhone / users.length < 0.8) {
        console.log('  2. 모든 사용자의 전화번호를 입력하세요');
      }

      if (usersWithTitle / users.length < 0.7) {
        console.log('  3. 각 사용자의 직책을 명확히 입력하세요 (예: 팀장, 대리, 사원 등)');
      }

      if (usersWithDept / users.length < 0.7) {
        console.log('  4. 모든 사용자를 적절한 부서에 배정하세요');
      }

      if (emptyGroups.length > 0) {
        console.log('  5. 멤버가 없는 그룹은 삭제하거나 멤버를 추가하세요');
      }

      if (groups.every((g: any) => !g.description)) {
        console.log('  6. 각 그룹의 역할과 책임을 설명란에 작성하세요');
      }

      console.log('\n===========================================\n');
    }

  } catch (error: any) {
    console.error('분석 실패:', error.message);
    console.error(error);
  }
}

analyzeLdapData();
