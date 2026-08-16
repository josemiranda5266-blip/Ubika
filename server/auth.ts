import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db, UserRecord, UserRole } from './db';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not configured');
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

/**
 * Generate signed JWT token
 */
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

/**
 * Middleware: Verify Bearer Token and attach user payload to req.user
 */
export function authenticateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Autenticación requerida',
      message: 'No se proveyó un token Bearer válido en el encabezado Authorization',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as AuthenticatedUserPayload;
    
    // Verify user still exists in database
    const userInDb = db.getUserById(decoded.userId);
    if (!userInDb || !userInDb.active) {
      return res.status(401).json({
        error: 'Usuario inactivo o no encontrado',
        message: 'La sesión ya no es válida',
      });
    }

    req.user = {
      ...decoded,
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

/**
 * Middleware: Check if authenticated user has one of the allowed roles
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (req.user.role === 'SUPER_ADMIN') {
      return next(); // SUPER_ADMIN can bypass role restrictions
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
 * In-memory IP/Token rate limiter to prevent abuse on public tracking or auth endpoints
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(limitWindowMs: number, maxRequests: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.headers['x-forwarded-for']?.toString() || 'anonymous';
    const now = Date.now();
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
