import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { db, UserRecord, UserRole } from './db';

const JWT_SECRET = process.env.JWT_SECRET?.trim();
const isTest = process.env.NODE_ENV === 'test';

if (!JWT_SECRET && !isTest) {
  throw new Error('JWT_SECRET is not configured. Server cannot start.');
}

if (!isTest && JWT_SECRET && JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters in non-test environments.');
}

const SIGNING_SECRET = JWT_SECRET || 'test-only-ubika-jwt-secret-please-do-not-use';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '24h') as SignOptions['expiresIn'];

export interface AuthenticatedUserPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string;
  driverId?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUserPayload;
}

function isValidPayload(payload: JwtPayload): payload is JwtPayload & AuthenticatedUserPayload {
  return (
    typeof payload.userId === 'string' &&
    typeof payload.email === 'string' &&
    typeof payload.name === 'string' &&
    typeof payload.role === 'string' &&
    typeof payload.companyId === 'string'
  );
}

export function generateAuthToken(user: UserRecord): string {
  const payload: AuthenticatedUserPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
    driverId: user.driverId,
  };
  return jwt.sign(payload, SIGNING_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'ubika',
    audience: 'ubika-app',
  });
}

export function authenticateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !/^Bearer\s+\S+$/i.test(authHeader)) {
    return res.status(401).json({ error: 'Autenticación requerida' });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  try {
    const decoded = jwt.verify(token, SIGNING_SECRET, {
      algorithms: ['HS256'],
      issuer: 'ubika',
      audience: 'ubika-app',
    });

    if (typeof decoded !== 'object' || !isValidPayload(decoded)) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    const userInDb = db.getUserById(decoded.userId);
    if (!userInDb || !userInDb.active) {
      return res.status(401).json({ error: 'Sesión no válida' });
    }

    req.user = {
      userId: userInDb.id,
      email: userInDb.email,
      name: userInDb.name,
      role: userInDb.role,
      companyId: userInDb.companyId,
      driverId: userInDb.driverId,
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    return next();
  };
}

interface RateLimitEntry { count: number; resetAt: number; }
const rateLimitMap = new Map<string, RateLimitEntry>();
let lastRateLimitCleanup = Date.now();

/**
 * Process-local limiter. It intentionally remains dependency-free for the MVP;
 * production deployments with multiple instances should use a shared store.
 */
export function rateLimit(limitWindowMs: number, maxRequests: number) {
  if (!Number.isFinite(limitWindowMs) || limitWindowMs <= 0 || !Number.isFinite(maxRequests) || maxRequests <= 0) {
    throw new Error('Invalid rate limit configuration');
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (now - lastRateLimitCleanup > 5 * 60 * 1000) {
      for (const [key, entry] of rateLimitMap) {
        if (entry.resetAt <= now) rateLimitMap.delete(key);
      }
      lastRateLimitCleanup = now;
    }

    const key = req.ip || 'anonymous';
    const entry = rateLimitMap.get(key);

    if (!entry || now >= entry.resetAt) {
      rateLimitMap.set(key, { count: 1, resetAt: now + limitWindowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'Demasiadas solicitudes',
        message: 'Límite de tasa alcanzado. Intente nuevamente más tarde.',
      });
    }

    entry.count += 1;
    return next();
  };
}
