import 'dotenv/config';
import crypto from 'node:crypto';

export interface PaymentProcessOptions {
  companyId: string;
  saleId: string;
  amount: number;
  paymentMethod: string;
  idempotencyKey?: string;
  externalReference?: string;
}

function getMercadoPagoAccessToken(): string {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
  if (token) return token;
  if (process.env.NODE_ENV === 'test') return 'TEST-MOCK-ACCESS-TOKEN';
  throw new Error('MERCADO_PAGO_ACCESS_TOKEN is required outside test environments');
}

function generateExternalReference(): string {
  return `ubika_pay_${crypto.randomUUID()}`;
}

/** Keep only payment fields that are useful to UBIKA; never persist arbitrary provider payloads. */
function sanitizeProviderResponse(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  const source = data as Record<string, unknown>;
  const allowed = ['status', 'status_detail', 'id', 'payment_method_id', 'transaction_amount', 'external_reference'];
  return Object.fromEntries(allowed.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
}

export const PaymentProviderService = {
  async createPayment(options: PaymentProcessOptions): Promise<{ success: boolean; externalReference: string; providerResponse: any }> {
    const accessToken = getMercadoPagoAccessToken();
    const isTest = process.env.NODE_ENV === 'test' || accessToken.startsWith('TEST-');
    const externalReference = options.externalReference || generateExternalReference();

    if (isTest) {
      return {
        success: true,
        externalReference,
        providerResponse: {
          status: 'approved',
          status_detail: 'accredited',
          id: `mp_${crypto.randomUUID()}`,
          payment_method_id: options.paymentMethod,
          transaction_amount: options.amount,
          external_reference: externalReference,
        },
      };
    }

    try {
      const response = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...(options.idempotencyKey ? { 'X-Idempotency-Key': options.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          transaction_amount: options.amount,
          description: `Venta UBIKA #${options.saleId}`,
          payment_method_id: options.paymentMethod,
          external_reference: externalReference,
        }),
      });

      const data = await response.json();
      const safeResponse = sanitizeProviderResponse(data);
      if (response.ok) {
        return {
          success: data.status === 'approved' || data.status === 'pending',
          externalReference,
          providerResponse: safeResponse,
        };
      }

      return { success: false, externalReference, providerResponse: safeResponse };
    } catch (err) {
      console.error('[PaymentProviderService Error]:', err instanceof Error ? err.message : 'unknown provider error');
      return {
        success: false,
        externalReference,
        providerResponse: { error: 'PAYMENT_PROVIDER_UNAVAILABLE' },
      };
    }
  },

  /** Partial refunds are sent with the requested amount and protected by an idempotency key. */
  async refundPayment(
    paymentId: string,
    amount?: number,
    idempotencyKey?: string,
  ): Promise<{ success: boolean; response: any }> {
    const accessToken = getMercadoPagoAccessToken();
    const isTest = process.env.NODE_ENV === 'test' || accessToken.startsWith('TEST-');
    const refundIdempotencyKey = idempotencyKey || `ubika_refund_${crypto.randomUUID()}`;

    if (isTest) {
      return {
        success: true,
        response: { status: 'refunded', id: paymentId, amount, idempotency_key: refundIdempotencyKey },
      };
    }

    try {
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': refundIdempotencyKey,
        },
        body: JSON.stringify(amount === undefined ? {} : { amount }),
      });
      const data = await response.json();
      return { success: response.ok, response: sanitizeProviderResponse(data) };
    } catch (err) {
      console.error('[PaymentProviderService Refund Error]:', err instanceof Error ? err.message : 'unknown provider error');
      return { success: false, response: { error: 'REFUND_PROVIDER_UNAVAILABLE' } };
    }
  }
};
