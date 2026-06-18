import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query, queryOne } from '../config/database';
import { randomUUID } from 'crypto';
import { errorLogger } from '../config/logger';

export const getClients = async (req: AuthRequest, res: Response) => {
  try {
    const clients = await query<any>(
      `SELECT c.*,
              json_agg(i ORDER BY i."name" ASC) FILTER (WHERE i."id" IS NOT NULL) AS "Item"
       FROM "Client" c
       LEFT JOIN "Item" i ON i."clientId" = c."id" AND i."type" = 'PROJECT' AND i."parentId" IS NULL
       WHERE c."isActive" = true
       GROUP BY c."id"
       ORDER BY c."name" ASC`
    );

    // normalize Item: null -> []
    const result = clients.map((c: any) => ({
      ...c,
      Item: c.Item ?? [],
    }));

    res.json(result);
  } catch (error) {
    errorLogger.error('Get clients error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createClient = async (req: AuthRequest, res: Response) => {
  try {
    const { name, code, phone, email, businessNumber, representative, address, description, logoUrl } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    try {
      const client = await queryOne<any>(
        `INSERT INTO "Client" ("id", "name", "code", "phone", "email", "businessNumber", "representative", "address", "description", "logoUrl", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          randomUUID(),
          name,
          code,
          phone ?? null,
          email ?? null,
          businessNumber ?? null,
          representative ?? null,
          address ?? null,
          description ?? null,
          logoUrl ?? null,
          new Date(),
        ]
      );

      res.status(201).json(client);
    } catch (dbError: any) {
      if (dbError.code === '23505') {
        return res.status(409).json({ error: 'Already exists' });
      }
      throw dbError;
    }
  } catch (error) {
    errorLogger.error('Create client error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateClient = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, phone, email, businessNumber, representative, address, description, logoUrl, isActive } = req.body;

    const existing = await queryOne<any>(`SELECT * FROM "Client" WHERE "id" = $1`, [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Not found' });
    }

    const client = await queryOne<any>(
      `UPDATE "Client"
       SET "name" = $1, "code" = $2, "phone" = $3, "email" = $4,
           "businessNumber" = $5, "representative" = $6, "address" = $7,
           "description" = $8, "logoUrl" = $9, "isActive" = $10, "updatedAt" = $11
       WHERE "id" = $12
       RETURNING *`,
      [
        name !== undefined ? name : existing.name,
        code !== undefined ? code : existing.code,
        phone !== undefined ? phone : existing.phone,
        email !== undefined ? email : existing.email,
        businessNumber !== undefined ? businessNumber : existing.businessNumber,
        representative !== undefined ? representative : existing.representative,
        address !== undefined ? address : existing.address,
        description !== undefined ? description : existing.description,
        logoUrl !== undefined ? logoUrl : existing.logoUrl,
        isActive !== undefined ? isActive : existing.isActive,
        new Date(),
        id,
      ]
    );

    res.json(client);
  } catch (error) {
    errorLogger.error('Update client error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteClient = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await queryOne<any>(`SELECT "id" FROM "Client" WHERE "id" = $1`, [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Not found' });
    }

    await query(
      `UPDATE "Client" SET "isActive" = false, "updatedAt" = $1 WHERE "id" = $2`,
      [new Date(), id]
    );

    res.status(204).send();
  } catch (error) {
    errorLogger.error('Delete client error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadClientLogo = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Construct the URL path for the uploaded file
    const logoUrl = `/uploads/client-logos/${req.file.filename}`;

    res.status(200).json({
      url: logoUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
    });
  } catch (error) {
    errorLogger.error('Upload client logo error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
