import type { DatabaseSchema } from '../db';
import type { RestaurantTableRepository } from './repository';
import type { RestaurantTable, RestaurantTableStatus } from './types';
import { fromRestaurantTableRecord, toRestaurantTableRecord, type RestaurantTableRecord } from './db-records';

export interface SalonDatabaseState {
  restaurant_tables?: RestaurantTableRecord[];
}

export class LocalDatabaseRestaurantTableRepository implements RestaurantTableRepository {
  constructor(private readonly state: DatabaseSchema & SalonDatabaseState) {
    this.state.restaurant_tables = this.state.restaurant_tables || [];
  }

  async create(table: RestaurantTable): Promise<RestaurantTable> {
    const records = this.state.restaurant_tables!;
    if (records.some((record) => record.id === table.id)) throw new Error('TABLE_ID_ALREADY_EXISTS');
    if (this.findActiveNumber(table.companyId, table.branchId, table.number)) throw new Error('TABLE_NUMBER_ALREADY_EXISTS');
    if (records.some((record) => record.publicQrToken === table.publicQrToken && record.active)) throw new Error('TABLE_QR_TOKEN_ALREADY_EXISTS');
    records.push(toRestaurantTableRecord(table));
    return table;
  }

  async getById(companyId: string, tableId: string): Promise<RestaurantTable | null> {
    const record = this.state.restaurant_tables!.find((candidate) => candidate.companyId === companyId && candidate.id === tableId);
    return record ? fromRestaurantTableRecord(record) : null;
  }

  async getByQrToken(token: string): Promise<RestaurantTable | null> {
    const record = this.state.restaurant_tables!.find((candidate) => candidate.publicQrToken === token && candidate.active);
    return record ? fromRestaurantTableRecord(record) : null;
  }

  async list(companyId: string, branchId?: string): Promise<RestaurantTable[]> {
    return this.state.restaurant_tables!
      .filter((record) => record.companyId === companyId && (!branchId || record.branchId === branchId))
      .sort((a, b) => a.number - b.number)
      .map(fromRestaurantTableRecord);
  }

  async update(
    companyId: string,
    tableId: string,
    patch: Partial<Pick<RestaurantTable, 'number' | 'name' | 'capacity' | 'area' | 'active' | 'publicQrToken' | 'status' | 'updatedAt'>>,
  ): Promise<RestaurantTable> {
    const index = this.state.restaurant_tables!.findIndex((candidate) => candidate.companyId === companyId && candidate.id === tableId);
    if (index < 0) throw new Error('TABLE_NOT_FOUND');
    const current = this.state.restaurant_tables![index];
    if (patch.number !== undefined && patch.number !== current.number && this.findActiveNumber(companyId, current.branchId, patch.number, tableId)) {
      throw new Error('TABLE_NUMBER_ALREADY_EXISTS');
    }
    if (patch.publicQrToken && patch.publicQrToken !== current.publicQrToken &&
        this.state.restaurant_tables!.some((record) => record.id !== tableId && record.active && record.publicQrToken === patch.publicQrToken)) {
      throw new Error('TABLE_QR_TOKEN_ALREADY_EXISTS');
    }
    const next = { ...current, ...patch };
    this.state.restaurant_tables![index] = next;
    return fromRestaurantTableRecord(next);
  }

  async setStatus(companyId: string, tableId: string, status: RestaurantTableStatus): Promise<RestaurantTable> {
    return this.update(companyId, tableId, { status });
  }

  private findActiveNumber(companyId: string, branchId: string | undefined, number: number, excludeTableId?: string): RestaurantTableRecord | null {
    return this.state.restaurant_tables!.find((record) =>
      record.companyId === companyId && record.active && record.number === number && record.branchId === branchId && record.id !== excludeTableId,
    ) ?? null;
  }
}
