import assert from 'node:assert/strict';
import express from 'express';
import { applyProductionHardening } from '../server/ops/production-hardening.js';

process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com';
process.env.TRUST_PROXY_HOPS = '2';

const app = express();
applyProductionHardening(app);

assert.equal(app.get('trust proxy'), 2);

const layerPaths = (app as any)._router.stack
  .map((layer: any) => layer.route?.path)
  .filter(Boolean);
assert.ok(layerPaths.includes('/api/readiness'));

console.log('production_hardening.test.ts: OK');
