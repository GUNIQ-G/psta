/**
 * v1.1.19: Update existing Team data with departmentNumber from LDAP
 * This script syncs departmentNumber from LDAP organizational units to PSTA Team table.
 */

import { PrismaClient } from '@prisma/client';
import { LdapService } from '../config/ldap';

const prisma = new PrismaClient();
const ldapService = new LdapService();

async function updateTeamDepartmentNumbers() {
  console.log('=== Team departmentNumber 업데이트 시작 ===\n');

  try {
    // 1. Get all LDAP organizational units with departmentNumber
    const ldapOUs = await ldapService.getAllOrganizationalUnits();
    console.log('LDAP 조직 수:', ldapOUs.length);

    // Build departmentNumber map: name -> departmentNumber
    const deptNumMap = new Map<string, string>();
    for (const ou of ldapOUs) {
      if (ou.name && ou.departmentNumber) {
        deptNumMap.set(ou.name, ou.departmentNumber);
        console.log(`  - ${ou.name}: ${ou.departmentNumber}`);
      }
    }

    console.log('\n');

    // 2. Get all PSTA teams
    const pstaTeams = await prisma.team.findMany();
    console.log('PSTA 팀 수:', pstaTeams.length);

    // 3. Update each team with matching departmentNumber
    let updated = 0;
    let skipped = 0;
    const notFound: string[] = [];

    for (const team of pstaTeams) {
      const deptNum = deptNumMap.get(team.name);

      if (deptNum) {
        if (team.departmentNumber !== deptNum) {
          await prisma.team.update({
            where: { id: team.id },
            data: {
              departmentNumber: deptNum,
              updatedAt: new Date(),
            },
          });
          console.log(`  업데이트: ${team.name} -> ${deptNum}`);
          updated++;
        } else {
          console.log(`  이미 설정됨: ${team.name} = ${deptNum}`);
          skipped++;
        }
      } else {
        notFound.push(team.name);
        skipped++;
      }
    }

    console.log('\n=== 결과 ===');
    console.log('업데이트:', updated);
    console.log('건너뜀:', skipped);
    if (notFound.length > 0) {
      console.log('LDAP에 없는 팀:', notFound.join(', '));
    }

    // 4. Verify
    const teamsWithDeptNum = await prisma.team.count({
      where: { departmentNumber: { not: null } },
    });
    console.log('\n최종 departmentNumber 설정된 팀 수:', teamsWithDeptNum);

  } catch (error: any) {
    console.error('오류:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

updateTeamDepartmentNumbers().then(() => {
  console.log('\n=== 완료 ===');
});
