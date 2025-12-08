import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import ldapService from '../config/ldap';
import { randomUUID } from 'crypto';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
const ALGORITHM = 'aes-256-cbc';

function encrypt(text: string): string {
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedText: string): string {
  const [ivHex, encrypted] = encryptedText.split(':');
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export const getAllLdapConfigs = async (req: AuthRequest, res: Response) => {
  try {
    const configs = await prisma.ldapConfig.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Get user counts for each config
    const configsWithUserCounts = await Promise.all(
      configs.map(async (config) => {
        const userCount = await prisma.user.count({
          where: {
            ldapDn: { contains: config.searchBase },
          },
        });

        return {
          id: config.id,
          name: config.name,
          host: config.host,
          port: config.port,
          protocol: config.protocol,
          bindDn: config.bindDn,
          searchBase: config.searchBase,
          searchFilter: config.searchFilter,
          timeout: config.timeout,
          enableDynamicUserCreation: config.enableDynamicUserCreation,
          attributeLoginId: config.attributeLoginId,
          attributeName: config.attributeName,
          attributeSurname: config.attributeSurname,
          attributeEmail: config.attributeEmail,
          isActive: config.isActive,
          rootOu: config.rootOu,
          description: config.description,
          lastTestedAt: config.lastTestedAt,
          lastTestSuccess: config.lastTestSuccess,
          // v1.1.19: 확장된 설정 필드
          userBaseDn: config.userBaseDn,
          orgBaseDn: config.orgBaseDn,
          searchScope: config.searchScope,
          filterActiveOnly: config.filterActiveOnly,
          filterEmailRequired: config.filterEmailRequired,
          hiddenOrgs: config.hiddenOrgs,
          maxDepth: config.maxDepth,
          showRootOu: config.showRootOu,
          sortOrder: config.sortOrder,
          displayNameFormat: config.displayNameFormat,
          attributeTitle: config.attributeTitle,
          attributeDepartment: config.attributeDepartment,
          attributeDeptNumber: config.attributeDeptNumber,
          userCount,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt,
        };
      })
    );

    res.json(configsWithUserCounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getLdapConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const config = await prisma.ldapConfig.findUnique({ where: { id } });

    if (!config) {
      return res.status(404).json({ error: 'LDAP config not found' });
    }

    // Don't send encrypted password
    res.json({
      id: config.id,
      name: config.name,
      host: config.host,
      port: config.port,
      protocol: config.protocol,
      bindDn: config.bindDn,
      searchBase: config.searchBase,
      searchFilter: config.searchFilter,
      timeout: config.timeout,
      enableDynamicUserCreation: config.enableDynamicUserCreation,
      attributeLoginId: config.attributeLoginId,
      attributeName: config.attributeName,
      attributeSurname: config.attributeSurname,
      attributeEmail: config.attributeEmail,
      isActive: config.isActive,
      rootOu: config.rootOu,
      description: config.description,
      lastTestedAt: config.lastTestedAt,
      lastTestSuccess: config.lastTestSuccess,
      // v1.1.19: 확장된 설정 필드
      userBaseDn: config.userBaseDn,
      orgBaseDn: config.orgBaseDn,
      searchScope: config.searchScope,
      filterActiveOnly: config.filterActiveOnly,
      filterEmailRequired: config.filterEmailRequired,
      hiddenOrgs: config.hiddenOrgs,
      maxDepth: config.maxDepth,
      showRootOu: config.showRootOu,
      sortOrder: config.sortOrder,
      displayNameFormat: config.displayNameFormat,
      attributeTitle: config.attributeTitle,
      attributeDepartment: config.attributeDepartment,
      attributeDeptNumber: config.attributeDeptNumber,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createLdapConfig = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      host,
      port,
      protocol,
      bindDn,
      bindPassword,
      searchBase,
      searchFilter,
      timeout,
      enableDynamicUserCreation,
      attributeLoginId,
      attributeName,
      attributeSurname,
      attributeEmail,
      rootOu,
      description,
      // v1.1.19: 확장된 설정 필드
      userBaseDn,
      orgBaseDn,
      searchScope,
      filterActiveOnly,
      filterEmailRequired,
      hiddenOrgs,
      maxDepth,
      showRootOu,
      sortOrder,
      displayNameFormat,
      attributeTitle,
      attributeDepartment,
      attributeDeptNumber,
    } = req.body;

    if (!name || !host || !bindDn || !bindPassword || !searchBase) {
      return res.status(400).json({
        error: 'Name, Host, Bind DN, Password, and Search Base are required',
      });
    }

    // Check if name already exists
    const existing = await prisma.ldapConfig.findUnique({ where: { name } });
    if (existing) {
      return res.status(400).json({ error: 'LDAP config with this name already exists' });
    }

    const config = await prisma.ldapConfig.create({
      data: {
        id: randomUUID(),
        name,
        host,
        port: port || 389,
        protocol: protocol || 'LDAP',
        bindDn,
        bindPassword: encrypt(bindPassword),
        searchBase,
        searchFilter: searchFilter || '',
        timeout: timeout || 30,
        enableDynamicUserCreation: enableDynamicUserCreation !== false,
        attributeLoginId: attributeLoginId || 'uid',
        attributeName: attributeName || 'cn',
        attributeSurname: attributeSurname || 'sn',
        attributeEmail: attributeEmail || 'Email',
        rootOu: rootOu || 'Organizations',
        description: description || null,
        // v1.1.19: 확장된 설정 필드
        userBaseDn: userBaseDn || null,
        orgBaseDn: orgBaseDn || null,
        searchScope: searchScope || 'sub',
        filterActiveOnly: filterActiveOnly !== false,
        filterEmailRequired: filterEmailRequired === true,
        hiddenOrgs: hiddenOrgs || null,
        maxDepth: maxDepth || 10,
        showRootOu: showRootOu === true,
        sortOrder: sortOrder || 'name',
        displayNameFormat: displayNameFormat || '{sn}{cn}',
        attributeTitle: attributeTitle || 'title',
        attributeDepartment: attributeDepartment || 'ou',
        attributeDeptNumber: attributeDeptNumber || 'departmentNumber',
        updatedAt: new Date(),
      },
    });

    res.json({
      message: 'LDAP config created successfully',
      id: config.id,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateLdapConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      host,
      port,
      protocol,
      bindDn,
      bindPassword,
      searchBase,
      searchFilter,
      timeout,
      enableDynamicUserCreation,
      attributeLoginId,
      attributeName,
      attributeSurname,
      attributeEmail,
      rootOu,
      description,
      // v1.1.19: 확장된 설정 필드
      userBaseDn,
      orgBaseDn,
      searchScope,
      filterActiveOnly,
      filterEmailRequired,
      hiddenOrgs,
      maxDepth,
      showRootOu,
      sortOrder,
      displayNameFormat,
      attributeTitle,
      attributeDepartment,
      attributeDeptNumber,
    } = req.body;

    const existing = await prisma.ldapConfig.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'LDAP config not found' });
    }

    const updateData: any = {
      name: name || existing.name,
      host: host || existing.host,
      port: port || existing.port,
      protocol: protocol || existing.protocol,
      bindDn: bindDn || existing.bindDn,
      searchBase: searchBase || existing.searchBase,
      searchFilter: searchFilter !== undefined ? searchFilter : existing.searchFilter,
      timeout: timeout || existing.timeout,
      enableDynamicUserCreation: enableDynamicUserCreation !== undefined ? enableDynamicUserCreation : existing.enableDynamicUserCreation,
      attributeLoginId: attributeLoginId || existing.attributeLoginId,
      attributeName: attributeName || existing.attributeName,
      attributeSurname: attributeSurname || existing.attributeSurname,
      attributeEmail: attributeEmail || existing.attributeEmail,
      rootOu: rootOu !== undefined ? rootOu : existing.rootOu,
      description: description !== undefined ? description : existing.description,
      // v1.1.19: 확장된 설정 필드
      userBaseDn: userBaseDn !== undefined ? userBaseDn : existing.userBaseDn,
      orgBaseDn: orgBaseDn !== undefined ? orgBaseDn : existing.orgBaseDn,
      searchScope: searchScope || existing.searchScope,
      filterActiveOnly: filterActiveOnly !== undefined ? filterActiveOnly : existing.filterActiveOnly,
      filterEmailRequired: filterEmailRequired !== undefined ? filterEmailRequired : existing.filterEmailRequired,
      hiddenOrgs: hiddenOrgs !== undefined ? hiddenOrgs : existing.hiddenOrgs,
      maxDepth: maxDepth || existing.maxDepth,
      showRootOu: showRootOu !== undefined ? showRootOu : existing.showRootOu,
      sortOrder: sortOrder || existing.sortOrder,
      displayNameFormat: displayNameFormat || existing.displayNameFormat,
      attributeTitle: attributeTitle || existing.attributeTitle,
      attributeDepartment: attributeDepartment || existing.attributeDepartment,
      attributeDeptNumber: attributeDeptNumber || existing.attributeDeptNumber,
      updatedAt: new Date(),
    };

    // Only update password if provided
    if (bindPassword) {
      updateData.bindPassword = encrypt(bindPassword);
    }

    await prisma.ldapConfig.update({
      where: { id },
      data: updateData,
    });

    res.json({ message: 'LDAP config updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteLdapConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.ldapConfig.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'LDAP config not found' });
    }

    await prisma.ldapConfig.delete({ where: { id } });

    res.json({ message: 'LDAP config deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const testLdapConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const config = await prisma.ldapConfig.findUnique({ where: { id } });
    if (!config) {
      return res.status(404).json({ error: 'LDAP config not found' });
    }

    const protocolPrefix = config.protocol === 'LDAPS' ? 'ldaps://' : 'ldap://';
    const url = `${protocolPrefix}${config.host}:${config.port}`;

    const testConfig = {
      url,
      bindDn: config.bindDn,
      bindPassword: decrypt(config.bindPassword),
      searchBase: config.searchBase,
      searchFilter: config.searchFilter || '',
    };

    const isConnected = await ldapService.testConnection(testConfig);

    // Update test result in database (v1.1.18)
    await prisma.ldapConfig.update({
      where: { id },
      data: {
        lastTestedAt: new Date(),
        lastTestSuccess: isConnected,
        updatedAt: new Date(),
      },
    });

    if (isConnected) {
      res.json({
        success: true,
        message: 'LDAP connection successful',
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'LDAP connection failed. Please check your settings.',
      });
    }
  } catch (error: any) {
    // Update test result as failed
    try {
      const { id } = req.params;
      await prisma.ldapConfig.update({
        where: { id },
        data: {
          lastTestedAt: new Date(),
          lastTestSuccess: false,
          updatedAt: new Date(),
        },
      });
    } catch (updateError) {
      // Ignore update error
    }

    res.status(400).json({
      success: false,
      message: error.message || 'LDAP connection test failed',
    });
  }
};

// v1.1.18: Test LDAP connection with form values (pre-save test)
export const testLdapConnection = async (req: AuthRequest, res: Response) => {
  try {
    const {
      host,
      port,
      protocol,
      bindDn,
      bindPassword,
      searchBase,
      searchFilter,
    } = req.body;

    if (!host || !bindDn || !bindPassword || !searchBase) {
      return res.status(400).json({
        success: false,
        message: 'Host, Bind DN, Password, and Search Base are required for testing',
      });
    }

    const protocolPrefix = protocol === 'LDAPS' ? 'ldaps://' : 'ldap://';
    const url = `${protocolPrefix}${host}:${port || 389}`;

    const testConfig = {
      url,
      bindDn,
      bindPassword, // Use password directly from form (not encrypted)
      searchBase,
      searchFilter: searchFilter || '',
    };

    const isConnected = await ldapService.testConnection(testConfig);

    if (isConnected) {
      res.json({
        success: true,
        message: 'LDAP 연결 테스트 성공',
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'LDAP 연결 실패. 설정을 확인하세요.',
      });
    }
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'LDAP 연결 테스트 실패',
    });
  }
};
