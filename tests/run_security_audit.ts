// Preload test-only persistence fixtures before running the audit suite.
// The audit is imported dynamically after fixtures are materialized so the
// security suite shares the exact same server/db module instance and state.
import './setup_env';
import './ensure_audit_fixtures';

const { db, injectTestFixtures, saveDatabaseSync } = await import('../server/db');
injectTestFixtures();

const state = db.getRawState() as any;
state.companies = state.companies || [];
state.users = state.users || [];
state.drivers = state.drivers || [];

if (!state.companies.some((c: any) => c.id === 'comp_farma_norte_02')) {
  state.companies.push({
    id: 'comp_farma_norte_02',
    name: 'Farmacia Norte',
    category: 'Farmacia / Salud',
    address: '', phone: '', city: '', activeOrdersCount: 0, totalDriversCount: 1,
    businessType: 'LOGISTICS', foodEnabled: false,
  });
}

const now = Date.now();
const adminPasswordHash = state.users.find((u: any) => u.id === 'usr_admin_piloto')?.passwordHash;
const driverPasswordHash = state.users.find((u: any) => u.id === 'usr_driver_piloto')?.passwordHash || adminPasswordHash;

if (!adminPasswordHash || !driverPasswordHash) {
  throw new Error('Audit fixture materialization failed: base pilot users are not present');
}

const ensureUser = (user: any) => {
  const existing = state.users.find((u: any) => u.id === user.id);
  if (existing) Object.assign(existing, user);
  else state.users.push(user);
};

ensureUser({
  id: 'usr_admin_farma_02', email: 'admin@farmanorte.com', passwordHash: adminPasswordHash,
  name: 'Administrador Farma Norte', role: 'COMPANY_ADMIN', companyId: 'comp_farma_norte_02',
  createdAt: now, active: true,
});
ensureUser({
  id: 'usr_driver_farma_01', email: 'esteban@farmanorte.com', passwordHash: driverPasswordHash,
  name: 'Esteban Morales', role: 'DRIVER', companyId: 'comp_farma_norte_02', driverId: 'drv_farma_01',
  createdAt: now, active: true,
});

if (!state.drivers.some((d: any) => d.id === 'drv_farma_01')) {
  state.drivers.push({
    id: 'drv_farma_01', companyId: 'comp_farma_norte_02', name: 'Esteban Morales',
    email: 'esteban@farmanorte.com', phone: '', vehicle: 'moto', status: 'disponible',
    internalId: 'F-01', createdAt: now, totalDeliveries: 10, rating: 4.8,
    lastActiveAt: now, speedKmH: 0,
  });
}

saveDatabaseSync();

const auditAdminB = state.users.find((u: any) => u.id === 'usr_admin_farma_02' && u.companyId === 'comp_farma_norte_02');
const auditDriverB = state.users.find((u: any) => u.id === 'usr_driver_farma_01' && u.companyId === 'comp_farma_norte_02');
if (!auditAdminB || !auditDriverB) {
  throw new Error('Audit fixture materialization failed: Empresa B users are not present in the persisted DB state');
}

console.log('[TEST FIXTURES] Empresa B verificada antes de ejecutar la auditoría HTTP.');

// Run the actual audit in the same prepared process. This guarantees that
// security_and_flow.test.ts reuses the already-loaded db module instance.
await import('./security_and_flow.test');
