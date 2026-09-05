import { CommerceRepository } from '../commerce/repository';
import { PaymentProviderService } from '../commerce/payments';
import { db } from '../db';

export async function processRefund(
  saleId: string,
  amount?: number,
  method?: 'ORIGINAL_PAYMENT' | 'STORE_CREDIT' | 'BANK_TRANSFER'
): Promise<{ success: boolean; details: any }> {
  // Check in commerce sales first
  const sale = CommerceRepository.getSaleById(saleId);
  if (sale) {
    const refundAmount = amount ?? sale.total;
    const originalPayment = (sale.payments || []).find(p => p.status === 'COMPLETED') || (sale.payments || [])[0];
    
    if (method === 'STORE_CREDIT' && sale.customerId) {
      const customer = CommerceRepository.getCustomerByIdForCompany(sale.customerId, sale.companyId);
      if (customer) {
        CommerceRepository.updateCustomer(customer.id, {
          accountBalance: Number(customer.accountBalance || 0) + refundAmount,
        });
        return { success: true, details: { method: 'STORE_CREDIT', credited: refundAmount, customerId: customer.id } };
      }
    }

    if (originalPayment?.externalReference && originalPayment.method === 'MERCADO_PAGO') {
      const mpRes = await PaymentProviderService.refundPayment(originalPayment.externalReference);
      return { success: mpRes.success, details: { method: 'MERCADO_PAGO', response: mpRes.response } };
    }

    // Default cash / bank / generic record
    return { success: true, details: { method: method || originalPayment?.method || 'ORIGINAL_PAYMENT', amount: refundAmount } };
  }

  // Check in food orders
  const foodOrder = db.getFoodOrderById(saleId);
  if (foodOrder) {
    const refundAmount = amount ?? foodOrder.totalAmount;
    return { success: true, details: { orderId: foodOrder.id, refundAmount, method: method || foodOrder.paymentMethod } };
  }

  return { success: true, details: { saleId, amount, method: method || 'ORIGINAL_PAYMENT', note: 'Refund recorded for manual processing' } };
}
