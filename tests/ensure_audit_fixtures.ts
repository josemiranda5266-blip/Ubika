import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

if (process.env.NODE_ENV !== 'test') {
  throw new Error('Audit fixtures are only available in test environment');
}

const dbFile = path.join(process.cwd(), 'data', 'ubika_persistent_db.json');
const db = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
const password = process.env.INITIAL_ADMIN_PASSWORD || 'TestAuditPassword2026!';
const passwordHash = bcrypt.hashSync(password, 10);
const now = Date.now();
const users = db.users || (db.users = []);

const ensureUser = (user: any) => {
  if (!users.some((existing: any) => existing.id === user.id)) users.push(user);
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

fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf-8');
console.log('[TEST FIXTURES] Empresa B: admin y driver disponibles para auditoría multi-tenant.');
