import crypto from 'crypto';
import { CommerceRepository } from '../commerce/repository';
import { PaymentProviderService } from '../commerce/payments';
import { db } from '../db';

type RefundMethod = 'ORIGINAL_PAYMENT' | 'STORE_CREDIT' | 'BANK_TRANSFER';

type RefundEntry = {
  id: string;
  amount: number;
  method: RefundMethod | string;
  status: 'COMPLETED' | 'PENDING_MANUAL';
  createdAt: number;
};

function normalizeRefundAmount(amount: number | undefined, total: number): number | null {
  const refundAmount = amount ?? total;
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) return null;
  if (refundAmount > total) return null;
  return Math.round(refundAmount * 100) / 100;
}

function getRefundEntries(entity: any): RefundEntry[] {
  return Array.isArray(entity?.refunds) ? entity.refunds : [];
}

function getReservedRefundAmount(entity: any): number {
  return Math.round(getRefundEntries(entity)
    .filter(refund => refund.status === 'COMPLETED' || refund.status === 'PENDING_MANUAL')
    .reduce((sum, refund) => sum + Number(refund.amount || 0), 0) * 100) / 100;
}

function canRefund(entity: any, total: number, amount: number): boolean {
  const reserved = getReservedRefundAmount(entity);
  return amount <= Math.round((total - reserved) * 100) / 100;
}

function buildRefundEntry(amount: number, method: RefundMethod | string, status: RefundEntry['status']): RefundEntry {
  return { id: `ref_${crypto.randomUUID()}`, amount, method, status, createdAt: Date.now() };
}

/**
 * Executes the provider/customer-credit side of a refund and records the
 * operation on the source entity. Completed and pending-manual amounts are
 * reserved so sequential duplicate requests cannot exceed the sale total.
 * Cross-instance atomicity remains a Phase 3 persistence requirement.
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
    if (refundAmount === null || !canRefund(sale, total, refundAmount)) {
      return { success: false, details: { error: 'Importe de reintegro inválido o superior al saldo reintegrable', saleId, total, refundedAmount: getReservedRefundAmount(sale) } };
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

      const entry = buildRefundEntry(refundAmount, refundMethod, 'COMPLETED');
      const result = CommerceRepository.applyStoreCreditRefund(
        sale.id,
        customer.id,
        sale.companyId,
        refundAmount,
        entry,
      );
      if (!result) {
        return { success: false, details: { error: 'No se pudo registrar atómicamente el crédito interno', saleId } };
      }
      return { success: true, details: { method: 'STORE_CREDIT', credited: refundAmount, customerId: customer.id, saleId } };
    }

    if (refundMethod === 'ORIGINAL_PAYMENT' && originalPayment?.externalReference && originalPayment.method === 'MERCADO_PAGO') {
      const mpRes = await PaymentProviderService.refundPayment(
        originalPayment.externalReference,
        refundAmount,
        `ubika_refund_${sale.id}_${refundAmount.toFixed(2)}`,
      );
      if (!mpRes.success) {
        return { success: false, details: { method: 'MERCADO_PAGO', amount: refundAmount, response: mpRes.response, saleId } };
      }
      const entry = buildRefundEntry(refundAmount, refundMethod, 'COMPLETED');
      const refunds = [...getRefundEntries(sale), entry];
      CommerceRepository.updateSale(sale.id, {
        refunds,
        status: getReservedRefundAmount({ refunds }) >= total ? 'REFUNDED' : sale.status,
      } as any);
      return { success: true, details: { method: 'MERCADO_PAGO', amount: refundAmount, response: mpRes.response, saleId } };
    }

    const entry = buildRefundEntry(refundAmount, refundMethod, 'PENDING_MANUAL');
    CommerceRepository.updateSale(sale.id, {
      refunds: [...getRefundEntries(sale), entry],
    } as any);
    return {
      success: true,
      details: { method: refundMethod, amount: refundAmount, saleId, requiresManualSettlement: true, status: 'PENDING_MANUAL' },
    };
  }

  const foodOrder = db.getFoodOrderById(saleId);
  if (foodOrder) {
    const total = Number(foodOrder.totalAmount);
    if (!Number.isFinite(total) || total <= 0) {
      return { success: false, details: { error: 'Orden con importe inválido', orderId: foodOrder.id } };
    }
    const refundAmount = normalizeRefundAmount(amount, total);
    if (refundAmount === null || !canRefund(foodOrder, total, refundAmount)) {
      return { success: false, details: { error: 'Importe de reintegro inválido o superior al saldo reintegrable', orderId: foodOrder.id, total, refundedAmount: getReservedRefundAmount(foodOrder) } };
    }

    const entry = buildRefundEntry(refundAmount, method || foodOrder.paymentMethod || 'ORIGINAL_PAYMENT', 'PENDING_MANUAL');
    db.updateFoodOrder(foodOrder.id, {
      refunds: [...getRefundEntries(foodOrder), entry],
    } as any);
    return {
      success: true,
      details: { orderId: foodOrder.id, refundAmount, method: entry.method, requiresManualSettlement: true, status: 'PENDING_MANUAL' },
    };
  }

  return { success: false, details: { error: 'Venta u orden no encontrada', saleId } };
}
