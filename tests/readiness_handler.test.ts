import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { readinessHandler } from '../server/ops/readiness-handler.js';

const DATA_DIR = path.resolve('data');
const DB_FILE = path.join(DATA_DIR, 'ubika_persistent_db.json');

test('readiness handler returns 200 when persistence is valid', async () => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const original = fs.existsSync(DB_FILE) ? fs.readFileSync(DB_FILE, 'utf8') : null;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], companies: [] }), 'utf8');
    const app = express();
    app.get('/api/readiness', readinessHandler);
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/readiness`);
    assert.equal(response.status, 200);
    const body = await response.json() as { ready: boolean };
    assert.equal(body.ready, true);

    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  } finally {
    if (original === null) fs.rmSync(DB_FILE, { force: true });
    else fs.writeFileSync(DB_FILE, original, 'utf8');
  }
});

test('readiness handler returns 503 for invalid persistence', async () => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const original = fs.existsSync(DB_FILE) ? fs.readFileSync(DB_FILE, 'utf8') : null;
  try {
    fs.writeFileSync(DB_FILE, '{invalid-json', 'utf8');
    const app = express();
    app.get('/api/readiness', readinessHandler);
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/readiness`);
    assert.equal(response.status, 503);
    const body = await response.json() as { ready: boolean; reason?: string };
    assert.equal(body.ready, false);
    assert.equal(body.reason, 'DATABASE_INVALID');

    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  } finally {
    if (original === null) fs.rmSync(DB_FILE, { force: true });
    else fs.writeFileSync(DB_FILE, original, 'utf8');
  }
});
