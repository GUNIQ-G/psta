import { PrismaClient, OrgType } from '@prisma/client';
import { LdapService } from '../src/config/ldap';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const ldapService = new LdapService();

function getOrgTypeFromDnDepth(dn: string, baseDn: string): OrgType {
  const relativeDn = dn.replace(`,${baseDn}`, '');
  const depth = relativeDn.split(',').length;

  if (depth === 1) return OrgType.COMPANY;
  if (depth === 2) return OrgType.DIVISION;
  if (depth === 3) return OrgType.DEPARTMENT;
  return OrgType.TEAM;
}

async function syncFromLdap() {
  try {
    const ldapConfig = await prisma.ldapConfig.findFirst({
      where: { isActive: true },
    });

    if (!ldapConfig) {
      console.error('LDAP is not configured');
      return;
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    // 1. Get and process OUs from LDAP
    const ldapOus = await ldapService.getAllOrganizationalUnits();
    console.log(`Found ${ldapOus.length} OUs in LDAP\n`);

    for (const ou of ldapOus) {
      if (!ou.name || !ou.dn) {
        skipped++;
        continue;
      }

      const existing = await prisma.organization.findFirst({
        where: { ldapDn: ou.dn },
      });

      if (existing) {
        if (existing.description !== ou.description) {
          await prisma.organization.update({
            where: { id: existing.id },
            data: {
              description: ou.description,
              updatedAt: new Date(),
            },
          });
          updated++;
          console.log(`✓ Updated OU: ${ou.name}`);
        } else {
          skipped++;
        }
      } else {
        const dnParts = ou.dn.split(',');
        const parentDnParts = dnParts.slice(1);
        const parentDn = parentDnParts.join(',');

        let parentId: string | null = null;
        if (parentDn !== ldapConfig.searchBase) {
          const parentOrg = await prisma.organization.findFirst({
            where: { ldapDn: parentDn },
          });
          parentId = parentOrg?.id || null;
        }

        const orgType = getOrgTypeFromDnDepth(ou.dn, ldapConfig.searchBase);

        await prisma.organization.create({
          data: {
            id: randomUUID(),
            name: ou.name,
            type: orgType,
            description: ou.description,
            parentId,
            ldapDn: ou.dn,
            updatedAt: new Date(),
          },
        });
        created++;
        console.log(`✓ Created OU: ${ou.name} (${orgType})`);
      }
    }

    // 2. Get and process Groups from LDAP
    const ldapGroups = await ldapService.getGroups();
    console.log(`\nFound ${ldapGroups.length} Groups in LDAP\n`);

    for (const group of ldapGroups) {
      if (!group.name || !group.dn) {
        skipped++;
        continue;
      }

      console.log(`\nProcessing group: ${group.name}`);
      console.log(`  DN: ${group.dn}`);
      console.log(`  Description: ${group.description || '(none)'}`);

      const existing = await prisma.organization.findFirst({
        where: { ldapDn: group.dn },
      });

      console.log(`  Existing in DB: ${existing ? 'YES (id=' + existing.id + ')' : 'NO'}`);

      if (existing) {
        console.log(`  Existing description: ${existing.description || '(none)'}`);
        console.log(`  Group description: ${group.description || '(none)'}`);
        console.log(`  Descriptions match: ${existing.description === group.description}`);

        if (existing.description !== group.description) {
          await prisma.organization.update({
            where: { id: existing.id },
            data: {
              description: group.description,
              updatedAt: new Date(),
            },
          });
          updated++;
          console.log(`✓ Updated Group: ${group.name}`);
        } else {
          skipped++;
          console.log(`- Skipped Group: ${group.name} (no changes)`);
        }
      } else {
        const newOrg = await prisma.organization.create({
          data: {
            id: randomUUID(),
            name: group.name,
            type: OrgType.TEAM,
            description: group.description,
            parentId: null,
            ldapDn: group.dn,
            updatedAt: new Date(),
          },
        });
        created++;
        console.log(`✓ Created Group: ${group.name} (TEAM) with ID: ${newOrg.id}`);
      }
    }

    const totalItems = ldapOus.length + ldapGroups.length;

    console.log('\n=================================');
    console.log('LDAP Sync Completed!');
    console.log('=================================');
    console.log(`Total items: ${totalItems}`);
    console.log(`Created: ${created}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);

    await prisma.$disconnect();
  } catch (error: any) {
    console.error('Error syncing from LDAP:', error.message);
    await prisma.$disconnect();
  }
}

syncFromLdap();
