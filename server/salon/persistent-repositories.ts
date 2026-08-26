import { loadDatabase, saveDatabaseSync, type DatabaseSchema } from '../db';
import type { DiningOrderRepository } from './dining-order-repository';
import type { RestaurantTableRepository } from './repository';
import type { DiningOrder, RestaurantTable, RestaurantTableStatus } from './types';

type SalonDatabase = DatabaseSchema & {
  restaurant_tables?: RestaurantTable[];
  dining_orders?: DiningOrder[];
};

function salonDatabase(): SalonDatabase {
  const database = loadDatabase() as SalonDatabase;
  database.restaurant_tables ||= [];
  database.dining_orders ||= [];
  return database;
}

function persist(): void {
  saveDatabaseSync();
}

export class PersistentRestaurantTableRepository implements RestaurantTableRepository {
  async create(table: RestaurantTable): Promise<RestaurantTable> {
    const database = salonDatabase();
    if (database.restaurant_tables!.some(existing => existing.id === table.id)) throw new Error('TABLE_ID_ALREADY_EXISTS');
    if (database.restaurant_tables!.some(existing => existing.active && table.active && existing.companyId === table.companyId && existing.branchId === table.branchId && existing.number === table.number)) {
      throw new Error('TABLE_NUMBER_ALREADY_EXISTS');
    }
    if (database.restaurant_tables!.some(existing => existing.active && table.active && existing.publicQrToken === table.publicQrToken)) {
      throw new Error('TABLE_QR_TOKEN_ALREADY_EXISTS');
    }
    database.restaurant_tables!.push({ ...table });
    persist();
    return { ...table };
  }

  async getById(companyId: string, tableId: string): Promise<RestaurantTable | null> {
    const table = salonDatabase().restaurant_tables!.find(item => item.id === tableId && item.companyId === companyId);
    return table ? { ...table } : null;
  }

  async getByQrToken(token: string): Promise<RestaurantTable | null> {
    const table = salonDatabase().restaurant_tables!.find(item => item.active && item.publicQrToken === token);
    return table ? { ...table } : null;
  }

  async list(companyId: string, branchId?: string): Promise<RestaurantTable[]> {
    return salonDatabase().restaurant_tables!
      .filter(table => table.companyId === companyId && (!branchId || table.branchId === branchId))
      .sort((a, b) => a.number - b.number)
      .map(table => ({ ...table }));
  }

  async update(companyId: string, tableId: string, patch: Partial<Pick<RestaurantTable, 'number' | 'name' | 'capacity' | 'area' | 'active' | 'publicQrToken' | 'status' | 'updatedAt'>>): Promise<RestaurantTable> {
    const database = salonDatabase();
    const index = database.restaurant_tables!.findIndex(table => table.id === tableId && table.companyId === companyId);
    if (index === -1) throw new Error('TABLE_NOT_FOUND');
    const current = database.restaurant_tables![index];
    const next = { ...current, ...patch };
    if (database.restaurant_tables!.some((existing, existingIndex) => existingIndex !== index && existing.active && next.active && existing.companyId === companyId && existing.branchId === next.branchId && existing.number === next.number)) {
      throw new Error('TABLE_NUMBER_ALREADY_EXISTS');
    }
    if (database.restaurant_tables!.some((existing, existingIndex) => existingIndex !== index && existing.active && next.active && existing.publicQrToken === next.publicQrToken)) {
      throw new Error('TABLE_QR_TOKEN_ALREADY_EXISTS');
    }
    database.restaurant_tables![index] = next;
    persist();
    return { ...next };
  }

  async setStatus(companyId: string, tableId: string, status: RestaurantTableStatus): Promise<RestaurantTable> {
    return this.update(companyId, tableId, { status, updatedAt: Date.now() });
  }
}

export class PersistentDiningOrderRepository implements DiningOrderRepository {
  async create(order: DiningOrder): Promise<DiningOrder> {
    const database = salonDatabase();
    if (database.dining_orders!.some(existing => existing.id === order.id)) throw new Error('DINING_ORDER_ID_ALREADY_EXISTS');
    database.dining_orders!.push(structuredClone(order));
    persist();
    return structuredClone(order);
  }

  async getById(companyId: string, orderId: string): Promise<DiningOrder | null> {
    const order = salonDatabase().dining_orders!.find(item => item.id === orderId && item.companyId === companyId);
    return order ? structuredClone(order) : null;
  }

  async getOpenByTable(companyId: string, tableId: string): Promise<DiningOrder[]> {
    return salonDatabase().dining_orders!
      .filter(order => order.companyId === companyId && order.tableId === tableId && !['CLOSED', 'CANCELLED'].includes(order.status))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(order => structuredClone(order));
  }

  async list(companyId: string): Promise<DiningOrder[]> {
    return salonDatabase().dining_orders!
      .filter(order => order.companyId === companyId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(order => structuredClone(order));
  }

  async update(companyId: string, orderId: string, patch: Partial<Pick<DiningOrder, 'status' | 'items' | 'subtotal' | 'total' | 'waiterId' | 'waiterName' | 'customerId' | 'customerName' | 'foodOrderId' | 'saleId' | 'notes' | 'updatedAt' | 'closedAt'>>): Promise<DiningOrder> {
    const database = salonDatabase();
    const index = database.dining_orders!.findIndex(order => order.id === orderId && order.companyId === companyId);
    if (index === -1) throw new Error('DINING_ORDER_NOT_FOUND');
    const next = { ...database.dining_orders![index], ...patch };
    database.dining_orders![index] = structuredClone(next);
    persist();
    return structuredClone(next);
  }
}
