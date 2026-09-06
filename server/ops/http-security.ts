import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Express } from 'express';

const REQUEST_ID_HEADER = 'X-Request-Id';
const DEFAULT_MAX_REQUEST_ID_LENGTH = 128;

function normalizeAllowedOrigins(): Set<string> {
  return new Set(
    (process.env.CORS_ALLOWED_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

export function getRequestId(req: Request): string {
  const incoming = req.header(REQUEST_ID_HEADER)?.trim();
  if (incoming && incoming.length <= DEFAULT_MAX_REQUEST_ID_LENGTH && /^[A-Za-z0-9._:-]+$/.test(incoming)) {
    return incoming;
  }
  return crypto.randomUUID();
}

export function applyHttpSecurity(app: Express): void {
  const allowedOrigins = normalizeAllowedOrigins();

  app.disable('x-powered-by');

  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = getRequestId(req);
    res.setHeader(REQUEST_ID_HEADER, requestId);

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(), camera=()');

    const origin = req.header('Origin');
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id, X-Idempotency-Key');

    if (req.method === 'OPTIONS') {
      if (origin && !allowedOrigins.has(origin)) {
        return res.sendStatus(403);
      }
      return res.sendStatus(204);
    }

    next();
  });
}

export function httpErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = res.getHeader(REQUEST_ID_HEADER)?.toString() || getRequestId(req);
  const message = err instanceof Error ? err.message : 'unknown error';
  console.error(`[UBIKA Server Error] requestId=${requestId}: ${message}`);

  if (res.headersSent) return;

  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Por favor intente nuevamente en unos instantes.',
    requestId,
  });
}
