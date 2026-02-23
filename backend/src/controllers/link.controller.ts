import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { randomUUID } from 'crypto';
import { UserRole } from '@prisma/client';
import https from 'https';
import http from 'http';

/**
 * Create link for item (action, team, service, or project)
 */
export const createLink = async (req: AuthRequest, res: Response) => {
  try {
    const { itemId, url, displayName } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!itemId || !url || !displayName) {
      return res.status(400).json({ message: 'Item ID, URL, and display name are required' });
    }

    // Get item with full hierarchy
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        Item: {
          include: {
            Item: {
              include: {
                Item: true, // Project level
              },
            },
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Extract hierarchy IDs
    let projectId: string | null = null;
    let serviceId: string | null = null;
    let teamId: string | null = null;

    // Determine hierarchy based on item type
    switch (item.type) {
      case 'ACTION':
        teamId = item.parentId;
        const team = item.Item;
        if (team) {
          serviceId = team.parentId;
          const service = team.Item;
          if (service) {
            projectId = service.parentId;
          }
        }
        break;
      case 'TEAM':
        teamId = item.id;
        serviceId = item.parentId;
        const teamService = item.Item;
        if (teamService) {
          projectId = teamService.parentId;
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

    // Create link record
    const link = await prisma.link.create({
      data: {
        id: randomUUID(),
        url,
        displayName,
        itemId,
        projectId,
        serviceId,
        teamId,
        createdById: userId,
        updatedAt: new Date(),
      },
      include: {
        CreatedBy: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    res.json(link);
  } catch (error) {
    console.error('Error creating link:', error);
    res.status(500).json({ message: 'Failed to create link' });
  }
};

/**
 * Get links for an item
 */
export const getItemLinks = async (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.params;

    const links = await prisma.link.findMany({
      where: { itemId },
      include: {
        CreatedBy: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(links);
  } catch (error) {
    console.error('Error fetching links:', error);
    res.status(500).json({ message: 'Failed to fetch links' });
  }
};

/**
 * Get all links with hierarchy information
 */
export const getAllLinks = async (req: AuthRequest, res: Response) => {
  try {
    const links = await prisma.link.findMany({
      include: {
        CreatedBy: {
          select: {
            id: true,
            username: true,
            displayName: true,
            Team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        Item: {
          include: {
            Client: true,
            Item: {
              include: {
                Client: true,
                Item: {
                  include: {
                    Client: true,
                    Item: {
                      include: {
                        Client: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(links);
  } catch (error) {
    console.error('Error fetching all links:', error);
    res.status(500).json({ message: 'Failed to fetch links' });
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
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get link
    const link = await prisma.link.findUnique({
      where: { id },
    });

    if (!link) {
      return res.status(404).json({ message: 'Link not found' });
    }

    // Check permissions: only ADMIN or creator can delete
    if (userRole !== UserRole.ADMIN && link.createdById !== userId) {
      return res.status(403).json({ message: 'You do not have permission to delete this link' });
    }

    // Delete link record
    await prisma.link.delete({
      where: { id },
    });

    res.json({ message: 'Link deleted successfully' });
  } catch (error) {
    console.error('Error deleting link:', error);
    res.status(500).json({ message: 'Failed to delete link' });
  }
};

/**
 * Get Nextcloud settings from database
 */
async function getNextcloudSettings(): Promise<{ url: string; username: string; password: string } | null> {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { category: 'nextcloud' },
    });

    const settingsMap: Record<string, string> = {};
    settings.forEach((s) => {
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
    console.error('Error loading Nextcloud settings:', error);
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
      return res.status(400).json({ message: 'URL is required' });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ message: 'Invalid URL format' });
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
    console.error('Error fetching title:', error);
    res.status(500).json({ message: 'Failed to fetch title from URL' });
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
