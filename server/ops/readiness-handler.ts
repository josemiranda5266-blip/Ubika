import type { Request, Response } from 'express';
import { checkReadiness } from './readiness.js';

/** Express handler for Kubernetes/load-balancer style readiness probes. */
export async function readinessHandler(_req: Request, res: Response): Promise<void> {
  const result = await checkReadiness();
  res.status(result.ready ? 200 : 503).json(result);
}
