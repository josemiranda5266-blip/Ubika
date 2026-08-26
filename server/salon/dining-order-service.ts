import type { RestaurantTableRepository } from './repository';
import type { DiningOrder, DiningOrderItem, DiningOrderOrigin, DiningOrderStatus } from './types';

export interface DiningOrderRepository {
  create(order: DiningOrder): Promise<DiningOrder>;
  getById(companyId: string, orderId: string): Promise<DiningOrder | null>;
  listOpenByTable(companyId: string, tableId: string): Promise<DiningOrder[]>;
  update(companyId: string, orderId: string, patch: Partial<DiningOrder>): Promise<DiningOrder>;
}

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
  constructor(
    private readonly tables: RestaurantTableRepository,
    private readonly orders: DiningOrderRepository,
  ) {}

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

    const created = await this.orders.create(order);
    await this.tables.setStatus(input.companyId, table.id, 'OCCUPIED');
    return created;
  }

  async sendToKitchen(companyId: string, orderId: string): Promise<DiningOrder> {
    return this.transition(companyId, orderId, 'OPEN', 'SENT_TO_KITCHEN');
  }

  async markServed(companyId: string, orderId: string): Promise<DiningOrder> {
    return this.transition(companyId, orderId, 'READY', 'SERVED');
  }

  async requestBill(companyId: string, orderId: string): Promise<DiningOrder> {
    const order = await this.get(companyId, orderId);
    if (order.status !== 'SERVED' && order.status !== 'READY') throw new Error('DINING_ORDER_INVALID_TRANSITION');
    return this.orders.update(companyId, orderId, { status: 'REQUESTED_BILL', updatedAt: Date.now() });
  }

  private async get(companyId: string, orderId: string): Promise<DiningOrder> {
    const order = await this.orders.getById(companyId, orderId);
    if (!order) throw new Error('DINING_ORDER_NOT_FOUND');
    return order;
  }

  private async transition(companyId: string, orderId: string, from: DiningOrderStatus, to: DiningOrderStatus): Promise<DiningOrder> {
    const order = await this.get(companyId, orderId);
    if (order.status !== from) throw new Error('DINING_ORDER_INVALID_TRANSITION');
    return this.orders.update(companyId, orderId, { status: to, updatedAt: Date.now() });
  }
}

function validateItems(items: DiningOrderItem[]): void {
  for (const item of items) {
    if (!item.productId || !item.name.trim()) throw new Error('DINING_ORDER_ITEM_INVALID');
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) throw new Error('DINING_ORDER_QUANTITY_INVALID');
    if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) throw new Error('DINING_ORDER_PRICE_INVALID');
    for (const selection of item.selections ?? []) {
      if (!selection.groupId || !selection.optionId || !selection.name.trim()) throw new Error('DINING_ORDER_SELECTION_INVALID');
      if (!Number.isFinite(selection.price) || selection.price < 0) throw new Error('DINING_ORDER_SELECTION_PRICE_INVALID');
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
