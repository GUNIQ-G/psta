import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import settingsService from '../services/settings.service';
import ldapService from '../config/ldap';

export const getLdapSettings = async (req: AuthRequest, res: Response) => {
  try {
    const config = await settingsService.getLdapConfig();

    // Parse URL to extract host, port, protocol if URL exists
    let host = '';
    let port = 389;
    let protocol = 'LDAP';

    if (config.url) {
      try {
        const url = new URL(config.url);
        host = url.hostname;
        port = url.port ? parseInt(url.port) : (url.protocol === 'ldaps:' ? 636 : 389);
        protocol = url.protocol === 'ldaps:' ? 'LDAPS' : 'LDAP';
      } catch (e) {
        // If URL parsing fails, use defaults
      }
    }

    // Don't send password to client
    res.json({
      name: config.name || 'dtw-ldap',
      host: config.host || host,
      port: config.port ? parseInt(config.port) : port,
      protocol: config.protocol || protocol,
      bindDn: config.bindDn || '',
      searchBase: config.searchBase || '',
      searchFilter: config.searchFilter || '',
      timeout: config.timeout ? parseInt(config.timeout) : 30,
      enableDynamicUserCreation: config.enableDynamicUserCreation !== 'false',
      attributeLoginId: config.attributeLoginId || 'uid',
      attributeName: config.attributeName || 'cn',
      attributeSurname: config.attributeSurname || 'sn',
      attributeEmail: config.attributeEmail || 'Email',
      isConfigured: !!(config.url && config.bindDn && config.bindPassword && config.searchBase) ||
                    !!(config.host && config.bindDn && config.bindPassword && config.searchBase),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateLdapSettings = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name, host, port, protocol, bindDn, bindPassword, searchBase, searchFilter,
      timeout, enableDynamicUserCreation, attributeLoginId, attributeName,
      attributeSurname, attributeEmail,
      // Support legacy format
      url
    } = req.body;

    // Build URL from host/port/protocol or use legacy URL
    let finalUrl = url;
    if (host && port && protocol) {
      const protocolPrefix = protocol === 'LDAPS' ? 'ldaps://' : 'ldap://';
      finalUrl = `${protocolPrefix}${host}:${port}`;
    }

    if (!finalUrl && !host) {
      return res.status(400).json({
        error: 'Host or URL is required'
      });
    }

    if (!bindDn || !searchBase) {
      return res.status(400).json({
        error: 'Bind DN and Search Base are required'
      });
    }

    // Only update password if provided
    const config: any = {
      name: name || 'dtw-ldap',
      host: host || '',
      port: port || 389,
      protocol: protocol || 'LDAP',
      url: finalUrl,
      bindDn,
      searchBase,
      searchFilter: searchFilter || '',
      timeout: timeout || 30,
      enableDynamicUserCreation: enableDynamicUserCreation !== false,
      attributeLoginId: attributeLoginId || 'uid',
      attributeName: attributeName || 'cn',
      attributeSurname: attributeSurname || 'sn',
      attributeEmail: attributeEmail || 'Email',
    };

    if (bindPassword) {
      config.bindPassword = bindPassword;
    } else {
      // Keep existing password
      const existingPassword = await settingsService.getSetting('ldap.bindPassword');
      if (!existingPassword) {
        return res.status(400).json({
          error: 'Password is required for initial setup'
        });
      }
      config.bindPassword = existingPassword;
    }

    await settingsService.setLdapConfig(config);

    res.json({
      message: 'LDAP settings updated successfully',
      isConfigured: true,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const testLdapConnection = async (req: AuthRequest, res: Response) => {
  try {
    const {
      host, port, protocol, bindDn, bindPassword, searchBase, searchFilter,
      // Support legacy format
      url
    } = req.body;

    // Build URL from host/port/protocol or use legacy URL
    let finalUrl = url;
    if (host && port && protocol) {
      const protocolPrefix = protocol === 'LDAPS' ? 'ldaps://' : 'ldap://';
      finalUrl = `${protocolPrefix}${host}:${port}`;
    }

    if (!finalUrl || !bindDn || !bindPassword || !searchBase) {
      return res.status(400).json({
        error: 'All LDAP settings are required for testing'
      });
    }

    const config = {
      url: finalUrl,
      bindDn,
      bindPassword,
      searchBase,
      searchFilter: searchFilter || '',
    };

    const isConnected = await ldapService.testConnection(config);

    if (isConnected) {
      res.json({
        success: true,
        message: 'LDAP connection successful'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'LDAP connection failed. Please check your settings.'
      });
    }
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'LDAP connection test failed'
    });
  }
};

export const getSlackSettings = async (req: AuthRequest, res: Response) => {
  try {
    const botToken = await settingsService.getSetting('slack.botToken');
    const defaultChannel = await settingsService.getSetting('slack.defaultChannel');

    res.json({
      defaultChannel: defaultChannel || '',
      isConfigured: !!botToken,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateSlackSettings = async (req: AuthRequest, res: Response) => {
  try {
    const { botToken, defaultChannel } = req.body;

    if (!defaultChannel) {
      return res.status(400).json({
        error: 'Default channel is required'
      });
    }

    if (botToken) {
      await settingsService.setSetting('slack.botToken', botToken, 'slack', true);
    }
    await settingsService.setSetting('slack.defaultChannel', defaultChannel, 'slack', false);

    res.json({
      message: 'Slack settings updated successfully',
      isConfigured: true,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
