import type { RestaurantTable, RestaurantTableStatus } from './types';

export interface RestaurantTableRepository {
  create(table: RestaurantTable): Promise<RestaurantTable>;
  getById(companyId: string, tableId: string): Promise<RestaurantTable | null>;
  getByQrToken(token: string): Promise<RestaurantTable | null>;
  list(companyId: string, branchId?: string): Promise<RestaurantTable[]>;
  update(
    companyId: string,
    tableId: string,
    patch: Partial<Pick<RestaurantTable, 'number' | 'name' | 'capacity' | 'area' | 'active' | 'publicQrToken' | 'status' | 'updatedAt'>>,
  ): Promise<RestaurantTable>;
  setStatus(companyId: string, tableId: string, status: RestaurantTableStatus): Promise<RestaurantTable>;
}

export function assertTableBelongsToCompany(table: RestaurantTable, companyId: string): void {
  if (table.companyId !== companyId) throw new Error('TABLE_ACCESS_DENIED');
}
