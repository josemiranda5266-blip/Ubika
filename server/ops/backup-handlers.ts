import type { Request, Response } from 'express';
import { createBackupV2, listBackupsV2, restoreBackupV2 } from './backup.js';

function backupErrorStatus(error: unknown): number {
  const code = error instanceof Error ? error.message : '';
  switch (code) {
    case 'BACKUP_NOT_FOUND':
    case 'BACKUP_MANIFEST_NOT_FOUND':
    case 'DATABASE_FILE_NOT_FOUND':
      return 404;
    case 'INVALID_BACKUP_PATH':
    case 'INVALID_BACKUP_FORMAT':
    case 'INVALID_BACKUP_SCHEMA':
    case 'INVALID_BACKUP_MANIFEST':
    case 'BACKUP_SIZE_MISMATCH':
    case 'BACKUP_INTEGRITY_FAILED':
      return 400;
    default:
      return 500;
  }
}

function backupErrorCode(error: unknown): string {
  return error instanceof Error ? error.message : 'BACKUP_OPERATION_FAILED';
}

/** Production-safe adapter for the v2 backup service. Authentication/RBAC is mounted by server.ts. */
export function createBackupHandler(_req: Request, res: Response): void {
  try {
    res.json({ success: true, ...createBackupV2(), timestamp: Date.now() });
  } catch (error) {
    res.status(backupErrorStatus(error)).json({
      success: false,
      error: backupErrorCode(error),
    });
  }
}

export function listBackupsHandler(_req: Request, res: Response): void {
  try {
    res.json({ success: true, backups: listBackupsV2() });
  } catch (error) {
    res.status(500).json({ success: false, error: backupErrorCode(error) });
  }
}

export function restoreBackupHandler(req: Request, res: Response): void {
  const fileName = req.body?.fileName;
  if (typeof fileName !== 'string' || fileName.trim().length === 0 || fileName.length > 255) {
    res.status(400).json({ success: false, error: 'INVALID_BACKUP_FILE_NAME' });
    return;
  }

  try {
    res.json({ success: true, ...restoreBackupV2(fileName), timestamp: Date.now() });
  } catch (error) {
    res.status(backupErrorStatus(error)).json({
      success: false,
      error: backupErrorCode(error),
    });
  }
}
