import type { DiningOrder } from './types';

export interface DiningOrderRepository {
  create(order: DiningOrder): Promise<DiningOrder>;
  getById(companyId: string, orderId: string): Promise<DiningOrder | null>;
  getOpenByTable(companyId: string, tableId: string): Promise<DiningOrder[]>;
  list(companyId: string): Promise<DiningOrder[]>;
  update(
    companyId: string,
    orderId: string,
    patch: Partial<Pick<DiningOrder, 'status' | 'items' | 'subtotal' | 'total' | 'waiterId' | 'customerId' | 'foodOrderId' | 'saleId' | 'notes' | 'updatedAt'>>,
  ): Promise<DiningOrder>;
}

export function assertDiningOrderBelongsToCompany(order: DiningOrder, companyId: string): void {
  if (order.companyId !== companyId) throw new Error('DINING_ORDER_ACCESS_DENIED');
}
