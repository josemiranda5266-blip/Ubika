import 'dotenv/config';

export interface PaymentProcessOptions {
  companyId: string;
  saleId: string;
  amount: number;
  paymentMethod: string;
  idempotencyKey?: string;
  externalReference?: string;
}

export const PaymentProviderService = {
  async createPayment(options: PaymentProcessOptions): Promise<{ success: boolean; externalReference: string; providerResponse: any }> {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || 'TEST-MOCK-ACCESS-TOKEN';
    const isTest = process.env.NODE_ENV === 'test' || accessToken.startsWith('TEST-');

    // Idempotency simulation or real integration call
    const externalReference = options.externalReference || `ubika_pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (isTest || process.env.NODE_ENV === 'test') {
      return {
        success: true,
        externalReference,
        providerResponse: {
          status: 'approved',
          status_detail: 'accredited',
          id: `mp_${Date.now()}`,
          payment_method_id: options.paymentMethod,
          transaction_amount: options.amount,
          idempotency_key: options.idempotencyKey,
        },
      };
    }

    try {
      const response = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
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
      if (response.ok) {
        return {
          success: data.status === 'approved' || data.status === 'pending',
          externalReference,
          providerResponse: data,
        };
      } else {
        return {
          success: false,
          externalReference,
          providerResponse: data,
        };
      }
    } catch (err) {
      console.error('[PaymentProviderService Error]:', err);
      return {
        success: false,
        externalReference,
        providerResponse: { error: String(err) },
      };
    }
  },

  async refundPayment(paymentId: string): Promise<{ success: boolean; response: any }> {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || 'TEST-MOCK-ACCESS-TOKEN';
    if (process.env.NODE_ENV === 'test') {
      return { success: true, response: { status: 'refunded', id: paymentId } };
    }
    try {
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      return { success: response.ok, response: data };
    } catch (err) {
      return { success: false, response: { error: String(err) } };
    }
  }
};
