import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { query, queryOne } from '../config/database';
import appLogger, { errorLogger } from '../config/logger';

const SETTING_DEFAULTS: Record<string, string> = {
  systemName: 'PSTA',
  systemDescription: 'Project-Service-Team-Action 관리 시스템',
  systemLogo: '/psta-logo.png',
  favicon: '/psta-favicon.png',
  copyrightText: 'PSTA. All rights reserved.',
  adminEmail: '',
};

// Get all system settings
export const getSystemSettings = async (req: Request, res: Response) => {
  try {
    const settings = await query<any>(
      `SELECT * FROM "SystemSetting" WHERE category = 'general'`
    );

    // 기본값 먼저 적용 후 DB 값으로 덮어씀
    const settingsObject: Record<string, string> = { ...SETTING_DEFAULTS };
    settings.forEach((setting: any) => {
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
    const setting = await queryOne<any>(
      `SELECT * FROM "SystemSetting" WHERE key = $1`,
      [key]
    );

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

    const now = new Date();

    const setting = await queryOne<any>(
      `INSERT INTO "SystemSetting" (id, key, value, category, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'general', $4, $4)
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value,
             "updatedAt" = EXCLUDED."updatedAt"
       RETURNING *`,
      [randomUUID(), key, value, now]
    );

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

    const now = new Date();

    const updates = Object.entries(settings).map(([key, value]) => {
      return queryOne<any>(
        `INSERT INTO "SystemSetting" (id, key, value, category, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'general', $4, $4)
         ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value,
               "updatedAt" = EXCLUDED."updatedAt"
         RETURNING *`,
        [randomUUID(), key, value as string, now]
      );
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
    const now = new Date();

    // Save logo URL to system settings
    await queryOne<any>(
      `INSERT INTO "SystemSetting" (id, key, value, category, "createdAt", "updatedAt")
       VALUES ($1, 'systemLogo', $2, 'general', $3, $3)
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value,
             "updatedAt" = EXCLUDED."updatedAt"
       RETURNING *`,
      [randomUUID(), logoUrl, now]
    );

    res.json({ logoUrl });
  } catch (error: any) {
    errorLogger.error('Error uploading logo:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete logo
export const deleteLogo = async (req: Request, res: Response) => {
  try {
    const setting = await queryOne<any>(
      `SELECT * FROM "SystemSetting" WHERE key = 'systemLogo'`
    );

    if (setting) {
      // Delete the file
      const filepath = path.join(__dirname, '../../', setting.value);

      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }

      // Delete from database
      await query(`DELETE FROM "SystemSetting" WHERE key = 'systemLogo'`);
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
    const now = new Date();

    // Save favicon URL to system settings
    await queryOne<any>(
      `INSERT INTO "SystemSetting" (id, key, value, category, "createdAt", "updatedAt")
       VALUES ($1, 'favicon', $2, 'general', $3, $3)
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value,
             "updatedAt" = EXCLUDED."updatedAt"
       RETURNING *`,
      [randomUUID(), faviconUrl, now]
    );

    res.json({ faviconUrl });
  } catch (error: any) {
    errorLogger.error('Error uploading favicon:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete favicon
export const deleteFavicon = async (req: Request, res: Response) => {
  try {
    const setting = await queryOne<any>(
      `SELECT * FROM "SystemSetting" WHERE key = 'favicon'`
    );

    if (setting) {
      // Delete the file
      const filepath = path.join(__dirname, '../../', setting.value);

      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }

      // Delete from database
      await query(`DELETE FROM "SystemSetting" WHERE key = 'favicon'`);
    }

    res.json({ message: 'Favicon deleted successfully' });
  } catch (error: any) {
    errorLogger.error('Error deleting favicon:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
