import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '../utils/helpers';

export interface AuthPayload {
  userId: string;
  phone: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    sendError(res, 401, 'Missing or invalid Authorization header');
    return;
  }
  const token = header.slice(7);
  try {
    const secret = process.env.JWT_SECRET!;
    const payload = jwt.verify(token, secret) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    sendError(res, 401, 'Token expired or invalid');
  }
}

export function signToken(payload: AuthPayload): string {
  const secret = process.env.JWT_SECRET!;
  const expiresIn = (process.env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']) || '30d';
  return jwt.sign(payload, secret, { expiresIn });
}
