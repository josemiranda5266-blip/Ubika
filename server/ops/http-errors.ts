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
  CASH_SESSION_NOT_FOUND_OR_CLOSED: { status: 404, message: 'La caja no existe o ya está cerrada.' },
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
  PRODUCT_DESCRIPTION_TOO_LONG: { status: 400, message: 'La descripción del producto es demasiado larga.' },
  INVALID_PRODUCT_NAME: { status: 400, message: 'El nombre del producto no es válido.' },
  INVALID_SALE_PRICE: { status: 400, message: 'El precio de venta no es válido.' },
  INVALID_COST_PRICE: { status: 400, message: 'El precio de costo no es válido.' },
  INVALID_TAX_RATE: { status: 400, message: 'La tasa de impuesto no es válida.' },
  INVALID_STOCK: { status: 400, message: 'El stock indicado no es válido.' },
  INVALID_QUANTITY_MUST_BE_POSITIVE: { status: 400, message: 'La cantidad debe ser mayor que cero.' },
  INVALID_INITIAL_CASH: { status: 400, message: 'El efectivo inicial no es válido.' },
  INVALID_COUNTED_CASH: { status: 400, message: 'El efectivo contado no es válido.' },
  SALE_ITEMS_REQUIRED: { status: 400, message: 'La venta debe contener al menos un producto.' },
  PAYMENT_AMOUNT_MISMATCH_WITH_TOTAL: { status: 400, message: 'El importe de los pagos no coincide con el total de la venta.' },
  CUSTOMER_NAME_REQUIRED: { status: 400, message: 'El nombre del cliente es obligatorio.' },
  CUSTOMER_NAME_TOO_LONG: { status: 400, message: 'El nombre del cliente es demasiado largo.' },
  CUSTOMER_ADDRESS_TOO_LONG: { status: 400, message: 'La dirección del cliente es demasiado larga.' },
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

const GENERIC_BAD_REQUEST_PREFIXES = ['INVALID_', 'MISSING_'];
const GENERIC_BAD_REQUEST_SUFFIXES = ['_REQUIRED'];
const INTERNAL_ERROR_CODE = 'INTERNAL_SERVER_ERROR';
const INTERNAL_ERROR_MESSAGE = 'Por favor intente nuevamente en unos instantes.';

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

function isGenericBadRequestCode(code: string): boolean {
  return GENERIC_BAD_REQUEST_PREFIXES.some((prefix) => code.startsWith(prefix)) ||
    GENERIC_BAD_REQUEST_SUFFIXES.some((suffix) => code.endsWith(suffix));
}

function policyFor(code: string | undefined): ErrorPolicy {
  if (!code) return { status: 500, message: INTERNAL_ERROR_MESSAGE };
  if (POLICIES[code]) return POLICIES[code];
  if (isGenericBadRequestCode(code)) return { status: 400, message: 'Los datos enviados no son válidos.' };
  if (code.startsWith('UNAUTHORIZED_')) return { status: 403, message: 'No tiene permiso para realizar esta operación.' };
  if (code.startsWith('NOT_FOUND_')) return { status: 404, message: 'El recurso solicitado no existe.' };
  return { status: 500, message: INTERNAL_ERROR_MESSAGE };
}

function isKnownPublicCode(code: string | undefined): boolean {
  if (!code) return false;
  return !!POLICIES[code] ||
    isGenericBadRequestCode(code) ||
    code.startsWith('UNAUTHORIZED_') ||
    code.startsWith('NOT_FOUND_');
}

export function toSafeErrorResponse(error: unknown): { status: number; body: SafeErrorResponse } {
  const internalCode = extractCode(error);
  const policy = policyFor(internalCode);
  return {
    status: policy.status,
    body: {
      error: isKnownPublicCode(internalCode) ? internalCode! : INTERNAL_ERROR_CODE,
      message: policy.message,
    },
  };
}

export function sendSafeError(res: Response, error: unknown): void {
  const result = toSafeErrorResponse(error);
  res.status(result.status).json(result.body);
}
