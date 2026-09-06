import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { sendSafeError, toSafeErrorResponse } from '../server/ops/http-errors';

async function request(server: http.Server, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: (server.address() as { port: number }).port, path }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTest() {
  assert.deepEqual(toSafeErrorResponse(new Error('PRODUCT_NOT_FOUND')), {
    status: 404,
    body: { error: 'PRODUCT_NOT_FOUND', message: 'El producto no existe.' },
  });

  assert.equal(toSafeErrorResponse(new Error('INSUFFICIENT_STOCK_NEGATIVE_RESULT')).status, 409);
  assert.equal(toSafeErrorResponse(new Error('UNAUTHORIZED_SOMETHING')).status, 403);
  assert.equal(toSafeErrorResponse(new Error('database password=secret')).status, 500);
  assert.equal(toSafeErrorResponse(new Error('database password=secret')).body.message.includes('secret'), false);

  const app = express();
  app.get('/safe', (_req, res) => sendSafeError(res, new Error('PRODUCT_NOT_FOUND')));
  app.get('/unknown', (_req, res) => sendSafeError(res, new Error('database password=secret')));
  const server = app.listen(0);
  try {
    const safe = await request(server, '/safe');
    assert.equal(safe.status, 404);
    assert.deepEqual(JSON.parse(safe.body), {
      error: 'PRODUCT_NOT_FOUND',
      message: 'El producto no existe.',
    });

    const unknown = await request(server, '/unknown');
    assert.equal(unknown.status, 500);
    assert.equal(unknown.body.includes('password=secret'), false);

    console.log('HTTP error contract tests passed');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runTest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
