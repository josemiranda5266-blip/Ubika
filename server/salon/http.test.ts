import assert from 'node:assert/strict';
import http from 'node:http';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-salon-http-test-secret';

const { createUbikaApp } = await import('../../server');
const { default: salonRouter } = await import('./routes');
const { db } = await import('../db');
const { generateAuthToken } = await import('../auth');

const companyId = `salon-http-${Date.now()}`;
const userId = `salon-admin-${Date.now()}`;
const email = `${userId}@example.test`;

const company = {
  id: companyId,
  name: 'Salon HTTP Test',
  category: 'Gastronomía',
  address: '',
  phone: '',
  city: '',
  activeOrdersCount: 0,
  totalDriversCount: 0,
  businessType: 'FOOD' as const,
  foodEnabled: true,
};

const user = {
  id: userId,
  email,
  passwordHash: 'test-only',
  name: 'Salon Admin Test',
  role: 'COMPANY_ADMIN' as const,
  companyId,
  createdAt: Date.now(),
  active: true,
};

db.createCompany(company);
db.createUser(user);

const app = createUbikaApp();
app.use('/api/salon', salonRouter);

const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address && typeof address !== 'string');
const baseUrl = `http://127.0.0.1:${address.port}`;
const token = generateAuthToken(user);

try {
  const createResponse = await fetch(`${baseUrl}/api/salon/tables`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ number: 1, name: 'Mesa 1', capacity: 4, area: 'Salón' }),
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json() as { table: { id: string; companyId: string; publicQrToken: string }; qrUrl: string };
  assert.equal(created.table.companyId, companyId);
  assert.ok(created.table.publicQrToken);
  assert.match(created.qrUrl, /\/api\/salon\/qr\//);

  const listResponse = await fetch(`${baseUrl}/api/salon/tables`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(listResponse.status, 200);
  const listed = await listResponse.json() as { tables: Array<{ id: string }> };
  assert.ok(listed.tables.some((table) => table.id === created.table.id));

  const qrResponse = await fetch(`${baseUrl}/api/salon/qr/${encodeURIComponent(created.table.publicQrToken)}`);
  assert.equal(qrResponse.status, 200);
  const qr = await qrResponse.json() as { companyId: string; tableId: string; tableNumber: number };
  assert.deepEqual(qr, { companyId, tableId: created.table.id, tableNumber: 1 });

  const unauthorizedResponse = await fetch(`${baseUrl}/api/salon/tables`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(unauthorizedResponse.status, 401);

  console.log('Salon HTTP tests: PASS');
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
