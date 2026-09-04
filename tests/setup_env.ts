// Setup test-only environment variables before other modules load
process.env.INITIAL_ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || 'test_secret_admin_2026_password';
process.env.INITIAL_DRIVER_PASSWORD = process.env.INITIAL_DRIVER_PASSWORD || 'test_secret_driver_2026_password';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_tests_only_123456';
process.env.SEED_DEMO_DATA = process.env.SEED_DEMO_DATA || 'true';

// The security audit suite exercises cross-tenant access against Farmacia Norte.
// Its base fixture historically created the company/driver but not the corresponding
// auth users, so provide those two test-only identities before the suite calls
// injectTestFixtures(). This is deliberately isolated to that test process.
if (process.argv.some((arg) => arg.includes('security_and_flow.test.ts'))) {
  const { db } = await import('../server/db');
  const passwordHash = '$2b$10$7V4Vf5hX7jM8cQ8W5fQJ6e7VqQ5xK8f3gP4mN6dR9sT2uL1wX0yZa';

  if (!db.getUserById('usr_admin_farma_02')) {
    db.createUser({
      id: 'usr_admin_farma_02',
      email: 'admin@farmanorte.com',
      passwordHash,
      name: 'Administrador Farma Norte',
      role: 'COMPANY_ADMIN',
      companyId: 'comp_farma_norte_02',
      createdAt: Date.now(),
      active: true,
    });
  }

  if (!db.getUserById('usr_driver_farma_01')) {
    db.createUser({
      id: 'usr_driver_farma_01',
      email: 'esteban@farmanorte.com',
      passwordHash,
      name: 'Esteban Morales',
      role: 'DRIVER',
      companyId: 'comp_farma_norte_02',
      driverId: 'drv_farma_01',
      createdAt: Date.now(),
      active: true,
    });
  }
}
