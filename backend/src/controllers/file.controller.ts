import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query, queryOne } from '../config/database';
import { randomUUID } from 'crypto';
import fs from 'fs';
import { UserRole } from '../types/enums';
import appLogger, { errorLogger } from '../config/logger';

/**
 * Upload file to item (action, team, service, or project)
 */
export const uploadFile = async (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!itemId) {
      return res.status(400).json({ error: 'Item ID is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get item with full hierarchy (up to 4 levels)
    const item = await queryOne<any>(
      `SELECT i1.id, i1.type, i1."parentId",
              i2.id AS "parent_id", i2.type AS "parent_type", i2."parentId" AS "parent_parentId",
              i3.id AS "gp_id", i3.type AS "gp_type", i3."parentId" AS "gp_parentId",
              i4.id AS "ggp_id", i4.type AS "ggp_type"
       FROM "Item" i1
       LEFT JOIN "Item" i2 ON i2.id = i1."parentId"
       LEFT JOIN "Item" i3 ON i3.id = i2."parentId"
       LEFT JOIN "Item" i4 ON i4.id = i3."parentId"
       WHERE i1.id = $1`,
      [itemId]
    );

    if (!item) {
      // Delete uploaded file if item doesn't exist
      fs.unlinkSync(req.file.path);
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

    // Decode originalname to handle Korean characters properly
    // multer receives filename in latin1 encoding, need to convert to UTF-8
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    const fileId = randomUUID();
    const now = new Date();

    // Create file record
    await query(
      `INSERT INTO "File" (id, filename, "originalName", filepath, filesize, mimetype, "itemId", "projectId", "serviceId", "teamId", "uploadedById", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [fileId, req.file.filename, originalName, req.file.path, req.file.size, req.file.mimetype, itemId, projectId, serviceId, teamId, userId, now, now]
    );

    const file = await queryOne<any>(
      `SELECT f.*,
              u.id AS "ub_id", u.username AS "ub_username", u."displayName" AS "ub_displayName"
       FROM "File" f
       LEFT JOIN "User" u ON u.id = f."uploadedById"
       WHERE f.id = $1`,
      [fileId]
    );

    const response = {
      ...file,
      UploadedBy: file.ub_id ? {
        id: file.ub_id,
        username: file.ub_username,
        displayName: file.ub_displayName,
      } : null,
    };
    delete response.ub_id;
    delete response.ub_username;
    delete response.ub_displayName;

    res.json(response);
  } catch (error) {
    errorLogger.error('Error uploading file:', { error });
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get files for an item
 */
export const getItemFiles = async (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.params;

    const rows = await query<any>(
      `SELECT f.*,
              u.id AS "ub_id", u.username AS "ub_username", u."displayName" AS "ub_displayName"
       FROM "File" f
       LEFT JOIN "User" u ON u.id = f."uploadedById"
       WHERE f."itemId" = $1
       ORDER BY f."createdAt" DESC`,
      [itemId]
    );

    const files = rows.map((f: any) => {
      const file = {
        ...f,
        UploadedBy: f.ub_id ? {
          id: f.ub_id,
          username: f.ub_username,
          displayName: f.ub_displayName,
        } : null,
      };
      delete file.ub_id;
      delete file.ub_username;
      delete file.ub_displayName;
      return file;
    });

    res.json(files);
  } catch (error) {
    errorLogger.error('Error fetching files:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all files with hierarchy information
 */
export const getAllFiles = async (req: AuthRequest, res: Response) => {
  try {
    const rows = await query<any>(
      `SELECT f.*,
              u.id AS "ub_id", u.username AS "ub_username", u."displayName" AS "ub_displayName",
              ut.id AS "ub_team_id", ut.name AS "ub_team_name",
              i1.id AS "item_id", i1.name AS "item_name", i1.type AS "item_type",
              c1.id AS "item_client_id", c1.name AS "item_client_name", c1."logoUrl" AS "item_client_logoUrl",
              i2.id AS "item_p_id", i2.name AS "item_p_name", i2.type AS "item_p_type",
              c2.id AS "item_p_client_id", c2.name AS "item_p_client_name", c2."logoUrl" AS "item_p_client_logoUrl",
              i3.id AS "item_pp_id", i3.name AS "item_pp_name", i3.type AS "item_pp_type",
              c3.id AS "item_pp_client_id", c3.name AS "item_pp_client_name", c3."logoUrl" AS "item_pp_client_logoUrl",
              i4.id AS "item_ppp_id", i4.name AS "item_ppp_name", i4.type AS "item_ppp_type",
              c4.id AS "item_ppp_client_id", c4.name AS "item_ppp_client_name", c4."logoUrl" AS "item_ppp_client_logoUrl"
       FROM "File" f
       LEFT JOIN "User" u ON u.id = f."uploadedById"
       LEFT JOIN "Team" ut ON ut.id = u."teamId"
       LEFT JOIN "Item" i1 ON i1.id = f."itemId"
       LEFT JOIN "Client" c1 ON c1.id = i1."clientId"
       LEFT JOIN "Item" i2 ON i2.id = i1."parentId"
       LEFT JOIN "Client" c2 ON c2.id = i2."clientId"
       LEFT JOIN "Item" i3 ON i3.id = i2."parentId"
       LEFT JOIN "Client" c3 ON c3.id = i3."clientId"
       LEFT JOIN "Item" i4 ON i4.id = i3."parentId"
       LEFT JOIN "Client" c4 ON c4.id = i4."clientId"
       ORDER BY f."createdAt" DESC`
    );

    const files = rows.map((f: any) => {
      const buildClient = (id: string | null, name: string | null, logoUrl: string | null) =>
        id ? { id, name, logoUrl } : null;

      const buildItem = (id: string | null, name: string | null, type: string | null, client: any, parent: any) =>
        id ? { id, name, type, Client: client, Item: parent } : null;

      const item_ppp = buildItem(f.item_ppp_id, f.item_ppp_name, f.item_ppp_type, buildClient(f.item_ppp_client_id, f.item_ppp_client_name, f.item_ppp_client_logoUrl), null);
      const item_pp = buildItem(f.item_pp_id, f.item_pp_name, f.item_pp_type, buildClient(f.item_pp_client_id, f.item_pp_client_name, f.item_pp_client_logoUrl), item_ppp);
      const item_p = buildItem(f.item_p_id, f.item_p_name, f.item_p_type, buildClient(f.item_p_client_id, f.item_p_client_name, f.item_p_client_logoUrl), item_pp);
      const item = buildItem(f.item_id, f.item_name, f.item_type, buildClient(f.item_client_id, f.item_client_name, f.item_client_logoUrl), item_p);

      const result: any = {};
      for (const key of Object.keys(f)) {
        if (!key.startsWith('ub_') && !key.startsWith('item_')) {
          result[key] = f[key];
        }
      }
      result.UploadedBy = f.ub_id ? {
        id: f.ub_id,
        username: f.ub_username,
        displayName: f.ub_displayName,
        Team: f.ub_team_id ? { id: f.ub_team_id, name: f.ub_team_name } : null,
      } : null;
      result.Item = item;
      return result;
    });

    res.json(files);
  } catch (error) {
    errorLogger.error('Error fetching all files:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all files and links for an item and its descendants (hierarchical)
 */
export const getHierarchicalDocuments = async (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.params;

    // Get the item with its type
    const item = await queryOne<any>(
      `SELECT id, type FROM "Item" WHERE id = $1`,
      [itemId]
    );

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    let itemIds: string[] = [itemId];

    // Collect all descendant item IDs based on hierarchy
    switch (item.type) {
      case 'PROJECT': {
        const services = await query<any>(
          `SELECT id FROM "Item" WHERE "parentId" = $1 AND type = 'SERVICE'`,
          [itemId]
        );
        const serviceIds = services.map((s: any) => s.id);
        itemIds = [...itemIds, ...serviceIds];

        if (serviceIds.length > 0) {
          const placeholders = serviceIds.map((_: any, i: number) => `$${i + 1}`).join(', ');
          const actions = await query<any>(
            `SELECT id FROM "Item" WHERE "parentId" IN (${placeholders}) AND type = 'ACTION'`,
            serviceIds
          );
          itemIds = [...itemIds, ...actions.map((a: any) => a.id)];
        }
        break;
      }
      case 'SERVICE': {
        const serviceActions = await query<any>(
          `SELECT id FROM "Item" WHERE "parentId" = $1 AND type = 'ACTION'`,
          [itemId]
        );
        itemIds = [...itemIds, ...serviceActions.map((a: any) => a.id)];
        break;
      }
      case 'ACTION':
        break;
    }

    const placeholders = itemIds.map((_: any, i: number) => `$${i + 1}`).join(', ');

    // Get all files for these items
    const fileRows = await query<any>(
      `SELECT f.*,
              u.id AS "ub_id", u.username AS "ub_username", u."displayName" AS "ub_displayName",
              ut.id AS "ub_team_id", ut.name AS "ub_team_name",
              i1.id AS "item_id", i1.name AS "item_name", i1.type AS "item_type",
              i2.id AS "item_p_id", i2.name AS "item_p_name", i2.type AS "item_p_type",
              i3.id AS "item_pp_id", i3.name AS "item_pp_name", i3.type AS "item_pp_type"
       FROM "File" f
       LEFT JOIN "User" u ON u.id = f."uploadedById"
       LEFT JOIN "Team" ut ON ut.id = u."teamId"
       LEFT JOIN "Item" i1 ON i1.id = f."itemId"
       LEFT JOIN "Item" i2 ON i2.id = i1."parentId"
       LEFT JOIN "Item" i3 ON i3.id = i2."parentId"
       WHERE f."itemId" IN (${placeholders})
       ORDER BY f."createdAt" DESC`,
      itemIds
    );

    const files = fileRows.map((f: any) => {
      const item_pp = f.item_pp_id ? { id: f.item_pp_id, name: f.item_pp_name, type: f.item_pp_type } : null;
      const item_p = f.item_p_id ? { id: f.item_p_id, name: f.item_p_name, type: f.item_p_type, Item: item_pp } : null;
      const itemObj = f.item_id ? { id: f.item_id, name: f.item_name, type: f.item_type, Item: item_p } : null;

      const result: any = {};
      for (const key of Object.keys(f)) {
        if (!key.startsWith('ub_') && !key.startsWith('item_')) {
          result[key] = f[key];
        }
      }
      result.UploadedBy = f.ub_id ? {
        id: f.ub_id,
        username: f.ub_username,
        displayName: f.ub_displayName,
        Team: f.ub_team_id ? { id: f.ub_team_id, name: f.ub_team_name } : null,
      } : null;
      result.Item = itemObj;
      return result;
    });

    // Get all links for these items
    const linkRows = await query<any>(
      `SELECT l.*,
              u.id AS "cb_id", u.username AS "cb_username", u."displayName" AS "cb_displayName",
              ut.id AS "cb_team_id", ut.name AS "cb_team_name",
              i1.id AS "item_id", i1.name AS "item_name", i1.type AS "item_type",
              i2.id AS "item_p_id", i2.name AS "item_p_name", i2.type AS "item_p_type",
              i3.id AS "item_pp_id", i3.name AS "item_pp_name", i3.type AS "item_pp_type"
       FROM "Link" l
       LEFT JOIN "User" u ON u.id = l."createdById"
       LEFT JOIN "Team" ut ON ut.id = u."teamId"
       LEFT JOIN "Item" i1 ON i1.id = l."itemId"
       LEFT JOIN "Item" i2 ON i2.id = i1."parentId"
       LEFT JOIN "Item" i3 ON i3.id = i2."parentId"
       WHERE l."itemId" IN (${placeholders})
       ORDER BY l."createdAt" DESC`,
      itemIds
    );

    const links = linkRows.map((l: any) => {
      const item_pp = l.item_pp_id ? { id: l.item_pp_id, name: l.item_pp_name, type: l.item_pp_type } : null;
      const item_p = l.item_p_id ? { id: l.item_p_id, name: l.item_p_name, type: l.item_p_type, Item: item_pp } : null;
      const itemObj = l.item_id ? { id: l.item_id, name: l.item_name, type: l.item_type, Item: item_p } : null;

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
      result.Item = itemObj;
      return result;
    });

    res.json({ files, links });
  } catch (error) {
    errorLogger.error('Error fetching hierarchical documents:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete file
 * Only ADMIN or uploader can delete
 */
export const deleteFile = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get file
    const file = await queryOne<any>(
      `SELECT * FROM "File" WHERE id = $1`,
      [id]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check permissions: only ADMIN or uploader can delete
    if (userRole !== UserRole.ADMIN && file.uploadedById !== userId) {
      return res.status(403).json({ error: 'You do not have permission to delete this file' });
    }

    // Delete file from filesystem
    if (fs.existsSync(file.filepath)) {
      fs.unlinkSync(file.filepath);
    }

    // Delete file record
    await query(`DELETE FROM "File" WHERE id = $1`, [id]);

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    errorLogger.error('Error deleting file:', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
