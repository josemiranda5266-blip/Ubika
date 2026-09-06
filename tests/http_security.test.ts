import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { applyHttpSecurity, httpErrorHandler } from '../server/ops/http-security';

async function request(server: http.Server, options: http.RequestOptions): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ ...options, hostname: '127.0.0.1' }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => resolve({
        status: res.statusCode || 0,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTest() {
  process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com';

  const app = express();
  applyHttpSecurity(app);
  app.get('/ok', (_req, res) => res.json({ ok: true }));
  app.get('/boom', () => {
    throw new Error('sensitive internal detail');
  });
  app.use(httpErrorHandler);

  const server = app.listen(0);
  try {
    const address = server.address() as { port: number };
    const base = { port: address.port };

    const accepted = await request(server, {
      ...base,
      path: '/ok',
      method: 'GET',
      headers: { Origin: 'https://app.example.com', 'X-Request-Id': 'test-request-123' },
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.headers['access-control-allow-origin'], 'https://app.example.com');
    assert.equal(accepted.headers['x-request-id'], 'test-request-123');
    assert.equal(accepted.headers['x-powered-by'], undefined);

    const rejectedCors = await request(server, {
      ...base,
      path: '/ok',
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example.com' },
    });
    assert.equal(rejectedCors.status, 403);

    const preflight = await request(server, {
      ...base,
      path: '/ok',
      method: 'OPTIONS',
      headers: { Origin: 'https://app.example.com' },
    });
    assert.equal(preflight.status, 204);

    const error = await request(server, {
      ...base,
      path: '/boom',
      method: 'GET',
    });
    assert.equal(error.status, 500);
    assert.equal(error.body.includes('sensitive internal detail'), false);
    const parsed = JSON.parse(error.body);
    assert.equal(parsed.error, 'INTERNAL_SERVER_ERROR');
    assert.match(parsed.requestId, /^[0-9a-f-]{36}$/);

    console.log('HTTP security middleware tests passed');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runTest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
