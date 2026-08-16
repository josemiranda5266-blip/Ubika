import assert from 'assert';
import { db } from '../server/db';
import { createUbikaApp } from '../server';
import { generateAuthToken } from '../server/auth';

async function runFoodSecurityAndFlowTests() {
  console.log('====================================================');
  console.log('🏃 INICIANDO TEST SUITE DE UBIKA FOOD: SEGURIDAD Y FLUJO');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function test(description: string, fn: () => void | Promise<void>) {
    try {
      const res = fn();
      if (res && typeof res.then === 'function') {
        return res.then(
          () => {
            console.log(`  ✅ [PASÓ] ${description}`);
            passed++;
          },
          (err: any) => {
            console.error(`  ❌ [FALLÓ] ${description}`);
            console.error(`     Error: ${err.message || err}`);
            failed++;
          }
        );
      } else {
        console.log(`  ✅ [PASÓ] ${description}`);
        passed++;
      }
    } catch (err: any) {
      console.error(`  ❌ [FALLÓ] ${description}`);
      console.error(`     Error: ${err.message || err}`);
      failed++;
    }
  }

  // Base de datos ya inicializada
  const app = createUbikaApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const BASE_URL = `http://127.0.0.1:${address.port}`;

  try {
    const adminLogisticsUser = db.getUsersByCompany('comp_centro_logistico_01')[0];
    const adminFoodUser = db.getUsersByCompany('comp_food_don_pedro_01')[0];
    const driverLogisticsUser = db.getUsersByCompany('comp_centro_logistico_01').find((u) => u.role === 'DRIVER')!;
    const driverOtherCompanyUser = db.getUsersByCompany('comp_farma_norte_02').find((u) => u.role === 'DRIVER')!;

    assert(adminLogisticsUser, 'Debe existir un usuario admin de logística');
    assert(adminFoodUser, 'Debe existir un usuario admin gastronómico');
    assert(driverLogisticsUser, 'Debe existir un driver de logística');
    assert(driverOtherCompanyUser, 'Debe existir un driver de otra empresa');

    const tokenAdminLogistics = generateAuthToken(adminLogisticsUser);
    const tokenAdminFood = generateAuthToken(adminFoodUser);

    console.log('--- 1. AISLAMIENTO MULTI-TENANT Y RECHAZO DE EMPRESAS DE LOGÍSTICA ---');

    await test('1. GET /api/food/store/comp_centro_logistico_01 debe retornar 403 o 404 (Logística no es Food)', async () => {
      const res = await fetch(`${BASE_URL}/api/food/store/comp_centro_logistico_01`);
      assert(res.status === 403 || res.status === 404, `Respondió con status ${res.status} en lugar de 403/404`);
    });

    await test('2. El GET anterior NUNCA debe haber creado una FoodStore para comp_centro_logistico_01', () => {
      const store = db.getFoodStoreByCompanyId('comp_centro_logistico_01');
      assert(store === null || store === undefined, 'No debe existir FoodStore para la empresa de logística');
    });

    await test('3. POST /api/food/orders especificando companyId comp_centro_logistico_01 debe ser rechazado', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_centro_logistico_01',
          deliveryType: 'FOOD_DELIVERY',
          items: [{ productId: 'prod_fake', quantity: 1 }],
          recipientName: 'Juan Pérez',
          recipientPhone: '+5491100001111',
        }),
      });
      assert(res.status === 403 || res.status === 404, `Respondió con status ${res.status}`);
    });

    await test('4. PUT /api/food/store/config por admin de logística para activar food debe ser rechazado con 403', async () => {
      const res = await fetch(`${BASE_URL}/api/food/store/config`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenAdminLogistics}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          foodEnabled: true,
          name: 'Hacked Store',
        }),
      });
      assert(res.status === 403, `Respondió con status ${res.status} en lugar de 403`);
    });

    await test('5. POST /api/food/categories por admin de logística debe ser rechazado con 403', async () => {
      const res = await fetch(`${BASE_URL}/api/food/categories`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenAdminLogistics}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Entradas' }),
      });
      assert(res.status === 403, `Respondió con status ${res.status}`);
    });

    await test('6. POST /api/food/products por admin de logística debe ser rechazado con 403', async () => {
      const res = await fetch(`${BASE_URL}/api/food/products`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenAdminLogistics}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ categoryId: 'cat_1', name: 'Pizza', price: 1000 }),
      });
      assert(res.status === 403, `Respondió con status ${res.status}`);
    });

    await test('7. PUT /api/food/shipping-rate por admin de logística debe ser rechazado con 403', async () => {
      const res = await fetch(`${BASE_URL}/api/food/shipping-rate`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenAdminLogistics}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ baseFee: 1000, includedKm: 2, perKmFee: 500, maxDistanceKm: 10, storeLatitude: -34.6, storeLongitude: -58.3 }),
      });
      assert(res.status === 403, `Respondió con status ${res.status}`);
    });

    console.log('\n--- 2. CONSULTA DE COMERCIO FOOD VÁLIDO Y CÁLCULO DE ENVÍO ---');

    let foodProducts: any[] = [];

    await test('8. GET /api/food/store/comp_food_don_pedro_01 responde 200 con tienda, categorías, productos y tarifa', async () => {
      const res = await fetch(`${BASE_URL}/api/food/store/comp_food_don_pedro_01`);
      assert(res.status === 200, `Respondió con status ${res.status}`);
      const data = await res.json();
      assert(data.store && data.store.name.includes('Don Pedro'), 'Debe retornar la tienda Don Pedro');
      assert(Array.isArray(data.categories) && data.categories.length > 0, 'Debe retornar categorías');
      assert(Array.isArray(data.products) && data.products.length > 0, 'Debe retornar productos');
      assert(data.shippingRate && typeof data.shippingRate.baseFee === 'number', 'Debe retornar tarifa de envío');
      foodProducts = data.products;
    });

    await test('9. POST /api/food/calculate-shipping con coordenadas inválidas responde 400', async () => {
      const res = await fetch(`${BASE_URL}/api/food/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: 'comp_food_don_pedro_01', latitude: 999, longitude: -58.38 }),
      });
      assert(res.status === 400, `Respondió con status ${res.status}`);
    });

    await test('10. POST /api/food/calculate-shipping con coordenadas válidas responde 200 con costo y distancia', async () => {
      const res = await fetch(`${BASE_URL}/api/food/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: 'comp_food_don_pedro_01', latitude: -34.605, longitude: -58.382 }),
      });
      assert(res.status === 200, `Respondió con status ${res.status}`);
      const data = await res.json();
      assert(typeof data.shippingCost === 'number' && typeof data.distanceKm === 'number', 'Respuesta incompleta');
    });

    await test('11. POST /api/food/calculate-shipping superando la distancia máxima responde 400 con outOfRange', async () => {
      const res = await fetch(`${BASE_URL}/api/food/calculate-shipping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: 'comp_food_don_pedro_01', latitude: -35.5, longitude: -59.5 }),
      });
      assert(res.status === 400, `Respondió con status ${res.status}`);
      const data = await res.json();
      assert(data.outOfRange === true, 'Debe marcar outOfRange: true');
    });

    console.log('\n--- 3. REGLAS DE CREACIÓN DE PEDIDOS Y VALIDACIÓN DE OPCIONES / PRECIOS ---');

    await test('12. Pedido FOOD_DELIVERY con método de pago TRANSFER es rechazado con 400', async () => {
      const burgerProd = foodProducts.find((p) => p.name.includes('Hamburguesa')) || foodProducts[0];
      const res = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          deliveryType: 'FOOD_DELIVERY',
          paymentMethod: 'TRANSFER', // No permitido para delivery
          items: [{ productId: burgerProd.id, quantity: 1 }],
          recipientName: 'Ana Gómez',
          recipientPhone: '+5491122223333',
          deliveryAddress: 'Av. Corrientes 1234',
          recipientLocation: { latitude: -34.6037, longitude: -58.3816 },
        }),
      });
      assert(res.status === 400, `Respondió con status ${res.status}`);
    });

    await test('13. Pedido con producto inexistente o de otra empresa es rechazado con 400', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          deliveryType: 'FOOD_PICKUP',
          paymentMethod: 'TRANSFER',
          items: [{ productId: 'fprod_invalid_999', quantity: 1 }],
          recipientName: 'Carlos López',
          recipientPhone: '+5491133334444',
        }),
      });
      assert(res.status === 400, `Respondió con status ${res.status}`);
    });

    await test('14. Pedido omitiendo grupo de opciones obligatorio (required minSelections) responde 400', async () => {
      const productWithOptions = foodProducts.find((p) => p.optionGroups && p.optionGroups.some((g: any) => g.required));
      if (productWithOptions) {
        const res = await fetch(`${BASE_URL}/api/food/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: 'comp_food_don_pedro_01',
            deliveryType: 'FOOD_PICKUP',
            paymentMethod: 'TRANSFER',
            items: [{ productId: productWithOptions.id, quantity: 1, selectedOptions: [] }],
            recipientName: 'María Rossi',
            recipientPhone: '+5491144445555',
          }),
        });
        assert(res.status === 400, `Respondió con status ${res.status}`);
      }
    });

    let createdDeliveryOrder: any = null;
    let createdPickupOrder: any = null;

    await test('15. Pedido FOOD_DELIVERY válido recalcula precios e incluye publicTrackingToken', async () => {
      const burgerProd = foodProducts[0];
      const res = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          deliveryType: 'FOOD_DELIVERY',
          paymentMethod: 'CASH',
          items: [{ productId: burgerProd.id, quantity: 2, unitPrice: 1 }], // Client sends fake unitPrice=1
          recipientName: 'Martín Palermo',
          recipientPhone: '+5491155556666',
          deliveryAddress: 'Av. Mayo 500',
          recipientLocation: { latitude: -34.608, longitude: -58.375 },
        }),
      });
      assert(res.status === 201, `Respondió con status ${res.status}`);
      const data = await res.json();
      assert(data.order && data.publicTrackingToken, 'Debe retornar order y publicTrackingToken');
      assert(data.order.subtotal === burgerProd.price * 2, 'El backend recalculó el subtotal ignorando el precio cliente');
      assert(data.order.shippingCost > 0, 'Debe haber calculado costo de envío');
      assert(data.order.totalAmount === data.order.subtotal + data.order.shippingCost, 'Total debe ser subtotal + envío');
      createdDeliveryOrder = data.order;
    });

    await test('16. Pedido FOOD_PICKUP válido genera pickupCode y publicTrackingToken', async () => {
      const burgerProd = foodProducts[0];
      const res = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          deliveryType: 'FOOD_PICKUP',
          paymentMethod: 'TRANSFER',
          items: [{ productId: burgerProd.id, quantity: 1 }],
          recipientName: 'Román Riquelme',
          recipientPhone: '+5491166667777',
        }),
      });
      assert(res.status === 201, `Respondió con status ${res.status}`);
      const data = await res.json();
      assert(data.order && data.order.pickupCode, 'Debe haber generado un pickupCode');
      assert(data.publicTrackingToken, 'Debe incluir token de tracking público');
      createdPickupOrder = data.order;
    });

    console.log('\n--- 4. ENDPOINTS PÚBLICOS DE TRACKING Y REPORTE DE TRANSFERENCIA ---');

    await test('17. Endpoint público de tracking sin token responde 403', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/public/${createdPickupOrder.id}`);
      assert(res.status === 403, `Respondió con status ${res.status}`);
    });

    await test('18. Endpoint público de tracking con token inválido responde 403', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/public/${createdPickupOrder.id}?token=invalid_token`);
      assert(res.status === 403, `Respondió con status ${res.status}`);
    });

    await test('19. Endpoint público con token válido responde 200 y NO expone pickupCode', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/public/${createdPickupOrder.id}?token=${createdPickupOrder.publicTrackingToken}`);
      assert(res.status === 200, `Respondió con status ${res.status}`);
      const data = await res.json();
      assert(data.pickupCode === undefined, 'El pickupCode NO debe exponerse en la respuesta pública');
      assert(data.recipientPhoneMasked && !data.recipientPhoneMasked.includes('66667777'), 'El teléfono debe estar enmascarado');
    });

    await test('20. Reporte de transferencia público sin token responde 403', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/public/${createdPickupOrder.id}/report-transfer`, {
        method: 'POST',
      });
      assert(res.status === 403, `Respondió con status ${res.status}`);
    });

    await test('21. Reporte de transferencia público para pedido FOOD_DELIVERY responde 400', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/public/${createdDeliveryOrder.id}/report-transfer?token=${createdDeliveryOrder.publicTrackingToken}`, {
        method: 'POST',
      });
      assert(res.status === 400, `Respondió con status ${res.status}`);
    });

    await test('22. Reporte de transferencia válido para pedido FOOD_PICKUP cambia paymentStatus a PROCESSING', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/public/${createdPickupOrder.id}/report-transfer?token=${createdPickupOrder.publicTrackingToken}`, {
        method: 'POST',
      });
      assert(res.status === 200, `Respondió con status ${res.status}`);
      const data = await res.json();
      assert(data.order.paymentStatus === 'PROCESSING', 'paymentStatus debe ser PROCESSING');
    });

    console.log('\n--- 5. GESTIÓN COMERCIANTE Y MÁQUINA DE ESTADOS DE PEDIDOS ---');

    await test('23. GET /api/food/orders por comerciante autenticado devuelve sus pedidos', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders`, {
        headers: { Authorization: `Bearer ${tokenAdminFood}` },
      });
      assert(res.status === 200, `Respondió con status ${res.status}`);
      const data = await res.json();
      assert(Array.isArray(data) && data.length >= 2, 'Debe devolver lista de pedidos');
    });

    await test('24. Asignar cadete de OTRA empresa al pedido responde 403', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/${createdDeliveryOrder.id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${tokenAdminFood}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderStatus: 'READY',
          driverId: driverOtherCompanyUser.driverId, // Driver of comp_farma_norte_02
        }),
      });
      assert(res.status === 403, `Respondió con status ${res.status} en lugar de 403`);
    });

    await test('25. Intento de pasar a PICKED_UP mediante PATCH /status responde 409 Conflict', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/${createdPickupOrder.id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${tokenAdminFood}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderStatus: 'PICKED_UP' }),
      });
      assert(res.status === 409, `Respondió con status ${res.status} en lugar de 409`);
    });

    await test('26. Transición inválida (PENDING -> DELIVERED) responde 409 Conflict', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/${createdDeliveryOrder.id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${tokenAdminFood}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderStatus: 'DELIVERED' }),
      });
      assert(res.status === 409, `Respondió con status ${res.status}`);
    });

    await test('27. Transición válida PENDING -> PREPARING responde 200', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/${createdPickupOrder.id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${tokenAdminFood}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderStatus: 'PREPARING' }),
      });
      assert(res.status === 200, `Respondió con status ${res.status}`);
    });

    await test('28. Transición válida PREPARING -> READY_FOR_PICKUP responde 200', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/${createdPickupOrder.id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${tokenAdminFood}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderStatus: 'READY' }),
      });
      assert(res.status === 200, `Respondió con status ${res.status}`);
      const data = await res.json();
      assert(data.orderStatus === 'READY_FOR_PICKUP', 'Debe haber quedado en READY_FOR_PICKUP');
    });

    console.log('\n--- 6. RETIRO EN LOCAL POR VALIDACIÓN DE CÓDIGO (/pickup) ---');

    await test('29. Validar retiro con código erróneo responde 400', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/${createdPickupOrder.id}/pickup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenAdminFood}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pickupCode: 'WRONG_CODE' }),
      });
      assert(res.status === 400, `Respondió con status ${res.status}`);
    });

    await test('30. Validar retiro con código correcto responde 200 y actualiza orderStatus a PICKED_UP', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/${createdPickupOrder.id}/pickup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenAdminFood}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pickupCode: createdPickupOrder.pickupCode }),
      });
      assert(res.status === 200, `Respondió con status ${res.status}`);
      const data = await res.json();
      assert(data.orderStatus === 'PICKED_UP', 'El estado del pedido debe ser PICKED_UP');
      assert(typeof data.pickedUpAt === 'number', 'Debe registrar la fecha pickedUpAt');
    });

    await test('31. Intento de re-retirar pedido ya retirado responde 409', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/${createdPickupOrder.id}/pickup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenAdminFood}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pickupCode: createdPickupOrder.pickupCode }),
      });
      assert(res.status === 409, `Respondió con status ${res.status}`);
    });

    await test('32. Auditoría en DB: El pedido en DB refleja orderStatus=PICKED_UP y pickedUpAt', () => {
      const orderInDb = db.getFoodOrderById(createdPickupOrder.id);
      assert(orderInDb && orderInDb.orderStatus === 'PICKED_UP', 'orderStatus en DB debe ser PICKED_UP');
      assert(orderInDb && typeof orderInDb.pickedUpAt === 'number', 'pickedUpAt debe estar guardado en DB');
    });

    await test('33. Evento de auditoría FOOD_ORDER_PICKED_UP fue registrado en el historial', () => {
      const events = db.getEventsByCompany('comp_food_don_pedro_01');
      const pickupEvent = events.find((e) => e.type === 'FOOD_ORDER_PICKED_UP' && e.deliveryId === createdPickupOrder.id);
      assert(pickupEvent !== undefined, 'El evento de auditoría debe existir en la DB');
    });

    console.log('\n====================================================');
    console.log(`📊 RESULTADO DE SUITE: PASARON ${passed} / ${passed + failed} PRUEBAS`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runFoodSecurityAndFlowTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
