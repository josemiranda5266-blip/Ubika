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
 * Resolve the tenant that authorized the refund through the legal withdrawal
 * record. The refund engine must never infer a tenant from saleId alone.
 * If the same sale is referenced by withdrawal requests belonging to
 * different companies, fail closed instead of guessing.
 */
function resolveRefundCompanyId(saleId: string): string | null {
  const state: any = db.getRawState();
  const requests = Array.isArray(state?.withdrawal_requests) ? state.withdrawal_requests : [];
  const companyIds = [...new Set(
    requests
      .filter((request: any) => request?.saleId === saleId && typeof request?.companyId === 'string' && request.companyId.trim())
      .map((request: any) => request.companyId.trim())
  )];

  return companyIds.length === 1 ? companyIds[0] : null;
}

/**
 * Executes the provider/customer-credit side of a refund and records the
 * operation on the source entity. Completed and pending-manual amounts are
 * reserved so sequential duplicate requests cannot exceed the sale total.
 * Each refund operation receives its own stable idempotency key so two
 * legitimate partial refunds for the same amount are not collapsed by the
 * payment provider. Cross-instance atomicity remains a Phase 3 requirement.
 *
 * Tenant isolation is enforced here as a second line of defense: the sale
 * must belong to the company attached to the legal withdrawal request that
 * authorized this operation. If that relationship cannot be established,
 * the refund is rejected rather than falling back to an unscoped lookup.
 */
export async function processRefund(
  saleId: string,
  amount?: number,
  method?: RefundMethod
): Promise<{ success: boolean; details: any }> {
  const refundCompanyId = resolveRefundCompanyId(saleId);
  if (!refundCompanyId) {
    return {
      success: false,
      details: {
        error: 'No se pudo determinar de forma segura la empresa autorizante del reintegro',
        saleId,
        code: 'REFUND_TENANT_CONTEXT_REQUIRED',
      },
    };
  }

  const sale = CommerceRepository.getSaleByIdForCompany(saleId, refundCompanyId);
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
      const entry = buildRefundEntry(refundAmount, refundMethod, 'COMPLETED');
      const mpRes = await PaymentProviderService.refundPayment(
        originalPayment.externalReference,
        refundAmount,
        `ubika_refund_${entry.id}`,
      );
      if (!mpRes.success) {
        return { success: false, details: { method: 'MERCADO_PAGO', amount: refundAmount, response: mpRes.response, saleId } };
      }
      const refunds = [...getRefundEntries(sale), entry];
      CommerceRepository.updateSale(sale.id, {
        refunds,
        status: getReservedRefundAmount({ refunds }) >= total ? 'REFUNDED' : sale.status,
      } as any);
      return { success: true, details: { method: 'MERCADO_PAGO', amount: refundAmount, response: mpRes.response, saleId, refundId: entry.id } };
    }

    const entry = buildRefundEntry(refundAmount, refundMethod, 'PENDING_MANUAL');
    CommerceRepository.updateSale(sale.id, {
      refunds: [...getRefundEntries(sale), entry],
    } as any);
    return {
      success: true,
      details: { method: refundMethod, amount: refundAmount, saleId, refundId: entry.id, requiresManualSettlement: true, status: 'PENDING_MANUAL' },
    };
  }

  const foodOrder = db.getFoodOrderById(saleId);
  if (foodOrder) {
    // Food orders do not currently expose a tenant-scoped repository helper;
    // enforce the same boundary before reading or mutating the order.
    if ((foodOrder as any).companyId !== refundCompanyId) {
      return {
        success: false,
        details: {
          error: 'La orden no pertenece a la empresa autorizante del reintegro',
          orderId: foodOrder.id,
          code: 'REFUND_TENANT_MISMATCH',
        },
      };
    }

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
      details: { orderId: foodOrder.id, refundAmount, refundId: entry.id, method: entry.method, requiresManualSettlement: true, status: 'PENDING_MANUAL' },
    };
  }

  return { success: false, details: { error: 'Venta u orden no encontrada', saleId } };
}
