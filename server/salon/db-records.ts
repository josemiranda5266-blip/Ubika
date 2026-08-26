import type { RestaurantTable, RestaurantTableStatus } from './types';

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
  return { ...table };
}

export function fromRestaurantTableRecord(record: RestaurantTableRecord): RestaurantTable {
  return { ...record };
}
