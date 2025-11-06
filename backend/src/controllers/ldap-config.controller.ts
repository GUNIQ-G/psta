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
    res.status(400).json({
      success: false,
      message: error.message || 'LDAP connection test failed',
    });
  }
};
