import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import './setup_env';

const { createBackupV2, listBackupsV2, restoreBackupV2 } = await import('../server/ops/backup');
const { saveDatabaseSync } = await import('../server/db');

const dataDir = path.resolve('data');
const dbFile = path.join(dataDir, 'ubika_persistent_db.json');
const backupDir = path.join(dataDir, 'backups');

function assertDatabaseReadable(): void {
  const parsed = JSON.parse(fs.readFileSync(dbFile, 'utf8')) as Record<string, unknown>;
  assert.ok(Array.isArray(parsed.users));
  assert.ok(Array.isArray(parsed.companies));
}

async function runBackupV2Tests() {
  console.log('====================================================');
  console.log('UBIKA — BACKUP V2 TESTS');
  console.log('====================================================');

  saveDatabaseSync();
  assertDatabaseReadable();

  const backup = createBackupV2();
  assert.match(backup.fileName, /^ubika_backup_v2_\d+\.json$/);
  assert.equal(typeof backup.sha256, 'string');
  assert.equal(backup.sha256.length, 64);
  assert.ok(backup.bytes > 0);

  const backupPath = path.join(backupDir, backup.fileName);
  const manifestPath = `${backupPath}.manifest.json`;
  assert.ok(fs.existsSync(backupPath));
  assert.ok(fs.existsSync(manifestPath));

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
  assert.equal(manifest.format, 'ubika-backup-v2');
  assert.equal(manifest.sha256, backup.sha256);
  assert.equal(manifest.bytes, backup.bytes);

  const listed = listBackupsV2();
  assert.ok(listed.some((item) => item.fileName === backup.fileName));
  assert.ok(listed.every((item) => item.sha256 === crypto.createHash('sha256').update(fs.readFileSync(path.join(backupDir, item.fileName))).digest('hex')));

  // Tampering with the backup payload must fail closed before restore.
  const originalBackup = fs.readFileSync(backupPath);
  fs.writeFileSync(backupPath, Buffer.concat([originalBackup, Buffer.from('\n')]));
  assert.throws(() => restoreBackupV2(backup.fileName), /BACKUP_SIZE_MISMATCH|BACKUP_INTEGRITY_FAILED/);
  fs.writeFileSync(backupPath, originalBackup);

  // The restore path must preserve the live state first and then reload it.
  const beforeRestore = fs.readFileSync(dbFile, 'utf8');
  const result = restoreBackupV2(backup.fileName);
  assert.equal(result.restoredFrom, backup.fileName);
  assert.match(result.rollbackBackup, /^ubika_backup_v2_\d+\.json$/);
  assertDatabaseReadable();
  const afterRestore = fs.readFileSync(dbFile, 'utf8');
  assert.equal(JSON.parse(afterRestore).users.length, JSON.parse(beforeRestore).users.length);

  // Retention must never expose more than the configured maximum number of snapshots.
  for (let i = 0; i < 12; i += 1) {
    createBackupV2();
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  assert.ok(listBackupsV2().length <= 10);

  // Traversal / arbitrary path input must be rejected.
  assert.throws(() => restoreBackupV2('../ubika_persistent_db.json'), /INVALID_BACKUP_PATH|BACKUP_NOT_FOUND/);

  console.log('✔ Backup creation, manifest integrity and retention listing');
  console.log('✔ Tampered payload rejected by size/hash validation');
  console.log('✔ Restore and rollback snapshot creation');
  console.log('✔ Retention limit enforced');
  console.log('✔ Path traversal protection');
  console.log('✔ BACKUP V2 TESTS: OK');
}

runBackupV2Tests().catch((error) => {
  console.error('✖ BACKUP V2 TESTS: FAILED');
  console.error(error);
  process.exit(1);
});
