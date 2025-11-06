import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { randomUUID } from 'crypto';

export const getClients = async (req: AuthRequest, res: Response) => {
  try {
    const clients = await prisma.client.findMany({
      where: { isActive: true },
      include: {
        Item: {
          where: {
            type: 'PROJECT',
            parentId: null,
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(clients);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createClient = async (req: AuthRequest, res: Response) => {
  try {
    const { name, code, phone, email, businessNumber, representative, address, description, logoUrl } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    const client = await prisma.client.create({
      data: {
        id: randomUUID(),
        name,
        code,
        phone,
        email,
        businessNumber,
        representative,
        address,
        description,
        logoUrl,
        updatedAt: new Date(),
      },
    });

    res.status(201).json(client);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateClient = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, phone, email, businessNumber, representative, address, description, logoUrl, isActive } = req.body;

    const client = await prisma.client.update({
      where: { id },
      data: {
        name,
        code,
        phone,
        email,
        businessNumber,
        representative,
        address,
        description,
        logoUrl,
        isActive,
        updatedAt: new Date()
      },
    });

    res.json(client);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteClient = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.client.update({
      where: { id },
      data: { isActive: false, updatedAt: new Date() },
    });

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};