import assert from 'node:assert/strict';
import express from 'express';
import { createBackupHandler, restoreBackupHandler } from '../server/ops/backup-handlers.js';

const app = express();
app.use(express.json());
app.post('/backup', createBackupHandler);
app.post('/restore', restoreBackupHandler);

const restoreRoute = (app as any)._router.stack.find((layer: any) => layer.route?.path === '/restore');
assert.ok(restoreRoute, 'restore route should be registered');

let status = 200;
let payload: unknown;
const res = {
  status(code: number) {
    status = code;
    return this;
  },
  json(value: unknown) {
    payload = value;
    return this;
  },
} as any;

restoreBackupHandler({ body: {} } as any, res);
assert.equal(status, 400);
assert.deepEqual(payload, { success: false, error: 'INVALID_BACKUP_FILE_NAME' });

restoreBackupHandler({ body: { fileName: 'x'.repeat(256) } } as any, res);
assert.equal(status, 400);
assert.deepEqual(payload, { success: false, error: 'INVALID_BACKUP_FILE_NAME' });

console.log('backup_handlers.test.ts: OK');
