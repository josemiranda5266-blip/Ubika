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

// Normalize legacy Don Pedro fixtures created by older DB migrations. The current
// Food contract requires foodEnabled=true plus a complete store shape, including
// schedule and bankInfo, because the public store endpoint reads schedule directly.
const donPedroStore = db.getFoodStoreByCompanyId('comp_food_don_pedro_01');
if (donPedroStore) {
  db.upsertFoodStore({
    ...donPedroStore,
    foodEnabled: true,
    schedule: Array.isArray(donPedroStore.schedule) ? donPedroStore.schedule : [],
    bankInfo: donPedroStore.bankInfo || { bankName: '', alias: '', cbu: '', holderName: '' },
    createdAt: donPedroStore.createdAt || Date.now(),
    updatedAt: Date.now(),
  });
}

// Keep the Don Pedro DRIVER user and Driver record consistent. Older fixtures can
// contain a DRIVER user whose driverId points to a missing legacy record, which
// makes an otherwise valid FOOD_DELIVERY assignment fail with HTTP 404.
const donPedroDrivers = db.getDriversByCompany('comp_food_don_pedro_01');
const donPedroDriverUsers = db.getUsersByCompany('comp_food_don_pedro_01').filter((u) => u.role === 'DRIVER');
const firstDonPedroDriverUser = donPedroDriverUsers[0];
if (firstDonPedroDriverUser && firstDonPedroDriverUser.driverId && !db.getDriverById(firstDonPedroDriverUser.driverId)) {
  db.createDriver({
    id: firstDonPedroDriverUser.driverId,
    companyId: 'comp_food_don_pedro_01',
    name: firstDonPedroDriverUser.name,
    email: firstDonPedroDriverUser.email,
    phone: firstDonPedroDriverUser.phone || '',
    vehicle: 'moto',
    status: 'disponible',
    internalId: 'DP-LEGACY-01',
    createdAt: Date.now(),
    totalDeliveries: 0,
    rating: 5,
    lastActiveAt: Date.now(),
    speedKmH: 0,
  });
} else if (!firstDonPedroDriverUser && !donPedroDrivers.some((d) => d.id === 'drv_don_pedro_01')) {
  const passwordHash = bcryptModule.default.hashSync(process.env.INITIAL_DRIVER_PASSWORD!, 10);
  db.createDriver({
    id: 'drv_don_pedro_01',
    companyId: 'comp_food_don_pedro_01',
    name: 'Cadete Pedro Jr',
    email: 'pedrojr@ubikafood.com',
    phone: '',
    vehicle: 'moto',
    status: 'disponible',
    internalId: 'DP-01',
    createdAt: Date.now(),
    totalDeliveries: 0,
    rating: 5,
    lastActiveAt: Date.now(),
    speedKmH: 0,
  });
  db.createUser({
    id: 'usr_driver_don_pedro_01',
    email: 'pedrojr@ubikafood.com',
    passwordHash,
    name: 'Cadete Pedro Jr',
    role: 'DRIVER',
    companyId: 'comp_food_don_pedro_01',
    driverId: 'drv_don_pedro_01',
    createdAt: Date.now(),
    active: true,
  });
}

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
if (!db.getDriverById('drv_centro_01')) {
  db.createDriver({
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
