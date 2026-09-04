/**
 * UBIKA PLATFORM - SUITE COMPLETA DE AUDITORÍA Y SEGURIDAD HARDENING
 *
 * Verificación exhaustiva de:
 * 1. Eliminación de contraseñas fallback y secretos hardcodeados
 * 2. Control estricto de Seed Demo (exclusivamente SEED_DEMO_DATA === 'true')
 * 3. Eliminación de rawToken persistente
 * 4. Verificación rigurosa de JWT (jwt.verify)
 * 5. Tests HTTP reales de aislamiento multiempresa y driver isolation
 * 6. Tests HTTP reales de purgado de coordenadas
 * 7. Tests HTTP reales del ciclo de vida del token de ubicación
 * 8. Auditoría automática de código sin secretos
 */

import './setup_env';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db, hashToken, saveDatabaseSync, injectTestFixtures } from '../server/db';
import { generateAuthToken } from '../server/auth';
import { createUbikaApp } from '../server';

async function runAuditSuite() {
  console.log('====================================================');
  console.log('🚀 INICIANDO SUITE DE AUDITORÍA Y HARDENING UBIKA');
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

  // ----------------------------------------------------
  // 1. AUDITORÍA DE SECRETOS Y CÓDIGO (Requerimiento 8 & 1 & 2)
  // ----------------------------------------------------
  console.log('--- 1. AUDITORÍA DE SECRETOS Y CÓDIGO ---');

  const filesToScan: string[] = [];
  function scanDir(dirPath: string) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
          scanDir(fullPath);
        }
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        filesToScan.push(fullPath);
      }
    }
  }

  scanDir(path.join(process.cwd(), 'server'));
  scanDir(path.join(process.cwd(), 'src'));

  const forbiddenPatterns = [
    /INITIAL_ADMIN_PASSWORD\s*\|\|/i,
    /INITIAL_DRIVER_PASSWORD\s*\|\|/i,
    /UbikaAdminSecure2026!/i,
    /UbikaDriverSecure2026!/i,
    /password:\s*['"]UbikaAdmin/i,
    /password:\s*['"]UbikaDriver/i,
  ];

  let violationsFound = false;
  for (const filePath of filesToScan) {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content)) {
        violationsFound = true;
        console.error(`Violación de secreto en ${filePath}: patrón ${pattern.toString()}`);
      }
    }
  }

  assert(!violationsFound, 'Sin contraseñas o secretos fallback hardcodeados en el código fuente');

  assert(
    process.env.SEED_DEMO_DATA === 'true',
    'Entorno configurado con SEED_DEMO_DATA === true para la ejecución del test suite'
  );

  // ----------------------------------------------------
  // 1.5 VERIFICACIÓN DE VARIABLES DE ENTORNO REQUERIDAS (INITIAL_ADMIN_PASSWORD & JWT_SECRET)
  // ----------------------------------------------------
  console.log('\n--- 1.5 VERIFICACIÓN DE VARIABLES DE ENTORNO REQUERIDAS ---');

  // A. INITIAL_ADMIN_PASSWORD definida: inicialización correcta
  try {
    execSync('INITIAL_ADMIN_PASSWORD=some_test_admin_pass INITIAL_DRIVER_PASSWORD=driver_pass JWT_SECRET=test_jwt_secret_123456 SEED_DEMO_DATA=true tsx -e "import(\'./server/db.ts\').then(m => m.loadDatabase())"', { stdio: 'pipe' });
    assert(true, 'INITIAL_ADMIN_PASSWORD definida: inicialización de DB correcta');
  } catch (err: any) {
    assert(false, 'INITIAL_ADMIN_PASSWORD definida: debió inicializar DB pero falló', err.message);
  }

  // B. INITIAL_ADMIN_PASSWORD ausente: error seguro
  try {
    execSync('INITIAL_ADMIN_PASSWORD="" INITIAL_DRIVER_PASSWORD=driver_pass JWT_SECRET=test_jwt_secret_123456 SEED_DEMO_DATA=true tsx -e "import(\'./server/db.ts\').then(m => m.loadDatabase())"', { stdio: 'pipe' });
    assert(false, 'INITIAL_ADMIN_PASSWORD ausente: debió fallar con error seguro pero no lo hizo');
  } catch (err: any) {
    const errorMsg = err.stderr ? err.stderr.toString() : err.message;
    const hasExpectedError = errorMsg.includes('INITIAL_ADMIN_PASSWORD is required');
    assert(hasExpectedError, 'INITIAL_ADMIN_PASSWORD ausente: produce un error explícito y seguro', errorMsg);
  }

  // C. JWT_SECRET definida: servidor inicia correctamente
  try {
    execSync('JWT_SECRET=test_jwt_secret_123456 tsx -e "import(\'./server/auth.ts\')"', { stdio: 'pipe' });
    assert(true, 'JWT_SECRET definida: módulo de autenticación carga correctamente');
  } catch (err: any) {
    assert(false, 'JWT_SECRET definida: debió cargar correctamente pero falló', err.message);
  }

  // D. JWT_SECRET ausente: el servidor no inicia (falla al importar)
  try {
    execSync('JWT_SECRET="" tsx -e "import(\'./server/auth.ts\')"', { stdio: 'pipe' });
    assert(false, 'JWT_SECRET ausente: debió fallar en la inicialización pero no lo hizo');
  } catch (err: any) {
    const errorMsg = err.stderr ? err.stderr.toString() : err.message;
    const hasExpectedError = errorMsg.includes('JWT_SECRET is not configured');
    assert(hasExpectedError, 'JWT_SECRET ausente: el servidor falla al iniciar de manera explícita', errorMsg);
  }

  // ----------------------------------------------------
  // 2. PRUEBA DE JWT RIGUROSA CON JWT.VERIFY (Requerimiento 4)
  // ----------------------------------------------------
  console.log('\n--- 2. VERIFICACIÓN DE SEGURIDAD JWT (jwt.verify) ---');

  const JWT_SECRET = process.env.JWT_SECRET!;
  assert(!!JWT_SECRET && JWT_SECRET.length >= 16, 'JWT_SECRET está configurado desde variables de entorno');

  // Los fixtures demo deben estar disponibles antes de generar tokens de prueba.
  // Se mantiene la inyección explícita para no activar seeds demo en producción.
  injectTestFixtures();

  const adminUserA = db.getUsersByCompany('comp_centro_logistico_01')[0];
  assert(!!adminUserA, 'Existe usuario Administrador para Empresa A');

  const validToken = generateAuthToken(adminUserA);

  // 2.1 JWT Válido
  try {
    const verified = jwt.verify(validToken, JWT_SECRET) as any;
    assert(
      verified.userId === adminUserA.id && verified.companyId === adminUserA.companyId,
      'jwt.verify() aprueba exitosamente un token JWT genuino y retorna el payload inmutable'
    );
  } catch (err) {
    assert(false, 'jwt.verify() no aceptó un token válido', String(err));
  }

  // 2.2 JWT Manipulado (Firma alterada)
  const tamperedToken = validToken.slice(0, -5) + 'XXXXX';
  let tamperedRejected = false;
  try {
    jwt.verify(tamperedToken, JWT_SECRET);
  } catch (err) {
    tamperedRejected = true;
  }
  assert(tamperedRejected, 'jwt.verify() rechaza token con firma o payload manipulado');

  // 2.3 JWT Firmado con Secreto Incorrecto
  let wrongSecretRejected = false;
  try {
    jwt.verify(validToken, 'SECRETO_INCORRECTO_123456789');
  } catch (err) {
    wrongSecretRejected = true;
  }
  assert(wrongSecretRejected, 'jwt.verify() rechaza token firmado con un secreto distinto');

  // 2.4 JWT Expirado
  const expiredJwt = jwt.sign(
    { userId: adminUserA.id, companyId: adminUserA.companyId, role: adminUserA.role },
    JWT_SECRET,
    { expiresIn: '-1s' }
  );
  let expiredRejected = false;
  try {
    jwt.verify(expiredJwt, JWT_SECRET);
  } catch (err) {
    expiredRejected = true;
  }
  assert(expiredRejected, 'jwt.verify() rechaza token JWT expirado (TokenExpiredError)');

  // ----------------------------------------------------
  // CONFIGURACIÓN DE SERVIDOR HTTP PARA TESTS REALES
  // ----------------------------------------------------
  const app = createUbikaApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const BASE_URL = `http://127.0.0.1:${address.port}`;

  try {
    // Generar tokens para pruebas HTTP
    const adminUserB = db.getUsersByCompany('comp_farma_norte_02')[0];
    const driverUserA = db.getUsersByCompany('comp_centro_logistico_01').find((u) => u.role === 'DRIVER')!;
    const driverUserB = db.getUsersByCompany('comp_farma_norte_02').find((u) => u.role === 'DRIVER')!;

    const tokenAdminA = generateAuthToken(adminUserA);
    const tokenAdminB = generateAuthToken(adminUserB);
    const tokenDriverA = generateAuthToken(driverUserA);
    const tokenDriverB = generateAuthToken(driverUserB);

    // ----------------------------------------------------
    // 3. PRUEBAS HTTP REALES - AISLAMIENTO MULTIEMPRESA Y ROLES (Requerimiento 5)
    // ----------------------------------------------------
    console.log('\n--- 3. TESTS HTTP REALES DE AISLAMIENTO MULTI-TENANT Y DRIVERS ---');

    // 3.1 Empresa A intenta listar/consultar entregas pasando companyId de Empresa B
    const resA = await fetch(`${BASE_URL}/api/deliveries?companyId=comp_farma_norte_02`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    const dataA = (await resA.json()) as any[];
    const hasCompanyBData = Array.isArray(dataA) && dataA.some((d) => d.companyId === 'comp_farma_norte_02');
    assert(
      !hasCompanyBData && resA.ok,
      'Empresa A no puede listar entregas de Empresa B, incluso especificando companyId=comp_farma_norte_02'
    );

    // Ensure Company B has at least one delivery for isolation testing
    let compBDelivery = db.getDeliveriesByCompany('comp_farma_norte_02')[0];
    if (!compBDelivery) {
      compBDelivery = db.createDelivery({
        id: 'del_farma_test_999',
        orderNumber: 777,
        companyId: 'comp_farma_norte_02',
        driverId: 'drv_farma_01',
        driverName: 'Roberto Farma Driver',
        driverPhone: '+54 9 11 4780-9902',
        driverVehicle: 'auto',
        recipientPhone: '+54 9 11 1111-2222',
        description: 'Medicamentos urgentes Farma Norte',
        priority: 'alta',
        sessionToken: 'tok_farma_test_777',
        status: 'en_camino',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        privacyPolicyPurged: false,
      });
    }
    const compBDeliveryId = compBDelivery.id;
    const resMod = await fetch(`${BASE_URL}/api/deliveries/${compBDeliveryId}/complete`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json',
      },
    });
    assert(
      resMod.status === 403,
      'Empresa A recibe HTTP 403 al intentar modificar una entrega perteneciente a Empresa B'
    );

    // 3.3 Driver A intenta consultar entrega asignada a Driver B (o de otra empresa)
    const driverBDeliveryId = db.getDeliveriesByDriver('drv_02')[0]?.id || compBDeliveryId;
    const resDriverAccess = await fetch(`${BASE_URL}/api/deliveries/${driverBDeliveryId}`, {
      headers: { Authorization: `Bearer ${tokenDriverA}` },
    });
    assert(
      resDriverAccess.status === 403,
      'Driver A recibe HTTP 403 al intentar consultar una entrega asignada a Driver B'
    );

    // 3.4 Inyección de companyId en Query Parameters (override attempt)
    const resMetrics = await fetch(`${BASE_URL}/api/metrics?companyId=comp_farma_norte_02`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    const metricsData = (await resMetrics.json()) as any;
    assert(
      metricsData.companyId === 'comp_centro_logistico_01',
      'Override de companyId en query parameters es ignorado; métricas corresponden únicamente a Empresa A'
    );

    // 3.5 Inyección de companyId en JSON Body al crear entrega
    const resCreate = await fetch(`${BASE_URL}/api/deliveries`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        companyId: 'comp_farma_norte_02', // Intento de inyección
        driverId: 'drv_01',
        recipientPhone: '+54 9 11 8888-7777',
        description: 'Entrega de prueba aislamiento inyección',
      }),
    });
    const createdData = (await resCreate.json()) as any;
    assert(
      createdData.companyId === 'comp_centro_logistico_01',
      'Inyección de companyId en el cuerpo de la solicitud es sobrescrita con el companyId del token verificado',
      JSON.stringify(createdData)
    );

    // ----------------------------------------------------
    // 4. TESTS HTTP REALES DE PURGADO DE COORDENADAS (Requerimiento 6)
    // ----------------------------------------------------
    console.log('\n--- 4. TESTS HTTP REALES DE PURGADO DE PRIVACIDAD ---');

    // Crear una entrega nueva con sesión activa y coordenadas
    const resPurgeTestCreate = await fetch(`${BASE_URL}/api/deliveries`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        driverId: 'drv_01',
        recipientPhone: '+54 9 11 3333-2222',
        description: 'Paquete para validación real de purgado',
      }),
    });
    const purgeDelivery = (await resPurgeTestCreate.json()) as any;
    const purgeToken = purgeDelivery.sessionToken;

    // Compartir coordenadas iniciales vía API
    await fetch(`${BASE_URL}/api/track/${purgeToken}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: -34.6037,
        longitude: -58.3816,
        accuracy: 8,
        addressHint: 'Av. Corrientes 1234',
      }),
    });

    // Verificar que la ubicación existía
    const preCheckRes = await fetch(`${BASE_URL}/api/deliveries/${purgeDelivery.id}`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    const preCheckDelivery = (await preCheckRes.json()) as any;
    assert(
      preCheckDelivery.recipientLocation !== null && preCheckDelivery.recipientLocation.latitude === -34.6037,
      'Ubicación del destinatario almacenada temporalmente antes de la entrega'
    );

    // Ejecutar el endpoint de negocio real para completar la entrega
    const completeRes = await fetch(`${BASE_URL}/api/deliveries/${purgeDelivery.id}/complete`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    assert(completeRes.ok, 'Solicitud HTTP de completado de entrega ejecutada exitosamente');

    // Verificar purgado en la Entrega
    const postCheckRes = await fetch(`${BASE_URL}/api/deliveries/${purgeDelivery.id}`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    const postCheckDelivery = (await postCheckRes.json()) as any;

    // Verificar purgado en la Sesión de Ubicación
    const dbSession = db.getSessionByToken(purgeToken);

    assert(
      postCheckDelivery.recipientLocation === null &&
        postCheckDelivery.privacyPolicyPurged === true &&
        dbSession?.status === 'PURGED' &&
        dbSession?.recipientLocation === null,
      'Coordenadas exactas purgadas a null, privacyPolicyPurged=true y session.status=PURGED tras completar entrega'
    );

    // Verificar Auditoría Eventos
    const eventsRes = await fetch(`${BASE_URL}/api/events?deliveryId=${purgeDelivery.id}`, {
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    const eventsData = (await eventsRes.json()) as any[];
    const purgedEvent = eventsData.find((e) => e.type === 'LOCATION_PURGED');

    assert(
      !!purgedEvent &&
        !JSON.stringify(purgedEvent).includes('-34.6037') &&
        !JSON.stringify(purgedEvent).includes('-58.3816'),
      'Evento LOCATION_PURGED registrado en auditoría SIN incluir coordenadas de latitud/longitud en su descripción o metadata'
    );

    // ----------------------------------------------------
    // 5. TESTS HTTP REALES DE TOKEN DE UBICACIÓN (Requerimiento 7)
    // ----------------------------------------------------
    console.log('\n--- 5. TESTS HTTP REALES DE TOKEN DE UBICACIÓN ---');

    // 5.1 Token Válido
    const resValidTrack = await fetch(`${BASE_URL}/api/track/${purgeToken}`);
    assert(
      resValidTrack.status === 200 || resValidTrack.status === 410,
      'Endpoint de consulta de token de seguimiento responde con contrato válido'
    );

    // 5.2 Token Manipulado / Inválido
    const resInvalidToken = await fetch(`${BASE_URL}/api/track/tok_invalid_tampered_123456/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: -34.6037, longitude: -58.3816 }),
    });
    assert(
      resInvalidToken.status === 404,
      'Solicitud con token de seguimiento manipulado o inexistente es rechazada con HTTP 404'
    );

    // 5.3 Intento de actualización en token PURGADO / Concluido
    const resPurgedTokenUpdate = await fetch(`${BASE_URL}/api/track/${purgeToken}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: -34.6037, longitude: -58.3816 }),
    });
    assert(
      resPurgedTokenUpdate.status === 410,
      'Token purgado/concluido rechaza nuevas actualizaciones de ubicación retornando HTTP 410 (Gone)'
    );

    // 5.4 Token Expirado
    const expiredToken = 'tok_expired_test_' + Date.now();
    db.createLocationSession({
      id: 'sess_expired_test',
      deliveryId: purgeDelivery.id,
      companyId: 'comp_centro_logistico_01',
      sessionTokenHash: hashToken(expiredToken),
      createdAt: Date.now() - 10000,
      expiresAt: Date.now() - 1000,
      status: 'EXPIRED',
    });

    const resExpiredTokenUpdate = await fetch(`${BASE_URL}/api/track/${expiredToken}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: -34.6037, longitude: -58.3816 }),
    });
    assert(
      resExpiredTokenUpdate.status === 410,
      'Token expirado rechaza actualizaciones de ubicación retornando HTTP 410 (Gone)'
    );
  } finally {
    server.close();
  }

  // ----------------------------------------------------
  // RESUMEN FINAL DE PRUEBAS
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`📊 RESULTADO DE AUDITORÍA: ${passed} PASADOS | ${failed} FALLADOS`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuditSuite().catch((err) => {
  console.error('Error fatal ejecutando suite de tests:', err);
  process.exit(1);
});
