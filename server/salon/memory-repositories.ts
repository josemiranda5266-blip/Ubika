import type { DiningOrderRepository } from './dining-order-repository';
import type { RestaurantTableRepository } from './repository';
import type { DiningOrder, RestaurantTable, RestaurantTableStatus } from './types';

export class InMemoryRestaurantTableRepository implements RestaurantTableRepository {
  private readonly tables = new Map<string, RestaurantTable>();

  async create(table: RestaurantTable): Promise<RestaurantTable> {
    if (this.tables.has(table.id)) throw new Error('TABLE_ID_ALREADY_EXISTS');
    for (const existing of this.tables.values()) {
      if (existing.active && table.active && existing.companyId === table.companyId && existing.branchId === table.branchId && existing.number === table.number) {
        throw new Error('TABLE_NUMBER_ALREADY_EXISTS');
      }
      if (existing.active && table.active && existing.publicQrToken === table.publicQrToken) {
        throw new Error('TABLE_QR_TOKEN_ALREADY_EXISTS');
      }
    }
    this.tables.set(table.id, { ...table });
    return { ...table };
  }

  async getById(companyId: string, tableId: string): Promise<RestaurantTable | null> {
    const table = this.tables.get(tableId);
    return table && table.companyId === companyId ? { ...table } : null;
  }

  async getByQrToken(token: string): Promise<RestaurantTable | null> {
    for (const table of this.tables.values()) {
      if (table.active && table.publicQrToken === token) return { ...table };
    }
    return null;
  }

  async list(companyId: string, branchId?: string): Promise<RestaurantTable[]> {
    return [...this.tables.values()]
      .filter(table => table.companyId === companyId && (!branchId || table.branchId === branchId))
      .sort((a, b) => a.number - b.number)
      .map(table => ({ ...table }));
  }

  async update(companyId: string, tableId: string, patch: Partial<Pick<RestaurantTable, 'number' | 'name' | 'capacity' | 'area' | 'active' | 'publicQrToken' | 'status' | 'updatedAt'>>): Promise<RestaurantTable> {
    const current = await this.getById(companyId, tableId);
    if (!current) throw new Error('TABLE_NOT_FOUND');
    const next = { ...current, ...patch };
    for (const existing of this.tables.values()) {
      if (existing.id === tableId) continue;
      if (existing.active && next.active && existing.companyId === companyId && existing.branchId === next.branchId && existing.number === next.number) throw new Error('TABLE_NUMBER_ALREADY_EXISTS');
      if (existing.active && next.active && existing.publicQrToken === next.publicQrToken) throw new Error('TABLE_QR_TOKEN_ALREADY_EXISTS');
    }
    this.tables.set(tableId, next);
    return { ...next };
  }

  async setStatus(companyId: string, tableId: string, status: RestaurantTableStatus): Promise<RestaurantTable> {
    return this.update(companyId, tableId, { status, updatedAt: Date.now() });
  }
}

export class InMemoryDiningOrderRepository implements DiningOrderRepository {
  private readonly orders = new Map<string, DiningOrder>();

  async create(order: DiningOrder): Promise<DiningOrder> {
    if (this.orders.has(order.id)) throw new Error('DINING_ORDER_ID_ALREADY_EXISTS');
    this.orders.set(order.id, structuredClone(order));
    return structuredClone(order);
  }

  async getById(companyId: string, orderId: string): Promise<DiningOrder | null> {
    const order = this.orders.get(orderId);
    return order && order.companyId === companyId ? structuredClone(order) : null;
  }

  async getOpenByTable(companyId: string, tableId: string): Promise<DiningOrder[]> {
    return [...this.orders.values()]
      .filter(order => order.companyId === companyId && order.tableId === tableId && !['CLOSED', 'CANCELLED'].includes(order.status))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(order => structuredClone(order));
  }

  async list(companyId: string): Promise<DiningOrder[]> {
    return [...this.orders.values()]
      .filter(order => order.companyId === companyId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(order => structuredClone(order));
  }

  async update(companyId: string, orderId: string, patch: Partial<Pick<DiningOrder, 'status' | 'items' | 'subtotal' | 'total' | 'waiterId' | 'customerId' | 'foodOrderId' | 'saleId' | 'notes' | 'updatedAt'>>): Promise<DiningOrder> {
    const current = await this.getById(companyId, orderId);
    if (!current) throw new Error('DINING_ORDER_NOT_FOUND');
    const next = { ...current, ...patch };
    this.orders.set(orderId, structuredClone(next));
    return structuredClone(next);
  }
}
