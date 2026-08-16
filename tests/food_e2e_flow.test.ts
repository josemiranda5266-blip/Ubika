import 'dotenv/config';
import assert from 'assert';
import { db } from '../server/db';
import { createUbikaApp } from '../server';
import { generateAuthToken } from '../server/auth';

async function runFoodE2EFlowTests() {
  console.log('====================================================');
  console.log('🚀 INICIANDO TEST SUITE E2E COMPLETO: UBIKA FOOD');
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

  const app = createUbikaApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const BASE_URL = `http://127.0.0.1:${address.port}`;

  try {
    const donPedroAdmin = db.getUsersByCompany('comp_food_don_pedro_01').find((u) => u.role === 'COMPANY_ADMIN');
    assert(donPedroAdmin, 'Debe existir el usuario admin de Don Pedro');
    const tokenDonPedro = generateAuthToken(donPedroAdmin);

    // Driver belonging to Don Pedro's company
    let donPedroDriverUser = db.getUsersByCompany('comp_food_don_pedro_01').find((u) => u.role === 'DRIVER');
    if (!donPedroDriverUser) {
      const driverObj = db.createDriver({
        id: 'drv_don_pedro_01',
        internalId: 'DRV-0001',
        companyId: 'comp_food_don_pedro_01',
        name: 'Cadete Pedro Jr',
        phone: '+5491188889999',
        email: 'cadete@donpedro.com',
        vehicle: 'moto',
        status: 'disponible',
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalDeliveries: 0,
        rating: 5.0,
      });
      donPedroDriverUser = db.createUser({
        id: 'usr_drv_don_pedro_01',
        email: 'cadete@donpedro.com',
        passwordHash: 'hash',
        name: 'Cadete Pedro Jr',
        role: 'DRIVER',
        companyId: 'comp_food_don_pedro_01',
        driverId: driverObj.id,
        createdAt: Date.now(),
        active: true,
      });
    }

    console.log('--- FLUJO E2E 1: PEDIDO FOOD_DELIVERY (CLIENTE -> COMERCIANTE -> CADETE -> ENTREGADO) ---');

    let storeData: any = null;
    let shippingCalc: any = null;
    let deliveryOrder: any = null;
    let publicToken: string = '';

    await test('Etapa 1: Cliente navega el menú del comercio Don Pedro', async () => {
      const res = await fetch(`${BASE_URL}/api/food/store/comp_food_don_pedro_01`);
      assert.strictEqual(res.status, 200);
      storeData = await res.json();
      assert(storeData.store && storeData.products.length > 0);
    });

    await test('Etapa 2: Cliente calcula el costo de envío con su ubicación GPS', async () => {
      const res = await fetch(`${BASE_URL}/api/food/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          latitude: -34.6037,
          longitude: -58.3816,
        }),
      });
      assert.strictEqual(res.status, 200);
      shippingCalc = await res.json();
      assert(typeof shippingCalc.shippingCost === 'number');
    });

    await test('Etapa 3: Cliente realiza pedido de delivery con pago en efectivo', async () => {
      const prod = storeData.products[0];
      const res = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          deliveryType: 'FOOD_DELIVERY',
          paymentMethod: 'CASH',
          items: [{ productId: prod.id, quantity: 2 }],
          recipientName: 'Gonzalo Higuaín',
          recipientPhone: '+5491177778888',
          deliveryAddress: 'Av. Libertador 2000',
          recipientLocation: { latitude: -34.6037, longitude: -58.3816 },
        }),
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      deliveryOrder = data.order;
      publicToken = data.publicTrackingToken;

      assert.strictEqual(deliveryOrder.orderStatus, 'PENDING');
      assert.strictEqual(deliveryOrder.paymentStatus, 'PENDING');
      assert.strictEqual(deliveryOrder.subtotal, prod.price * 2);
    });

    await test('Etapa 4: Cliente consulta tracking público con token de seguimiento', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/public/${deliveryOrder.id}?token=${publicToken}`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.orderStatus, 'PENDING');
      assert.strictEqual(data.pickupCode, undefined); // Pickup code never exposed
      assert(data.recipientPhoneMasked.includes('***'));
    });

    await test('Etapa 5: Comerciante cambia estado a PREPARING (Cocina en marcha)', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/${deliveryOrder.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenDonPedro}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'PREPARING' }),
      });
      assert.strictEqual(res.status, 200);
      const updated = await res.json();
      assert.strictEqual(updated.orderStatus, 'PREPARING');
    });

    await test('Etapa 6: Comerciante marca pedido READY y asigna cadete de su empresa', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/${deliveryOrder.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenDonPedro}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderStatus: 'READY',
          driverId: donPedroDriverUser!.driverId,
        }),
      });
      assert.strictEqual(res.status, 200);
      const updated = await res.json();
      assert.strictEqual(updated.orderStatus, 'ASSIGNED');
      assert.strictEqual(updated.driverId, donPedroDriverUser!.driverId);
      assert(updated.deliveryId, 'Debe haber creado un delivery en el motor core de logística');
    });

    const tokenDriver = generateAuthToken(donPedroDriverUser!);

    await test('Etapa 7: Cadete pasa pedido a IN_TRANSIT', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/${deliveryOrder.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenDriver}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'IN_TRANSIT' }),
      });
      assert.strictEqual(res.status, 200);
      const updated = await res.json();
      assert.strictEqual(updated.orderStatus, 'IN_TRANSIT');
    });

    await test('Etapa 8: Cadete entrega pedido al cliente (DELIVERED)', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/${deliveryOrder.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenDriver}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'DELIVERED' }),
      });
      assert.strictEqual(res.status, 200);
      const updated = await res.json();
      assert.strictEqual(updated.orderStatus, 'DELIVERED');
    });

    await test('Etapa 9: Comerciante confirma la cobranza en efectivo (payment/approve)', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/${deliveryOrder.id}/payment/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenDonPedro}` },
      });
      assert.strictEqual(res.status, 200);
      const updated = await res.json();
      assert.strictEqual(updated.paymentStatus, 'APPROVED');
    });


    console.log('\n--- FLUJO E2E 2: PEDIDO FOOD_PICKUP (TRANSFERENCIA -> REPORTE PÚBLICO -> APROBACIÓN -> PREPARACIÓN -> RETIRO CON CÓDIGO) ---');

    let pickupOrder: any = null;
    let pickupPublicToken: string = '';

    await test('Etapa 1: Cliente genera pedido de retiro en local con pago por Transferencia', async () => {
      const prod = storeData.products[0];
      const res = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          deliveryType: 'FOOD_PICKUP',
          paymentMethod: 'TRANSFER',
          items: [{ productId: prod.id, quantity: 1 }],
          recipientName: 'Lionel Messi',
          recipientPhone: '+5491110101010',
        }),
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      pickupOrder = data.order;
      pickupPublicToken = data.publicTrackingToken;

      assert(pickupOrder.pickupCode, 'Debe poseer un código de retiro de 5 caracteres');
      assert.strictEqual(pickupOrder.orderStatus, 'PENDING');
      assert.strictEqual(pickupOrder.paymentStatus, 'PENDING');
    });

    await test('Etapa 2: Cliente informa transferencia mediante endpoint público con token', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/public/${pickupOrder.id}/report-transfer?token=${pickupPublicToken}`, {
        method: 'POST',
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.order.paymentStatus, 'PROCESSING');
    });

    await test('Etapa 3: Comerciante valida comprobante y aprueba el pago', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/${pickupOrder.id}/payment/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenDonPedro}` },
      });
      assert.strictEqual(res.status, 200);
      const updated = await res.json();
      assert.strictEqual(updated.paymentStatus, 'APPROVED');
    });

    await test('Etapa 4: Comerciante pasa el pedido a PREPARING', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/${pickupOrder.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenDonPedro}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'PREPARING' }),
      });
      assert.strictEqual(res.status, 200);
      const updated = await res.json();
      assert.strictEqual(updated.orderStatus, 'PREPARING');
    });

    await test('Etapa 5: Comerciante marca el pedido listo para retiro (READY)', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/${pickupOrder.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenDonPedro}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'READY' }),
      });
      assert.strictEqual(res.status, 200);
      const updated = await res.json();
      assert.strictEqual(updated.orderStatus, 'READY_FOR_PICKUP');
    });

    await test('Etapa 6: Cliente llega al local y comerciante valida el código de retiro', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/${pickupOrder.id}/pickup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenDonPedro}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupCode: pickupOrder.pickupCode }),
      });
      assert.strictEqual(res.status, 200);
      const updated = await res.json();
      assert.strictEqual(updated.orderStatus, 'PICKED_UP');
      assert(typeof updated.pickedUpAt === 'number');
      assert(typeof updated.pickupCodeUsedAt === 'number');
    });

    await test('Etapa 7: Intento de reutilizar código de retiro (Replay attack) es rechazado con 409', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/${pickupOrder.id}/pickup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenDonPedro}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupCode: pickupOrder.pickupCode }),
      });
      assert.strictEqual(res.status, 409);
    });

    console.log('\n====================================================');
    console.log(`📊 PRUEBAS E2E COMPLETADAS: PASARON ${passed} / ${passed + failed} ETAPAS`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runFoodE2EFlowTests().catch((err) => {
  console.error('Fatal E2E Test Error:', err);
  process.exit(1);
});
