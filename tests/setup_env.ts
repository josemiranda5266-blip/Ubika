// Setup test-only environment variables before other modules load
process.env.INITIAL_ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || 'test_secret_admin_2026_password';
process.env.INITIAL_DRIVER_PASSWORD = process.env.INITIAL_DRIVER_PASSWORD || 'test_secret_driver_2026_password';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_tests_only_123456';
process.env.SEED_DEMO_DATA = process.env.SEED_DEMO_DATA || 'true';

// The security suite needs two complete tenants. Keep this repair isolated to tests
// so production startup never creates demo accounts implicitly.
const [{ db, injectTestFixtures, saveDatabaseSync }, bcryptModule] = await Promise.all([
  import('../server/db'),
  import('bcryptjs'),
]);

injectTestFixtures();

if (!db.getUsersByCompany('comp_farma_norte_02').some((u) => u.role === 'COMPANY_ADMIN')) {
  const passwordHash = bcryptModule.default.hashSync(process.env.INITIAL_ADMIN_PASSWORD!, 10);
  db.createUser({
    id: 'usr_admin_farma_02',
    email: 'admin@farmanorte.com',
    passwordHash,
    name: 'Administrador Farmacia Norte',
    role: 'COMPANY_ADMIN',
    companyId: 'comp_farma_norte_02',
    createdAt: Date.now(),
    active: true,
  });
}

if (!db.getUsersByCompany('comp_farma_norte_02').some((u) => u.role === 'DRIVER')) {
  const passwordHash = bcryptModule.default.hashSync(process.env.INITIAL_DRIVER_PASSWORD!, 10);
  db.createUser({
    id: 'usr_driver_farma_02',
    email: 'driver@farmanorte.com',
    passwordHash,
    name: 'Driver Farmacia Norte',
    role: 'DRIVER',
    companyId: 'comp_farma_norte_02',
    driverId: 'drv_farma_01',
    createdAt: Date.now(),
    active: true,
  });
}

// Company A already has delivery data, but its test fixture lacked a matching
// DRIVER user. Create both sides of the relationship so JWT/RBAC tests exercise
// real tenant-scoped identities instead of relying on undefined users.
if (!db.drivers.find((d) => d.id === 'drv_centro_01')) {
  db.drivers.push({
    id: 'drv_centro_01',
    companyId: 'comp_centro_logistico_01',
    name: 'Driver Centro Logístico',
    email: 'driver@logisticaexpress.com',
    phone: '',
    vehicle: 'moto',
    status: 'disponible',
    internalId: 'CL-01',
    createdAt: Date.now(),
    totalDeliveries: 0,
    rating: 5,
    lastActiveAt: Date.now(),
    speedKmH: 0,
  });
}

if (!db.getUsersByCompany('comp_centro_logistico_01').some((u) => u.role === 'DRIVER')) {
  const passwordHash = bcryptModule.default.hashSync(process.env.INITIAL_DRIVER_PASSWORD!, 10);
  db.createUser({
    id: 'usr_driver_centro_01',
    email: 'driver@logisticaexpress.com',
    passwordHash,
    name: 'Driver Centro Logístico',
    role: 'DRIVER',
    companyId: 'comp_centro_logistico_01',
    driverId: 'drv_centro_01',
    createdAt: Date.now(),
    active: true,
  });
}

saveDatabaseSync();
