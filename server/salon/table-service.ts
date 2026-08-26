import { generatePublicTableQrToken } from './qr';
import {
  validateCreateRestaurantTableInput,
  validateUpdateRestaurantTableInput,
  type CreateRestaurantTableInput,
  type UpdateRestaurantTableInput,
} from './validation';
import type { RestaurantTable } from './types';
import type { RestaurantTableRepository } from './repository';

export class RestaurantTableService {
  constructor(private readonly repository: RestaurantTableRepository) {}

  async create(
    companyId: string,
    branchId: string | undefined,
    input: CreateRestaurantTableInput,
    now = new Date(),
  ): Promise<RestaurantTable> {
    validateCreateRestaurantTableInput(input);

    const tables = await this.repository.list(companyId, branchId);
    if (tables.some((table) => table.number === input.number && table.active)) {
      throw new Error('TABLE_NUMBER_ALREADY_EXISTS');
    }

    const table: RestaurantTable = {
      id: crypto.randomUUID(),
      companyId,
      branchId,
      number: input.number,
      name: input.name?.trim() || undefined,
      capacity: input.capacity,
      area: input.area?.trim() || undefined,
      status: 'AVAILABLE',
      active: true,
      publicQrToken: generatePublicTableQrToken(),
      createdAt: now,
      updatedAt: now,
    };

    return this.repository.create(table);
  }

  async update(
    companyId: string,
    tableId: string,
    input: UpdateRestaurantTableInput,
    now = new Date(),
  ): Promise<RestaurantTable> {
    validateUpdateRestaurantTableInput(input);

    const current = await this.repository.getById(companyId, tableId);
    if (!current) throw new Error('TABLE_NOT_FOUND');
    if (!current.active) throw new Error('TABLE_INACTIVE');
    if (current.status === 'OCCUPIED') throw new Error('TABLE_OCCUPIED');

    if (
      input.number !== undefined &&
      input.number !== current.number
    ) {
      const tables = await this.repository.list(companyId, current.branchId);
      if (tables.some((table) => table.id !== tableId && table.active && table.number === input.number)) {
        throw new Error('TABLE_NUMBER_ALREADY_EXISTS');
      }
    }

    return this.repository.update(companyId, tableId, {
      ...input,
      name: input.name?.trim(),
      area: input.area?.trim(),
      updatedAt: now,
    } as Partial<RestaurantTable>);
  }

  async regenerateQr(
    companyId: string,
    tableId: string,
  ): Promise<RestaurantTable> {
    const current = await this.repository.getById(companyId, tableId);
    if (!current) throw new Error('TABLE_NOT_FOUND');
    if (!current.active) throw new Error('TABLE_INACTIVE');
    if (current.status === 'OCCUPIED') throw new Error('TABLE_OCCUPIED');

    return this.repository.update(companyId, tableId, {
      publicQrToken: generatePublicTableQrToken(),
      updatedAt: new Date(),
    } as Partial<RestaurantTable>);
  }

  async deactivate(companyId: string, tableId: string): Promise<RestaurantTable> {
    const current = await this.repository.getById(companyId, tableId);
    if (!current) throw new Error('TABLE_NOT_FOUND');
    if (current.status === 'OCCUPIED') throw new Error('TABLE_OCCUPIED');

    return this.repository.update(companyId, tableId, {
      active: false,
      updatedAt: new Date(),
    } as Partial<RestaurantTable>);
  }
}
