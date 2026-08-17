import './setup_env';
import 'dotenv/config';
import assert from 'assert';
import { db, injectTestFixtures } from '../server/db';
import { createUbikaApp } from '../server';
import { generateAuthToken } from '../server/auth';

async function runTest() {
  injectTestFixtures();
  const app = createUbikaApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const BASE_URL = `http://127.0.0.1:${address.port}`;

  const driverUser = db.createUser({
    id: 'usr_drv_1',
    email: 'driver@ubika.com',
    passwordHash: 'hash',
    name: 'Driver',
    role: 'DRIVER',
    companyId: 'comp_1',
    createdAt: Date.now(),
    active: true,
  });

  const clientUser = db.createUser({
    id: 'usr_cli_1',
    email: 'client@ubika.com',
    passwordHash: 'hash',
    name: 'Client',
    role: 'CLIENT',
    companyId: 'comp_1',
    createdAt: Date.now(),
    active: true,
  });

  const tokenDriver = generateAuthToken(driverUser);
  const tokenClient = generateAuthToken(clientUser);

  const resDriver = await fetch(`${BASE_URL}/api/v1/commerce/products`, {
    headers: { 'Authorization': `Bearer ${tokenDriver}` }
  });
  assert(resDriver.status === 403 || resDriver.status === 401, 'DRIVER no debe poder acceder a commerce');

  const resClient = await fetch(`${BASE_URL}/api/v1/commerce/sales`, {
    headers: { 'Authorization': `Bearer ${tokenClient}` }
  });
  assert(resClient.status === 403 || resClient.status === 401, 'CLIENT no debe poder acceder a sales');

  server.close();
  console.log('✅ [PASÓ] UBIKA COMMERCE RBAC TEST');
}

runTest().catch(err => {
  console.error('❌ [FALLÓ] Test RBAC:', err);
  process.exit(1);
});
