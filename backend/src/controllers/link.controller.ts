import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query, queryOne } from '../config/database';
import { randomUUID } from 'crypto';
import { UserRole } from '../types/enums';
import https from 'https';
import http from 'http';
import appLogger, { errorLogger } from '../config/logger';

/**
 * Create link for item (action, team, service, or project)
 */
export const createLink = async (req: AuthRequest, res: Response) => {
  try {
    const { itemId, url, displayName } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!itemId || !url || !displayName) {
      return res.status(400).json({ error: 'Item ID, URL, and display name are required' });
    }

    // Get item with full hierarchy
    const item = await queryOne<any>(
      `SELECT i1.id, i1.type, i1."parentId",
              i2.id AS "parent_id", i2."parentId" AS "parent_parentId",
              i3.id AS "gp_id", i3."parentId" AS "gp_parentId"
       FROM "Item" i1
       LEFT JOIN "Item" i2 ON i2.id = i1."parentId"
       LEFT JOIN "Item" i3 ON i3.id = i2."parentId"
       WHERE i1.id = $1`,
      [itemId]
    );

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Extract hierarchy IDs
    let projectId: string | null = null;
    let serviceId: string | null = null;
    let teamId: string | null = null;

    // Determine hierarchy based on item type
    switch (item.type) {
      case 'ACTION':
        teamId = item.parentId;
        if (item.parent_id) {
          serviceId = item.parent_parentId;
          if (item.gp_id) {
            projectId = item.gp_parentId;
          }
        }
        break;
      case 'TEAM':
        teamId = item.id;
        serviceId = item.parentId;
        if (item.parent_id) {
          projectId = item.parent_parentId;
        }
        break;
      case 'SERVICE':
        serviceId = item.id;
        projectId = item.parentId;
        break;
      case 'PROJECT':
        projectId = item.id;
        break;
    }

    const linkId = randomUUID();
    const now = new Date();

    // Create link record
    await query(
      `INSERT INTO "Link" (id, url, "displayName", "itemId", "projectId", "serviceId", "teamId", "createdById", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [linkId, url, displayName, itemId, projectId, serviceId, teamId, userId, now, now]
    );

    const link = await queryOne<any>(
      `SELECT l.*,
              u.id AS "cb_id", u.username AS "cb_username", u."displayName" AS "cb_displayName"
       FROM "Link" l
       LEFT JOIN "User" u ON u.id = l."createdById"
       WHERE l.id = $1`,
      [linkId]
    );

    const response = {
      ...link,
      CreatedBy: link.cb_id ? {
        id: link.cb_id,
        username: link.cb_username,
        displayName: link.cb_displayName,
      } : null,
    };
    delete response.cb_id;
    delete response.cb_username;
    delete response.cb_displayName;

    res.json(response);
  } catch (error) {
    errorLogger.error('Error creating link:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get links for an item
 */
export const getItemLinks = async (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.params;

    const rows = await query<any>(
      `SELECT l.*,
              u.id AS "cb_id", u.username AS "cb_username", u."displayName" AS "cb_displayName"
       FROM "Link" l
       LEFT JOIN "User" u ON u.id = l."createdById"
       WHERE l."itemId" = $1
       ORDER BY l."createdAt" DESC`,
      [itemId]
    );

    const links = rows.map((l: any) => {
      const link = {
        ...l,
        CreatedBy: l.cb_id ? {
          id: l.cb_id,
          username: l.cb_username,
          displayName: l.cb_displayName,
        } : null,
      };
      delete link.cb_id;
      delete link.cb_username;
      delete link.cb_displayName;
      return link;
    });

    res.json(links);
  } catch (error) {
    errorLogger.error('Error fetching links:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all links with hierarchy information
 */
export const getAllLinks = async (req: AuthRequest, res: Response) => {
  try {
    const rows = await query<any>(
      `SELECT l.*,
              u.id AS "cb_id", u.username AS "cb_username", u."displayName" AS "cb_displayName",
              ut.id AS "cb_team_id", ut.name AS "cb_team_name",
              i1.id AS "item_id", i1.name AS "item_name", i1.type AS "item_type",
              c1.id AS "item_client_id", c1.name AS "item_client_name", c1."logoUrl" AS "item_client_logoUrl",
              i2.id AS "item_p_id", i2.name AS "item_p_name", i2.type AS "item_p_type",
              c2.id AS "item_p_client_id", c2.name AS "item_p_client_name", c2."logoUrl" AS "item_p_client_logoUrl",
              i3.id AS "item_pp_id", i3.name AS "item_pp_name", i3.type AS "item_pp_type",
              c3.id AS "item_pp_client_id", c3.name AS "item_pp_client_name", c3."logoUrl" AS "item_pp_client_logoUrl",
              i4.id AS "item_ppp_id", i4.name AS "item_ppp_name", i4.type AS "item_ppp_type",
              c4.id AS "item_ppp_client_id", c4.name AS "item_ppp_client_name", c4."logoUrl" AS "item_ppp_client_logoUrl"
       FROM "Link" l
       LEFT JOIN "User" u ON u.id = l."createdById"
       LEFT JOIN "Team" ut ON ut.id = u."teamId"
       LEFT JOIN "Item" i1 ON i1.id = l."itemId"
       LEFT JOIN "Client" c1 ON c1.id = i1."clientId"
       LEFT JOIN "Item" i2 ON i2.id = i1."parentId"
       LEFT JOIN "Client" c2 ON c2.id = i2."clientId"
       LEFT JOIN "Item" i3 ON i3.id = i2."parentId"
       LEFT JOIN "Client" c3 ON c3.id = i3."clientId"
       LEFT JOIN "Item" i4 ON i4.id = i3."parentId"
       LEFT JOIN "Client" c4 ON c4.id = i4."clientId"
       ORDER BY l."createdAt" DESC`
    );

    const links = rows.map((l: any) => {
      const buildClient = (id: string | null, name: string | null, logoUrl: string | null) =>
        id ? { id, name, logoUrl } : null;

      const buildItem = (id: string | null, name: string | null, type: string | null, client: any, parent: any) =>
        id ? { id, name, type, Client: client, Item: parent } : null;

      const item_ppp = buildItem(l.item_ppp_id, l.item_ppp_name, l.item_ppp_type, buildClient(l.item_ppp_client_id, l.item_ppp_client_name, l.item_ppp_client_logoUrl), null);
      const item_pp = buildItem(l.item_pp_id, l.item_pp_name, l.item_pp_type, buildClient(l.item_pp_client_id, l.item_pp_client_name, l.item_pp_client_logoUrl), item_ppp);
      const item_p = buildItem(l.item_p_id, l.item_p_name, l.item_p_type, buildClient(l.item_p_client_id, l.item_p_client_name, l.item_p_client_logoUrl), item_pp);
      const item = buildItem(l.item_id, l.item_name, l.item_type, buildClient(l.item_client_id, l.item_client_name, l.item_client_logoUrl), item_p);

      const result: any = {};
      for (const key of Object.keys(l)) {
        if (!key.startsWith('cb_') && !key.startsWith('item_')) {
          result[key] = l[key];
        }
      }
      result.CreatedBy = l.cb_id ? {
        id: l.cb_id,
        username: l.cb_username,
        displayName: l.cb_displayName,
        Team: l.cb_team_id ? { id: l.cb_team_id, name: l.cb_team_name } : null,
      } : null;
      result.Item = item;
      return result;
    });

    res.json(links);
  } catch (error) {
    errorLogger.error('Error fetching all links:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete link
 * Only ADMIN or creator can delete
 */
export const deleteLink = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get link
    const link = await queryOne<any>(
      `SELECT * FROM "Link" WHERE id = $1`,
      [id]
    );

    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }

    // Check permissions: only ADMIN or creator can delete
    if (userRole !== UserRole.ADMIN && link.createdById !== userId) {
      return res.status(403).json({ error: 'You do not have permission to delete this link' });
    }

    // Delete link record
    await query(`DELETE FROM "Link" WHERE id = $1`, [id]);

    res.json({ message: 'Link deleted successfully' });
  } catch (error) {
    errorLogger.error('Error deleting link:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get Nextcloud settings from database
 */
async function getNextcloudSettings(): Promise<{ url: string; username: string; password: string } | null> {
  try {
    const settings = await query<any>(
      `SELECT key, value FROM "SystemSetting" WHERE category = 'nextcloud'`
    );

    const settingsMap: Record<string, string> = {};
    settings.forEach((s: any) => {
      settingsMap[s.key] = s.value;
    });

    if (settingsMap.nextcloud_url && settingsMap.nextcloud_username && settingsMap.nextcloud_app_password) {
      return {
        url: settingsMap.nextcloud_url,
        username: settingsMap.nextcloud_username,
        password: settingsMap.nextcloud_app_password,
      };
    }
    return null;
  } catch (error) {
    errorLogger.error('Error loading Nextcloud settings:', { error });
    return null;
  }
}

/**
 * Fetch title from URL (for Nextcloud and other pages)
 * Extracts document name from page title or og:title meta tag
 */
export const fetchTitle = async (req: AuthRequest, res: Response) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Check if URL is a Nextcloud internal link and get auth settings
    const nextcloudSettings = await getNextcloudSettings();
    let authHeader: string | undefined;

    if (nextcloudSettings) {
      const nextcloudHost = new URL(nextcloudSettings.url).hostname;
      if (parsedUrl.hostname === nextcloudHost) {
        // This is a Nextcloud URL, use authentication
        const credentials = Buffer.from(`${nextcloudSettings.username}:${nextcloudSettings.password}`).toString('base64');
        authHeader = `Basic ${credentials}`;
      }
    }

    // Fetch the page HTML
    const html = await fetchHtml(parsedUrl.href, authHeader);

    // Extract title from HTML
    const title = extractTitle(html);

    if (title) {
      res.json({ title, url });
    } else {
      // Fallback: extract filename from URL path
      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
      const fallbackTitle = pathParts[pathParts.length - 1] || parsedUrl.hostname;
      res.json({ title: decodeURIComponent(fallbackTitle), url });
    }
  } catch (error) {
    errorLogger.error('Error fetching title:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Helper: Fetch HTML from URL (with optional auth)
 */
function fetchHtml(url: string, authHeader?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (compatible; PSTA/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const request = protocol.get(url, {
      timeout: 10000,
      headers,
    }, (response) => {
      // Handle redirects (preserve auth header for same host)
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const redirectUrl = response.headers.location.startsWith('http')
          ? response.headers.location
          : new URL(response.headers.location, url).href;

        // Keep auth header only if redirecting to same host
        const originalHost = new URL(url).hostname;
        const redirectHost = new URL(redirectUrl).hostname;
        const keepAuth = originalHost === redirectHost ? authHeader : undefined;

        fetchHtml(redirectUrl, keepAuth).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      let data = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => resolve(data));
      response.on('error', reject);
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Helper: Extract title from HTML
 * Tries og:title first, then <title> tag
 */
function extractTitle(html: string): string | null {
  // Try og:title first (often has cleaner filename for Nextcloud)
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if (ogTitleMatch && ogTitleMatch[1]) {
    return cleanTitle(ogTitleMatch[1]);
  }

  // Try <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    return cleanTitle(titleMatch[1]);
  }

  // Try h1 tag as last resort
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match && h1Match[1]) {
    return cleanTitle(h1Match[1]);
  }

  return null;
}

/**
 * Helper: Clean up extracted title
 * Removes common suffixes like " - Nextcloud", decodes HTML entities
 */
function cleanTitle(title: string): string {
  let cleaned = title.trim();

  // Decode HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));

  // Remove common Nextcloud suffixes
  cleaned = cleaned.replace(/\s*[-–—]\s*(Nextcloud|Files|Documents).*$/i, '');

  return cleaned;
}
