import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query, queryOne } from '../config/database';
import { OrgType } from '../types/enums';
import { randomUUID } from 'crypto';
import ldapService from '../config/ldap';
import appLogger, { errorLogger, ldapLogger } from '../config/logger';

// Helper function to determine org type from DN depth
function getOrgTypeFromDnDepth(dn: string, baseDn: string): OrgType {
  const relativeDn = dn.replace(`,${baseDn}`, '');
  const depth = relativeDn.split(',').length;

  if (depth === 1) return OrgType.COMPANY;
  if (depth === 2) return OrgType.DIVISION;
  if (depth === 3) return OrgType.DEPARTMENT;
  return OrgType.TEAM;
}

// Get all organizations (tree structure)
export const getOrganizationTree = async (req: AuthRequest, res: Response) => {
  try {
    // Get all organizations with members and counts
    const orgs = await query<any>(
      `SELECT o.*,
              COUNT(DISTINCT c.id) AS "childrenCount",
              COUNT(DISTINCT u.id) AS "membersCount"
       FROM "Organization" o
       LEFT JOIN "Organization" c ON c."parentId" = o.id
       LEFT JOIN "User" u ON u."organizationId" = o.id
       WHERE o."isActive" = true
       GROUP BY o.id
       ORDER BY o.order ASC, o."createdAt" ASC`
    );

    // Fetch members for each org
    const memberRows = await query<any>(
      `SELECT u.id, u.username, u."displayName", u.email, u.role, u."organizationId"
       FROM "User" u
       WHERE u."organizationId" IS NOT NULL`
    );

    // Build org map with members and counts
    const orgMap: Record<string, any> = {};
    for (const org of orgs) {
      orgMap[org.id] = {
        ...org,
        Members: memberRows.filter((m: any) => m.organizationId === org.id).map((m: any) => ({
          id: m.id,
          username: m.username,
          displayName: m.displayName,
          email: m.email,
          role: m.role,
        })),
        _count: {
          Children: parseInt(org.childrenCount ?? '0'),
          Members: parseInt(org.membersCount ?? '0'),
        },
        children: [],
      };
      delete orgMap[org.id].childrenCount;
      delete orgMap[org.id].membersCount;
    }

    // Build tree structure
    const buildTree = (parentId: string | null): any[] => {
      return orgs
        .filter((org: any) => org.parentId === parentId)
        .map((org: any) => ({
          ...orgMap[org.id],
          children: buildTree(org.id),
        }));
    };

    const tree = buildTree(null);
    res.json(tree);
  } catch (error: any) {
    errorLogger.error('Error fetching organization tree', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get organization by ID
export const getOrganizationById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const org = await queryOne<any>(
      `SELECT * FROM "Organization" WHERE id = $1`,
      [id]
    );

    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [members, parent, children] = await Promise.all([
      query<any>(
        `SELECT id, username, "displayName", email, role, "phoneNumber"
         FROM "User" WHERE "organizationId" = $1`,
        [id]
      ),
      org.parentId
        ? queryOne<any>(`SELECT id, name, type FROM "Organization" WHERE id = $1`, [org.parentId])
        : Promise.resolve(null),
      query<any>(
        `SELECT id, name, type FROM "Organization" WHERE "parentId" = $1`,
        [id]
      ),
    ]);

    res.json({
      ...org,
      Members: members,
      Parent: parent,
      Children: children,
    });
  } catch (error: any) {
    errorLogger.error('Error fetching organization', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create organization
export const createOrganization = async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, description, parentId } = req.body;

    // Validate required fields
    if (!name || !type) {
      return res.status(400).json({
        error: 'Missing required fields: name and type are required'
      });
    }

    // Validate type
    const validTypes = ['COMPANY', 'DIVISION', 'DEPARTMENT', 'TEAM'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Invalid organization type. Must be one of: COMPANY, DIVISION, DEPARTMENT, TEAM'
      });
    }

    // Determine parent DN for LDAP
    let parentDn = '';
    if (parentId) {
      const parent = await queryOne<any>(
        `SELECT * FROM "Organization" WHERE id = $1`,
        [parentId]
      );

      if (!parent) {
        return res.status(404).json({ error: 'Parent organization not found' });
      }

      parentDn = parent.ldapDn || '';
    }

    // If no parent DN, get base DN from LDAP config
    if (!parentDn) {
      const ldapConfig = await queryOne<any>(
        `SELECT * FROM "LdapConfig" WHERE "isActive" = true LIMIT 1`
      );
      if (ldapConfig) {
        parentDn = ldapConfig.searchBase;
      } else {
        return res.status(500).json({ error: 'LDAP is not configured' });
      }
    }

    // Create OU in LDAP first
    let createdLdapDn = '';
    try {
      createdLdapDn = await ldapService.createOrganizationalUnit(name, parentDn, description);
      ldapLogger.info('Created LDAP OU', { dn: createdLdapDn });
    } catch (ldapError: any) {
      ldapLogger.error('LDAP OU creation failed', { error: ldapError });
      return res.status(500).json({
        error: `Failed to create LDAP OU: ${ldapError.message}`
      });
    }

    const orgId = randomUUID();
    const now = new Date();

    // Create organization in database
    await query(
      `INSERT INTO "Organization" (id, name, type, description, "parentId", "ldapDn", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)`,
      [orgId, name, type, description ?? null, parentId ?? null, createdLdapDn, now, now]
    );

    const org = await queryOne<any>(
      `SELECT * FROM "Organization" WHERE id = $1`,
      [orgId]
    );

    const [members, parent] = await Promise.all([
      query<any>(`SELECT * FROM "User" WHERE "organizationId" = $1`, [orgId]),
      parentId
        ? queryOne<any>(`SELECT id, name, type FROM "Organization" WHERE id = $1`, [parentId])
        : Promise.resolve(null),
    ]);

    res.status(201).json({
      ...org,
      Members: members,
      Parent: parent,
    });
  } catch (error: any) {
    errorLogger.error('Error creating organization', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update organization
export const updateOrganization = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, description, parentId, ldapDn, isActive, order } = req.body;

    const existing = await queryOne<any>(
      `SELECT * FROM "Organization" WHERE id = $1`,
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Validate type if provided
    const validTypes = ['COMPANY', 'DIVISION', 'DEPARTMENT', 'TEAM'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Invalid organization type. Must be one of: COMPANY, DIVISION, DEPARTMENT, TEAM'
      });
    }

    // If parentId is being changed, verify parent exists and prevent circular reference
    if (parentId !== undefined && parentId !== existing.parentId) {
      if (parentId) {
        const parent = await queryOne<any>(
          `SELECT * FROM "Organization" WHERE id = $1`,
          [parentId]
        );

        if (!parent) {
          return res.status(404).json({ error: 'Parent organization not found' });
        }

        // Prevent setting parent as self
        if (parentId === id) {
          return res.status(400).json({ error: 'Organization cannot be its own parent' });
        }

        // Check if parentId is a descendant
        const checkDescendant = async (orgId: string): Promise<boolean> => {
          const children = await query<any>(
            `SELECT id FROM "Organization" WHERE "parentId" = $1`,
            [orgId]
          );

          for (const child of children) {
            if (child.id === parentId) {
              return true;
            }
            if (await checkDescendant(child.id)) {
              return true;
            }
          }

          return false;
        };

        if (await checkDescendant(id)) {
          return res.status(400).json({ error: 'Cannot set a descendant as parent' });
        }
      }
    }

    // Update LDAP OU if name, description, or parent changed
    let newLdapDn = existing.ldapDn;
    if (existing.ldapDn) {
      try {
        // If name or parent changed, we need to move/rename the OU
        if (name !== undefined && name !== existing.name) {
          let newParentDn: string;
          if (parentId !== undefined) {
            const parentOrg = await queryOne<any>(
              `SELECT "ldapDn" FROM "Organization" WHERE id = $1`,
              [parentId]
            );
            newParentDn = parentOrg?.ldapDn || '';
          } else {
            newParentDn = existing.ldapDn.substring(existing.ldapDn.indexOf(',') + 1);
          }

          if (newParentDn) {
            newLdapDn = await ldapService.moveOrganizationalUnit(existing.ldapDn, name, newParentDn);
            ldapLogger.info('Moved/Renamed LDAP OU', { from: existing.ldapDn, to: newLdapDn });
          }
        } else if (parentId !== undefined && parentId !== existing.parentId) {
          // Only parent changed
          const newParent = await queryOne<any>(
            `SELECT "ldapDn" FROM "Organization" WHERE id = $1`,
            [parentId]
          );
          if (newParent?.ldapDn) {
            const currentName = existing.name;
            newLdapDn = await ldapService.moveOrganizationalUnit(existing.ldapDn, currentName, newParent.ldapDn);
            ldapLogger.info('Moved LDAP OU', { from: existing.ldapDn, to: newLdapDn });
          }
        }

        // Update description if changed
        if (description !== undefined && description !== existing.description && newLdapDn) {
          await ldapService.updateOrganizationalUnit(newLdapDn, { description });
          ldapLogger.info('Updated LDAP OU description', { dn: newLdapDn });
        }
      } catch (ldapError: any) {
        ldapLogger.error('LDAP OU update failed', { error: ldapError });
        return res.status(500).json({
          error: `Failed to update LDAP OU: ${ldapError.message}`
        });
      }
    }

    // Build SET clauses
    const setClauses: string[] = ['"updatedAt" = $1'];
    const params: any[] = [new Date()];

    if (name !== undefined) { params.push(name); setClauses.push(`name = $${params.length}`); }
    if (type !== undefined) { params.push(type); setClauses.push(`type = $${params.length}`); }
    if (description !== undefined) { params.push(description); setClauses.push(`description = $${params.length}`); }
    if (parentId !== undefined) { params.push(parentId); setClauses.push(`"parentId" = $${params.length}`); }
    if (newLdapDn !== existing.ldapDn) { params.push(newLdapDn); setClauses.push(`"ldapDn" = $${params.length}`); }
    if (isActive !== undefined) { params.push(isActive); setClauses.push(`"isActive" = $${params.length}`); }
    if (order !== undefined) { params.push(order); setClauses.push(`"order" = $${params.length}`); }

    params.push(id);
    await query(
      `UPDATE "Organization" SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
      params
    );

    const org = await queryOne<any>(
      `SELECT * FROM "Organization" WHERE id = $1`,
      [id]
    );

    const [members, parent] = await Promise.all([
      query<any>(
        `SELECT id, username, "displayName", email, role FROM "User" WHERE "organizationId" = $1`,
        [id]
      ),
      org.parentId
        ? queryOne<any>(`SELECT id, name, type FROM "Organization" WHERE id = $1`, [org.parentId])
        : Promise.resolve(null),
    ]);

    res.json({
      ...org,
      Members: members,
      Parent: parent,
    });
  } catch (error: any) {
    errorLogger.error('Error updating organization', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete organization
export const deleteOrganization = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await queryOne<any>(
      `SELECT * FROM "Organization" WHERE id = $1`,
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [children, members] = await Promise.all([
      query<any>(`SELECT id FROM "Organization" WHERE "parentId" = $1`, [id]),
      query<any>(`SELECT id FROM "User" WHERE "organizationId" = $1`, [id]),
    ]);

    // Check if has children
    if (children.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete organization with child organizations. Delete children first.'
      });
    }

    // Check if has members
    if (members.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete organization with members. Reassign members first.'
      });
    }

    // Delete from LDAP first
    if (existing.ldapDn) {
      try {
        await ldapService.deleteOrganizationalUnit(existing.ldapDn);
        ldapLogger.info('Deleted LDAP OU', { dn: existing.ldapDn });
      } catch (ldapError: any) {
        ldapLogger.error('LDAP OU deletion failed', { error: ldapError });
        return res.status(500).json({
          error: `Failed to delete LDAP OU: ${ldapError.message}`
        });
      }
    }

    await query(`DELETE FROM "Organization" WHERE id = $1`, [id]);

    res.json({ message: 'Organization deleted successfully' });
  } catch (error: any) {
    errorLogger.error('Error deleting organization', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Add member to organization
export const addMemberToOrganization = async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId, userId } = req.body;

    if (!organizationId || !userId) {
      return res.status(400).json({
        error: 'Missing required fields: organizationId and userId are required'
      });
    }

    const org = await queryOne<any>(
      `SELECT * FROM "Organization" WHERE id = $1`,
      [organizationId]
    );

    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const user = await queryOne<any>(
      `SELECT * FROM "User" WHERE id = $1`,
      [userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user's LDAP departmentNumber if user has LDAP DN
    if (user.ldapDn && org.ldapDn) {
      try {
        await ldapService.updateUser(user.ldapDn, {
          departmentNumber: org.name,
        });
        ldapLogger.info('Updated LDAP user departmentNumber', { dn: user.ldapDn, department: org.name });
      } catch (ldapError: any) {
        ldapLogger.error('LDAP user update failed', { error: ldapError });
        // Continue anyway - we'll update database
      }
    }

    await query(
      `UPDATE "User" SET "organizationId" = $1, "updatedAt" = $2 WHERE id = $3`,
      [organizationId, new Date(), userId]
    );

    res.json({ message: 'Member added to organization successfully' });
  } catch (error: any) {
    errorLogger.error('Error adding member to organization', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Remove member from organization
export const removeMemberFromOrganization = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing required field: userId is required'
      });
    }

    const user = await queryOne<any>(
      `SELECT * FROM "User" WHERE id = $1`,
      [userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Clear user's LDAP departmentNumber if user has LDAP DN
    if (user.ldapDn) {
      try {
        await ldapService.updateUser(user.ldapDn, {
          departmentNumber: '',
        });
        ldapLogger.info('Cleared LDAP user departmentNumber', { dn: user.ldapDn });
      } catch (ldapError: any) {
        ldapLogger.error('LDAP user update failed', { error: ldapError });
        // Continue anyway - we'll update database
      }
    }

    await query(
      `UPDATE "User" SET "organizationId" = NULL, "updatedAt" = $1 WHERE id = $2`,
      [new Date(), userId]
    );

    res.json({ message: 'Member removed from organization successfully' });
  } catch (error: any) {
    errorLogger.error('Error removing member from organization', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Sync organizations from LDAP
export const syncFromLdap = async (req: AuthRequest, res: Response) => {
  try {
    // Get LDAP config
    const ldapConfig = await queryOne<any>(
      `SELECT * FROM "LdapConfig" WHERE "isActive" = true LIMIT 1`
    );

    if (!ldapConfig) {
      return res.status(500).json({ error: 'LDAP is not configured' });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    // 1. Get and process OUs from LDAP
    const ldapOus = await ldapService.getAllOrganizationalUnits();
    ldapLogger.info('Found OUs in LDAP', { count: ldapOus.length });

    for (const ou of ldapOus) {
      if (!ou.name || !ou.dn) {
        skipped++;
        continue;
      }

      const existing = await queryOne<any>(
        `SELECT * FROM "Organization" WHERE "ldapDn" = $1`,
        [ou.dn]
      );

      if (existing) {
        if (existing.description !== ou.description) {
          await query(
            `UPDATE "Organization" SET description = $1, "updatedAt" = $2 WHERE id = $3`,
            [ou.description ?? null, new Date(), existing.id]
          );
          updated++;
          ldapLogger.info('Updated OU from LDAP sync', { name: ou.name });
        } else {
          skipped++;
        }
      } else {
        const dnParts = ou.dn.split(',');
        const parentDnParts = dnParts.slice(1);
        const parentDn = parentDnParts.join(',');

        let parentId: string | null = null;
        if (parentDn !== ldapConfig.searchBase) {
          const parentOrg = await queryOne<any>(
            `SELECT id FROM "Organization" WHERE "ldapDn" = $1`,
            [parentDn]
          );
          parentId = parentOrg?.id || null;
        }

        const orgType = getOrgTypeFromDnDepth(ou.dn, ldapConfig.searchBase);
        const now = new Date();

        await query(
          `INSERT INTO "Organization" (id, name, type, description, "parentId", "ldapDn", "isActive", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)`,
          [randomUUID(), ou.name, orgType, ou.description ?? null, parentId, ou.dn, now, now]
        );
        created++;
        ldapLogger.info('Created OU from LDAP sync', { name: ou.name, type: orgType });
      }
    }

    // 2. Get and process Groups from LDAP
    const ldapGroups = await ldapService.getGroups();
    ldapLogger.info('Found Groups in LDAP', { count: ldapGroups.length });

    for (const group of ldapGroups) {
      if (!group.name || !group.dn) {
        skipped++;
        continue;
      }

      const existing = await queryOne<any>(
        `SELECT * FROM "Organization" WHERE "ldapDn" = $1`,
        [group.dn]
      );

      if (existing) {
        if (existing.description !== group.description) {
          await query(
            `UPDATE "Organization" SET description = $1, "updatedAt" = $2 WHERE id = $3`,
            [group.description ?? null, new Date(), existing.id]
          );
          updated++;
          ldapLogger.info('Updated Group from LDAP sync', { name: group.name });
        } else {
          skipped++;
        }
      } else {
        // For groups, we'll treat them as TEAM type by default
        const now = new Date();
        await query(
          `INSERT INTO "Organization" (id, name, type, description, "parentId", "ldapDn", "isActive", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, NULL, $5, true, $6, $7)`,
          [randomUUID(), group.name, OrgType.TEAM, group.description ?? null, group.dn, now, now]
        );
        created++;
        ldapLogger.info('Created Group from LDAP sync', { name: group.name, type: 'TEAM' });
      }
    }

    const totalItems = ldapOus.length + ldapGroups.length;

    res.json({
      message: 'LDAP sync completed',
      stats: {
        total: totalItems,
        created,
        updated,
        skipped,
      },
    });
  } catch (error: any) {
    errorLogger.error('Error syncing from LDAP', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
