import ldapjs from 'ldapjs';

const client = ldapjs.createClient({ url: 'ldap://10.90.200.201:389' });

client.bind('cn=admin,dc=ldap,dc=dztechwill,dc=com', 'literal:[REDACTED]', (err) => {
  if (err) { console.log('Bind error:', err.message); process.exit(1); }

  console.log('=== 1. LDAP 조직(ou=organization) 구조 ===\n');

  client.search('ou=organization,dc=ldap,dc=dztechwill,dc=com', {
    filter: '(objectClass=organizationalUnit)',
    scope: 'sub',
    attributes: ['ou', 'description', 'departmentNumber', 'dn']
  }, (err, res) => {
    if (err) { console.log('Error:', err.message); return; }

    const orgs: any[] = [];
    res.on('searchEntry', (entry) => {
      const ou = entry.pojo.attributes.find((a: any) => a.type === 'ou')?.values[0];
      const desc = entry.pojo.attributes.find((a: any) => a.type === 'description')?.values[0];
      const deptNum = entry.pojo.attributes.find((a: any) => a.type === 'departmentNumber')?.values[0];
      const dn = entry.objectName?.toString();
      orgs.push({ ou, desc, deptNum, dn });
    });

    res.on('end', () => {
      console.log('조직 수:', orgs.length);
      orgs.forEach(o => {
        console.log('- ' + o.ou);
        console.log('  DN: ' + o.dn);
        console.log('  departmentNumber: ' + (o.deptNum || '없음'));
        console.log('');
      });

      // Now check users
      console.log('\n=== 2. 사용자 departmentNumber 샘플 ===\n');
      client.search('dc=ldap,dc=dztechwill,dc=com', {
        filter: '(objectClass=inetOrgPerson)',
        scope: 'sub',
        attributes: ['uid', 'cn', 'departmentNumber', 'ou'],
        sizeLimit: 10
      }, (err, res2) => {
        if (err) { console.log('Error:', err.message); return; }

        const users: any[] = [];
        res2.on('searchEntry', (entry) => {
          const uid = entry.pojo.attributes.find((a: any) => a.type === 'uid')?.values[0];
          const cn = entry.pojo.attributes.find((a: any) => a.type === 'cn')?.values[0];
          const deptNum = entry.pojo.attributes.find((a: any) => a.type === 'departmentNumber')?.values[0];
          const ou = entry.pojo.attributes.find((a: any) => a.type === 'ou')?.values[0];
          users.push({ uid, cn, deptNum, ou });
        });

        res2.on('end', () => {
          users.forEach(u => {
            console.log('- ' + u.uid + ' (' + u.cn + ')');
            console.log('  departmentNumber: ' + (u.deptNum || '없음'));
            console.log('  ou: ' + (u.ou || '없음'));
            console.log('');
          });
          client.unbind();
          process.exit(0);
        });
      });
    });
  });
});
