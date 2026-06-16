import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { OrgType } from '@prisma/client';
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
    // Get all organizations
    const allOrgs = await prisma.organization.findMany({
      where: { isActive: true },
      include: {
        Members: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
            role: true,
          },
        },
        _count: {
          select: {
            Children: true,
            Members: true,
          },
        },
      },
      orderBy: [
        { order: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    // Build tree structure
    const buildTree = (parentId: string | null): any[] => {
      return allOrgs
        .filter((org: any) => org.parentId === parentId)
        .map((org: any) => ({
          ...org,
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

    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        Members: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
            role: true,
            phoneNumber: true,
          },
        },
        Parent: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        Children: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json(org);
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
      const parent = await prisma.organization.findUnique({
        where: { id: parentId },
      });

      if (!parent) {
        return res.status(404).json({ error: 'Parent organization not found' });
      }

      parentDn = parent.ldapDn || '';
    }

    // If no parent DN, get base DN from LDAP config
    if (!parentDn) {
      const ldapConfig = await prisma.ldapConfig.findFirst({
        where: { isActive: true },
      });
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

    // Create organization in database
    const org = await prisma.organization.create({
      data: {
        id: randomUUID(),
        name,
        type,
        description,
        parentId,
        ldapDn: createdLdapDn,
        updatedAt: new Date(),
      },
      include: {
        Members: true,
        Parent: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    res.status(201).json(org);
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

    const existing = await prisma.organization.findUnique({
      where: { id },
    });

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
        const parent = await prisma.organization.findUnique({
          where: { id: parentId },
        });

        if (!parent) {
          return res.status(404).json({ error: 'Parent organization not found' });
        }

        // Prevent setting parent as self
        if (parentId === id) {
          return res.status(400).json({ error: 'Organization cannot be its own parent' });
        }

        // Check if parentId is a descendant
        const checkDescendant = async (orgId: string): Promise<boolean> => {
          const children = await prisma.organization.findMany({
            where: { parentId: orgId },
          });

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
          const newParentDn = parentId !== undefined ?
            (await prisma.organization.findUnique({ where: { id: parentId } }))?.ldapDn || '' :
            existing.ldapDn.substring(existing.ldapDn.indexOf(',') + 1);

          if (newParentDn) {
            newLdapDn = await ldapService.moveOrganizationalUnit(existing.ldapDn, name, newParentDn);
            ldapLogger.info('Moved/Renamed LDAP OU', { from: existing.ldapDn, to: newLdapDn });
          }
        } else if (parentId !== undefined && parentId !== existing.parentId) {
          // Only parent changed
          const newParent = await prisma.organization.findUnique({ where: { id: parentId } });
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

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (description !== undefined) updateData.description = description;
    if (parentId !== undefined) updateData.parentId = parentId;
    if (newLdapDn !== existing.ldapDn) updateData.ldapDn = newLdapDn;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (order !== undefined) updateData.order = order;

    const org = await prisma.organization.update({
      where: { id },
      data: updateData,
      include: {
        Members: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
            role: true,
          },
        },
        Parent: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    res.json(org);
  } catch (error: any) {
    errorLogger.error('Error updating organization', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete organization
export const deleteOrganization = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.organization.findUnique({
      where: { id },
      include: {
        Children: true,
        Members: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check if has children
    if (existing.Children.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete organization with child organizations. Delete children first.'
      });
    }

    // Check if has members
    if (existing.Members.length > 0) {
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

    await prisma.organization.delete({
      where: { id },
    });

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

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

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

    await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId,
        updatedAt: new Date(),
      },
    });

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

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

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

    await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId: null,
        updatedAt: new Date(),
      },
    });

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
    const ldapConfig = await prisma.ldapConfig.findFirst({
      where: { isActive: true },
    });

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

      const existing = await prisma.organization.findFirst({
        where: { ldapDn: group.dn },
      });

      if (existing) {
        if (existing.description !== group.description) {
          await prisma.organization.update({
            where: { id: existing.id },
            data: {
              description: group.description,
              updatedAt: new Date(),
            },
          });
          updated++;
          ldapLogger.info('Updated Group from LDAP sync', { name: group.name });
        } else {
          skipped++;
        }
      } else {
        // For groups, we'll treat them as TEAM type by default
        // They are typically under ou=groups, so no hierarchical parent
        await prisma.organization.create({
          data: {
            id: randomUUID(),
            name: group.name,
            type: OrgType.TEAM, // Groups are treated as teams
            description: group.description,
            parentId: null, // Groups don't have hierarchical parents in this structure
            ldapDn: group.dn,
            updatedAt: new Date(),
          },
        });
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
