import type { DiningOrder, DiningOrderItem, DiningOrderStatus, DiningOrderOrigin } from './types';

export interface DiningOrderRecord {
  id: string;
  companyId: string;
  branchId?: string;
  tableId: string;
  waiterId?: string;
  waiterName?: string;
  origin: DiningOrderOrigin;
  status: DiningOrderStatus;
  foodOrderId?: string;
  saleId?: string;
  customerId?: string;
  customerName?: string;
  items: DiningOrderItem[];
  notes?: string;
  subtotal: number;
  total: number;
  createdAt: number;
  updatedAt: number;
  closedAt?: number;
}

export function toDiningOrderRecord(order: DiningOrder): DiningOrderRecord {
  return { ...order, items: order.items.map((item) => ({ ...item, selections: item.selections?.map((s) => ({ ...s })) })) };
}

export function fromDiningOrderRecord(record: DiningOrderRecord): DiningOrder {
  return { ...record, items: record.items.map((item) => ({ ...item, selections: item.selections?.map((s) => ({ ...s })) })) };
}
