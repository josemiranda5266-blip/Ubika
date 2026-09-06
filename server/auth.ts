import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db, UserRecord, UserRole } from './db';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not configured. Server cannot start.');
}

const JWT_EXPIRES_IN = '24h';

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

export function generateAuthToken(user: UserRecord): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  const payload: AuthenticatedUserPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
    driverId: user.driverId,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function authenticateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Autenticación requerida',
      message: 'No se proveyó un token Bearer válido en el encabezado Authorization',
    });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token || token.split('.').length !== 3) {
    return res.status(401).json({
      error: 'Token inválido',
      message: 'El encabezado Authorization no contiene un JWT válido',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as Partial<AuthenticatedUserPayload>;
    if (typeof decoded.userId !== 'string' || decoded.userId.length === 0) {
      return res.status(401).json({ error: 'Token inválido', message: 'El token no identifica a un usuario válido' });
    }

    const userInDb = db.getUserById(decoded.userId);
    if (!userInDb || !userInDb.active) {
      return res.status(401).json({
        error: 'Usuario inactivo o no encontrado',
        message: 'La sesión ya no es válida',
      });
    }

    // Refresh all mutable identity/authorization fields from persistence so
    // email, name, role, tenant and driver changes take effect immediately
    // without waiting for JWT expiration.
    req.user = {
      userId: userInDb.id,
      email: userInDb.email,
      name: userInDb.name,
      role: userInDb.role,
      companyId: userInDb.companyId,
      driverId: userInDb.driverId,
    };
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Token inválido o expirado',
      message: 'Por favor inicie sesión nuevamente',
    });
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
      return res.status(403).json({
        error: 'Acceso denegado',
        message: `El rol '${req.user.role}' no tiene permisos suficientes para esta acción`,
      });
    }

    next();
  };
}

/**
 * In-memory rate limiter keyed by the TCP peer address. This intentionally
 * does not use req.ip until proxy trust is explicitly configured, preventing
 * X-Forwarded-For spoofing from rotating the limiter key.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastRateLimitCleanup = 0;

export function rateLimit(limitWindowMs: number, maxRequests: number) {
  if (!Number.isFinite(limitWindowMs) || limitWindowMs <= 0) {
    throw new Error('limitWindowMs must be a positive number');
  }
  if (!Number.isFinite(maxRequests) || maxRequests <= 0) {
    throw new Error('maxRequests must be a positive number');
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.socket.remoteAddress || 'anonymous';
    const now = Date.now();

    if (now - lastRateLimitCleanup >= RATE_LIMIT_CLEANUP_INTERVAL_MS) {
      for (const [entryKey, entry] of rateLimitMap) {
        if (entry.resetAt <= now) rateLimitMap.delete(entryKey);
      }
      lastRateLimitCleanup = now;
    }

    const entry = rateLimitMap.get(key);
    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(key, { count: 1, resetAt: now + limitWindowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      return res.status(429).json({
        error: 'Demasiadas solicitudes',
        message: 'Límite de tasa alcanzado. Por favor intente nuevamente en unos segundos.',
      });
    }

    entry.count += 1;
    next();
  };
}
