import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

// Setup test-only environment variables before other modules load
process.env.INITIAL_ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || 'test_secret_admin_2026_password';
process.env.INITIAL_DRIVER_PASSWORD = process.env.INITIAL_DRIVER_PASSWORD || 'test_secret_driver_2026_password';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_tests_only_123456';
process.env.SEED_DEMO_DATA = process.env.SEED_DEMO_DATA || 'true';

// Test-only persistence fixture. This runs synchronously before server/db is imported,
// so multi-tenant audit tests always have Empresa B users available.
if (process.env.NODE_ENV === 'test') {
  const dbFile = path.join(process.cwd(), 'data', 'ubika_persistent_db.json');

  if (fs.existsSync(dbFile)) {
    const db = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
    db.users = db.users || [];
    db.companies = db.companies || [];
    db.drivers = db.drivers || [];

    if (!db.companies.some((c: any) => c.id === 'comp_farma_norte_02')) {
      db.companies.push({
        id: 'comp_farma_norte_02', name: 'Farmacia Norte', category: 'Farmacia / Salud',
        address: '', phone: '', city: '', activeOrdersCount: 0, totalDriversCount: 1,
        businessType: 'LOGISTICS', foodEnabled: false,
      });
    }

    const passwordHash = bcrypt.hashSync(process.env.INITIAL_ADMIN_PASSWORD!, 10);
    if (!db.users.some((u: any) => u.id === 'usr_admin_farma_02')) {
      db.users.push({ id: 'usr_admin_farma_02', email: 'admin@farmanorte.com', passwordHash,
        name: 'Administrador Farma Norte', role: 'COMPANY_ADMIN', companyId: 'comp_farma_norte_02',
        createdAt: Date.now(), active: true });
    }
    if (!db.users.some((u: any) => u.id === 'usr_driver_farma_01')) {
      db.users.push({ id: 'usr_driver_farma_01', email: 'esteban@farmanorte.com', passwordHash,
        name: 'Esteban Morales', role: 'DRIVER', companyId: 'comp_farma_norte_02',
        driverId: 'drv_farma_01', createdAt: Date.now(), active: true });
    }
    if (!db.drivers.some((d: any) => d.id === 'drv_farma_01')) {
      db.drivers.push({ id: 'drv_farma_01', companyId: 'comp_farma_norte_02', name: 'Esteban Morales',
        email: 'esteban@farmanorte.com', phone: '', vehicle: 'moto', status: 'disponible',
        internalId: 'F-01', createdAt: Date.now(), totalDeliveries: 10, rating: 4.8,
        lastActiveAt: Date.now(), speedKmH: 0 });
    }
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf-8');
  }
}
