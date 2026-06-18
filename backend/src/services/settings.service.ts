import { query, queryOne } from '../config/database';
import crypto, { randomUUID } from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
const ALGORITHM = 'aes-256-cbc';

class SettingsService {
  private encrypt(text: string): string {
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  private decrypt(encryptedText: string): string {
    const [ivHex, encrypted] = encryptedText.split(':');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async getSetting(key: string): Promise<string | null> {
    const setting = await queryOne<{ value: string; isEncrypted: boolean }>(
      `SELECT "value", "isEncrypted" FROM "SystemSetting" WHERE "key" = $1`,
      [key]
    );
    if (!setting) return null;

    if (setting.isEncrypted) {
      return this.decrypt(setting.value);
    }
    return setting.value;
  }

  async setSetting(key: string, value: string, category: string = 'general', isEncrypted: boolean = false): Promise<void> {
    const storedValue = isEncrypted ? this.encrypt(value) : value;
    const now = new Date();

    await query(
      `INSERT INTO "SystemSetting" ("id", "key", "value", "category", "isEncrypted", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT ("key") DO UPDATE SET
         "value" = EXCLUDED."value",
         "category" = EXCLUDED."category",
         "isEncrypted" = EXCLUDED."isEncrypted",
         "updatedAt" = EXCLUDED."updatedAt"`,
      [randomUUID(), key, storedValue, category, isEncrypted, now]
    );
  }

  async getSettingsByCategory(category: string): Promise<Record<string, string>> {
    const settings = await query<{ key: string; value: string; isEncrypted: boolean }>(
      `SELECT "key", "value", "isEncrypted" FROM "SystemSetting" WHERE "category" = $1`,
      [category]
    );
    const result: Record<string, string> = {};

    for (const setting of settings) {
      result[setting.key] = setting.isEncrypted
        ? this.decrypt(setting.value)
        : setting.value;
    }

    return result;
  }

  async deleteSetting(key: string): Promise<void> {
    await query(
      `DELETE FROM "SystemSetting" WHERE "key" = $1`,
      [key]
    );
  }

  // LDAP specific methods
  async getLdapConfig() {
    return {
      name: await this.getSetting('ldap.name'),
      host: await this.getSetting('ldap.host'),
      port: await this.getSetting('ldap.port'),
      protocol: await this.getSetting('ldap.protocol'),
      url: await this.getSetting('ldap.url'),
      bindDn: await this.getSetting('ldap.bindDn'),
      bindPassword: await this.getSetting('ldap.bindPassword'),
      searchBase: await this.getSetting('ldap.searchBase'),
      searchFilter: await this.getSetting('ldap.searchFilter') || '',
      timeout: await this.getSetting('ldap.timeout'),
      enableDynamicUserCreation: await this.getSetting('ldap.enableDynamicUserCreation'),
      attributeLoginId: await this.getSetting('ldap.attributeLoginId'),
      attributeName: await this.getSetting('ldap.attributeName'),
      attributeSurname: await this.getSetting('ldap.attributeSurname'),
      attributeEmail: await this.getSetting('ldap.attributeEmail'),
    };
  }

  async setLdapConfig(config: {
    name?: string;
    host?: string;
    port?: number;
    protocol?: string;
    url: string;
    bindDn: string;
    bindPassword: string;
    searchBase: string;
    searchFilter?: string;
    timeout?: number;
    enableDynamicUserCreation?: boolean;
    attributeLoginId?: string;
    attributeName?: string;
    attributeSurname?: string;
    attributeEmail?: string;
  }) {
    await this.setSetting('ldap.name', config.name || 'dtw-ldap', 'ldap', false);
    await this.setSetting('ldap.host', config.host || '', 'ldap', false);
    await this.setSetting('ldap.port', String(config.port || 389), 'ldap', false);
    await this.setSetting('ldap.protocol', config.protocol || 'LDAP', 'ldap', false);
    await this.setSetting('ldap.url', config.url, 'ldap', false);
    await this.setSetting('ldap.bindDn', config.bindDn, 'ldap', false);
    await this.setSetting('ldap.bindPassword', config.bindPassword, 'ldap', true);
    await this.setSetting('ldap.searchBase', config.searchBase, 'ldap', false);
    await this.setSetting('ldap.searchFilter', config.searchFilter || '', 'ldap', false);
    await this.setSetting('ldap.timeout', String(config.timeout || 30), 'ldap', false);
    await this.setSetting('ldap.enableDynamicUserCreation', String(config.enableDynamicUserCreation !== false), 'ldap', false);
    await this.setSetting('ldap.attributeLoginId', config.attributeLoginId || 'uid', 'ldap', false);
    await this.setSetting('ldap.attributeName', config.attributeName || 'cn', 'ldap', false);
    await this.setSetting('ldap.attributeSurname', config.attributeSurname || 'sn', 'ldap', false);
    await this.setSetting('ldap.attributeEmail', config.attributeEmail || 'Email', 'ldap', false);
  }

  async isLdapConfigured(): Promise<boolean> {
    const url = await this.getSetting('ldap.url');
    return !!url;
  }
}

export default new SettingsService();
