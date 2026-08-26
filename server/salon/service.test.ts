import { describe, expect, it } from 'vitest';
import { InMemoryDiningOrderRepository, InMemoryRestaurantTableRepository } from './memory-repositories';
import { SalonService } from './service';
import type { DiningOrder, RestaurantTable } from './types';

const companyId = 'company-test';

function table(overrides: Partial<RestaurantTable> = {}): RestaurantTable {
  return { id: 'table-1', companyId, number: 1, name: 'Mesa 1', capacity: 4, status: 'AVAILABLE', active: true, publicQrToken: 'qr-table-1', createdAt: 1, updatedAt: 1, ...overrides };
}

function order(overrides: Partial<DiningOrder> = {}): DiningOrder {
  return { id: 'order-1', companyId, tableId: 'table-1', status: 'OPEN', items: [{ productId: 'p1', productName: 'Producto', quantity: 1, unitPrice: 100, total: 100 }], subtotal: 100, total: 100, createdAt: 1, updatedAt: 1, ...overrides };
}

function service() {
  const tables = new InMemoryRestaurantTableRepository();
  const orders = new InMemoryDiningOrderRepository();
  return { service: new SalonService(tables, orders), tables, orders };
}

describe('SalonService', () => {
  it('creates a table and rejects duplicate number and QR', async () => {
    const { service } = service();
    await service.createTable(table());
    await expect(service.createTable(table({ id: 'table-2' }))).rejects.toThrow('TABLE_NUMBER_ALREADY_EXISTS');
    await expect(service.createTable(table({ id: 'table-2', number: 2 }))).rejects.toThrow('TABLE_QR_TOKEN_ALREADY_EXISTS');
  });

  it('creates an open order and marks an available table occupied', async () => {
    const { service, tables } = service();
    await service.createTable(table());
    await service.createDiningOrder(order());
    await expect(tables.getById(companyId, 'table-1')).resolves.toMatchObject({ status: 'OCCUPIED' });
  });

  it('rejects a second OPEN order for the same table', async () => {
    const { service } = service();
    await service.createTable(table());
    await service.createDiningOrder(order());
    await expect(service.createDiningOrder(order({ id: 'order-2' }))).rejects.toThrow('OPEN_DINING_ORDER_ALREADY_EXISTS');
  });

  it('accepts the valid lifecycle and frees the table when closed', async () => {
    const { service, tables } = service();
    await service.createTable(table());
    await service.createDiningOrder(order());
    for (const status of ['SENT_TO_KITCHEN', 'PREPARING', 'READY', 'SERVED', 'REQUESTED_BILL', 'CLOSED'] as const) {
      await service.transitionOrder(companyId, 'order-1', status);
    }
    await expect(tables.getById(companyId, 'table-1')).resolves.toMatchObject({ status: 'AVAILABLE' });
  });

  it('rejects invalid backward transitions after preparation', async () => {
    const { service } = service();
    await service.createTable(table());
    await service.createDiningOrder(order());
    await service.transitionOrder(companyId, 'order-1', 'SENT_TO_KITCHEN');
    await service.transitionOrder(companyId, 'order-1', 'PREPARING');
    await expect(service.transitionOrder(companyId, 'order-1', 'OPEN')).rejects.toThrow('DINING_ORDER_INVALID_TRANSITION:PREPARING->OPEN');
  });

  it('rejects access through another company', async () => {
    const { service } = service();
    await service.createTable(table());
    await service.createDiningOrder(order());
    await expect(service.transitionOrder('other-company', 'order-1', 'CANCELLED')).rejects.toThrow('DINING_ORDER_NOT_FOUND');
  });
});
