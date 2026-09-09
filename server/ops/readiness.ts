import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve('data');
const DB_FILE = path.join(DATA_DIR, 'ubika_persistent_db.json');

export type ReadinessResult =
  | { ready: true; checks: { dataDirectory: true; databaseFile: true; databaseShape: true } }
  | {
      ready: false;
      checks: {
        dataDirectory: boolean;
        databaseFile: boolean;
        databaseShape: boolean;
      };
      reason: 'DATA_DIRECTORY_UNAVAILABLE' | 'DATABASE_FILE_UNAVAILABLE' | 'DATABASE_INVALID';
    };

function hasDatabaseShape(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const state = value as Record<string, unknown>;
  return Array.isArray(state.users) && Array.isArray(state.companies);
}

export function checkReadiness(): ReadinessResult {
  let dataDirectory = false;
  let databaseFile = false;
  let databaseShape = false;

  try {
    dataDirectory = fs.statSync(DATA_DIR).isDirectory();
  } catch {
    dataDirectory = false;
  }

  if (!dataDirectory) {
    return {
      ready: false,
      checks: { dataDirectory, databaseFile, databaseShape },
      reason: 'DATA_DIRECTORY_UNAVAILABLE',
    };
  }

  try {
    databaseFile = fs.statSync(DB_FILE).isFile();
  } catch {
    databaseFile = false;
  }

  if (!databaseFile) {
    return {
      ready: false,
      checks: { dataDirectory, databaseFile, databaseShape },
      reason: 'DATABASE_FILE_UNAVAILABLE',
    };
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    databaseShape = hasDatabaseShape(JSON.parse(raw));
  } catch {
    databaseShape = false;
  }

  if (!databaseShape) {
    return {
      ready: false,
      checks: { dataDirectory, databaseFile, databaseShape },
      reason: 'DATABASE_INVALID',
    };
  }

  return {
    ready: true,
    checks: { dataDirectory: true, databaseFile: true, databaseShape: true },
  };
}
