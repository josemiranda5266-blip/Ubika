import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

// Setup test-only environment variables before other modules load
process.env.INITIAL_ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || 'test_secret_admin_2026_password';
process.env.INITIAL_DRIVER_PASSWORD = process.env.INITIAL_DRIVER_PASSWORD || 'test_secret_driver_2026_password';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_tests_only_123456';
process.env.SEED_DEMO_DATA = process.env.SEED_DEMO_DATA || 'true';

// Test-only persistence fixture. This runs synchronously before server/db is imported,
// so every audit process starts from a deterministic Empresa B fixture state.
if (process.env.NODE_ENV === 'test') {
  const dbFile = path.join(process.cwd(), 'data', 'ubika_persistent_db.json');

  if (fs.existsSync(dbFile)) {
    const db = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
    db.users = db.users || [];
    db.companies = db.companies || [];
    db.drivers = db.drivers || [];

    const now = Date.now();
    const passwordHash = bcrypt.hashSync(process.env.INITIAL_ADMIN_PASSWORD!, 10);

    const ensureCompany = (company: any) => {
      const existing = db.companies.find((c: any) => c.id === company.id);
      if (existing) Object.assign(existing, company);
      else db.companies.push(company);
    };

    const ensureUser = (user: any) => {
      const existing = db.users.find((u: any) => u.id === user.id);
      if (existing) Object.assign(existing, user);
      else db.users.push(user);
    };

    const ensureDriver = (driver: any) => {
      const existing = db.drivers.find((d: any) => d.id === driver.id);
      if (existing) Object.assign(existing, driver);
      else db.drivers.push(driver);
    };

    ensureCompany({
      id: 'comp_farma_norte_02', name: 'Farmacia Norte', category: 'Farmacia / Salud',
      address: '', phone: '', city: '', activeOrdersCount: 0, totalDriversCount: 1,
      businessType: 'LOGISTICS', foodEnabled: false,
    });

    ensureUser({
      id: 'usr_admin_farma_02', email: 'admin@farmanorte.com', passwordHash,
      name: 'Administrador Farma Norte', role: 'COMPANY_ADMIN', companyId: 'comp_farma_norte_02',
      createdAt: now, active: true,
    });

    ensureUser({
      id: 'usr_driver_farma_01', email: 'esteban@farmanorte.com', passwordHash,
      name: 'Esteban Morales', role: 'DRIVER', companyId: 'comp_farma_norte_02',
      driverId: 'drv_farma_01', createdAt: now, active: true,
    });

    ensureDriver({
      id: 'drv_farma_01', companyId: 'comp_farma_norte_02', name: 'Esteban Morales',
      email: 'esteban@farmanorte.com', phone: '', vehicle: 'moto', status: 'disponible',
      internalId: 'F-01', createdAt: now, totalDeliveries: 10, rating: 4.8,
      lastActiveAt: now, speedKmH: 0,
    });

    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf-8');
  }
}
