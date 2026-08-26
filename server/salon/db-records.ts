import type { RestaurantTable, RestaurantTableStatus } from './types';

/** Persistence-safe representation used by the unified UBIKA database. */
export interface RestaurantTableRecord {
  id: string;
  companyId: string;
  branchId?: string;
  number: number;
  name?: string;
  capacity: number;
  area?: string;
  status: RestaurantTableStatus;
  active: boolean;
  publicQrToken: string;
  createdAt: number;
  updatedAt: number;
}

export function toRestaurantTableRecord(table: RestaurantTable): RestaurantTableRecord {
  return {
    ...table,
    createdAt: table.createdAt.getTime(),
    updatedAt: table.updatedAt.getTime(),
  };
}

export function fromRestaurantTableRecord(record: RestaurantTableRecord): RestaurantTable {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}
