import { LdapService } from '../src/config/ldap';

const ldapService = new LdapService();

async function testLdapGroups() {
  try {
    console.log('Fetching Groups from LDAP...\n');
    const groups = await ldapService.getGroups();

    console.log('Total Groups found:', groups.length);
    console.log('');

    groups.forEach((group: any, index: number) => {
      console.log(`${index + 1}. Group: ${group.name}`);
      console.log(`   DN: ${group.dn}`);
      console.log(`   Description: ${group.description || '(없음)'}`);
      console.log(`   Members: ${group.members?.length || 0}`);
      console.log('');
    });
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

testLdapGroups();
