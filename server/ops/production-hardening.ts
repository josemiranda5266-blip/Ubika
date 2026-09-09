import type { Express, Request, Response } from 'express';
import type { Server } from 'node:http';
import { getTrustProxyHops } from './runtime-config.js';
import { applyHttpSecurity, httpErrorHandler } from './http-security.js';
import { readinessHandler } from './readiness-handler.js';
import { installGracefulShutdown } from './graceful-shutdown.js';

/**
 * Single integration point for the operational hardening modules.
 * Keep this function small so the main server only needs one explicit call.
 */
export function applyProductionHardening(app: Express): void {
  app.set('trust proxy', getTrustProxyHops());
  applyHttpSecurity(app);

  app.get('/api/readiness', readinessHandler);

  // Error middleware must remain last in the application stack.
  app.use(httpErrorHandler);
}

/** Attach signal handling only after the HTTP server has been created. */
export function attachProductionShutdown(server: Server): () => void {
  return installGracefulShutdown(server);
}

/** Small health helper kept here only for callers that want explicit liveness semantics. */
export function livenessHandler(_req: Request, res: Response): void {
  res.json({
    status: 'ok',
    service: 'ubika',
    timestamp: Date.now(),
  });
}
