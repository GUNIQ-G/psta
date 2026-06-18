import ldap from 'ldapjs';
import prisma from './database';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? (() => {
  throw new Error('[FATAL] ENCRYPTION_KEY 환경변수가 설정되지 않았습니다. .env 파일을 확인하세요.');
})();
const ALGORITHM = 'aes-256-cbc';

function decrypt(encryptedText: string): string {
  const [ivHex, encrypted] = encryptedText.split(':');
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export interface LdapConfig {
  url: string;
  bindDn: string;
  bindPassword: string;
  searchBase: string;
  searchFilter: string;
  attributeLoginId?: string;
  attributeName?: string;
  attributeEmail?: string;
  orgBaseDn?: string | null;
}

export class LdapService {
  private client: ldap.Client | null = null;
  private config: LdapConfig | null = null;

  private async getActiveConfig(): Promise<LdapConfig | null> {
    const dbConfig = await prisma.ldapConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!dbConfig) {
      return null;
    }

    const url = dbConfig.protocol === 'LDAPS'
      ? `ldaps://${dbConfig.host}:${dbConfig.port}`
      : `ldap://${dbConfig.host}:${dbConfig.port}`;

    return {
      url,
      bindDn: dbConfig.bindDn,
      bindPassword: decrypt(dbConfig.bindPassword),
      searchBase: dbConfig.searchBase,
      searchFilter: dbConfig.searchFilter || `(${dbConfig.attributeLoginId}={{username}})`,
      attributeLoginId: dbConfig.attributeLoginId,
      attributeName: dbConfig.attributeName,
      attributeEmail: dbConfig.attributeEmail,
      orgBaseDn: (dbConfig as any).orgBaseDn || null,
    };
  }

  async authenticate(username: string, password: string): Promise<any> {
    console.log(`[LDAP] Attempting to authenticate user: ${username}`);

    const config = await this.getActiveConfig();

    if (!config) {
      console.error('[LDAP] No active LDAP configuration found');
      throw new Error('LDAP is not configured. Please configure LDAP settings first.');
    }

    console.log(`[LDAP] Using config: ${config.url}, searchBase: ${config.searchBase}`);

    return new Promise((resolve, reject) => {
      const client = ldap.createClient({
        url: config.url,
        reconnect: false,
        timeout: 10000,
        connectTimeout: 10000,
      });

      const cleanup = () => {
        try {
          client.unbind();
        } catch (e) {
          // Ignore
        }
      };

      const timeoutId = setTimeout(() => {
        cleanup();
        console.error('[LDAP] Authentication timeout');
        reject(new Error('LDAP connection timeout'));
      }, 15000);

      client.on('error', (err) => {
        clearTimeout(timeoutId);
        cleanup();
        console.error('[LDAP] Client error:', err.message);
        reject(new Error(`LDAP connection error: ${err.message}`));
      });

      // First, bind with admin credentials to search for the user
      console.log(`[LDAP] Binding with admin credentials: ${config.bindDn}`);
      client.bind(config.bindDn, config.bindPassword, (bindErr) => {
        if (bindErr) {
          clearTimeout(timeoutId);
          cleanup();
          console.error('[LDAP] Admin bind failed:', bindErr.message);
          return reject(new Error(`LDAP admin bind failed: ${bindErr.message}`));
        }

        console.log('[LDAP] Admin bind successful, searching for user...');

        // Support both {username} and {{username}} placeholders
        const searchFilter = config.searchFilter
          .replace('{{username}}', username)
          .replace('{username}', username);
        const loginAttr = config.attributeLoginId || 'uid';

        console.log(`[LDAP] Search filter: ${searchFilter}`);

        const opts: ldap.SearchOptions = {
          filter: searchFilter,
          scope: 'sub',
          attributes: ['dn', loginAttr, 'cn', 'mail', 'displayName', 'telephoneNumber', 'sn'],
        };

        client.search(config.searchBase, opts, (searchErr, searchRes) => {
          if (searchErr) {
            clearTimeout(timeoutId);
            cleanup();
            console.error('[LDAP] Search failed:', searchErr.message);
            return reject(new Error(`LDAP search failed: ${searchErr.message}`));
          }

          let userEntry: any = null;

          searchRes.on('searchEntry', (entry) => {
            // Extract DN - ldapjs returns it as objectName which can be a string or LdapDn object
            let dn = '';
            if (typeof entry.objectName === 'string') {
              dn = entry.objectName;
            } else if (entry.objectName && typeof entry.objectName === 'object') {
              dn = (entry.objectName as any).toString();
            }

            console.log('[LDAP] User found:', dn);

            // Get attributes with fallbacks
            const snValue = entry.attributes.find(attr => attr.type === 'sn')?.values[0] || '';
            const cnValue = entry.attributes.find(attr => attr.type === 'cn')?.values[0] || '';
            const displayNameAttr = entry.attributes.find(attr => attr.type === 'displayName')?.values[0];
            // displayName 우선, 없으면 성+이름 조합
            const displayNameValue = displayNameAttr || (snValue + cnValue) || username;
            const emailValue = entry.attributes.find(attr => attr.type === 'mail')?.values[0] ||
                              `${username}@example.com`;
            const phoneValue = entry.attributes.find(attr => attr.type === 'telephoneNumber')?.values[0] || null;

            console.log('[LDAP] Extracted attributes:', {
              displayName: displayNameValue,
              email: emailValue,
              phone: phoneValue
            });

            userEntry = {
              dn: dn,
              username: entry.attributes.find(attr => attr.type === loginAttr)?.values[0] || username,
              email: emailValue,
              displayName: displayNameValue,
              phoneNumber: phoneValue,
            };
          });

          searchRes.on('error', (err) => {
            clearTimeout(timeoutId);
            cleanup();
            console.error('[LDAP] Search error:', err.message);
            reject(new Error(`LDAP search error: ${err.message}`));
          });

          searchRes.on('end', () => {
            if (!userEntry) {
              clearTimeout(timeoutId);
              cleanup();
              console.error('[LDAP] User not found in LDAP');
              return reject(new Error(`User '${username}' not found in LDAP directory`));
            }

            // Now authenticate the user with their own credentials
            console.log(`[LDAP] Authenticating user with their credentials: ${userEntry.dn}`);

            const authClient = ldap.createClient({
              url: config.url,
              reconnect: false,
              timeout: 10000,
              connectTimeout: 10000,
            });

            authClient.on('error', (err) => {
              clearTimeout(timeoutId);
              cleanup();
              authClient.unbind();
              console.error('[LDAP] Auth client error:', err.message);
              reject(new Error(`LDAP auth error: ${err.message}`));
            });

            // Ensure DN and password are strings
            const userDn = String(userEntry.dn);
            const userPassword = String(password);

            console.log(`[LDAP] Binding with DN: ${userDn}`);

            authClient.bind(userDn, userPassword, (authErr) => {
              clearTimeout(timeoutId);
              cleanup();
              authClient.unbind();

              if (authErr) {
                console.error('[LDAP] User authentication failed:', authErr.message);
                return reject(new Error('Invalid username or password'));
              }

              console.log('[LDAP] User authenticated successfully');
              resolve(userEntry);
            });
          });
        });
      });
    });
  }

  async getGroups(): Promise<any[]> {
    const config = await this.getActiveConfig();

    if (!config) {
      throw new Error('LDAP is not configured');
    }

    return new Promise((resolve, reject) => {
      const client = ldap.createClient({
        url: config.url,
        reconnect: false,
      });

      client.bind(config.bindDn, config.bindPassword, (bindErr) => {
        if (bindErr) {
          client.unbind();
          return reject(new Error(`LDAP bind failed: ${bindErr.message}`));
        }

        const opts: ldap.SearchOptions = {
          filter: '(objectClass=groupOfNames)',
          scope: 'sub',
          attributes: ['dn', 'cn', 'description', 'member'],
        };

        client.search(config.searchBase, opts, (searchErr, searchRes) => {
          if (searchErr) {
            client.unbind();
            return reject(new Error(`LDAP search failed: ${searchErr.message}`));
          }

          const groups: any[] = [];

          searchRes.on('searchEntry', (entry) => {
            // Convert DN to string properly
            let dn = '';
            if (typeof entry.objectName === 'string') {
              dn = entry.objectName;
            } else if (entry.objectName && typeof entry.objectName === 'object') {
              dn = (entry.objectName as any).toString();
            }

            const group = {
              dn: dn,
              name: entry.attributes.find(attr => attr.type === 'cn')?.values[0],
              description: entry.attributes.find(attr => attr.type === 'description')?.values[0],
              members: entry.attributes.find(attr => attr.type === 'member')?.values || [],
            };
            groups.push(group);
          });

          searchRes.on('error', (err) => {
            client.unbind();
            reject(new Error(`LDAP search error: ${err.message}`));
          });

          searchRes.on('end', () => {
            client.unbind();
            resolve(groups);
          });
        });
      });
    });
  }

  /**
   * Get all organizational units (OUs) from LDAP
   * Used for hierarchical team structure (v1.1.18)
   */
  async getOrganizationalUnits(): Promise<any[]> {
    const config = await this.getActiveConfig();

    if (!config) {
      throw new Error('LDAP is not configured');
    }

    return new Promise((resolve, reject) => {
      const client = ldap.createClient({
        url: config.url,
        reconnect: false,
      });

      client.bind(config.bindDn, config.bindPassword, (bindErr) => {
        if (bindErr) {
          client.unbind();
          return reject(new Error(`LDAP bind failed: ${bindErr.message}`));
        }

        const opts: ldap.SearchOptions = {
          // people, Organizations, Groups 등 시스템 OU 제외
          filter: '(&(objectClass=organizationalUnit)(!(ou=people))(!(ou=Organizations))(!(ou=Groups))(!(ou=users)))',
          scope: 'sub',
          attributes: ['dn', 'ou', 'description', 'departmentNumber'],  // v1.1.19: Added departmentNumber
        };

        client.search(config.searchBase, opts, (searchErr, searchRes) => {
          if (searchErr) {
            client.unbind();
            return reject(new Error(`LDAP search failed: ${searchErr.message}`));
          }

          const ous: any[] = [];

          searchRes.on('searchEntry', (entry) => {
            // Convert DN to string properly
            let dn = '';
            if (typeof entry.objectName === 'string') {
              dn = entry.objectName;
            } else if (entry.objectName && typeof entry.objectName === 'object') {
              dn = (entry.objectName as any).toString();
            }

            const ou = {
              dn: dn,
              name: entry.attributes.find(attr => attr.type === 'ou')?.values[0],
              description: entry.attributes.find(attr => attr.type === 'description')?.values[0],
              departmentNumber: entry.attributes.find(attr => attr.type === 'departmentNumber')?.values[0],  // v1.1.19
            };
            ous.push(ou);
          });

          searchRes.on('error', (err) => {
            client.unbind();
            reject(new Error(`LDAP search error: ${err.message}`));
          });

          searchRes.on('end', () => {
            client.unbind();
            resolve(ous);
          });
        });
      });
    });
  }

  async getUserGroups(userDn: string): Promise<string[]> {
    const config = await this.getActiveConfig();

    if (!config) {
      throw new Error('LDAP is not configured');
    }

    return new Promise((resolve, reject) => {
      const client = ldap.createClient({
        url: config.url,
        reconnect: false,
      });

      client.bind(config.bindDn, config.bindPassword, (bindErr) => {
        if (bindErr) {
          client.unbind();
          return reject(new Error(`LDAP bind failed: ${bindErr.message}`));
        }

        const opts: ldap.SearchOptions = {
          filter: `(&(objectClass=groupOfNames)(member=${userDn}))`,
          scope: 'sub',
          attributes: ['cn', 'dn'],
        };

        client.search(config.searchBase, opts, (searchErr, searchRes) => {
          if (searchErr) {
            client.unbind();
            return reject(new Error(`LDAP search failed: ${searchErr.message}`));
          }

          const groups: string[] = [];

          searchRes.on('searchEntry', (entry) => {
            const groupName = entry.attributes.find(attr => attr.type === 'cn')?.values[0];
            if (groupName) {
              groups.push(groupName);
            }
          });

          searchRes.on('error', (err) => {
            client.unbind();
            reject(new Error(`LDAP search error: ${err.message}`));
          });

          searchRes.on('end', () => {
            client.unbind();
            resolve(groups);
          });
        });
      });
    });
  }

  // Get all users from LDAP
  async getAllUsers(): Promise<any[]> {
    const config = await this.getActiveConfig();

    if (!config) {
      throw new Error('LDAP is not configured');
    }

    return new Promise((resolve, reject) => {
      const client = ldap.createClient({
        url: config.url,
        reconnect: false,
      });

      client.bind(config.bindDn, config.bindPassword, (bindErr) => {
        if (bindErr) {
          client.unbind();
          return reject(new Error(`LDAP bind failed: ${bindErr.message}`));
        }

        const opts: ldap.SearchOptions = {
          filter: '(objectClass=inetOrgPerson)',
          scope: 'sub',
          attributes: ['dn', 'uid', 'cn', 'sn', 'mail', 'displayName', 'telephoneNumber', 'title', 'employeeType', 'departmentNumber', 'ou', 'department'],
        };

        client.search(config.searchBase, opts, (searchErr, searchRes) => {
          if (searchErr) {
            client.unbind();
            return reject(new Error(`LDAP search failed: ${searchErr.message}`));
          }

          const users: any[] = [];

          searchRes.on('searchEntry', (entry) => {
            let dn = '';
            if (typeof entry.objectName === 'string') {
              dn = entry.objectName;
            } else if (entry.objectName && typeof entry.objectName === 'object') {
              dn = (entry.objectName as any).toString();
            }

            const user = {
              dn: dn,
              uid: entry.attributes.find(attr => attr.type === 'uid')?.values[0],
              cn: entry.attributes.find(attr => attr.type === 'cn')?.values[0],
              sn: entry.attributes.find(attr => attr.type === 'sn')?.values[0],
              mail: entry.attributes.find(attr => attr.type === 'mail')?.values[0],
              displayName: entry.attributes.find(attr => attr.type === 'displayName')?.values[0],
              telephoneNumber: entry.attributes.find(attr => attr.type === 'telephoneNumber')?.values[0],
              title: entry.attributes.find(attr => attr.type === 'title')?.values[0],
              employeeType: entry.attributes.find(attr => attr.type === 'employeeType')?.values[0],
              departmentNumber: entry.attributes.find(attr => attr.type === 'departmentNumber')?.values[0],
              ou: entry.attributes.find(attr => attr.type === 'ou')?.values[0],
              department: entry.attributes.find(attr => attr.type === 'department')?.values[0],
            };
            users.push(user);
          });

          searchRes.on('error', (err) => {
            client.unbind();
            reject(new Error(`LDAP search error: ${err.message}`));
          });

          searchRes.on('end', () => {
            client.unbind();
            resolve(users);
          });
        });
      });
    });
  }

  // Create a new LDAP user
  async createUser(userData: any): Promise<void> {
    const config = await this.getActiveConfig();

    if (!config) {
      throw new Error('LDAP is not configured');
    }

    return new Promise((resolve, reject) => {
      const client = ldap.createClient({
        url: config.url,
        reconnect: false,
      });

      client.bind(config.bindDn, config.bindPassword, (bindErr) => {
        if (bindErr) {
          client.unbind();
          return reject(new Error(`LDAP bind failed: ${bindErr.message}`));
        }

        const dn = `uid=${userData.uid},${config.searchBase}`;
        const entry = {
          objectClass: ['inetOrgPerson', 'organizationalPerson', 'person', 'top'],
          uid: userData.uid,
          cn: userData.cn,
          sn: userData.sn,
          mail: userData.mail || `${userData.uid}@example.com`,
          userPassword: userData.password,
          ...(userData.displayName && { displayName: userData.displayName }),
          ...(userData.telephoneNumber && { telephoneNumber: userData.telephoneNumber }),
          ...(userData.title && { title: userData.title }),
          ...(userData.departmentNumber && { departmentNumber: userData.departmentNumber }),
        };

        client.add(dn, entry, (addErr) => {
          client.unbind();
          if (addErr) {
            return reject(new Error(`Failed to create user: ${addErr.message}`));
          }
          resolve();
        });
      });
    });
  }

  // Update an LDAP user
  async updateUser(dn: string, changes: any): Promise<void> {
    const config = await this.getActiveConfig();

    if (!config) {
      throw new Error('LDAP is not configured');
    }

    return new Promise((resolve, reject) => {
      const client = ldap.createClient({
        url: config.url,
        reconnect: false,
      });

      client.bind(config.bindDn, config.bindPassword, (bindErr) => {
        if (bindErr) {
          client.unbind();
          return reject(new Error(`LDAP bind failed: ${bindErr.message}`));
        }

        const modifications: any[] = [];

        Object.keys(changes).forEach(key => {
          if (changes[key] !== undefined && changes[key] !== null && key !== 'password') {
            modifications.push(new ldap.Change({
              operation: 'replace',
              modification: {
                type: key,
                values: [changes[key]]
              }
            }));
          }
        });

        // Handle password separately
        if (changes.password) {
          modifications.push(new ldap.Change({
            operation: 'replace',
            modification: {
              type: 'userPassword',
              values: [changes.password]
            }
          }));
        }

        client.modify(dn, modifications, (modErr) => {
          client.unbind();
          if (modErr) {
            return reject(new Error(`Failed to update user: ${modErr.message}`));
          }
          resolve();
        });
      });
    });
  }

  // Delete an LDAP user
  async deleteUser(dn: string): Promise<void> {
    const config = await this.getActiveConfig();

    if (!config) {
      throw new Error('LDAP is not configured');
    }

    return new Promise((resolve, reject) => {
      const client = ldap.createClient({
        url: config.url,
        reconnect: false,
      });

      client.bind(config.bindDn, config.bindPassword, (bindErr) => {
        if (bindErr) {
          client.unbind();
          return reject(new Error(`LDAP bind failed: ${bindErr.message}`));
        }

        client.del(dn, (delErr) => {
          client.unbind();
          if (delErr) {
            return reject(new Error(`Failed to delete user: ${delErr.message}`));
          }
          resolve();
        });
      });
    });
  }

  // Create a new LDAP group
  async createGroup(groupData: any): Promise<void> {
    const config = await this.getActiveConfig();

    if (!config) {
      throw new Error('LDAP is not configured');
    }

    return new Promise((resolve, reject) => {
      const client = ldap.createClient({
        url: config.url,
        reconnect: false,
      });

      client.bind(config.bindDn, config.bindPassword, (bindErr) => {
        if (bindErr) {
          client.unbind();
          return reject(new Error(`LDAP bind failed: ${bindErr.message}`));
        }

        const dn = `cn=${groupData.name},${config.searchBase}`;
        const entry = {
          objectClass: ['groupOfNames', 'top'],
          cn: groupData.name,
          member: groupData.members || [],
          ...(groupData.description && { description: groupData.description }),
        };

        client.add(dn, entry, (addErr) => {
          client.unbind();
          if (addErr) {
            return reject(new Error(`Failed to create group: ${addErr.message}`));
          }
          resolve();
        });
      });
    });
  }

  // Update an LDAP group
  async updateGroup(dn: string, changes: any): Promise<void> {
    const config = await this.getActiveConfig();

    if (!config) {
      throw new Error('LDAP is not configured');
    }

    return new Promise((resolve, reject) => {
      const client = ldap.createClient({
        url: config.url,
        reconnect: false,
      });

      client.bind(config.bindDn, config.bindPassword, (bindErr) => {
        if (bindErr) {
          client.unbind();
          return reject(new Error(`LDAP bind failed: ${bindErr.message}`));
        }

        const modifications: any[] = [];

        if (changes.description !== undefined) {
          modifications.push(new ldap.Change({
            operation: 'replace',
            modification: {
              type: 'description',
              values: [changes.description]
            }
          }));
        }

        if (changes.members !== undefined) {
          modifications.push(new ldap.Change({
            operation: 'replace',
            modification: {
              type: 'member',
              values: changes.members
            }
          }));
        }

        client.modify(dn, modifications, (modErr) => {
          client.unbind();
          if (modErr) {
            return reject(new Error(`Failed to update group: ${modErr.message}`));
          }
          resolve();
        });
      });
    });
  }

  // Delete an LDAP group
  async deleteGroup(dn: string): Promise<void> {
    const config = await this.getActiveConfig();

    if (!config) {
      throw new Error('LDAP is not configured');
    }

    return new Promise((resolve, reject) => {
      const client = ldap.createClient({
        url: config.url,
        reconnect: false,
      });

      client.bind(config.bindDn, config.bindPassword, (bindErr) => {
        if (bindErr) {
          client.unbind();
          return reject(new Error(`LDAP bind failed: ${bindErr.message}`));
        }

        client.del(dn, (delErr) => {
          client.unbind();
          if (delErr) {
            return reject(new Error(`Failed to delete group: ${delErr.message}`));
          }
          resolve();
        });
      });
    });
  }

  // Add user to group
  async addUserToGroup(groupDn: string, userDn: string): Promise<void> {
    const config = await this.getActiveConfig();

    if (!config) {
      throw new Error('LDAP is not configured');
    }

    return new Promise((resolve, reject) => {
      const client = ldap.createClient({
        url: config.url,
        reconnect: false,
      });

      client.bind(config.bindDn, config.bindPassword, (bindErr) => {
        if (bindErr) {
          client.unbind();
          return reject(new Error(`LDAP bind failed: ${bindErr.message}`));
        }

        const change = new ldap.Change({
          operation: 'add',
          modification: {
            type: 'member',
            values: [userDn]
          }
        });

        client.modify(groupDn, change, (modErr) => {
          client.unbind();
          if (modErr) {
            return reject(new Error(`Failed to add user to group: ${modErr.message}`));
          }
          resolve();
        });
      });
    });
  }

  // Remove user from group
  async removeUserFromGroup(groupDn: string, userDn: string): Promise<void> {
    const config = await this.getActiveConfig();

    if (!config) {
      throw new Error('LDAP is not configured');
    }

    return new Promise((resolve, reject) => {
      const client = ldap.createClient({
        url: config.url,
        reconnect: false,
      });

      client.bind(config.bindDn, config.bindPassword, (bindErr) => {
        if (bindErr) {
          client.unbind();
          return reject(new Error(`LDAP bind failed: ${bindErr.message}`));
        }

        const change = new ldap.Change({
          operation: 'delete',
          modification: {
            type: 'member',
            values: [userDn]
          }
        });

        client.modify(groupDn, change, (modErr) => {
          client.unbind();
          if (modErr) {
            return reject(new Error(`Failed to remove user from group: ${modErr.message}`));
          }
          resolve();
        });
      });
    });
  }

  disconnect() {
    if (this.client) {
      this.client.unbind();
      this.client = null;
    }
  }

  async testConnection(config: LdapConfig): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const testClient = ldap.createClient({
        url: config.url,
        reconnect: false,
        timeout: 5000,
        connectTimeout: 5000,
      });

      const cleanup = () => {
        try {
          testClient.unbind();
        } catch (e) {
          // Ignore unbind errors
        }
      };

      // Set overall timeout
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('LDAP connection timeout'));
      }, 10000);

      testClient.on('error', (err) => {
        clearTimeout(timeoutId);
        cleanup();
        reject(new Error(`LDAP connection error: ${err.message}`));
      });

      testClient.bind(config.bindDn, config.bindPassword, (err) => {
        clearTimeout(timeoutId);
        cleanup();
        if (err) {
          reject(new Error(`LDAP bind failed: ${err.message}`));
        } else {
          resolve(true);
        }
      });
    });
  }

  // Get all organizational units from LDAP
  async getAllOrganizationalUnits(): Promise<any[]> {
    const config = await this.getActiveConfig();
    if (!config) throw new Error('LDAP is not configured');

    return new Promise((resolve, reject) => {
      const client = ldap.createClient({ url: config.url, reconnect: false });
      client.bind(config.bindDn, config.bindPassword, (bindErr) => {
        if (bindErr) {
          client.unbind();
          return reject(new Error(`LDAP bind failed: ${bindErr.message}`));
        }

        const opts: ldap.SearchOptions = {
          filter: '(objectClass=organizationalUnit)',
          scope: 'sub',
          attributes: ['ou', 'description', 'departmentNumber'],
        };

        // Use orgBaseDn if available, otherwise fallback to searchBase
        const orgSearchBase = (config as any).orgBaseDn || config.searchBase;
        client.search(orgSearchBase, opts, (searchErr, searchRes) => {
          if (searchErr) {
            client.unbind();
            return reject(new Error(`LDAP search failed: ${searchErr.message}`));
          }

          const ous: any[] = [];

          // Helper to convert Buffer/string value to UTF-8 string
          const toUtf8String = (val: any): string | undefined => {
            if (val === undefined || val === null) return undefined;
            if (Buffer.isBuffer(val)) return val.toString('utf8');
            if (typeof val === 'string') return val;
            return String(val);
          };

          searchRes.on('searchEntry', (entry) => {
            let dn = '';
            if (typeof entry.objectName === 'string') {
              dn = entry.objectName;
            } else if (entry.objectName && typeof entry.objectName === 'object') {
              dn = (entry.objectName as any).toString();
            }

            const ouAttr = entry.attributes.find((attr: any) => attr.type === 'ou');
            const descAttr = entry.attributes.find((attr: any) => attr.type === 'description');
            const deptNumAttr = entry.attributes.find((attr: any) => attr.type === 'departmentNumber');

            const ou = {
              dn: dn,
              name: toUtf8String(ouAttr?.values[0]),
              description: toUtf8String(descAttr?.values[0]),
              departmentNumber: toUtf8String(deptNumAttr?.values[0]),
            };
            ous.push(ou);
          });

          searchRes.on('end', () => {
            client.unbind();
            resolve(ous);
          });

          searchRes.on('error', (err) => {
            client.unbind();
            reject(new Error(`LDAP search error: ${err.message}`));
          });
        });
      });
    });
  }

  // Create an organizational unit (OU)
  async createOrganizationalUnit(name: string, parentDn: string, description?: string): Promise<string> {
    const config = await this.getActiveConfig();
    if (!config) throw new Error('LDAP is not configured');

    return new Promise((resolve, reject) => {
      const client = ldap.createClient({ url: config.url, reconnect: false });
      client.bind(config.bindDn, config.bindPassword, (bindErr) => {
        if (bindErr) {
          client.unbind();
          return reject(new Error(`LDAP bind failed: ${bindErr.message}`));
        }

        const ouDn = `ou=${name},${parentDn}`;
        const entry: any = {
          objectClass: ['organizationalUnit', 'top'],
          ou: name,
        };

        if (description) {
          entry.description = description;
        }

        client.add(ouDn, entry, (addErr) => {
          client.unbind();
          if (addErr) {
            return reject(new Error(`Failed to create OU: ${addErr.message}`));
          }
          resolve(ouDn);
        });
      });
    });
  }

  // Update an organizational unit
  async updateOrganizationalUnit(dn: string, changes: any): Promise<void> {
    const config = await this.getActiveConfig();
    if (!config) throw new Error('LDAP is not configured');

    return new Promise((resolve, reject) => {
      const client = ldap.createClient({ url: config.url, reconnect: false });
      client.bind(config.bindDn, config.bindPassword, (bindErr) => {
        if (bindErr) {
          client.unbind();
          return reject(new Error(`LDAP bind failed: ${bindErr.message}`));
        }

        const modifications: any[] = [];

        if (changes.description !== undefined) {
          modifications.push(new ldap.Change({
            operation: 'replace',
            modification: {
              type: 'description',
              values: [changes.description]
            }
          }));
        }

        if (modifications.length === 0) {
          client.unbind();
          return resolve();
        }

        client.modify(dn, modifications, (modErr) => {
          client.unbind();
          if (modErr) {
            return reject(new Error(`Failed to update OU: ${modErr.message}`));
          }
          resolve();
        });
      });
    });
  }

  // Delete an organizational unit
  async deleteOrganizationalUnit(dn: string): Promise<void> {
    const config = await this.getActiveConfig();
    if (!config) throw new Error('LDAP is not configured');

    return new Promise((resolve, reject) => {
      const client = ldap.createClient({ url: config.url, reconnect: false });
      client.bind(config.bindDn, config.bindPassword, (bindErr) => {
        if (bindErr) {
          client.unbind();
          return reject(new Error(`LDAP bind failed: ${bindErr.message}`));
        }

        client.del(dn, (delErr) => {
          client.unbind();
          if (delErr) {
            return reject(new Error(`Failed to delete OU: ${delErr.message}`));
          }
          resolve();
        });
      });
    });
  }

  // Move/Rename an organizational unit
  async moveOrganizationalUnit(oldDn: string, newName: string, newParentDn: string): Promise<string> {
    const config = await this.getActiveConfig();
    if (!config) throw new Error('LDAP is not configured');

    return new Promise((resolve, reject) => {
      const client = ldap.createClient({ url: config.url, reconnect: false });
      client.bind(config.bindDn, config.bindPassword, (bindErr) => {
        if (bindErr) {
          client.unbind();
          return reject(new Error(`LDAP bind failed: ${bindErr.message}`));
        }

        const newRdn = `ou=${newName}`;

        client.modifyDN(oldDn, newRdn, (modDnErr) => {
          if (modDnErr) {
            client.unbind();
            return reject(new Error(`Failed to rename OU: ${modDnErr.message}`));
          }

          // If parent needs to change, do another operation
          const currentParentDn = oldDn.substring(oldDn.indexOf(',') + 1);
          if (newParentDn !== currentParentDn) {
            const tempDn = `${newRdn},${currentParentDn}`;
            client.modifyDN(tempDn, newRdn, { deleteOldRdn: true, newSuperior: newParentDn }, (moveErr) => {
              client.unbind();
              if (moveErr) {
                return reject(new Error(`Failed to move OU: ${moveErr.message}`));
              }
              resolve(`${newRdn},${newParentDn}`);
            });
          } else {
            client.unbind();
            resolve(`${newRdn},${newParentDn}`);
          }
        });
      });
    });
  }
}

export default new LdapService();