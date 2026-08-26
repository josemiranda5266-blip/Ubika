import assert from 'node:assert/strict';
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

async function expectRejects(action: () => Promise<unknown>, message: string) {
  await assert.rejects(action, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

function createService() {
  const tables = new InMemoryRestaurantTableRepository();
  const orders = new InMemoryDiningOrderRepository();
  return { service: new SalonService(tables, orders), tables, orders };
}

async function run() {
  {
    const { service } = createService();
    await service.createTable(table());
    await expectRejects(() => service.createTable(table({ id: 'table-2' })), 'TABLE_NUMBER_ALREADY_EXISTS');
    await expectRejects(() => service.createTable(table({ id: 'table-2', number: 2 })), 'TABLE_QR_TOKEN_ALREADY_EXISTS');
  }

  {
    const { service, tables } = createService();
    await service.createTable(table());
    await service.createDiningOrder(order());
    const savedTable = await tables.getById(companyId, 'table-1');
    assert.equal(savedTable?.status, 'OCCUPIED');
  }

  {
    const { service } = createService();
    await service.createTable(table());
    await service.createDiningOrder(order());
    await expectRejects(() => service.createDiningOrder(order({ id: 'order-2' })), 'OPEN_DINING_ORDER_ALREADY_EXISTS');
  }

  {
    const { service, tables } = createService();
    await service.createTable(table());
    await service.createDiningOrder(order());
    for (const status of ['SENT_TO_KITCHEN', 'PREPARING', 'READY', 'SERVED', 'REQUESTED_BILL', 'CLOSED'] as const) {
      await service.transitionOrder(companyId, 'order-1', status);
    }
    const savedTable = await tables.getById(companyId, 'table-1');
    assert.equal(savedTable?.status, 'AVAILABLE');
  }

  {
    const { service } = createService();
    await service.createTable(table());
    await service.createDiningOrder(order());
    await service.transitionOrder(companyId, 'order-1', 'SENT_TO_KITCHEN');
    await service.transitionOrder(companyId, 'order-1', 'PREPARING');
    await expectRejects(() => service.transitionOrder(companyId, 'order-1', 'OPEN'), 'DINING_ORDER_INVALID_TRANSITION:PREPARING->OPEN');
  }

  {
    const { service } = createService();
    await service.createTable(table());
    await service.createDiningOrder(order());
    await expectRejects(() => service.transitionOrder('other-company', 'order-1', 'CANCELLED'), 'DINING_ORDER_NOT_FOUND');
  }

  console.log('SalonService tests: PASS');
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
