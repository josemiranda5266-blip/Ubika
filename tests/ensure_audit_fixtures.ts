import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

if (process.env.NODE_ENV !== 'test') {
  throw new Error('Audit fixtures are only available in test environment');
}

const dbFile = path.join(process.cwd(), 'data', 'ubika_persistent_db.json');
if (!fs.existsSync(dbFile)) {
  throw new Error('Audit fixture database does not exist; run the test environment setup first');
}

const db = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
db.companies = db.companies || [];
db.users = db.users || [];
db.drivers = db.drivers || [];

const password = process.env.INITIAL_ADMIN_PASSWORD;
if (!password) {
  throw new Error('INITIAL_ADMIN_PASSWORD is required for audit fixtures');
}

const passwordHash = bcrypt.hashSync(password, 10);
const now = Date.now();

const company = db.companies.find((existing: any) => existing.id === 'comp_farma_norte_02');
if (!company) {
  db.companies.push({
    id: 'comp_farma_norte_02',
    name: 'Farmacia Norte',
    category: 'Farmacia / Salud',
    address: '',
    phone: '',
    city: '',
    activeOrdersCount: 0,
    totalDriversCount: 1,
    businessType: 'LOGISTICS',
    foodEnabled: false,
  });
}

const ensureUser = (user: any) => {
  const existing = db.users.find((candidate: any) => candidate.id === user.id);
  if (existing) {
    Object.assign(existing, user);
  } else {
    db.users.push(user);
  }
};

ensureUser({
  id: 'usr_admin_farma_02',
  email: 'admin@farmanorte.com',
  passwordHash,
  name: 'Administrador Farma Norte',
  role: 'COMPANY_ADMIN',
  companyId: 'comp_farma_norte_02',
  createdAt: now,
  active: true,
});

ensureUser({
  id: 'usr_driver_farma_01',
  email: 'esteban@farmanorte.com',
  passwordHash,
  name: 'Esteban Morales',
  role: 'DRIVER',
  companyId: 'comp_farma_norte_02',
  driverId: 'drv_farma_01',
  createdAt: now,
  active: true,
});

const driver = db.drivers.find((existing: any) => existing.id === 'drv_farma_01');
if (driver) {
  Object.assign(driver, {
    companyId: 'comp_farma_norte_02',
    name: 'Esteban Morales',
    email: 'esteban@farmanorte.com',
    vehicle: 'moto',
    status: 'disponible',
  });
} else {
  db.drivers.push({
    id: 'drv_farma_01',
    companyId: 'comp_farma_norte_02',
    name: 'Esteban Morales',
    email: 'esteban@farmanorte.com',
    phone: '',
    vehicle: 'moto',
    status: 'disponible',
    internalId: 'F-01',
    createdAt: now,
    totalDeliveries: 10,
    rating: 4.8,
    lastActiveAt: now,
    speedKmH: 0,
  });
}

fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf-8');
console.log('[TEST FIXTURES] Empresa B: admin, driver y empresa disponibles para auditoría multi-tenant.');
