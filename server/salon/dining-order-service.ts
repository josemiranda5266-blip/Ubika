import type { RestaurantTableRepository } from './repository';
import type { DiningOrder, DiningOrderItem, DiningOrderOrigin } from './types';

export interface CreateDiningOrderInput {
  companyId: string;
  branchId?: string;
  tableId: string;
  origin: DiningOrderOrigin;
  waiterId?: string;
  waiterName?: string;
  customerId?: string;
  customerName?: string;
  items: DiningOrderItem[];
  notes?: string;
}

export class DiningOrderService {
  constructor(private readonly tables: RestaurantTableRepository) {}

  async open(input: CreateDiningOrderInput, now = Date.now()): Promise<DiningOrder> {
    if (!input.companyId) throw new Error('COMPANY_ID_REQUIRED');
    if (!input.tableId) throw new Error('TABLE_ID_REQUIRED');
    if (!input.items.length) throw new Error('DINING_ORDER_EMPTY');

    const table = await this.tables.getById(input.companyId, input.tableId);
    if (!table) throw new Error('TABLE_NOT_FOUND');
    if (!table.active) throw new Error('TABLE_INACTIVE');
    if (table.status === 'RESERVED') throw new Error('TABLE_RESERVED');
    if (table.status === 'OCCUPIED') throw new Error('TABLE_ALREADY_OCCUPIED');

    validateItems(input.items);
    const subtotal = calculateSubtotal(input.items);

    const order: DiningOrder = {
      id: crypto.randomUUID(),
      companyId: input.companyId,
      branchId: input.branchId ?? table.branchId,
      tableId: table.id,
      waiterId: input.waiterId,
      waiterName: input.waiterName,
      origin: input.origin,
      status: 'OPEN',
      customerId: input.customerId,
      customerName: input.customerName,
      items: input.items,
      notes: input.notes?.trim() || undefined,
      subtotal,
      total: subtotal,
      createdAt: now,
      updatedAt: now,
    };

    await this.tables.setStatus(input.companyId, table.id, 'OCCUPIED');
    return order;
  }
}

function validateItems(items: DiningOrderItem[]): void {
  for (const item of items) {
    if (!item.productId || !item.name.trim()) throw new Error('DINING_ORDER_ITEM_INVALID');
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) throw new Error('DINING_ORDER_QUANTITY_INVALID');
    if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) throw new Error('DINING_ORDER_PRICE_INVALID');
    if (item.selections) {
      for (const selection of item.selections) {
        if (!selection.groupId || !selection.optionId || !selection.name.trim()) throw new Error('DINING_ORDER_SELECTION_INVALID');
        if (!Number.isFinite(selection.price) || selection.price < 0) throw new Error('DINING_ORDER_SELECTION_PRICE_INVALID');
      }
    }
  }
}

function calculateSubtotal(items: DiningOrderItem[]): number {
  const cents = items.reduce((sum, item) => {
    const selections = (item.selections ?? []).reduce((selectionSum, selection) => selectionSum + selection.price, 0);
    return sum + Math.round((item.unitPrice + selections) * 100) * item.quantity;
  }, 0);
  return cents / 100;
}
