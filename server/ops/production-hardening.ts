import type { Express, Request, Response } from 'express';
import type { Server } from 'node:http';
import { getTrustProxyHops } from './runtime-config.js';
import { applyHttpSecurity } from './http-security.js';
import { readinessHandler } from './readiness-handler.js';
import { installGracefulShutdown } from './graceful-shutdown.js';

/**
 * Single integration point for the operational hardening modules.
 * Keep this function small so the main server only needs one explicit call.
 *
 * The global error handler is intentionally not installed here: Express error
 * middleware must be registered after all application routes.
 */
export function applyProductionHardening(app: Express): void {
  app.set('trust proxy', getTrustProxyHops());
  applyHttpSecurity(app);
  app.get('/api/readiness', readinessHandler);
}

/** Attach signal handling only after the HTTP server has been created. */
export function attachProductionShutdown(server: Server): () => void {
  return installGracefulShutdown(server);
}

/** Explicit liveness response for callers that want a minimal probe. */
export function livenessHandler(_req: Request, res: Response): void {
  res.json({
    status: 'ok',
    service: 'ubika',
    timestamp: Date.now(),
  });
}
