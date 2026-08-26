import type { DiningOrderRepository } from './dining-order-repository';
import type { RestaurantTableRepository } from './repository';
import type { DiningOrder, RestaurantTable, RestaurantTableStatus } from './types';

const OPEN_ORDER_STATUSES = new Set<DiningOrder['status']>(['OPEN', 'SENT_TO_KITCHEN', 'PREPARING', 'READY', 'SERVED', 'REQUESTED_BILL']);
const TABLE_MUTABLE_STATUSES = new Set<RestaurantTableStatus>(['AVAILABLE', 'OCCUPIED', 'RESERVED']);

export class SalonService {
  constructor(
    private readonly tables: RestaurantTableRepository,
    private readonly orders: DiningOrderRepository,
  ) {}

  async listTables(companyId: string, branchId?: string): Promise<RestaurantTable[]> {
    if (!companyId) throw new Error('COMPANY_ID_REQUIRED');
    return this.tables.list(companyId, branchId);
  }

  async resolveTableByQr(token: string): Promise<RestaurantTable | null> {
    if (!token) throw new Error('TABLE_QR_TOKEN_REQUIRED');
    return this.tables.getByQrToken(token);
  }

  async updateTable(companyId: string, tableId: string, patch: Partial<Pick<RestaurantTable, 'number' | 'name' | 'capacity' | 'area' | 'active' | 'publicQrToken' | 'status' | 'updatedAt'>>): Promise<RestaurantTable> {
    if (!companyId) throw new Error('COMPANY_ID_REQUIRED');
    if (!tableId) throw new Error('TABLE_ID_REQUIRED');
    return this.tables.update(companyId, tableId, patch);
  }

  async createTable(table: RestaurantTable): Promise<RestaurantTable> {
    if (!table.companyId) throw new Error('COMPANY_ID_REQUIRED');
    if (!table.publicQrToken) throw new Error('TABLE_QR_TOKEN_REQUIRED');
    if (!Number.isInteger(table.number) || table.number <= 0) throw new Error('TABLE_NUMBER_INVALID');
    if (!Number.isInteger(table.capacity) || table.capacity <= 0) throw new Error('TABLE_CAPACITY_INVALID');
    return this.tables.create(table);
  }

  async setTableStatus(companyId: string, tableId: string, status: RestaurantTableStatus): Promise<RestaurantTable> {
    if (!TABLE_MUTABLE_STATUSES.has(status)) throw new Error('TABLE_STATUS_INVALID');
    const table = await this.tables.getById(companyId, tableId);
    if (!table) throw new Error('TABLE_NOT_FOUND');
    return this.tables.setStatus(companyId, tableId, status);
  }

  async createDiningOrder(order: DiningOrder): Promise<DiningOrder> {
    if (!order.companyId) throw new Error('COMPANY_ID_REQUIRED');
    if (!order.tableId) throw new Error('TABLE_ID_REQUIRED');
    if (!order.items.length) throw new Error('DINING_ORDER_ITEMS_REQUIRED');
    if (order.subtotal < 0 || order.total < 0) throw new Error('DINING_ORDER_TOTAL_INVALID');

    const table = await this.tables.getById(order.companyId, order.tableId);
    if (!table || !table.active) throw new Error('TABLE_NOT_FOUND');

    const openOrders = await this.orders.getOpenByTable(order.companyId, order.tableId);
    if (order.status === 'OPEN' && openOrders.some(existing => existing.status === 'OPEN')) {
      throw new Error('OPEN_DINING_ORDER_ALREADY_EXISTS');
    }

    const created = await this.orders.create(order);
    if (table.status === 'AVAILABLE') await this.tables.setStatus(order.companyId, order.tableId, 'OCCUPIED');
    return created;
  }

  async transitionOrder(companyId: string, orderId: string, nextStatus: DiningOrder['status']): Promise<DiningOrder> {
    const order = await this.orders.getById(companyId, orderId);
    if (!order) throw new Error('DINING_ORDER_NOT_FOUND');

    const allowed = this.allowedTransitions(order.status);
    if (!allowed.has(nextStatus)) throw new Error(`DINING_ORDER_INVALID_TRANSITION:${order.status}->${nextStatus}`);

    const updated = await this.orders.update(companyId, orderId, { status: nextStatus, updatedAt: Date.now() });

    if (nextStatus === 'CLOSED' || nextStatus === 'CANCELLED') {
      const openOrders = await this.orders.getOpenByTable(companyId, order.tableId);
      if (!openOrders.length) await this.tables.setStatus(companyId, order.tableId, 'AVAILABLE');
    } else if (OPEN_ORDER_STATUSES.has(nextStatus)) {
      const table = await this.tables.getById(companyId, order.tableId);
      if (table && table.status === 'AVAILABLE') await this.tables.setStatus(companyId, order.tableId, 'OCCUPIED');
    }

    return updated;
  }

  private allowedTransitions(status: DiningOrder['status']): Set<DiningOrder['status']> {
    switch (status) {
      case 'OPEN': return new Set(['SENT_TO_KITCHEN', 'CANCELLED']);
      case 'SENT_TO_KITCHEN': return new Set(['PREPARING', 'CANCELLED']);
      case 'PREPARING': return new Set(['READY', 'CANCELLED']);
      case 'READY': return new Set(['SERVED', 'CANCELLED']);
      case 'SERVED': return new Set(['REQUESTED_BILL']);
      case 'REQUESTED_BILL': return new Set(['CLOSED']);
      case 'CLOSED':
      case 'CANCELLED':
        return new Set();
    }
  }
}
