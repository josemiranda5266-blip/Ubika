import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, saveDatabaseSync } from '../db';

const DATA_DIR = path.resolve('data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = path.join(DATA_DIR, 'ubika_persistent_db.json');
const BACKUP_PREFIX = 'ubika_backup_v2_';
const MAX_BACKUPS = 10;

interface BackupManifest {
  format: 'ubika-backup-v2';
  createdAt: string;
  source: string;
  sha256: string;
  bytes: number;
}

function ensureBackupDirectory(): void {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

function isAuthorizedBackupFile(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  const root = path.resolve(BACKUPS_DIR) + path.sep;
  return resolved.startsWith(root) && path.basename(resolved).startsWith(BACKUP_PREFIX) && resolved.endsWith('.json');
}

function sha256File(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function validateDatabaseShape(value: unknown): asserts value is { users: unknown[]; companies: unknown[] } {
  if (!value || typeof value !== 'object') throw new Error('INVALID_BACKUP_FORMAT');
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.users) || !Array.isArray(candidate.companies)) {
    throw new Error('INVALID_BACKUP_SCHEMA');
  }
}

function validateManifest(manifest: BackupManifest, backupPath: string): void {
  if (manifest.format !== 'ubika-backup-v2') throw new Error('UNSUPPORTED_BACKUP_FORMAT');
  const actualBytes = fs.statSync(backupPath).size;
  if (manifest.bytes !== actualBytes) throw new Error('BACKUP_SIZE_MISMATCH');
  if (manifest.sha256 !== sha256File(backupPath)) throw new Error('BACKUP_INTEGRITY_FAILED');
}

export function createBackupV2(): { fileName: string; sha256: string; bytes: number } {
  ensureBackupDirectory();
  if (!fs.existsSync(DB_FILE)) throw new Error('DATABASE_FILE_NOT_FOUND');

  // Ensure the snapshot reflects the current in-memory database state.
  saveDatabaseSync();
  if (!fs.existsSync(DB_FILE)) throw new Error('DATABASE_FILE_NOT_FOUND');

  const timestamp = Date.now();
  const fileName = `${BACKUP_PREFIX}${timestamp}.json`;
  const target = path.join(BACKUPS_DIR, fileName);
  const source = fs.readFileSync(DB_FILE);
  const sha256 = crypto.createHash('sha256').update(source).digest('hex');

  const temp = `${target}.tmp`;
  fs.writeFileSync(temp, source, { flag: 'wx' });
  fs.renameSync(temp, target);

  const manifest: BackupManifest = {
    format: 'ubika-backup-v2',
    createdAt: new Date(timestamp).toISOString(),
    source: 'ubika_persistent_db.json',
    sha256,
    bytes: source.byteLength,
  };
  fs.writeFileSync(`${target}.manifest.json`, JSON.stringify(manifest, null, 2), 'utf8');

  const backups = fs.readdirSync(BACKUPS_DIR)
    .filter((name) => name.startsWith(BACKUP_PREFIX) && name.endsWith('.json') && !name.endsWith('.manifest.json'))
    .sort();
  while (backups.length > MAX_BACKUPS) {
    const oldest = backups.shift();
    if (oldest) {
      fs.rmSync(path.join(BACKUPS_DIR, oldest), { force: true });
      fs.rmSync(`${path.join(BACKUPS_DIR, oldest)}.manifest.json`, { force: true });
    }
  }

  return { fileName, sha256, bytes: source.byteLength };
}

export function restoreBackupV2(fileName: string): { restoredFrom: string; rollbackBackup: string } {
  ensureBackupDirectory();
  const backupPath = path.join(BACKUPS_DIR, path.basename(fileName));
  if (!isAuthorizedBackupFile(backupPath)) throw new Error('INVALID_BACKUP_PATH');
  if (!fs.existsSync(backupPath)) throw new Error('BACKUP_NOT_FOUND');

  const manifestPath = `${backupPath}.manifest.json`;
  if (!fs.existsSync(manifestPath)) throw new Error('BACKUP_MANIFEST_NOT_FOUND');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BackupManifest;
  validateManifest(manifest, backupPath);

  const parsed = JSON.parse(fs.readFileSync(backupPath, 'utf8')) as unknown;
  validateDatabaseShape(parsed);

  // Always preserve the live database before replacing it.
  const rollback = createBackupV2();
  const restoreTemp = `${DB_FILE}.restore.${Date.now()}.tmp`;
  fs.writeFileSync(restoreTemp, JSON.stringify(parsed, null, 2), 'utf8');

  try {
    JSON.parse(fs.readFileSync(restoreTemp, 'utf8'));
    fs.renameSync(restoreTemp, DB_FILE);
    db.reloadFromDisk();
  } catch (error) {
    fs.rmSync(restoreTemp, { force: true });
    const rollbackPath = path.join(BACKUPS_DIR, rollback.fileName);
    fs.copyFileSync(rollbackPath, DB_FILE);
    db.reloadFromDisk();
    throw error;
  }

  return { restoredFrom: fileName, rollbackBackup: rollback.fileName };
}

export function listBackupsV2(): Array<{ fileName: string; bytes: number; sha256: string }> {
  ensureBackupDirectory();
  return fs.readdirSync(BACKUPS_DIR)
    .filter((name) => name.startsWith(BACKUP_PREFIX) && name.endsWith('.json') && !name.endsWith('.manifest.json'))
    .sort()
    .reverse()
    .map((fileName) => ({
      fileName,
      bytes: fs.statSync(path.join(BACKUPS_DIR, fileName)).size,
      sha256: sha256File(path.join(BACKUPS_DIR, fileName)),
    }));
}
