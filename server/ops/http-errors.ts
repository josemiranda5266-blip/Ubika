import type { Response } from 'express';

export interface SafeErrorResponse {
  error: string;
  message: string;
}

interface ErrorPolicy {
  status: number;
  message: string;
}

const POLICIES: Record<string, ErrorPolicy> = {
  PRODUCT_NOT_FOUND: { status: 404, message: 'El producto no existe.' },
  CATEGORY_NOT_FOUND: { status: 404, message: 'La categoría no existe.' },
  CUSTOMER_NOT_FOUND: { status: 404, message: 'El cliente no existe.' },
  SALE_NOT_FOUND: { status: 404, message: 'La venta no existe.' },
  CASH_SESSION_NOT_FOUND: { status: 404, message: 'La caja no existe.' },
  USER_NOT_FOUND: { status: 404, message: 'El usuario no existe.' },
  INSUFFICIENT_STOCK: { status: 409, message: 'No hay stock suficiente.' },
  INSUFFICIENT_STOCK_NEGATIVE_RESULT: { status: 409, message: 'El ajuste dejaría el stock en negativo.' },
  CASH_SESSION_ALREADY_OPEN: { status: 409, message: 'Ya existe una caja abierta.' },
  SALE_ALREADY_FINALIZED: { status: 409, message: 'La venta ya fue finalizada.' },
  IDEMPOTENCY_KEY_REUSED: { status: 409, message: 'La operación ya fue procesada con esa clave.' },
  CATEGORY_NAME_REQUIRED: { status: 400, message: 'El nombre de la categoría es obligatorio.' },
  CATEGORY_NAME_TOO_LONG: { status: 400, message: 'El nombre de la categoría es demasiado largo.' },
  PRODUCT_NAME_REQUIRED: { status: 400, message: 'El nombre del producto es obligatorio.' },
  PRODUCT_NAME_TOO_LONG: { status: 400, message: 'El nombre del producto es demasiado largo.' },
  INVALID_SALE_PRICE: { status: 400, message: 'El precio de venta no es válido.' },
  INVALID_STOCK: { status: 400, message: 'El stock indicado no es válido.' },
  LEGAL_CONSENT_REQUIRED: { status: 400, message: 'Debe aceptar los términos y políticas requeridos.' },
  UNAUTHORIZED_CASH_SESSION_CLOSURE: { status: 403, message: 'No tiene permiso para cerrar esta caja.' },
  INVALID_BACKUP_PATH: { status: 400, message: 'El archivo de respaldo no es válido.' },
  BACKUP_NOT_FOUND: { status: 404, message: 'El respaldo solicitado no existe.' },
  BACKUP_MANIFEST_NOT_FOUND: { status: 422, message: 'El respaldo no tiene un manifiesto válido.' },
  BACKUP_INTEGRITY_FAILED: { status: 422, message: 'El respaldo no superó la validación de integridad.' },
  BACKUP_SIZE_MISMATCH: { status: 422, message: 'El respaldo no superó la validación de tamaño.' },
  INVALID_BACKUP_FORMAT: { status: 422, message: 'El formato del respaldo no es válido.' },
  INVALID_BACKUP_SCHEMA: { status: 422, message: 'La estructura del respaldo no es válida.' },
  UNSUPPORTED_BACKUP_FORMAT: { status: 422, message: 'La versión del respaldo no es compatible.' },
};

const GENERIC_BAD_REQUEST_CODES = new Set([
  'INVALID_',
  'MISSING_',
  'REQUIRED',
]);

function extractCode(error: unknown): string | undefined {
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as { code?: unknown; message?: unknown };
  if (typeof candidate.code === 'string') return candidate.code;
  if (typeof candidate.message === 'string' && /^[A-Z][A-Z0-9_]+$/.test(candidate.message)) {
    return candidate.message;
  }
  return undefined;
}

function policyFor(code: string | undefined): ErrorPolicy {
  if (!code) return { status: 500, message: 'Por favor intente nuevamente en unos instantes.' };
  if (POLICIES[code]) return POLICIES[code];
  if ([...GENERIC_BAD_REQUEST_CODES].some((prefix) => code.startsWith(prefix) || code.endsWith(prefix))) {
    return { status: 400, message: 'Los datos enviados no son válidos.' };
  }
  if (code.startsWith('UNAUTHORIZED_')) return { status: 403, message: 'No tiene permiso para realizar esta operación.' };
  if (code.startsWith('NOT_FOUND_')) return { status: 404, message: 'El recurso solicitado no existe.' };
  return { status: 500, message: 'Por favor intente nuevamente en unos instantes.' };
}

export function toSafeErrorResponse(error: unknown): { status: number; body: SafeErrorResponse } {
  const code = extractCode(error);
  const policy = policyFor(code);
  return {
    status: policy.status,
    body: {
      error: code || 'INTERNAL_SERVER_ERROR',
      message: policy.message,
    },
  };
}

export function sendSafeError(res: Response, error: unknown): void {
  const result = toSafeErrorResponse(error);
  res.status(result.status).json(result.body);
}
