import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import prisma from '../config/database';
import appLogger, { errorLogger } from '../config/logger';

// Get all system settings
export const getSystemSettings = async (req: Request, res: Response) => {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { category: 'general' },
    });

    // Convert array to object for easier access
    const settingsObject: { [key: string]: string } = {};
    settings.forEach((setting) => {
      settingsObject[setting.key] = setting.value;
    });

    res.json(settingsObject);
  } catch (error: any) {
    errorLogger.error('Error fetching system settings:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get a specific setting by key
export const getSettingByKey = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const setting = await prisma.systemSetting.findUnique({
      where: { key },
    });

    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({ key: setting.key, value: setting.value });
  } catch (error: any) {
    errorLogger.error('Error fetching setting:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update or create a setting
export const updateSetting = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (!value && value !== '') {
      return res.status(400).json({ error: 'Value is required' });
    }

    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: {
        value,
        updatedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        key,
        value,
        category: 'general',
        updatedAt: new Date(),
      },
    });

    res.json(setting);
  } catch (error: any) {
    errorLogger.error('Error updating setting:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update multiple settings at once
export const updateSettings = async (req: Request, res: Response) => {
  try {
    const settings = req.body; // { systemName: 'value', systemDescription: 'value', ... }

    const updates = Object.entries(settings).map(([key, value]) => {
      return prisma.systemSetting.upsert({
        where: { key },
        update: {
          value: value as string,
          updatedAt: new Date(),
        },
        create: {
          id: randomUUID(),
          key,
          value: value as string,
          category: 'general',
          updatedAt: new Date(),
        },
      });
    });

    await Promise.all(updates);

    res.json({ message: 'Settings updated successfully' });
  } catch (error: any) {
    errorLogger.error('Error updating settings:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Upload system logo
export const uploadLogo = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const logoUrl = `/uploads/system-logos/${req.file.filename}`;

    // Save logo URL to system settings
    await prisma.systemSetting.upsert({
      where: { key: 'systemLogo' },
      update: {
        value: logoUrl,
        updatedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        key: 'systemLogo',
        value: logoUrl,
        category: 'general',
        updatedAt: new Date(),
      },
    });

    res.json({ logoUrl });
  } catch (error: any) {
    errorLogger.error('Error uploading logo:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete logo
export const deleteLogo = async (req: Request, res: Response) => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'systemLogo' },
    });

    if (setting) {
      // Delete the file
      const filepath = path.join(__dirname, '../../', setting.value);

      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }

      // Delete from database
      await prisma.systemSetting.delete({
        where: { key: 'systemLogo' },
      });
    }

    res.json({ message: 'Logo deleted successfully' });
  } catch (error: any) {
    errorLogger.error('Error deleting logo:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Upload favicon
export const uploadFavicon = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const faviconUrl = `/uploads/system-logos/${req.file.filename}`;

    // Save favicon URL to system settings
    await prisma.systemSetting.upsert({
      where: { key: 'favicon' },
      update: {
        value: faviconUrl,
        updatedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        key: 'favicon',
        value: faviconUrl,
        category: 'general',
        updatedAt: new Date(),
      },
    });

    res.json({ faviconUrl });
  } catch (error: any) {
    errorLogger.error('Error uploading favicon:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete favicon
export const deleteFavicon = async (req: Request, res: Response) => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'favicon' },
    });

    if (setting) {
      // Delete the file
      const filepath = path.join(__dirname, '../../', setting.value);

      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }

      // Delete from database
      await prisma.systemSetting.delete({
        where: { key: 'favicon' },
      });
    }

    res.json({ message: 'Favicon deleted successfully' });
  } catch (error: any) {
    errorLogger.error('Error deleting favicon:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
