import assert from 'node:assert/strict';
import { loadDatabase, saveDatabaseSync } from '../db';
import { PersistentDiningOrderRepository, PersistentRestaurantTableRepository } from './persistent-repositories';
import type { DiningOrder, RestaurantTable } from './types';

const companyId = `salon-persistence-test-${Date.now()}`;

const table: RestaurantTable = {
  id: `table-persist-${Date.now()}`,
  companyId,
  number: 1,
  name: 'Mesa persistente',
  capacity: 4,
  status: 'AVAILABLE',
  active: true,
  publicQrToken: `qr-persist-${Date.now()}`,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const order: DiningOrder = {
  id: `order-persist-${Date.now()}`,
  companyId,
  tableId: table.id,
  origin: 'WAITER',
  status: 'OPEN',
  items: [{ productId: 'p1', name: 'Producto persistente', quantity: 1, unitPrice: 100 }],
  subtotal: 100,
  total: 100,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

async function run() {
  const db = loadDatabase();
  db.restaurant_tables = db.restaurant_tables || [];
  db.dining_orders = db.dining_orders || [];

  const tables = new PersistentRestaurantTableRepository();
  const orders = new PersistentDiningOrderRepository();

  await tables.create(table);
  await orders.create(order);
  saveDatabaseSync();

  const reloaded = loadDatabase();
  assert.ok(reloaded.restaurant_tables?.some((item) => item.id === table.id));
  assert.ok(reloaded.dining_orders?.some((item) => item.id === order.id));

  const persistedTable = await tables.getById(companyId, table.id);
  const persistedOrder = await orders.getById(companyId, order.id);
  assert.equal(persistedTable?.publicQrToken, table.publicQrToken);
  assert.equal(persistedOrder?.tableId, table.id);

  console.log('Salon persistence tests: PASS');
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
