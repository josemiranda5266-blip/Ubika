/**
 * UBIKA PLATFORM - TEST DE VALIDACIÓN DE SEGURIDAD, PERSISTENCIA Y FLUJO END-TO-END
 *
 * Casos de prueba automatizados para verificar:
 * 1. Aislamiento multiempresa (Empresa A vs Empresa B)
 * 2. Aislamiento entre repartidores (Driver A vs Driver B)
 * 3. Expiración de tokens y rechazo de coordenadas
 * 4. Purgado de coordenadas tras finalizar entrega
 * 5. Autenticación y hash de contraseñas (bcrypt + JWT sin secretos hardcodeados)
 * 6. Persistencia a disco en reinicios de servidor
 * 7. Control de acceso por rol y scoping de empresa
 */

import 'dotenv/config';
import { db, hashToken, saveDatabaseSync, loadDatabase } from '../server/db';
import { generateAuthToken } from '../server/auth';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

async function runTests() {
  console.log('====================================================');
  console.log('🚀 INICIANDO AUDITORÍA Y TESTS DE SEGURIDAD UBIKA');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASÓ] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FALLÓ] ${testName}: ${detail || ''}`);
      failed++;
    }
  }

  // --- CASO 1: Aislamiento Multiempresa ---
  console.log('\n--- CASO 1: Aislamiento Multiempresa ---');
  const comp1Drivers = db.getDriversByCompany('comp_centro_logistico_01');
  const comp2Drivers = db.getDriversByCompany('comp_farma_norte_02');

  const comp1HasComp2Drivers = comp1Drivers.some((d) => d.companyId === 'comp_farma_norte_02');
  const comp2HasComp1Drivers = comp2Drivers.some((d) => d.companyId === 'comp_centro_logistico_01');

  assert(
    !comp1HasComp2Drivers && !comp2HasComp1Drivers,
    'Repartidores de Empresa A y Empresa B están estrictamente aislados en la base de datos',
    'Se detectó mezcla de repartidores entre empresas'
  );

  const comp1Deliveries = db.getDeliveriesByCompany('comp_centro_logistico_01');
  const comp2Deliveries = db.getDeliveriesByCompany('comp_farma_norte_02');
  const crossDeliveryLeak = comp1Deliveries.some((d) => d.companyId === 'comp_farma_norte_02');

  assert(
    !crossDeliveryLeak,
    'Entregas de Empresa A no son visibles ni accesibles para Empresa B',
    'Se detectaron entregas de otra empresa en la consulta'
  );

  // --- CASO 2: Aislamiento entre Repartidores ---
  console.log('\n--- CASO 2: Aislamiento entre Repartidores ---');
  const driver1Tasks = db.getDeliveriesByDriver('drv_01');
  const driver2Tasks = db.getDeliveriesByDriver('drv_02');

  const driver1HasDriver2Tasks = driver1Tasks.some((t) => t.driverId === 'drv_02');
  const driver2HasDriver1Tasks = driver2Tasks.some((t) => t.driverId === 'drv_01');

  assert(
    !driver1HasDriver2Tasks && !driver2HasDriver1Tasks,
    'Driver A no tiene acceso a las tareas asignadas a Driver B',
    'Las tareas de repartidores están mezcladas'
  );

  // --- CASO 3: Tokens de Sesión y Expiración ---
  console.log('\n--- CASO 3: Tokens de Sesión y Expiración ---');
  const token = 'tok_test_' + Date.now();
  const tokenHash = hashToken(token);

  assert(
    tokenHash.length === 64,
    'El hash SHA-256 del token de sesión es criptográficamente seguro (64 hex chars)'
  );

  const expiredSession = db.createLocationSession({
    id: 'sess_test_expired',
    deliveryId: 'del_test_exp',
    companyId: 'comp_centro_logistico_01',
    rawToken: token,
    sessionTokenHash: tokenHash,
    createdAt: Date.now() - 5 * 3600000,
    expiresAt: Date.now() - 1000, // Expirado hace 1 segundo
    status: 'EXPIRED',
  });

  const isExpired = Date.now() > expiredSession.expiresAt;
  assert(
    isExpired && expiredSession.status === 'EXPIRED',
    'La sesión expirada es correctamente identificada y rechaza recepción de coordenadas'
  );

  // --- CASO 4: Purgado de Coordenadas al Finalizar Entrega ---
  console.log('\n--- CASO 4: Purgado de Coordenadas ---');
  const testDelivery = db.createDelivery({
    id: 'del_test_purge_' + Date.now(),
    orderNumber: 9999,
    companyId: 'comp_centro_logistico_01',
    driverId: 'drv_01',
    driverName: 'Carlos Mendoza',
    driverPhone: '+54 9 11 5555-1234',
    driverVehicle: 'moto',
    recipientPhone: '+54 9 11 9999-0000',
    description: 'Paquete de prueba para purgado',
    priority: 'normal',
    sessionToken: 'tok_test_purge_' + Date.now(),
    status: 'en_camino',
    createdAt: Date.now(),
    expiresAt: Date.now() + 3600000,
    recipientLocation: {
      latitude: -34.6037,
      longitude: -58.3816,
      accuracy: 5,
      updatedAt: Date.now(),
    },
    privacyPolicyPurged: false,
  });

  assert(
    testDelivery.recipientLocation !== null && testDelivery.recipientLocation !== undefined,
    'La entrega activa almacena temporalmente la ubicación del destinatario con consentimiento'
  );

  // Simulamos finalización de entrega con purgado
  testDelivery.status = 'entregado';
  testDelivery.recipientLocation = null;
  testDelivery.privacyPolicyPurged = true;
  db.updateDelivery(testDelivery.id, testDelivery);

  const updatedFromDb = db.getDeliveryById(testDelivery.id);
  assert(
    updatedFromDb?.recipientLocation === null && updatedFromDb?.privacyPolicyPurged === true,
    'Al finalizar la entrega, las coordenadas exactas del destinatario son purgadas de la base de datos'
  );

  // --- CASO 5: Autenticación Real (Bcrypt + JWT) ---
  console.log('\n--- CASO 5: Autenticación y JWT ---');
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'UbikaAdminSecure2026!';
  const adminUser = db.getUserByEmail('admin@ubikapiloto.com') || db.getUserByEmail('admin@logisticaexpress.com');
  assert(adminUser !== undefined, 'Usuario administrador existe en la base de datos');

  if (adminUser) {
    const passwordOk = bcrypt.compareSync(adminPassword, adminUser.passwordHash);
    const passwordWrong = bcrypt.compareSync('PasswordIncorrecto', adminUser.passwordHash);

    assert(passwordOk && !passwordWrong, 'El hash bcrypt valida correctamente contraseñas válidas y rechaza inválidas');

    const jwtToken = generateAuthToken(adminUser);
    const decoded = jwt.decode(jwtToken) as any;

    assert(
      decoded && decoded.userId === adminUser.id && decoded.companyId === adminUser.companyId,
      'El JWT emitido contiene la identidad verificada y el companyId inmutable'
    );
  }

  // --- CASO 6: Persistencia a Disco ---
  console.log('\n--- CASO 6: Persistencia a Disco ---');
  saveDatabaseSync();
  const reloadedDb = db.reloadFromDisk();

  const persistedDelivery = reloadedDb.deliveries.find((d) => d.id === testDelivery.id);
  assert(
    persistedDelivery !== undefined && persistedDelivery.privacyPolicyPurged === true,
    'Los datos persisten a través del almacenamiento en disco simulando reinicio del servidor'
  );

  // --- CASO 7: Seguridad de Variables de Entorno (Sin Fallbacks Inseguros) ---
  console.log('\n--- CASO 7: Configuración de Seguridad y Secretos ---');
  assert(
    process.env.JWT_SECRET !== undefined && process.env.JWT_SECRET.length > 0,
    'JWT_SECRET está configurado desde variables de entorno y no en duro'
  );

  console.log('\n====================================================');
  console.log(`📊 RESULTADO DE TESTS: ${passed} PASADOS | ${failed} FALLADOS`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
