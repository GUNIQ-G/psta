import { Request, Response } from 'express';
import prisma from '../config/database';
import { randomUUID } from 'crypto';
import { WebClient } from '@slack/web-api';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    username: string;
    role: string;
  };
}

// Get all Slack configurations
export const getAllSlackConfigs = async (req: AuthRequest, res: Response) => {
  try {
    const configs = await prisma.slackConfig.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Hide sensitive data
    const sanitizedConfigs = configs.map(config => ({
      ...config,
      botToken: config.botToken ? '••••••••' + config.botToken.slice(-8) : '',
      userToken: config.userToken ? '••••••••' + config.userToken.slice(-8) : '',
      clientSecret: config.clientSecret ? '••••••••' + config.clientSecret.slice(-8) : '',
      signingSecret: config.signingSecret ? '••••••••' + config.signingSecret.slice(-8) : '',
      verificationToken: config.verificationToken ? '••••••••' + config.verificationToken.slice(-8) : '',
    }));

    res.json(sanitizedConfigs);
  } catch (error: any) {
    console.error('Error fetching Slack configs:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch Slack configurations' });
  }
};

// Get Slack configuration by ID
export const getSlackConfigById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const config = await prisma.slackConfig.findUnique({
      where: { id },
    });

    if (!config) {
      return res.status(404).json({ error: 'Slack configuration not found' });
    }

    res.json(config);
  } catch (error: any) {
    console.error('Error fetching Slack config:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch Slack configuration' });
  }
};

// Create Slack configuration
export const createSlackConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { name, botToken, userToken, signingSecret, verificationToken, appId, clientId, clientSecret, isActive } = req.body;

    if (!name || !botToken) {
      return res.status(400).json({ error: 'Name and Bot Token are required' });
    }

    // Check if name already exists
    const existing = await prisma.slackConfig.findFirst({
      where: { name },
    });

    if (existing) {
      return res.status(400).json({ error: 'Configuration with this name already exists' });
    }

    // If isActive is true, deactivate all other configs
    if (isActive) {
      await prisma.slackConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false, updatedAt: new Date() },
      });
    }

    const config = await prisma.slackConfig.create({
      data: {
        id: randomUUID(),
        name,
        botToken,
        userToken,
        signingSecret,
        verificationToken,
        appId,
        clientId,
        clientSecret,
        isActive: isActive ?? true,
        updatedAt: new Date(),
      },
    });

    res.status(201).json(config);
  } catch (error: any) {
    console.error('Error creating Slack config:', error);
    res.status(500).json({ error: error.message || 'Failed to create Slack configuration' });
  }
};

// Update Slack configuration
export const updateSlackConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, botToken, userToken, signingSecret, verificationToken, appId, clientId, clientSecret, isActive } = req.body;

    const existing = await prisma.slackConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Slack configuration not found' });
    }

    // If isActive is true, deactivate all other configs
    if (isActive) {
      await prisma.slackConfig.updateMany({
        where: {
          isActive: true,
          id: { not: id }
        },
        data: { isActive: false, updatedAt: new Date() },
      });
    }

    const config = await prisma.slackConfig.update({
      where: { id },
      data: {
        name,
        botToken,
        userToken,
        signingSecret,
        verificationToken,
        appId,
        clientId,
        clientSecret,
        isActive,
        updatedAt: new Date(),
      },
    });

    res.json(config);
  } catch (error: any) {
    console.error('Error updating Slack config:', error);
    res.status(500).json({ error: error.message || 'Failed to update Slack configuration' });
  }
};

// Delete Slack configuration
export const deleteSlackConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.slackConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Slack configuration not found' });
    }

    await prisma.slackConfig.delete({
      where: { id },
    });

    res.json({ message: 'Slack configuration deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting Slack config:', error);
    res.status(500).json({ error: error.message || 'Failed to delete Slack configuration' });
  }
};

// Test Slack connection
export const testSlackConnection = async (req: AuthRequest, res: Response) => {
  try {
    const { botToken } = req.body;

    if (!botToken) {
      return res.status(400).json({ error: 'Bot Token is required' });
    }

    const client = new WebClient(botToken);

    // Test auth
    const authTest = await client.auth.test();

    if (!authTest.ok) {
      return res.status(400).json({
        success: false,
        error: 'Failed to authenticate with Slack'
      });
    }

    res.json({
      success: true,
      workspace: authTest.team,
      botUser: authTest.user,
      userId: authTest.user_id,
    });
  } catch (error: any) {
    console.error('Slack connection test error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to connect to Slack'
    });
  }
};

// Get Slack user by email
export const getSlackUserByEmail = async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Get active Slack config
    const config = await prisma.slackConfig.findFirst({
      where: { isActive: true },
    });

    if (!config) {
      return res.status(404).json({ error: 'No active Slack configuration found' });
    }

    const client = new WebClient(config.botToken);

    // Lookup user by email
    const result = await client.users.lookupByEmail({ email });

    if (!result.ok || !result.user) {
      return res.status(404).json({ error: 'User not found in Slack workspace' });
    }

    res.json({
      id: result.user.id,
      name: result.user.name,
      realName: result.user.real_name,
      email: result.user.profile?.email,
    });
  } catch (error: any) {
    console.error('Error looking up Slack user:', error);
    res.status(500).json({ error: error.message || 'Failed to lookup Slack user' });
  }
};

// Send DM to user
export const sendDirectMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, message } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ error: 'User ID and message are required' });
    }

    // Get active Slack config
    const config = await prisma.slackConfig.findFirst({
      where: { isActive: true },
    });

    if (!config) {
      return res.status(404).json({ error: 'No active Slack configuration found' });
    }

    const client = new WebClient(config.botToken);

    // Open DM channel
    const dmChannel = await client.conversations.open({
      users: userId,
    });

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

    res.json({
      success: true,
      timestamp: result.ts,
    });
  } catch (error: any) {
    console.error('Error sending Slack DM:', error);
    res.status(500).json({ error: error.message || 'Failed to send Slack DM' });
  }
};

// Send DM by email
export const sendDirectMessageByEmail = async (req: AuthRequest, res: Response) => {
  try {
    const { email, message } = req.body;

    if (!email || !message) {
      return res.status(400).json({ error: 'Email and message are required' });
    }

    // Get active Slack config
    const config = await prisma.slackConfig.findFirst({
      where: { isActive: true },
    });

    if (!config) {
      return res.status(404).json({ error: 'No active Slack configuration found' });
    }

    const client = new WebClient(config.botToken);

    // Lookup user by email
    const userResult = await client.users.lookupByEmail({ email });

    if (!userResult.ok || !userResult.user) {
      return res.status(404).json({ error: 'User not found in Slack workspace' });
    }

    const userId = userResult.user.id as string;

    // Open DM channel
    const dmChannel = await client.conversations.open({
      users: userId,
    });

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

    res.json({
      success: true,
      userId,
      timestamp: result.ts,
    });
  } catch (error: any) {
    console.error('Error sending Slack DM by email:', error);
    res.status(500).json({ error: error.message || 'Failed to send Slack DM' });
  }
};
