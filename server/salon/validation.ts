import type { RestaurantTable } from './types';

export interface CreateRestaurantTableInput {
  number: number;
  name?: string;
  capacity: number;
  area?: string;
}

export interface UpdateRestaurantTableInput {
  number?: number;
  name?: string;
  capacity?: number;
  area?: string;
  active?: boolean;
}

export function validateCreateRestaurantTableInput(
  input: CreateRestaurantTableInput,
): void {
  if (!Number.isInteger(input.number) || input.number <= 0) {
    throw new Error('TABLE_NUMBER_INVALID');
  }

  if (!Number.isInteger(input.capacity) || input.capacity <= 0) {
    throw new Error('TABLE_CAPACITY_INVALID');
  }

  if (input.name !== undefined && input.name.trim().length > 80) {
    throw new Error('TABLE_NAME_TOO_LONG');
  }

  if (input.area !== undefined && input.area.trim().length > 80) {
    throw new Error('TABLE_AREA_TOO_LONG');
  }
}

export function validateUpdateRestaurantTableInput(
  input: UpdateRestaurantTableInput,
): void {
  if (input.number !== undefined && (!Number.isInteger(input.number) || input.number <= 0)) {
    throw new Error('TABLE_NUMBER_INVALID');
  }

  if (input.capacity !== undefined && (!Number.isInteger(input.capacity) || input.capacity <= 0)) {
    throw new Error('TABLE_CAPACITY_INVALID');
  }

  if (input.name !== undefined && input.name.trim().length > 80) {
    throw new Error('TABLE_NAME_TOO_LONG');
  }

  if (input.area !== undefined && input.area.trim().length > 80) {
    throw new Error('TABLE_AREA_TOO_LONG');
  }
}

export function isRestaurantTableConfigurable(table: RestaurantTable): boolean {
  return table.active && table.status !== 'OCCUPIED';
}
