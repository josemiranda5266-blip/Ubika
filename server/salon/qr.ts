import { randomBytes } from 'node:crypto';

const QR_TOKEN_BYTES = 24;

/**
 * Generates an opaque public identifier for a table QR.
 * It contains no company, table, user, or credential information.
 */
export function generatePublicTableQrToken(): string {
  return randomBytes(QR_TOKEN_BYTES).toString('base64url');
}

/**
 * Builds the public route encoded by a table QR.
 * The application/router resolves the token server-side.
 */
export function buildPublicTableQrPath(token: string): string {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) {
    throw new Error('TABLE_QR_TOKEN_INVALID');
  }

  return `/mesa/${token}`;
}
