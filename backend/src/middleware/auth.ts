import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { queryOne } from '../config/database';
import { UserRole } from '../types/enums';

export interface UserPayload {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: UserPayload;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const generateToken = (userId: string, username: string, email: string, displayName: string, role: UserRole): string => {
  const payload: UserPayload = { id: userId, username, email, displayName, role };
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '24h'
  });
};

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const user = await queryOne<{
      id: string;
      username: string;
      email: string;
      displayName: string;
      role: UserRole;
      isActive: boolean;
    }>(
      `SELECT id, username, email, "displayName", role, "isActive" FROM "User" WHERE id = $1`,
      [decoded.id]
    );

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid user' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
