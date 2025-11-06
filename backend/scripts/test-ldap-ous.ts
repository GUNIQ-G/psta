import { LdapService } from '../src/config/ldap';

const ldapService = new LdapService();

async function testLdapOus() {
  try {
    console.log('Fetching OUs from LDAP...\n');
    const ous = await ldapService.getAllOrganizationalUnits();

    console.log('Total OUs found:', ous.length);
    console.log('');

    ous.forEach((ou: any, index: number) => {
      console.log(`${index + 1}. OU: ${ou.name}`);
      console.log(`   DN: ${ou.dn}`);
      console.log(`   Description: ${ou.description || '(없음)'}`);
      console.log('');
    });
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

testLdapOus();
