import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkReadiness } from '../server/ops/readiness';

const DATA_DIR = path.resolve('data');
const DB_FILE = path.join(DATA_DIR, 'ubika_persistent_db.json');

function runTest() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const original = fs.existsSync(DB_FILE) ? fs.readFileSync(DB_FILE, 'utf8') : null;

  try {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], companies: [] }), 'utf8');
    const ready = checkReadiness();
    assert.equal(ready.ready, true, 'Una base persistente con forma mínima válida debe quedar ready');

    fs.writeFileSync(DB_FILE, '{malformed-json', 'utf8');
    const malformed = checkReadiness();
    assert.equal(malformed.ready, false, 'JSON corrupto debe producir not-ready');
    assert.equal(malformed.reason, 'DATABASE_INVALID');

    fs.writeFileSync(DB_FILE, JSON.stringify({ users: {}, companies: [] }), 'utf8');
    const invalidShape = checkReadiness();
    assert.equal(invalidShape.ready, false, 'Una forma de DB inválida debe producir not-ready');
    assert.equal(invalidShape.reason, 'DATABASE_INVALID');

    console.log('✓ readiness.test.ts passed');
  } finally {
    if (original === null) fs.rmSync(DB_FILE, { force: true });
    else fs.writeFileSync(DB_FILE, original, 'utf8');
  }
}

runTest();
