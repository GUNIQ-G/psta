import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query, queryOne } from '../config/database';
import { randomUUID } from 'crypto';
import { WebClient } from '@slack/web-api';
import appLogger, { errorLogger, notificationLogger } from '../config/logger';

// Platform-specific config interfaces
interface SlackConfig {
  botToken: string;
  userToken?: string;
  signingSecret?: string;
  verificationToken?: string;
  appId?: string;
  clientId?: string;
  clientSecret?: string;
}

interface TelegramConfig {
  botToken: string;
  chatId?: string;
}

interface DiscordConfig {
  webhookUrl?: string;
  botToken?: string;
  channelId?: string;
}

interface LineConfig {
  channelAccessToken: string;
  channelSecret?: string;
}

interface KakaoTalkConfig {
  apiKey: string;
  adminKey?: string;
}

// Get all notification apps
export const getAllNotificationApps = async (req: AuthRequest, res: Response) => {
  try {
    const apps = await query<any>(
      `SELECT * FROM "NotificationApp" ORDER BY "createdAt" DESC`
    );

    // Sanitize sensitive data
    const sanitizedApps = apps.map(app => {
      const config = JSON.parse(app.config);
      let sanitizedConfig: any = {};

      switch (app.type) {
        case 'SLACK':
          sanitizedConfig = {
            ...config,
            botToken: config.botToken ? '••••••••' + config.botToken.slice(-8) : '',
            userToken: config.userToken ? '••••••••' + config.userToken.slice(-8) : '',
            clientSecret: config.clientSecret ? '••••••••' + config.clientSecret.slice(-8) : '',
            signingSecret: config.signingSecret ? '••••••••' + config.signingSecret.slice(-8) : '',
          };
          break;
        case 'TELEGRAM':
          sanitizedConfig = {
            ...config,
            botToken: config.botToken ? '••••••••' + config.botToken.slice(-8) : '',
          };
          break;
        case 'DISCORD':
          sanitizedConfig = {
            ...config,
            botToken: config.botToken ? '••••••••' + config.botToken.slice(-8) : '',
            webhookUrl: config.webhookUrl ? config.webhookUrl.replace(/\/[\w-]+\/[\w-]+$/, '/••••••••/••••••••') : '',
          };
          break;
        case 'LINE':
          sanitizedConfig = {
            ...config,
            channelAccessToken: config.channelAccessToken ? '••••••••' + config.channelAccessToken.slice(-8) : '',
            channelSecret: config.channelSecret ? '••••••••' + config.channelSecret.slice(-8) : '',
          };
          break;
        case 'KAKAOTALK':
          sanitizedConfig = {
            ...config,
            apiKey: config.apiKey ? '••••••••' + config.apiKey.slice(-8) : '',
            adminKey: config.adminKey ? '••••••••' + config.adminKey.slice(-8) : '',
          };
          break;
      }

      return {
        ...app,
        config: JSON.stringify(sanitizedConfig),
      };
    });

    res.json(sanitizedApps);
  } catch (error: any) {
    errorLogger.error('Error fetching notification apps:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get notification app by ID
export const getNotificationAppById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const app = await queryOne<any>(
      `SELECT * FROM "NotificationApp" WHERE id = $1`,
      [id]
    );

    if (!app) {
      return res.status(404).json({ error: 'Notification app not found' });
    }

    res.json(app);
  } catch (error: any) {
    errorLogger.error('Error fetching notification app:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create notification app
export const createNotificationApp = async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, config, isActive } = req.body;

    if (!name || !type || !config) {
      return res.status(400).json({ error: 'Name, type, and config are required' });
    }

    // Validate config is valid JSON
    try {
      JSON.parse(config);
    } catch (e) {
      return res.status(400).json({ error: 'Config must be valid JSON' });
    }

    // Check if name already exists
    const existing = await queryOne<any>(
      `SELECT id FROM "NotificationApp" WHERE name = $1`,
      [name]
    );

    if (existing) {
      return res.status(400).json({ error: 'App with this name already exists' });
    }

    const activeFlag = isActive ?? true;

    // If isActive is true, deactivate all other apps of the same type
    if (activeFlag) {
      await query(
        `UPDATE "NotificationApp" SET "isActive" = false, "updatedAt" = $1
         WHERE type = $2 AND "isActive" = true`,
        [new Date(), type]
      );
    }

    const app = await queryOne<any>(
      `INSERT INTO "NotificationApp" (id, name, type, config, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING *`,
      [randomUUID(), name, type, config, activeFlag, new Date()]
    );

    res.status(201).json(app);
  } catch (error: any) {
    errorLogger.error('Error creating notification app:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update notification app
export const updateNotificationApp = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, config, isActive } = req.body;

    const existing = await queryOne<any>(
      `SELECT * FROM "NotificationApp" WHERE id = $1`,
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Notification app not found' });
    }

    // Validate config if provided
    if (config) {
      try {
        JSON.parse(config);
      } catch (e) {
        return res.status(400).json({ error: 'Config must be valid JSON' });
      }
    }

    // If isActive is true, deactivate all other apps of the same type
    if (isActive) {
      const effectiveType = type || existing.type;
      await query(
        `UPDATE "NotificationApp" SET "isActive" = false, "updatedAt" = $1
         WHERE type = $2 AND "isActive" = true AND id != $3`,
        [new Date(), effectiveType, id]
      );
    }

    // Build dynamic SET clause
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (type !== undefined) {
      setClauses.push(`type = $${paramIndex++}`);
      params.push(type);
    }
    if (config !== undefined) {
      setClauses.push(`config = $${paramIndex++}`);
      params.push(config);
    }
    if (isActive !== undefined) {
      setClauses.push(`"isActive" = $${paramIndex++}`);
      params.push(isActive);
    }
    setClauses.push(`"updatedAt" = $${paramIndex++}`);
    params.push(new Date());

    params.push(id);

    const app = await queryOne<any>(
      `UPDATE "NotificationApp" SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    res.json(app);
  } catch (error: any) {
    errorLogger.error('Error updating notification app:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete notification app
export const deleteNotificationApp = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await queryOne<any>(
      `SELECT id FROM "NotificationApp" WHERE id = $1`,
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Notification app not found' });
    }

    await query(`DELETE FROM "NotificationApp" WHERE id = $1`, [id]);

    res.json({ message: 'Notification app deleted successfully' });
  } catch (error: any) {
    errorLogger.error('Error deleting notification app:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Test connection
export const testConnection = async (req: AuthRequest, res: Response) => {
  try {
    const { type, config } = req.body;

    if (!type || !config) {
      return res.status(400).json({ error: 'Type and config are required' });
    }

    let configObj: any;
    try {
      configObj = typeof config === 'string' ? JSON.parse(config) : config;
    } catch (e) {
      return res.status(400).json({ error: 'Invalid config JSON' });
    }

    switch (type) {
      case 'SLACK': {
        const slackConfig = configObj as SlackConfig;
        if (!slackConfig.botToken) {
          return res.status(400).json({ error: 'Bot token is required for Slack' });
        }

        const client = new WebClient(slackConfig.botToken);
        const authTest = await client.auth.test();

        if (!authTest.ok) {
          return res.status(400).json({ success: false, error: 'Failed to authenticate with Slack' });
        }

        return res.json({
          success: true,
          platform: 'Slack',
          workspace: authTest.team,
          botUser: authTest.user,
          userId: authTest.user_id,
        });
      }

      case 'TELEGRAM': {
        const telegramConfig = configObj as TelegramConfig;
        if (!telegramConfig.botToken) {
          return res.status(400).json({ error: 'Bot token is required for Telegram' });
        }

        // Test Telegram bot
        const response = await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/getMe`);
        const data: any = await response.json();

        if (!data.ok) {
          return res.status(400).json({ success: false, error: 'Failed to authenticate with Telegram' });
        }

        return res.json({
          success: true,
          platform: 'Telegram',
          botUsername: data.result.username,
          botName: data.result.first_name,
        });
      }

      case 'DISCORD': {
        const discordConfig = configObj as DiscordConfig;

        if (discordConfig.webhookUrl) {
          // Test webhook
          const response = await fetch(discordConfig.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '✅ PSTA 연결 테스트 성공' }),
          });

          if (!response.ok) {
            return res.status(400).json({ success: false, error: 'Failed to send test message' });
          }

          return res.json({
            success: true,
            platform: 'Discord',
            method: 'Webhook',
          });
        }

        return res.status(400).json({ error: 'Webhook URL or Bot Token is required for Discord' });
      }

      default:
        return res.status(400).json({ error: `Testing not implemented for ${type}` });
    }
  } catch (error: any) {
    errorLogger.error('Connection test error:', { error });
    res.status(400).json({
      success: false,
      error: 'Failed to test connection',
    });
  }
};

// Send message by email (unified interface)
export const sendMessageByEmail = async (req: AuthRequest, res: Response) => {
  try {
    const { email, message, type } = req.body;

    if (!email || !message) {
      return res.status(400).json({ error: 'Email and message are required' });
    }

    // Get active app of specified type (or first active app)
    let app: any;
    if (type) {
      app = await queryOne<any>(
        `SELECT * FROM "NotificationApp" WHERE "isActive" = true AND type = $1 LIMIT 1`,
        [type]
      );
    } else {
      app = await queryOne<any>(
        `SELECT * FROM "NotificationApp" WHERE "isActive" = true LIMIT 1`
      );
    }

    if (!app) {
      return res.status(404).json({ error: 'No active notification app found' });
    }

    const config = JSON.parse(app.config);

    switch (app.type) {
      case 'SLACK': {
        const slackConfig = config as SlackConfig;
        const client = new WebClient(slackConfig.botToken);

        // Lookup user by email
        const userResult = await client.users.lookupByEmail({ email });

        if (!userResult.ok || !userResult.user) {
          return res.status(404).json({ error: 'User not found in Slack workspace' });
        }

        const userId = userResult.user.id as string;

        // Open DM channel
        const dmChannel = await client.conversations.open({ users: userId });

        if (!dmChannel.ok || !dmChannel.channel) {
          return res.status(400).json({ error: 'Failed to open DM channel' });
        }

        // Send message
        const result = await client.chat.postMessage({
          channel: dmChannel.channel.id as string,
          text: message,
        });

        if (!result.ok) {
          return res.status(400).json({ error: 'Failed to send message' });
        }

        return res.json({
          success: true,
          platform: 'Slack',
          userId,
          timestamp: result.ts,
        });
      }

      default:
        return res.status(400).json({ error: `Sending messages not implemented for ${app.type}` });
    }
  } catch (error: any) {
    errorLogger.error('Error sending message:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
