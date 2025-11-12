import { PrismaClient } from '@prisma/client';
import { LdapService } from '../src/config/ldap';

const prisma = new PrismaClient();
const ldapService = new LdapService();

interface SyncReport {
  ldapGroups: any[];
  ldapUsers: any[];
  pstaTeams: any[];
  pstaUsers: any[];
  missingTeams: any[];
  extraTeams: any[];
  missingUsers: any[];
  extraUsers: any[];
  teamMembershipMismatches: any[];
}

async function checkLdapSync(): Promise<SyncReport> {
  console.log('🔍 Starting LDAP-PSTA sync check...\n');

  // 1. Fetch LDAP Groups (Teams)
  console.log('📡 Fetching LDAP groups...');
  const ldapGroups = await ldapService.getGroups();
  console.log(`✅ Found ${ldapGroups.length} LDAP groups\n`);

  // 2. Fetch LDAP Users
  console.log('📡 Fetching LDAP users...');
  const ldapUsers = await ldapService.getAllUsers();
  console.log(`✅ Found ${ldapUsers.length} LDAP users\n`);

  // 3. Fetch PSTA Teams
  console.log('🗄️  Fetching PSTA teams...');
  const pstaTeams = await prisma.team.findMany({
    include: {
      User: {
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
        },
      },
    },
  });
  console.log(`✅ Found ${pstaTeams.length} PSTA teams\n`);

  // 4. Fetch PSTA Users
  console.log('🗄️  Fetching PSTA users...');
  const pstaUsers = await prisma.user.findMany({
    include: {
      Team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
  console.log(`✅ Found ${pstaUsers.length} PSTA users\n`);

  // 5. Compare Teams
  console.log('🔄 Comparing teams/groups...');
  const ldapGroupNames = ldapGroups.map(g => g.name).filter(Boolean);
  const pstaTeamNames = pstaTeams.map(t => t.name);

  const missingTeams = ldapGroupNames.filter(name => !pstaTeamNames.includes(name));
  const extraTeams = pstaTeamNames.filter(name => !ldapGroupNames.includes(name));

  console.log(`  - LDAP groups not in PSTA: ${missingTeams.length}`);
  console.log(`  - PSTA teams not in LDAP: ${extraTeams.length}\n`);

  // 6. Compare Users
  console.log('🔄 Comparing users...');
  const ldapUsernames = ldapUsers.map(u => u.uid).filter(Boolean);
  const pstaUsernames = pstaUsers.map(u => u.username);

  const missingUsers = ldapUsernames.filter(username => !pstaUsernames.includes(username));
  const extraUsers = pstaUsernames.filter(username => !ldapUsernames.includes(username));

  console.log(`  - LDAP users not in PSTA: ${missingUsers.length}`);
  console.log(`  - PSTA users not in LDAP: ${extraUsers.length}\n`);

  // 7. Check Team Membership Mismatches
  console.log('🔄 Checking team membership mismatches...');
  const teamMembershipMismatches: any[] = [];

  for (const ldapGroup of ldapGroups) {
    const groupName = ldapGroup.name;
    if (!groupName) continue;

    const pstaTeam = pstaTeams.find(t => t.name === groupName);
    if (!pstaTeam) continue;

    // Get LDAP group member usernames
    const ldapMemberDns = ldapGroup.members || [];
    const ldapMemberUsernames: string[] = [];

    for (const memberDn of ldapMemberDns) {
      // Extract uid from DN (e.g., "uid=user1,ou=users,dc=example,dc=com" -> "user1")
      const ldapUser = ldapUsers.find(u => u.dn === memberDn);
      if (ldapUser && ldapUser.uid) {
        ldapMemberUsernames.push(ldapUser.uid);
      }
    }

    // Get PSTA team member usernames
    const pstaMemberUsernames = pstaTeam.User.map((m: any) => m.username);

    // Find mismatches
    const inLdapNotPsta = ldapMemberUsernames.filter(u => !pstaMemberUsernames.includes(u));
    const inPstaNotLdap = pstaMemberUsernames.filter(u => !ldapMemberUsernames.includes(u));

    if (inLdapNotPsta.length > 0 || inPstaNotLdap.length > 0) {
      teamMembershipMismatches.push({
        teamName: groupName,
        teamId: pstaTeam.id,
        inLdapNotPsta,
        inPstaNotLdap,
      });
    }
  }

  console.log(`  - Teams with membership mismatches: ${teamMembershipMismatches.length}\n`);

  return {
    ldapGroups,
    ldapUsers,
    pstaTeams,
    pstaUsers,
    missingTeams: missingTeams.map(name => {
      const group = ldapGroups.find(g => g.name === name);
      return {
        name,
        dn: group?.dn,
        description: group?.description,
        memberCount: (group?.members as any)?.length || 0,
      };
    }),
    extraTeams: extraTeams.map(name => {
      const team = pstaTeams.find(t => t.name === name);
      return {
        name,
        id: team?.id,
        description: team?.description,
        memberCount: team?.User?.length || 0,
      };
    }),
    missingUsers: missingUsers.map(username => {
      const user = ldapUsers.find(u => u.uid === username);
      return {
        username,
        dn: user?.dn,
        displayName: user?.displayName || user?.cn,
        email: user?.mail,
      };
    }),
    extraUsers: extraUsers.map(username => {
      const user = pstaUsers.find(u => u.username === username);
      return {
        username,
        id: user?.id,
        displayName: user?.displayName,
        email: user?.email,
        teamName: user?.Team?.name || 'No team',
      };
    }),
    teamMembershipMismatches,
  };
}

async function printReport(report: SyncReport) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 LDAP-PSTA SYNC REPORT');
  console.log('='.repeat(80) + '\n');

  // Summary
  console.log('📋 SUMMARY');
  console.log('─'.repeat(80));
  console.log(`LDAP Groups:  ${report.ldapGroups.length}`);
  console.log(`PSTA Teams:   ${report.pstaTeams.length}`);
  console.log(`LDAP Users:   ${report.ldapUsers.length}`);
  console.log(`PSTA Users:   ${report.pstaUsers.length}`);
  console.log('');

  // Missing Teams (in LDAP but not in PSTA)
  if (report.missingTeams.length > 0) {
    console.log('❌ TEAMS IN LDAP BUT NOT IN PSTA (' + report.missingTeams.length + ')');
    console.log('─'.repeat(80));
    report.missingTeams.forEach((team, idx) => {
      console.log(`${idx + 1}. ${team.name}`);
      console.log(`   DN: ${team.dn}`);
      console.log(`   Description: ${team.description || 'N/A'}`);
      console.log(`   Members: ${team.memberCount}`);
      console.log('');
    });
  } else {
    console.log('✅ All LDAP groups exist in PSTA\n');
  }

  // Extra Teams (in PSTA but not in LDAP)
  if (report.extraTeams.length > 0) {
    console.log('⚠️  TEAMS IN PSTA BUT NOT IN LDAP (' + report.extraTeams.length + ')');
    console.log('─'.repeat(80));
    report.extraTeams.forEach((team, idx) => {
      console.log(`${idx + 1}. ${team.name}`);
      console.log(`   ID: ${team.id}`);
      console.log(`   Description: ${team.description || 'N/A'}`);
      console.log(`   Members: ${team.memberCount}`);
      console.log('');
    });
  } else {
    console.log('✅ All PSTA teams exist in LDAP\n');
  }

  // Missing Users (in LDAP but not in PSTA)
  if (report.missingUsers.length > 0) {
    console.log('❌ USERS IN LDAP BUT NOT IN PSTA (' + report.missingUsers.length + ')');
    console.log('─'.repeat(80));
    report.missingUsers.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.username}`);
      console.log(`   DN: ${user.dn}`);
      console.log(`   Display Name: ${user.displayName || 'N/A'}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log('');
    });
  } else {
    console.log('✅ All LDAP users exist in PSTA\n');
  }

  // Extra Users (in PSTA but not in LDAP)
  if (report.extraUsers.length > 0) {
    console.log('⚠️  USERS IN PSTA BUT NOT IN LDAP (' + report.extraUsers.length + ')');
    console.log('─'.repeat(80));
    report.extraUsers.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.username}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Display Name: ${user.displayName || 'N/A'}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   Team: ${user.teamName}`);
      console.log('');
    });
  } else {
    console.log('✅ All PSTA users exist in LDAP\n');
  }

  // Team Membership Mismatches
  if (report.teamMembershipMismatches.length > 0) {
    console.log('⚠️  TEAM MEMBERSHIP MISMATCHES (' + report.teamMembershipMismatches.length + ')');
    console.log('─'.repeat(80));
    report.teamMembershipMismatches.forEach((mismatch, idx) => {
      console.log(`${idx + 1}. Team: ${mismatch.teamName} (ID: ${mismatch.teamId})`);

      if (mismatch.inLdapNotPsta.length > 0) {
        console.log(`   ❌ In LDAP but not in PSTA (${mismatch.inLdapNotPsta.length}):`);
        mismatch.inLdapNotPsta.forEach((username: string) => {
          console.log(`      - ${username}`);
        });
      }

      if (mismatch.inPstaNotLdap.length > 0) {
        console.log(`   ⚠️  In PSTA but not in LDAP (${mismatch.inPstaNotLdap.length}):`);
        mismatch.inPstaNotLdap.forEach((username: string) => {
          console.log(`      - ${username}`);
        });
      }

      console.log('');
    });
  } else {
    console.log('✅ All team memberships are in sync\n');
  }

  console.log('='.repeat(80));
  console.log('✅ SYNC CHECK COMPLETE');
  console.log('='.repeat(80) + '\n');

  // Overall Status
  const hasIssues =
    report.missingTeams.length > 0 ||
    report.extraTeams.length > 0 ||
    report.missingUsers.length > 0 ||
    report.extraUsers.length > 0 ||
    report.teamMembershipMismatches.length > 0;

  if (hasIssues) {
    console.log('⚠️  ACTION REQUIRED: Sync issues detected');
    console.log('');
    console.log('Recommendations:');
    if (report.missingTeams.length > 0) {
      console.log('  1. Create missing teams in PSTA or remove groups from LDAP');
    }
    if (report.missingUsers.length > 0) {
      console.log('  2. Users in LDAP need to log in to PSTA for the first time');
    }
    if (report.extraUsers.length > 0) {
      console.log('  3. Remove inactive users from PSTA or add them back to LDAP');
    }
    if (report.teamMembershipMismatches.length > 0) {
      console.log('  4. Update team memberships in LDAP or PSTA to match');
    }
  } else {
    console.log('✅ PERFECT SYNC: No issues detected!');
  }

  console.log('');
}

async function main() {
  try {
    const report = await checkLdapSync();
    await printReport(report);
  } catch (error: any) {
    console.error('❌ Error checking LDAP sync:', error.message);
    console.error('\nDetails:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    ldapService.disconnect();
  }
}

main();
