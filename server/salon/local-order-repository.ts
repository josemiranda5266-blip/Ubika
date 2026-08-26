import type { DatabaseSchema } from '../db';
import type { DiningOrder } from './types';
import type { DiningOrderRepository } from './dining-order-service';
import { fromDiningOrderRecord, toDiningOrderRecord, type DiningOrderRecord } from './dining-order-records';

export interface SalonOrderDatabaseState {
  dining_orders?: DiningOrderRecord[];
}

export class LocalDiningOrderRepository implements DiningOrderRepository {
  constructor(private readonly state: DatabaseSchema & SalonOrderDatabaseState) {
    this.state.dining_orders ||= [];
  }

  async create(order: DiningOrder): Promise<DiningOrder> {
    const records = this.state.dining_orders!;
    if (records.some((r) => r.id === order.id)) throw new Error('DINING_ORDER_ID_ALREADY_EXISTS');
    records.push(toDiningOrderRecord(order));
    return order;
  }

  async getById(companyId: string, orderId: string): Promise<DiningOrder | null> {
    const record = this.state.dining_orders!.find((r) => r.companyId === companyId && r.id === orderId);
    return record ? fromDiningOrderRecord(record) : null;
  }

  async listOpenByTable(companyId: string, tableId: string): Promise<DiningOrder[]> {
    const closed = new Set(['CLOSED', 'CANCELLED']);
    return this.state.dining_orders!
      .filter((r) => r.companyId === companyId && r.tableId === tableId && !closed.has(r.status))
      .map(fromDiningOrderRecord);
  }

  async update(companyId: string, orderId: string, patch: Partial<DiningOrder>): Promise<DiningOrder> {
    const records = this.state.dining_orders!;
    const index = records.findIndex((r) => r.companyId === companyId && r.id === orderId);
    if (index < 0) throw new Error('DINING_ORDER_NOT_FOUND');
    const current = records[index];
    const next = { ...current, ...patch } as DiningOrderRecord;
    records[index] = toDiningOrderRecord(next as DiningOrder);
    return fromDiningOrderRecord(records[index]);
  }
}
