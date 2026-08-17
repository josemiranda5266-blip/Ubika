import './setup_env';
import 'dotenv/config';
import assert from 'assert';
import { db, injectTestFixtures } from '../server/db';
import { createUbikaApp } from '../server';
import { generateAuthToken } from '../server/auth';

async function runFoodTenantIsolationTests() {
  console.log('====================================================');
  console.log('🔒 INICIANDO TEST SUITE DE AISLAMIENTO TOTAL DE TENANTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(description: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ [PASÓ] ${description}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ [FALLÓ] ${description}`);
      console.error(`     Error: ${err.message || err}`);
      failed++;
    }
  }

  injectTestFixtures();
  const app = createUbikaApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const BASE_URL = `http://127.0.0.1:${address.port}`;

  try {
    const adminLogisticsUser = db.getUsersByCompany('comp_centro_logistico_01')[0];
    const adminFoodUser = db.getUsersByCompany('comp_food_don_pedro_01')[0];

    assert(adminLogisticsUser, 'Debe existir un usuario admin de logística');
    assert(adminFoodUser, 'Debe existir un usuario admin gastronómico');

    const tokenAdminLogistics = generateAuthToken(adminLogisticsUser);
    const tokenAdminFood = generateAuthToken(adminFoodUser);

    console.log('--- TEST 1: RECHAZO DE CONSULTA DE TIENDA FOOD PARA EMPRESA LOGÍSTICA ---');
    await test('1. GET /api/food/store/comp_centro_logistico_01 debe retornar 403 o 404 (Logística no es Food)', async () => {
      const res = await fetch(`${BASE_URL}/api/food/store/comp_centro_logistico_01`);
      assert(res.status === 403 || res.status === 404, `Respondió con status ${res.status} en lugar de 403/404`);
    });

    console.log('--- TEST 2: VERIFICACIÓN DE NO AUTO-CREACIÓN DE STORE PARA LOGÍSTICA ---');
    await test('2. El GET anterior NUNCA debe haber creado una FoodStore para comp_centro_logistico_01 en DB', () => {
      const store = db.getFoodStoreByCompanyId('comp_centro_logistico_01');
      assert(store === null || store === undefined, 'No debe existir FoodStore para la empresa de logística');
    });

    console.log('--- TEST 3: RECHAZO DE CREACIÓN DE PEDIDO FOOD PARA EMPRESA LOGÍSTICA ---');
    await test('3. POST /api/food/orders con companyId comp_centro_logistico_01 debe ser rechazado', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_centro_logistico_01',
          deliveryType: 'FOOD_DELIVERY',
          paymentMethod: 'CASH',
          items: [{ productId: 'prod_fake', quantity: 1 }],
          recipientName: 'Juan Pérez',
          recipientPhone: '+5491100001111',
        }),
      });
      assert(res.status === 403 || res.status === 404, `Respondió con status ${res.status}`);
    });

    console.log('--- TEST 4: RECHAZO DE CONFIGURACIÓN DE TIENDA POR ADMIN DE LOGÍSTICA ---');
    await test('4. PUT /api/food/store/config por admin de logística debe ser rechazado con 403', async () => {
      const res = await fetch(`${BASE_URL}/api/food/store/config`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenAdminLogistics}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          foodEnabled: true,
          name: 'Intento de activación',
        }),
      });
      assert.strictEqual(res.status, 403, `Respondió con status ${res.status} en lugar de 403`);
    });

    console.log('--- TEST 5: RECHAZO DE CREACIÓN DE CATEGORÍA FOOD POR ADMIN DE LOGÍSTICA ---');
    await test('5. POST /api/food/categories por admin de logística debe ser rechazado con 403', async () => {
      const res = await fetch(`${BASE_URL}/api/food/categories`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenAdminLogistics}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Categoría Ilegal' }),
      });
      assert.strictEqual(res.status, 403, `Respondió con status ${res.status} en lugar de 403`);
    });

    console.log('--- TEST 6: RECHAZO DE CREACIÓN DE PRODUCTO FOOD POR ADMIN DE LOGÍSTICA ---');
    await test('6. POST /api/food/products por admin de logística debe ser rechazado con 403', async () => {
      const res = await fetch(`${BASE_URL}/api/food/products`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenAdminLogistics}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categoryId: 'fcat_fake',
          name: 'Producto Ilegal',
          price: 1000,
        }),
      });
      assert.strictEqual(res.status, 403, `Respondió con status ${res.status} en lugar de 403`);
    });

    console.log('--- TEST 7: RECHAZO DE CONFIGURACIÓN DE TARIFA FOOD POR ADMIN DE LOGÍSTICA ---');
    await test('7. PUT /api/food/shipping-rate por admin de logística debe ser rechazado con 403', async () => {
      const res = await fetch(`${BASE_URL}/api/food/shipping-rate`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenAdminLogistics}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseFee: 1000,
          includedKm: 3,
          perKmFee: 300,
          maxDistanceKm: 10,
          storeLatitude: -34.6037,
          storeLongitude: -58.3816,
        }),
      });
      assert.strictEqual(res.status, 403, `Respondió con status ${res.status} en lugar de 403`);
    });

    console.log('--- TEST 8: CONSULTA EXITOSA DE TIENDA FOOD VÁLIDA (DON PEDRO) ---');
    await test('8. GET /api/food/store/comp_food_don_pedro_01 responde 200 con datos completos', async () => {
      const res = await fetch(`${BASE_URL}/api/food/store/comp_food_don_pedro_01`);
      assert.strictEqual(res.status, 200, `Respondió con status ${res.status}`);
      const data = await res.json();
      assert(data.store, 'Debe devolver store');
      assert.strictEqual(data.store.name, 'Hamburguesería Don Pedro');
      assert(Array.isArray(data.categories) && data.categories.length > 0, 'Debe incluir categorías');
      assert(Array.isArray(data.products) && data.products.length > 0, 'Debe incluir productos');
      assert(data.shippingRate, 'Debe incluir shippingRate');
    });

    console.log('--- TEST 9: CONSULTA DE PEDIDOS FOOD POR COMERCIANTE Y PRESENCIA DE PEDIDO #1075 ---');
    await test('9. GET /api/food/orders para Don Pedro devuelve sus pedidos incluyendo el pedido #1075', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders`, {
        headers: { Authorization: `Bearer ${tokenAdminFood}` },
      });
      assert.strictEqual(res.status, 200);
      const orders = await res.json();
      assert(Array.isArray(orders), 'Debe ser un array');
      const order1075 = orders.find((o: any) => o.orderNumber === 1075);
      assert(order1075, 'El pedido #1075 de Don Pedro debe estar presente');
      assert.strictEqual(order1075.companyId, 'comp_food_don_pedro_01');
    });

    console.log('--- TEST 10: VALIDACIÓN DE RETIRO EN MOSTRADOR CON CÓDIGO (PICKUP) ---');
    await test('10. POST /api/food/orders/:id/pickup valida código de retiro y pasa a PICKED_UP', async () => {
      const ordersRes = await fetch(`${BASE_URL}/api/food/orders`, {
        headers: { Authorization: `Bearer ${tokenAdminFood}` },
      });
      const orders = await ordersRes.json();
      const order = orders.find((o: any) => o.orderNumber === 1075);
      assert(order, 'Debe existir pedido 1075');

      const pickupRes = await fetch(`${BASE_URL}/api/food/orders/${order.id}/pickup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenAdminFood}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pickupCode: 'DP107' }),
      });
      assert(pickupRes.status === 200 || pickupRes.status === 409, `Respondió con status ${pickupRes.status}`);
    });

    console.log('--- TEST 11: APROBACIÓN DE PAGO POR COMERCIO FOOD ---');
    await test('11. POST /api/food/orders/:id/payment/approve aprueba el pago del pedido', async () => {
      // Create a dedicated order for testing payment approval idempotently
      const orderRes = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          deliveryType: 'FOOD_PICKUP',
          paymentMethod: 'CASH',
          items: [{ productId: 'prod_burg_clasica', quantity: 1 }],
          recipientName: 'Test Pago',
          recipientPhone: '+5491100002222',
        }),
      });
      const orderData = await orderRes.json();
      assert(orderData.order && orderData.order.id, 'Debe crearse el pedido para aprobar');

      const approveRes = await fetch(`${BASE_URL}/api/food/orders/${orderData.order.id}/payment/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAdminFood}` },
      });
      assert.strictEqual(approveRes.status, 200, `Respondió con status ${approveRes.status}`);
      const updated = await approveRes.json();
      assert.strictEqual(updated.paymentStatus, 'APPROVED');
    });

    console.log('--- TEST 12: AISLAMIENTO EN UBIKA LOGÍSTICA ---');
    await test('12. GET /api/deliveries para comp_centro_logistico_01 no contiene pedidos ni datos de Don Pedro', async () => {
      const res = await fetch(`${BASE_URL}/api/deliveries?companyId=comp_centro_logistico_01`, {
        headers: { Authorization: `Bearer ${tokenAdminLogistics}` },
      });
      assert.strictEqual(res.status, 200);
      const deliveries = await res.json();
      const containsFoodOrder = deliveries.some((d: any) => d.foodOrderId === 'forder_1075_dp_seed');
      assert(!containsFoodOrder, 'Deliveries de Logística Express Centro no deben contener el pedido #1075 de Don Pedro');
    });
  } finally {
    server.close();
  }

  console.log('\n====================================================');
  console.log(`📊 RESULTADO DE AISLAMIENTO: ${passed} PASADOS | ${failed} FALLADOS`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFoodTenantIsolationTests().catch((e) => {
  console.error('Error fatal en suite de aislamiento:', e);
  process.exit(1);
});
