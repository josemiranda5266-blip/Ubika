import { CommerceRepository } from '../commerce/repository';
import { PaymentProviderService } from '../commerce/payments';
import { db } from '../db';

type RefundMethod = 'ORIGINAL_PAYMENT' | 'STORE_CREDIT' | 'BANK_TRANSFER';

function normalizeRefundAmount(amount: number | undefined, total: number): number | null {
  const refundAmount = amount ?? total;
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) return null;
  if (refundAmount > total) return null;
  return Math.round(refundAmount * 100) / 100;
}

/**
 * Executes only the provider/customer-credit side of a refund. The caller is
 * responsible for authorization and for persisting the final legal/order
 * state. Unknown sale IDs are failures, never successful "manual" refunds.
 */
export async function processRefund(
  saleId: string,
  amount?: number,
  method?: RefundMethod
): Promise<{ success: boolean; details: any }> {
  const sale = CommerceRepository.getSaleById(saleId);
  if (sale) {
    const total = Number(sale.total);
    if (!Number.isFinite(total) || total <= 0) {
      return { success: false, details: { error: 'Venta con importe inválido', saleId } };
    }

    const refundAmount = normalizeRefundAmount(amount, total);
    if (refundAmount === null) {
      return { success: false, details: { error: 'Importe de reintegro inválido', saleId, total } };
    }

    const originalPayment = (sale.payments || []).find(p => p.status === 'COMPLETED') || (sale.payments || [])[0];
    const refundMethod = method || (originalPayment?.method as RefundMethod | undefined) || 'ORIGINAL_PAYMENT';

    if (refundMethod === 'STORE_CREDIT') {
      if (!sale.customerId) {
        return { success: false, details: { error: 'La venta no tiene cliente para crédito interno', saleId } };
      }
      const customer = CommerceRepository.getCustomerByIdForCompany(sale.customerId, sale.companyId);
      if (!customer) {
        return { success: false, details: { error: 'Cliente no encontrado en la empresa de la venta', saleId } };
      }

      CommerceRepository.updateCustomer(customer.id, {
        accountBalance: Number(customer.accountBalance || 0) + refundAmount,
      });
      return {
        success: true,
        details: { method: 'STORE_CREDIT', credited: refundAmount, customerId: customer.id, saleId },
      };
    }

    if (refundMethod === 'ORIGINAL_PAYMENT' && originalPayment?.externalReference && originalPayment.method === 'MERCADO_PAGO') {
      const mpRes = await PaymentProviderService.refundPayment(originalPayment.externalReference);
      return {
        success: mpRes.success,
        details: {
          method: 'MERCADO_PAGO',
          amount: refundAmount,
          response: mpRes.response,
          saleId,
        },
      };
    }

    // Cash, bank transfer and other manual original-payment refunds are
    // acknowledged as a pending/manual operation, not as provider settlement.
    return {
      success: true,
      details: {
        method: refundMethod,
        amount: refundAmount,
        saleId,
        requiresManualSettlement: true,
      },
    };
  }

  const foodOrder = db.getFoodOrderById(saleId);
  if (foodOrder) {
    const total = Number(foodOrder.totalAmount);
    const refundAmount = normalizeRefundAmount(amount, total);
    if (refundAmount === null) {
      return { success: false, details: { error: 'Importe de reintegro inválido', orderId: foodOrder.id, total } };
    }

    return {
      success: true,
      details: {
        orderId: foodOrder.id,
        refundAmount,
        method: method || foodOrder.paymentMethod,
        requiresManualSettlement: true,
      },
    };
  }

  return {
    success: false,
    details: { error: 'Venta u orden no encontrada', saleId },
  };
}
