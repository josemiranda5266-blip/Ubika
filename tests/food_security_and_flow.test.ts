import './setup_env';
import 'dotenv/config';
import assert from 'assert';
import { db, injectTestFixtures } from '../server/db';
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
  injectTestFixtures();
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
          paymentMethod: 'CASH',
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
      let productWithOptions = foodProducts.find((p: any) => p.optionGroups && p.optionGroups.some((g: any) => g.required || (g.minSelections && g.minSelections > 0)));
      if (!productWithOptions) {
        const cat = db.getFoodCategoriesByCompanyId('comp_food_don_pedro_01')[0];
        productWithOptions = db.createFoodProduct({
          id: `fprod_req_mandatory_${Date.now()}`,
          companyId: 'comp_food_don_pedro_01',
          categoryId: cat ? cat.id : 'fcat_don_pedro_01',
          name: 'Producto Con Opciones Requeridas Obligatorio',
          description: 'Testing required option groups',
          price: 5000,
          isAvailable: true,
          displayOrder: 1,
          optionGroups: [
            {
              id: 'grp_req_test_mandatory',
              name: 'Opción Obligatoria',
              required: true,
              minSelections: 1,
              maxSelections: 1,
              options: [{ id: 'opt_req_mandatory_1', name: 'Opción 1', price: 0 }],
            },
          ],
        });
      }
      assert(productWithOptions, 'Debe existir un producto con opciones requeridas');

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
      assert.strictEqual(res.status, 400, `Respondió con status ${res.status} al omitir opción obligatoria`);
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

    console.log('\n--- 7. LOGIN REAL Y SEGURIDAD POR ROLES (DON PEDRO, CLIENT, DRIVER) ---');

    await test('34. Login real con usr_don_pedro_01 mediante POST /api/auth/login responde 200 y token', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'donpedro@ubikafood.com',
          password: process.env.INITIAL_ADMIN_PASSWORD || 'test_secret_admin_2026_password',
        }),
      });
      assert(res.status === 200, `Respondió con status ${res.status}`);
      const data = await res.json();
      assert(data.token, 'Debe devolver un JWT token válido');
      
      const ordersRes = await fetch(`${BASE_URL}/api/food/orders`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      assert(ordersRes.status === 200, 'GET /api/food/orders con token real de Don Pedro debe responder 200');
    });

    const clientUserRecord = db.getUserById('usr_client_01') || db.createUser({ id: 'usr_client_01', email: 'client@test.com', passwordHash: 'hash', name: 'Client Test', role: 'CLIENT', companyId: 'comp_food_don_pedro_01', createdAt: Date.now(), active: true });
    const driverUserRecord = db.getUserById('usr_driver_01') || db.createUser({ id: 'usr_driver_01', email: 'driver@test.com', passwordHash: 'hash', name: 'Driver Test', role: 'DRIVER', companyId: 'comp_food_don_pedro_01', driverId: 'drv_01', createdAt: Date.now(), active: true });
    const tokenClient = generateAuthToken(clientUserRecord);
    const tokenDriver = generateAuthToken(driverUserRecord);

    await test('35. CLIENT y DRIVER son rechazados con 403 en PATCH /status de comerciante', async () => {
      const resClient = await fetch(`${BASE_URL}/api/food/orders/${createdDeliveryOrder.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenClient}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'PREPARING' }),
      });
      assert(resClient.status === 403, `CLIENT debió recibir 403 pero recibió ${resClient.status}`);

      const resDriver = await fetch(`${BASE_URL}/api/food/orders/${createdDeliveryOrder.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenDriver}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'PREPARING' }),
      });
      assert(resDriver.status === 403, `DRIVER debió recibir 403 pero recibió ${resDriver.status}`);
    });

    await test('36. Intento de enviar paymentStatus en PATCH /status es rechazado con 400', async () => {
      const res = await fetch(`${BASE_URL}/api/food/orders/${createdDeliveryOrder.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenAdminFood}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: 'APPROVED' }),
      });
      assert(res.status === 400, `Respondió con status ${res.status} en lugar de 400`);
    });

    await test('37. Aprobación de pago mediante POST /api/food/orders/:orderId/payment/approve por comerciante', async () => {
      const resDriver = await fetch(`${BASE_URL}/api/food/orders/${createdPickupOrder.id}/payment/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenDriver}` },
      });
      assert(resDriver.status === 403, `DRIVER debió recibir 403 en aprobación de pago pero recibió ${resDriver.status}`);

      const resAdmin = await fetch(`${BASE_URL}/api/food/orders/${createdPickupOrder.id}/payment/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAdminFood}` },
      });
      assert(resAdmin.status === 200, `Respondió con status ${resAdmin.status}`);
      const data = await resAdmin.json();
      assert(data.paymentStatus === 'APPROVED', 'paymentStatus debe actualizarse a APPROVED');
    });

    console.log('\n--- 8. PRUEBAS RIGUROSAS DE MODIFICADORES, CANTIDAD Y MÉTODOS DE PAGO ---');

    await test('38. Validación estricta de cantidad (quantity): 0, decimal, string y >50 son rechazados con 400', async () => {
      const burgerProd = foodProducts[0];
      const invalidQuantities = [0, -1, 1.5, 51, "3"];

      for (const qty of invalidQuantities) {
        const res = await fetch(`${BASE_URL}/api/food/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: 'comp_food_don_pedro_01',
            deliveryType: 'FOOD_PICKUP',
            paymentMethod: 'CASH',
            items: [{ productId: burgerProd.id, quantity: qty }],
            recipientName: 'Test Qty',
            recipientPhone: '+5491100000000',
          }),
        });
        assert(res.status === 400, `quantity=${qty} debió ser rechazado con 400 pero devolvió ${res.status}`);
      }
    });

    await test('39. Método de pago no válido (CRYPTO / arbitrary) es rechazado con 400', async () => {
      const burgerProd = foodProducts[0];
      const res = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          deliveryType: 'FOOD_PICKUP',
          paymentMethod: 'CRYPTO_BITCOIN',
          items: [{ productId: burgerProd.id, quantity: 1 }],
          recipientName: 'Test Payment',
          recipientPhone: '+5491100000000',
        }),
      });
      assert(res.status === 400, `paymentMethod no válido debió ser rechazado con 400 pero devolvió ${res.status}`);
    });

    await test('40. Prueba completa de modificadores con minSelections=1 y maxSelections=2', async () => {
      const category = db.getFoodCategoriesByCompanyId('comp_food_don_pedro_01')[0];
      assert(category, 'Debe haber una categoría para Don Pedro');

      const prodWithOptions = db.createFoodProduct({
        id: `fprod_test_mod_${Date.now()}`,
        companyId: 'comp_food_don_pedro_01',
        categoryId: category.id,
        name: 'Hamburguesa Especial Modificadores',
        description: 'Testing option groups',
        price: 1000,
        isAvailable: true,
        displayOrder: 99,
        optionGroups: [
          {
            id: 'grp_salsa',
            name: 'Salsa Especial',
            required: true,
            minSelections: 1,
            maxSelections: 2,
            options: [
              { id: 'opt_ketchup', name: 'Ketchup', price: 100 },
              { id: 'opt_mayo', name: 'Mayonesa', price: 150 },
              { id: 'opt_bbq', name: 'BBQ', price: 200 },
            ],
          },
        ],
      });

      // A. 0 selecciones -> 400
      const res0 = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          deliveryType: 'FOOD_PICKUP',
          paymentMethod: 'CASH',
          items: [{ productId: prodWithOptions.id, quantity: 1, selectedOptions: [] }],
          recipientName: 'Test Modifiers',
          recipientPhone: '+5491100000000',
        }),
      });
      assert(res0.status === 400, `0 selecciones debió responder 400 pero dio ${res0.status}`);

      // B. 1 selección válida -> 201
      const res1 = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          deliveryType: 'FOOD_PICKUP',
          paymentMethod: 'CASH',
          items: [{ productId: prodWithOptions.id, quantity: 1, selectedOptions: [{ optionId: 'opt_ketchup' }] }],
          recipientName: 'Test Modifiers 1',
          recipientPhone: '+5491100000000',
        }),
      });
      assert(res1.status === 201, `1 selección válida debió responder 201 pero dio ${res1.status}`);

      // C. 2 selecciones válidas -> 201
      const res2 = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          deliveryType: 'FOOD_PICKUP',
          paymentMethod: 'CASH',
          items: [{ productId: prodWithOptions.id, quantity: 1, selectedOptions: [{ optionId: 'opt_ketchup' }, { optionId: 'opt_mayo' }] }],
          recipientName: 'Test Modifiers 2',
          recipientPhone: '+5491100000000',
        }),
      });
      assert(res2.status === 201, `2 selecciones válidas debió responder 201 pero dio ${res2.status}`);

      // D. 3 selecciones (supera maxSelections=2) -> 400
      const res3 = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          deliveryType: 'FOOD_PICKUP',
          paymentMethod: 'CASH',
          items: [{ productId: prodWithOptions.id, quantity: 1, selectedOptions: [{ optionId: 'opt_ketchup' }, { optionId: 'opt_mayo' }, { optionId: 'opt_bbq' }] }],
          recipientName: 'Test Modifiers 3',
          recipientPhone: '+5491100000000',
        }),
      });
      assert(res3.status === 400, `3 selecciones (supera máx 2) debió responder 400 pero dio ${res3.status}`);

      // E. optionId inexistente -> 400
      const resFakeOpt = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          deliveryType: 'FOOD_PICKUP',
          paymentMethod: 'CASH',
          items: [{ productId: prodWithOptions.id, quantity: 1, selectedOptions: [{ optionId: 'opt_fake_999' }] }],
          recipientName: 'Test Modifiers Fake',
          recipientPhone: '+5491100000000',
        }),
      });
      assert(resFakeOpt.status === 400, `optionId inexistente debió responder 400 pero dio ${resFakeOpt.status}`);
    });

    console.log('\n--- 9. AUDITORÍA FINAL: SEPARACIÓN DE ROLES, TRANSICIONES DE CADETE Y PAGO ESTRICTO ---');

    const dispatcherFoodUser = db.getUserById('usr_dispatcher_food_01') || db.createUser({
      id: 'usr_dispatcher_food_01',
      email: 'despacho@donpedro.com',
      passwordHash: 'hash',
      name: 'Despachador Don Pedro',
      role: 'DISPATCHER',
      companyId: 'comp_food_don_pedro_01',
      createdAt: Date.now(),
      active: true,
    });
    const tokenDispatcherFood = generateAuthToken(dispatcherFoodUser);

    const otherCompanyAdminUser = db.getUsersByCompany('comp_farma_norte_02').find((u) => u.role === 'COMPANY_ADMIN')!;
    const tokenOtherCompanyAdmin = generateAuthToken(otherCompanyAdminUser);

    await test('41. DISPATCHER no puede crear productos ni categorías ni modificar configuración (403)', async () => {
      const resCat = await fetch(`${BASE_URL}/api/food/categories`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenDispatcherFood}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Cat Dispatched' }),
      });
      assert(resCat.status === 403, `DISPATCHER debió recibir 403 en POST /categories pero recibió ${resCat.status}`);

      const resProd = await fetch(`${BASE_URL}/api/food/products`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenDispatcherFood}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: 'cat_test', name: 'Prod Dispatched', price: 500 }),
      });
      assert(resProd.status === 403, `DISPATCHER debió recibir 403 en POST /products pero recibió ${resProd.status}`);

      const resConfig = await fetch(`${BASE_URL}/api/food/store/config`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenDispatcherFood}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });
      assert(resConfig.status === 403, `DISPATCHER debió recibir 403 en PUT /store/config pero recibió ${resConfig.status}`);
    });

    await test('42. DISPATCHER no puede validar retiro en local ni aprobar pagos (403)', async () => {
      const resPickup = await fetch(`${BASE_URL}/api/food/orders/${createdPickupOrder.id}/pickup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenDispatcherFood}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupCode: 'ABCDE' }),
      });
      assert(resPickup.status === 403, `DISPATCHER debió recibir 403 en /pickup pero recibió ${resPickup.status}`);

      const resApprove = await fetch(`${BASE_URL}/api/food/orders/${createdPickupOrder.id}/payment/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenDispatcherFood}` },
      });
      assert(resApprove.status === 403, `DISPATCHER debió recibir 403 en /payment/approve pero recibió ${resApprove.status}`);
    });

    await test('43. DISPATCHER sí puede consultar pedidos (GET /orders) y gestionar estados de pedido', async () => {
      const resOrders = await fetch(`${BASE_URL}/api/food/orders`, {
        headers: { Authorization: `Bearer ${tokenDispatcherFood}` },
      });
      assert(resOrders.status === 200, `DISPATCHER debió poder consultar pedidos (status 200) pero recibió ${resOrders.status}`);
    });

    await test('44. Flujo estricto de pago TRANSFER: PENDING -> APPROVED directamente es rechazado con 409', async () => {
      const burgerProd = foodProducts[0];
      const resCreate = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          deliveryType: 'FOOD_PICKUP',
          paymentMethod: 'TRANSFER',
          items: [{ productId: burgerProd.id, quantity: 1 }],
          recipientName: 'Transfer User',
          recipientPhone: '+5491199998888',
        }),
      });
      assert(resCreate.status === 201, `Creación de pedido transfer debió responder 201 pero dio ${resCreate.status}`);
      const createData = await resCreate.json();
      const transferOrder = createData.order;
      assert(transferOrder.paymentStatus === 'PENDING', 'Estado de pago inicial debe ser PENDING');

      // Intentar aprobar directamente sin haber informado el comprobante (PENDING -> APPROVED) -> debe fallar con 409
      const resDirectApprove = await fetch(`${BASE_URL}/api/food/orders/${transferOrder.id}/payment/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAdminFood}` },
      });
      assert(resDirectApprove.status === 409, `PENDING -> APPROVED directo debió responder 409 pero dio ${resDirectApprove.status}`);

      // Simular que el cliente informa el pago (transición a PROCESSING)
      db.updateFoodOrder(transferOrder.id, { paymentStatus: 'PROCESSING' });

      // Ahora el admin sí puede aprobar el pago (PROCESSING -> APPROVED) -> 200
      const resApproveOk = await fetch(`${BASE_URL}/api/food/orders/${transferOrder.id}/payment/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAdminFood}` },
      });
      assert(resApproveOk.status === 200, `PROCESSING -> APPROVED debió responder 200 pero dio ${resApproveOk.status}`);
      const approvedOrder = await resApproveOk.json();
      assert(approvedOrder.paymentStatus === 'APPROVED', 'El estado del pago debe ser APPROVED');
      assert(approvedOrder.orderStatus === transferOrder.orderStatus, 'orderStatus no debe haber sido modificado por /payment/approve');

      // Intentar re-aprobar un pago ya APPROVED -> debe fallar con 409
      const resReApprove = await fetch(`${BASE_URL}/api/food/orders/${transferOrder.id}/payment/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAdminFood}` },
      });
      assert(resReApprove.status === 409, `Re-aprobar pago ya APPROVED debió responder 409 pero dio ${resReApprove.status}`);

      // Intentar aprobar con admin de otra empresa -> debe fallar con 403
      const resOtherComp = await fetch(`${BASE_URL}/api/food/orders/${transferOrder.id}/payment/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenOtherCompanyAdmin}` },
      });
      assert(resOtherComp.status === 403, `Admin de otra empresa debió ser rechazado con 403 pero dio ${resOtherComp.status}`);
    });

    await test('45. Flujo estricto de Delivery: Transición directa ASSIGNED -> DELIVERED está prohibida (409)', async () => {
      const burgerProd = foodProducts[0];
      const resCreate = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          deliveryType: 'FOOD_DELIVERY',
          paymentMethod: 'CASH',
          items: [{ productId: burgerProd.id, quantity: 1 }],
          recipientName: 'Delivery Sequence User',
          recipientPhone: '+5491199998888',
          deliveryAddress: 'Av. Corrientes 1000',
          recipientLocation: { latitude: -34.6037, longitude: -58.3816 },
        }),
      });
      assert(resCreate.status === 201, 'Creación de pedido delivery falló');
      const createData = await resCreate.json();
      const order = createData.order;

      // PENDING -> PREPARING
      const resPrep = await fetch(`${BASE_URL}/api/food/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenAdminFood}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'PREPARING' }),
      });
      assert(resPrep.status === 200, `PENDING -> PREPARING falló con ${resPrep.status}`);

      // PREPARING -> READY
      const resReady = await fetch(`${BASE_URL}/api/food/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenAdminFood}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'READY' }),
      });
      assert(resReady.status === 200, `PREPARING -> READY falló con ${resReady.status}`);

      // READY -> ASSIGNED (con cadete)
      let donPedroDriver = db.getDriversByCompany('comp_food_don_pedro_01')[0];
      if (!donPedroDriver) {
        donPedroDriver = db.createDriver({
          id: 'drv_dp_seq_01',
          internalId: 'DP-SEQ-01',
          companyId: 'comp_food_don_pedro_01',
          name: 'Cadete Secuencia',
          phone: '+5491177778888',
          email: 'cadete.seq@donpedro.com',
          vehicle: 'moto',
          status: 'disponible',
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
          totalDeliveries: 0,
          rating: 5.0,
        });
      }

      const resAssign = await fetch(`${BASE_URL}/api/food/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenAdminFood}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'ASSIGNED', driverId: donPedroDriver.id }),
      });
      assert(resAssign.status === 200, `READY -> ASSIGNED falló con ${resAssign.status}`);

      // INTENTO PROHIBIDO: ASSIGNED -> DELIVERED directamente -> 409
      const resDirectDelivered = await fetch(`${BASE_URL}/api/food/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenAdminFood}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'DELIVERED' }),
      });
      assert(resDirectDelivered.status === 409, `ASSIGNED -> DELIVERED debió responder 409 pero dio ${resDirectDelivered.status}`);

      // SECUENCIA VÁLIDA: ASSIGNED -> IN_TRANSIT -> 200
      const resInTransit = await fetch(`${BASE_URL}/api/food/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenAdminFood}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'IN_TRANSIT' }),
      });
      assert(resInTransit.status === 200, `ASSIGNED -> IN_TRANSIT debió responder 200 pero dio ${resInTransit.status}`);

      // IN_TRANSIT -> DELIVERED -> 200
      const resDeliveredOk = await fetch(`${BASE_URL}/api/food/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenAdminFood}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'DELIVERED' }),
      });
      assert(resDeliveredOk.status === 200, `IN_TRANSIT -> DELIVERED debió responder 200 pero dio ${resDeliveredOk.status}`);
      const finalOrder = await resDeliveredOk.json();
      assert(finalOrder.orderStatus === 'DELIVERED', 'Estado final debe ser DELIVERED');
    });

    console.log('--- 10. NUEVO ROL DE COCINA (KITCHEN) Y SEGURIDAD ASOCIADA ---');

    await test('46. KITCHEN puede consultar pedidos de su comercio', async () => {
      const kitchenUser = db.getUsersByCompany('comp_food_don_pedro_01').find((u) => u.role === 'KITCHEN')!;
      assert(kitchenUser, 'Debe existir un usuario de cocina');
      const tokenKitchen = generateAuthToken(kitchenUser);

      const res = await fetch(`${BASE_URL}/api/food/kitchen/orders`, {
        headers: { Authorization: `Bearer ${tokenKitchen}` },
      });
      assert(res.status === 200, `KITCHEN debió consultar pedidos con 200 pero dio ${res.status}`);
      const data = await res.json();
      assert(Array.isArray(data), 'Debe retornar una lista de pedidos');
    });

    await test('47. KITCHEN de otra empresa recibe 403 al intentar modificar pedidos (aislamiento)', async () => {
      const otherKitchenUser = db.getUserById('usr_other_kitchen_01') || db.createUser({
        id: 'usr_other_kitchen_01',
        email: 'other_kitchen@ubikafood.com',
        name: 'Otra Cocina',
        role: 'KITCHEN' as const,
        companyId: 'comp_farma_norte_02',
        active: true,
        createdAt: Date.now(),
        passwordHash: '',
      });
      const tokenOtherKitchen = generateAuthToken(otherKitchenUser);

      const burgerProd = foodProducts[0];
      const resCreate = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          deliveryType: 'FOOD_PICKUP',
          paymentMethod: 'CASH',
          items: [{ productId: burgerProd.id, quantity: 1 }],
          recipientName: 'Isolated Kitchen Order',
          recipientPhone: '+5491199998888',
        }),
      });
      assert(resCreate.status === 201, `Crear pedido falló con status ${resCreate.status}`);
      const { order } = await resCreate.json();

      const resPatch = await fetch(`${BASE_URL}/api/food/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenOtherKitchen}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'PREPARING' }),
      });
      assert(resPatch.status === 403, `Otras cocinas debieron ser rechazadas con 403 pero dio ${resPatch.status}`);
    });

    await test('48. KITCHEN puede pasar pedido de PENDING a PREPARING', async () => {
      const kitchenUser = db.getUsersByCompany('comp_food_don_pedro_01').find((u) => u.role === 'KITCHEN')!;
      const tokenKitchen = generateAuthToken(kitchenUser);
      const burgerProd = foodProducts[0];

      const resCreate = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          deliveryType: 'FOOD_PICKUP',
          paymentMethod: 'CASH',
          items: [{ productId: burgerProd.id, quantity: 1 }],
          recipientName: 'Kitchen Flow Order',
          recipientPhone: '+5491199998888',
        }),
      });
      assert(resCreate.status === 201, `Crear pedido falló con status ${resCreate.status}`);
      const { order } = await resCreate.json();

      const resPrep = await fetch(`${BASE_URL}/api/food/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenKitchen}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'PREPARING' }),
      });
      assert(resPrep.status === 200, `KITCHEN debió poder poner en preparación con 200 pero dio ${resPrep.status}`);
      const updated = await resPrep.json();
      assert(updated.orderStatus === 'PREPARING');
    });

    await test('49. KITCHEN puede pasar pedido de PREPARING a READY', async () => {
      const kitchenUser = db.getUsersByCompany('comp_food_don_pedro_01').find((u) => u.role === 'KITCHEN')!;
      const tokenKitchen = generateAuthToken(kitchenUser);
      const burgerProd = foodProducts[0];

      const resCreate = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          deliveryType: 'FOOD_PICKUP',
          paymentMethod: 'CASH',
          items: [{ productId: burgerProd.id, quantity: 1 }],
          recipientName: 'Kitchen Ready Flow',
          recipientPhone: '+5491199998888',
        }),
      });
      assert(resCreate.status === 201, `Crear pedido falló con status ${resCreate.status}`);
      const { order } = await resCreate.json();

      // PENDING -> PREPARING
      await fetch(`${BASE_URL}/api/food/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenKitchen}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'PREPARING' }),
      });

      // PREPARING -> READY
      const resReady = await fetch(`${BASE_URL}/api/food/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenKitchen}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'READY' }),
      });
      assert(resReady.status === 200, `KITCHEN debió poder marcar listo con 200 pero dio ${resReady.status}`);
      const updated = await resReady.json();
      assert(updated.orderStatus === 'READY_FOR_PICKUP');
    });

    await test('50. KITCHEN NO puede cambiar estado a READY -> DELIVERED', async () => {
      const kitchenUser = db.getUsersByCompany('comp_food_don_pedro_01').find((u) => u.role === 'KITCHEN')!;
      const tokenKitchen = generateAuthToken(kitchenUser);
      const burgerProd = foodProducts[0];

      const resCreate = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          deliveryType: 'FOOD_PICKUP',
          paymentMethod: 'CASH',
          items: [{ productId: burgerProd.id, quantity: 1 }],
          recipientName: 'Kitchen Direct Delivery Test',
          recipientPhone: '+5491199998888',
        }),
      });
      assert(resCreate.status === 201, `Crear pedido falló con status ${resCreate.status}`);
      const { order } = await resCreate.json();

      // PENDING -> PREPARING
      await fetch(`${BASE_URL}/api/food/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenKitchen}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'PREPARING' }),
      });

      // PREPARING -> READY
      await fetch(`${BASE_URL}/api/food/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenKitchen}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'READY' }),
      });

      // Try READY -> DELIVERED
      const resDelivered = await fetch(`${BASE_URL}/api/food/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenKitchen}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'DELIVERED' }),
      });
      assert(resDelivered.status === 403, `READY -> DELIVERED debió responder 403 pero dio ${resDelivered.status}`);
    });

    await test('51. KITCHEN NO puede cambiar estado a READY -> IN_TRANSIT', async () => {
      const kitchenUser = db.getUsersByCompany('comp_food_don_pedro_01').find((u) => u.role === 'KITCHEN')!;
      const tokenKitchen = generateAuthToken(kitchenUser);
      const burgerProd = foodProducts[0];

      const resCreate = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          deliveryType: 'FOOD_PICKUP',
          paymentMethod: 'CASH',
          items: [{ productId: burgerProd.id, quantity: 1 }],
          recipientName: 'Kitchen Direct Transit Test',
          recipientPhone: '+5491199998888',
        }),
      });
      assert(resCreate.status === 201, `Crear pedido falló con status ${resCreate.status}`);
      const { order } = await resCreate.json();

      // PENDING -> PREPARING
      await fetch(`${BASE_URL}/api/food/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenKitchen}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'PREPARING' }),
      });

      // PREPARING -> READY
      await fetch(`${BASE_URL}/api/food/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenKitchen}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'READY' }),
      });

      // Try READY -> IN_TRANSIT
      const resInTransit = await fetch(`${BASE_URL}/api/food/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenKitchen}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'IN_TRANSIT' }),
      });
      assert(resInTransit.status === 403, `READY -> IN_TRANSIT debió responder 403 pero dio ${resInTransit.status}`);
    });

    await test('52. KITCHEN NO puede cambiar estado a READY -> ASSIGNED', async () => {
      const kitchenUser = db.getUsersByCompany('comp_food_don_pedro_01').find((u) => u.role === 'KITCHEN')!;
      const tokenKitchen = generateAuthToken(kitchenUser);
      const burgerProd = foodProducts[0];

      const resCreate = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          deliveryType: 'FOOD_PICKUP',
          paymentMethod: 'CASH',
          items: [{ productId: burgerProd.id, quantity: 1 }],
          recipientName: 'Kitchen Direct Assigned Test',
          recipientPhone: '+5491199998888',
        }),
      });
      assert(resCreate.status === 201, `Crear pedido falló con status ${resCreate.status}`);
      const { order } = await resCreate.json();

      // PENDING -> PREPARING
      await fetch(`${BASE_URL}/api/food/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenKitchen}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'PREPARING' }),
      });

      // PREPARING -> READY
      await fetch(`${BASE_URL}/api/food/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenKitchen}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'READY' }),
      });

      // Try READY -> ASSIGNED
      const resAssign = await fetch(`${BASE_URL}/api/food/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenKitchen}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'ASSIGNED' }),
      });
      assert(resAssign.status === 403, `READY -> ASSIGNED debió responder 403 pero dio ${resAssign.status}`);
    });

    await test('53. KITCHEN NO puede administrar productos', async () => {
      const kitchenUser = db.getUsersByCompany('comp_food_don_pedro_01').find((u) => u.role === 'KITCHEN')!;
      const tokenKitchen = generateAuthToken(kitchenUser);

      const res = await fetch(`${BASE_URL}/api/food/products`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenKitchen}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hacked Product', price: 999, isAvailable: true }),
      });
      assert(res.status === 403, `KITCHEN debió recibir 403 al crear productos pero dio ${res.status}`);
    });

    await test('54. KITCHEN NO puede crear categorías', async () => {
      const kitchenUser = db.getUsersByCompany('comp_food_don_pedro_01').find((u) => u.role === 'KITCHEN')!;
      const tokenKitchen = generateAuthToken(kitchenUser);

      const res = await fetch(`${BASE_URL}/api/food/categories`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenKitchen}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hacked Category' }),
      });
      assert(res.status === 403, `KITCHEN debió recibir 403 al crear categorías pero dio ${res.status}`);
    });

    await test('55. KITCHEN NO puede administrar pagos', async () => {
      const kitchenUser = db.getUsersByCompany('comp_food_don_pedro_01').find((u) => u.role === 'KITCHEN')!;
      const tokenKitchen = generateAuthToken(kitchenUser);

      const res = await fetch(`${BASE_URL}/api/food/orders/some-id/payment/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenKitchen}` },
      });
      assert(res.status === 403, `KITCHEN debió recibir 403 al aprobar pagos pero dio ${res.status}`);
    });

    await test('56. KITCHEN NO puede asignar cadetes ni modificar cadete', async () => {
      const kitchenUser = db.getUsersByCompany('comp_food_don_pedro_01').find((u) => u.role === 'KITCHEN')!;
      const tokenKitchen = generateAuthToken(kitchenUser);
      const burgerProd = foodProducts[0];

      const resCreate = await fetch(`${BASE_URL}/api/food/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'comp_food_don_pedro_01',
          deliveryType: 'FOOD_PICKUP',
          paymentMethod: 'CASH',
          items: [{ productId: burgerProd.id, quantity: 1 }],
          recipientName: 'Kitchen Driver Assign Test',
          recipientPhone: '+5491199998888',
        }),
      });
      assert(resCreate.status === 201, `Crear pedido falló con status ${resCreate.status}`);
      const { order } = await resCreate.json();

      // PENDING -> PREPARING
      await fetch(`${BASE_URL}/api/food/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenKitchen}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'PREPARING' }),
      });

      // Try PREPARING -> READY with driverId
      const resReady = await fetch(`${BASE_URL}/api/food/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenKitchen}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'READY', driverId: 'drv_dp_seq_01' }),
      });
      assert(resReady.status === 403, `La asignación de cadete por cocina debió dar 403 pero dio ${resReady.status}`);
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
