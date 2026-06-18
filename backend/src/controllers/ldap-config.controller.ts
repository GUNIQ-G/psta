import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query, queryOne } from '../config/database';
import ldapService from '../config/ldap';
import { randomUUID } from 'crypto';
import crypto from 'crypto';
import appLogger, { errorLogger, ldapLogger } from '../config/logger';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? (() => {
  throw new Error('[FATAL] ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.');
})();
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
    const configs = await query<any>(
      `SELECT * FROM "LdapConfig" ORDER BY "createdAt" DESC`
    );

    // Get user counts for each config
    const configsWithUserCounts = await Promise.all(
      configs.map(async (config: any) => {
        const countRow = await queryOne<any>(
          `SELECT COUNT(*)::int AS "userCount" FROM "User" WHERE "ldapDn" LIKE $1`,
          [`%${config.searchBase}%`]
        );
        const userCount = countRow?.userCount ?? 0;

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
    errorLogger.error('Error fetching LDAP configs', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getLdapConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const config = await queryOne<any>(
      `SELECT * FROM "LdapConfig" WHERE "id" = $1`,
      [id]
    );

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
    errorLogger.error('Error fetching LDAP config', { error });
    res.status(500).json({ error: 'Internal server error' });
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
    const existing = await queryOne<any>(
      `SELECT "id" FROM "LdapConfig" WHERE "name" = $1`,
      [name]
    );
    if (existing) {
      return res.status(400).json({ error: 'LDAP config with this name already exists' });
    }

    const config = await queryOne<any>(
      `INSERT INTO "LdapConfig" (
        "id", "name", "host", "port", "protocol", "bindDn", "bindPassword",
        "searchBase", "searchFilter", "timeout", "enableDynamicUserCreation",
        "attributeLoginId", "attributeName", "attributeSurname", "attributeEmail",
        "rootOu", "description",
        "userBaseDn", "orgBaseDn", "searchScope", "filterActiveOnly", "filterEmailRequired",
        "hiddenOrgs", "maxDepth", "showRootOu", "sortOrder", "displayNameFormat",
        "attributeTitle", "attributeDepartment", "attributeDeptNumber", "updatedAt"
       ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17,
        $18, $19, $20, $21, $22,
        $23, $24, $25, $26, $27,
        $28, $29, $30, $31
       )
       RETURNING *`,
      [
        randomUUID(),
        name,
        host,
        port || 389,
        protocol || 'LDAP',
        bindDn,
        encrypt(bindPassword),
        searchBase,
        searchFilter || '',
        timeout || 30,
        enableDynamicUserCreation !== false,
        attributeLoginId || 'uid',
        attributeName || 'cn',
        attributeSurname || 'sn',
        attributeEmail || 'Email',
        rootOu || 'Organizations',
        description || null,
        userBaseDn || null,
        orgBaseDn || null,
        searchScope || 'sub',
        filterActiveOnly !== false,
        filterEmailRequired === true,
        hiddenOrgs || null,
        maxDepth || 10,
        showRootOu === true,
        sortOrder || 'name',
        displayNameFormat || '{sn}{cn}',
        attributeTitle || 'title',
        attributeDepartment || 'ou',
        attributeDeptNumber || 'departmentNumber',
        new Date(),
      ]
    );

    res.json({
      message: 'LDAP config created successfully',
      id: config.id,
    });
  } catch (error: any) {
    errorLogger.error('Error creating LDAP config', { error });
    res.status(500).json({ error: 'Internal server error' });
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

    const existing = await queryOne<any>(
      `SELECT * FROM "LdapConfig" WHERE "id" = $1`,
      [id]
    );
    if (!existing) {
      return res.status(404).json({ error: 'LDAP config not found' });
    }

    const newBindPassword = bindPassword ? encrypt(bindPassword) : existing.bindPassword;

    await query(
      `UPDATE "LdapConfig"
       SET "name" = $1, "host" = $2, "port" = $3, "protocol" = $4,
           "bindDn" = $5, "bindPassword" = $6, "searchBase" = $7,
           "searchFilter" = $8, "timeout" = $9, "enableDynamicUserCreation" = $10,
           "attributeLoginId" = $11, "attributeName" = $12, "attributeSurname" = $13,
           "attributeEmail" = $14, "rootOu" = $15, "description" = $16,
           "userBaseDn" = $17, "orgBaseDn" = $18, "searchScope" = $19,
           "filterActiveOnly" = $20, "filterEmailRequired" = $21, "hiddenOrgs" = $22,
           "maxDepth" = $23, "showRootOu" = $24, "sortOrder" = $25,
           "displayNameFormat" = $26, "attributeTitle" = $27,
           "attributeDepartment" = $28, "attributeDeptNumber" = $29, "updatedAt" = $30
       WHERE "id" = $31`,
      [
        name || existing.name,
        host || existing.host,
        port || existing.port,
        protocol || existing.protocol,
        bindDn || existing.bindDn,
        newBindPassword,
        searchBase || existing.searchBase,
        searchFilter !== undefined ? searchFilter : existing.searchFilter,
        timeout || existing.timeout,
        enableDynamicUserCreation !== undefined ? enableDynamicUserCreation : existing.enableDynamicUserCreation,
        attributeLoginId || existing.attributeLoginId,
        attributeName || existing.attributeName,
        attributeSurname || existing.attributeSurname,
        attributeEmail || existing.attributeEmail,
        rootOu !== undefined ? rootOu : existing.rootOu,
        description !== undefined ? description : existing.description,
        userBaseDn !== undefined ? userBaseDn : existing.userBaseDn,
        orgBaseDn !== undefined ? orgBaseDn : existing.orgBaseDn,
        searchScope || existing.searchScope,
        filterActiveOnly !== undefined ? filterActiveOnly : existing.filterActiveOnly,
        filterEmailRequired !== undefined ? filterEmailRequired : existing.filterEmailRequired,
        hiddenOrgs !== undefined ? hiddenOrgs : existing.hiddenOrgs,
        maxDepth || existing.maxDepth,
        showRootOu !== undefined ? showRootOu : existing.showRootOu,
        sortOrder || existing.sortOrder,
        displayNameFormat || existing.displayNameFormat,
        attributeTitle || existing.attributeTitle,
        attributeDepartment || existing.attributeDepartment,
        attributeDeptNumber || existing.attributeDeptNumber,
        new Date(),
        id,
      ]
    );

    res.json({ message: 'LDAP config updated successfully' });
  } catch (error: any) {
    errorLogger.error('Error updating LDAP config', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteLdapConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await queryOne<any>(
      `SELECT "id" FROM "LdapConfig" WHERE "id" = $1`,
      [id]
    );
    if (!existing) {
      return res.status(404).json({ error: 'LDAP config not found' });
    }

    await query(`DELETE FROM "LdapConfig" WHERE "id" = $1`, [id]);

    res.json({ message: 'LDAP config deleted successfully' });
  } catch (error: any) {
    errorLogger.error('Error deleting LDAP config', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const testLdapConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const config = await queryOne<any>(
      `SELECT * FROM "LdapConfig" WHERE "id" = $1`,
      [id]
    );
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
    await query(
      `UPDATE "LdapConfig" SET "lastTestedAt" = $1, "lastTestSuccess" = $2, "updatedAt" = $3 WHERE "id" = $4`,
      [new Date(), isConnected, new Date(), id]
    );

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
      await query(
        `UPDATE "LdapConfig" SET "lastTestedAt" = $1, "lastTestSuccess" = false, "updatedAt" = $2 WHERE "id" = $3`,
        [new Date(), new Date(), id]
      );
    } catch (updateError) {
      // Ignore update error
    }

    ldapLogger.error('LDAP connection test failed', { error });
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
    ldapLogger.error('LDAP connection pre-save test failed', { error });
    res.status(400).json({
      success: false,
      message: error.message || 'LDAP 연결 테스트 실패',
    });
  }
};
