import './setup_env';
import 'dotenv/config';
import assert from 'assert';
import { db, injectTestFixtures, UserRecord } from '../server/db';
import { createUbikaApp } from '../server';
import { generateAuthToken } from '../server/auth';
import { CommerceRepository } from '../server/commerce/repository';
import { EmailService } from '../server/email';

async function runWithdrawalComplianceTests() {
  console.log('====================================================');
  console.log('🏃 INICIANDO TEST SUITE: BOTÓN DE ARREPENTIMIENTO Y DESISTIMIENTO');
  console.log('   (Ley 24.240, Ley 25.326, Disposición 954/2025 y Disposición 3/2026)');
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
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const companyA = 'comp_test_a';
  const companyB = 'comp_test_b';

  // Create admin users for tests
  const adminA: UserRecord = {
    id: 'user_admin_a',
    companyId: companyA,
    email: 'admin.a@test.local',
    name: 'Admin Empresa A',
    passwordHash: 'dummy',
    role: 'COMPANY_ADMIN',
    active: true,
    privacyPolicyAccepted: true,
    privacyPolicyAcceptedAt: Date.now(),
    termsOfServiceAccepted: true,
    termsOfServiceAcceptedAt: Date.now(),
    createdAt: Date.now(),
  };
  db.createUser(adminA);
  const tokenAdminA = generateAuthToken(adminA);

  // Setup sample sales: one recent (2 days old), one expired (15 days old)
  const recentSale = CommerceRepository.createSale({
    id: 'sale_recent_1',
    companyId: companyA,
    createdBy: adminA.id,
    items: [],
    subtotal: 5000,
    discount: 0,
    surcharge: 0,
    tax: 1050,
    total: 6050,
    payments: [{ id: 'pay_rec_1', method: 'CASH', amount: 6050, status: 'COMPLETED', createdAt: Date.now() - (2 * 24 * 60 * 60 * 1000) }],
    status: 'COMPLETED',
    createdAt: Date.now() - (2 * 24 * 60 * 60 * 1000), // 2 days ago
    updatedAt: Date.now() - (2 * 24 * 60 * 60 * 1000),
  });

  const expiredSale = CommerceRepository.createSale({
    id: 'sale_expired_1',
    companyId: companyA,
    createdBy: adminA.id,
    items: [],
    subtotal: 8000,
    discount: 0,
    surcharge: 0,
    tax: 1680,
    total: 9680,
    payments: [{ id: 'pay_exp_1', method: 'CASH', amount: 9680, status: 'COMPLETED', createdAt: Date.now() - (15 * 24 * 60 * 60 * 1000) }],
    status: 'COMPLETED',
    createdAt: Date.now() - (15 * 24 * 60 * 60 * 1000), // 15 days ago
    updatedAt: Date.now() - (15 * 24 * 60 * 60 * 1000),
  });

  let createdWithdrawalId = '';

  try {
    // 1. Acceso público y validación de datos requeridos
    await test('1. Debe rechazar solicitud pública sin consentimiento informado (Ley 25.326)', async () => {
      const res = await fetch(`${baseUrl}/api/legal/withdrawal-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'PURCHASE_WITHDRAWAL',
          saleId: recentSale.id,
          consumerName: 'Juan Pérez',
          consumerEmail: 'juan@perez.local',
          consumerPhone: '+5491112345678',
          reason: 'El producto no cumple con lo esperado',
          consentAccepted: false,
        }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('tratamiento de datos personales'));
    });

    await test('2. Debe rechazar solicitud si el motivo es insuficiente (<10 caracteres)', async () => {
      const res = await fetch(`${baseUrl}/api/legal/withdrawal-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'PURCHASE_WITHDRAWAL',
          saleId: recentSale.id,
          consumerName: 'Juan Pérez',
          consumerEmail: 'juan@perez.local',
          consumerPhone: '+5491112345678',
          reason: 'No va',
          consentAccepted: true,
        }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('10 caracteres'));
    });

    await test('3. Debe rechazar compra cuyo plazo legal de 10 días corridos haya vencido', async () => {
      const res = await fetch(`${baseUrl}/api/legal/withdrawal-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'PURCHASE_WITHDRAWAL',
          saleId: expiredSale.id,
          consumerName: 'Juan Pérez',
          consumerEmail: 'juan@perez.local',
          consumerPhone: '+5491112345678',
          reason: 'Deseo devolver la compra de hace 15 días',
          consentAccepted: true,
        }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('10 días corridos'));
    });

    await test('4. Debe registrar exitosamente solicitud de arrepentimiento dentro de los 10 días', async () => {
      const res = await fetch(`${baseUrl}/api/legal/withdrawal-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'PURCHASE_WITHDRAWAL',
          saleId: recentSale.id,
          consumerName: 'Juan Pérez',
          consumerEmail: 'juan@perez.local',
          consumerPhone: '+5491112345678',
          consumerDocument: '35123456',
          reason: 'El producto recibido presenta características distintas a las descriptas',
          consentAccepted: true,
        }),
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.withdrawalId.startsWith('wdrl_'));
      assert.ok(data.estimatedResponseDate > Date.now());
      createdWithdrawalId = data.withdrawalId;

      // Verificar en base de datos
      const stored = db.getWithdrawalRequest(createdWithdrawalId);
      assert.ok(stored);
      assert.strictEqual(stored.companyId, companyA);
      assert.strictEqual(stored.status, 'PENDING');
      assert.strictEqual(stored.consumerEmail, 'juan@perez.local');
    });

    await test('5. Debe registrar baja de servicio directa sin exigir venta previa (Disp. 954/2025)', async () => {
      const res = await fetch(`${baseUrl}/api/legal/withdrawal-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'SERVICE_CANCELLATION',
          companyId: companyA,
          consumerName: 'María García',
          consumerEmail: 'maria@garcia.local',
          consumerPhone: '+5491187654321',
          reason: 'Solicito la baja inmediata de mi servicio sin trabas',
          consentAccepted: true,
        }),
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.withdrawalId.startsWith('wdrl_'));
    });

    // Consulta de estado con verificación proporcional
    await test('6. Debe rechazar consulta pública de estado sin verificación de identidad (Disp. 3/2026)', async () => {
      const res = await fetch(`${baseUrl}/api/legal/withdrawal-status/${createdWithdrawalId}`);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.ok(data.error.includes('Verificación de identidad requerida'));
    });

    await test('7. Debe permitir consulta pública de estado con email o documento verificado', async () => {
      const res = await fetch(`${baseUrl}/api/legal/withdrawal-status/${createdWithdrawalId}?email=juan@perez.local`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.withdrawalId, createdWithdrawalId);
      assert.strictEqual(data.status, 'PENDING');
      assert.strictEqual(data.type, 'PURCHASE_WITHDRAWAL');
    });

    // Procesamiento por operador y aislamiento multi-tenant
    await test('8. Debe rechazar procesamiento de solicitud sin autenticación o rol admin', async () => {
      const res = await fetch(`${baseUrl}/api/legal/withdrawal-process/${createdWithdrawalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      });
      assert.strictEqual(res.status, 401);
    });

    await test('9. Debe impedir que un operador de otra empresa procese la solicitud (Cross-tenant)', async () => {
      const adminB: UserRecord = {
        id: 'user_admin_b',
        companyId: companyB,
        email: 'admin.b@test.local',
        name: 'Admin Empresa B',
        passwordHash: 'dummy',
        role: 'COMPANY_ADMIN',
        active: true,
        privacyPolicyAccepted: true,
        privacyPolicyAcceptedAt: Date.now(),
        termsOfServiceAccepted: true,
        termsOfServiceAcceptedAt: Date.now(),
        createdAt: Date.now(),
      };
      db.createUser(adminB);
      const tokenAdminB = generateAuthToken(adminB);

      const res = await fetch(`${baseUrl}/api/legal/withdrawal-process/${createdWithdrawalId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAdminB}`,
        },
        body: JSON.stringify({ status: 'APPROVED' }),
      });
      assert.strictEqual(res.status, 403);
    });

    await test('10. Debe exigir causa o excepción legal si se rechaza la solicitud', async () => {
      const res = await fetch(`${baseUrl}/api/legal/withdrawal-process/${createdWithdrawalId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAdminA}`,
        },
        body: JSON.stringify({ status: 'REJECTED' }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('justificación formal'));
    });

    await test('11. Debe procesar aprobación con registro de reembolso por parte del comercio', async () => {
      const res = await fetch(`${baseUrl}/api/legal/withdrawal-process/${createdWithdrawalId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAdminA}`,
        },
        body: JSON.stringify({
          status: 'APPROVED',
          refundAmount: 6050,
          refundMethod: 'ORIGINAL_PAYMENT',
          responseMessage: 'Devolución aprobada. Se ha reintegrado el importe correspondiente.',
        }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.request.status, 'APPROVED');
      assert.strictEqual(data.request.refundAmount, 6050);
      assert.strictEqual(data.request.refundMethod, 'ORIGINAL_PAYMENT');
    });

    await test('12. Operador puede listar solicitudes de su empresa en /api/legal/withdrawals', async () => {
      const res = await fetch(`${baseUrl}/api/legal/withdrawals`, {
        headers: { Authorization: `Bearer ${tokenAdminA}` },
      });
      assert.strictEqual(res.status, 200);
      const list = await res.json();
      assert.ok(Array.isArray(list));
      assert.ok(list.some((r: any) => r.id === createdWithdrawalId));
    });

  } finally {
    server.close();
  }

  console.log('\n====================================================');
  console.log(`🏁 FIN TEST SUITE: ${passed} PASARON, ${failed} FALLARON`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runWithdrawalComplianceTests().catch((err) => {
  console.error('Fatal error in withdrawal compliance test suite:', err);
  process.exit(1);
});
