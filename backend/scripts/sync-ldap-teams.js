// Script to sync LDAP groups to PSTA Teams
const ldap = require('ldapjs');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
const ALGORITHM = 'aes-256-cbc';

function decrypt(encryptedText) {
  const [ivHex, encrypted] = encryptedText.split(':');
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function syncLdapTeams() {
  try {
    console.log('\n=== Syncing LDAP Groups to PSTA Teams ===\n');

    const dbConfig = await prisma.ldapConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!dbConfig) {
      console.log('❌ No active LDAP config found');
      return;
    }

    const url = `ldap://${dbConfig.host}:${dbConfig.port}`;
    const config = {
      url,
      bindDn: dbConfig.bindDn,
      bindPassword: decrypt(dbConfig.bindPassword),
      searchBase: dbConfig.searchBase,
    };

    const client = ldap.createClient({ url: config.url });

    client.bind(config.bindDn, config.bindPassword, async (bindErr) => {
      if (bindErr) {
        console.error('❌ Bind error:', bindErr.message);
        client.unbind();
        await prisma.$disconnect();
        return;
      }

      console.log('✓ LDAP bind successful\n');

      const groupOpts = {
        filter: '(objectClass=groupOfNames)',
        scope: 'sub',
      };

      const ldapGroups = [];

      client.search(config.searchBase, groupOpts, (searchErr, searchRes) => {
        if (searchErr) {
          console.error('❌ Search error:', searchErr.message);
          client.unbind();
          prisma.$disconnect();
          return;
        }

        searchRes.on('searchEntry', (entry) => {
          const dn = entry.objectName.toString();
          const cn = entry.attributes.find(attr => attr.type === 'cn')?.values[0];
          const members = entry.attributes.find(attr => attr.type === 'member')?.values || [];

          ldapGroups.push({
            dn,
            name: cn,
            members,
          });
        });

        searchRes.on('error', (err) => {
          console.error('❌ Search error:', err.message);
        });

        searchRes.on('end', async () => {
          console.log(`✓ Found ${ldapGroups.length} LDAP groups\n`);

          // Create/update teams in PSTA
          for (const group of ldapGroups) {
            try {
              const { randomUUID } = require('crypto');

              // Check if team already exists
              const existingTeam = await prisma.team.findFirst({
                where: { ldapDn: group.dn }
              });

              let team;
              if (existingTeam) {
                team = await prisma.team.update({
                  where: { id: existingTeam.id },
                  data: {
                    name: group.name,
                    updatedAt: new Date(),
                  }
                });
                console.log(`✓ Updated team: ${team.name} (${group.members.length} members)`);
              } else {
                team = await prisma.team.create({
                  data: {
                    id: randomUUID(),
                    name: group.name,
                    ldapDn: group.dn,
                    description: `LDAP 그룹: ${group.name}`,
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  }
                });
                console.log(`✓ Created team: ${team.name} (${group.members.length} members)`);
              }

            } catch (error) {
              console.error(`❌ Error creating/updating team ${group.name}:`, error.message);
            }
          }

          console.log('\n=== Sync Complete ===\n');
          console.log('Summary:');
          const teams = await prisma.team.findMany({
            where: { ldapDn: { not: null } }
          });
          teams.forEach(team => {
            console.log(`  - ${team.name}`);
          });

          client.unbind();
          await prisma.$disconnect();
        });
      });
    });
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
  }
}

syncLdapTeams();
