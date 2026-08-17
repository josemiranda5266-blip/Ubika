import './setup_env';
import 'dotenv/config';
import assert from 'assert';
import { db, injectTestFixtures } from '../server/db';
import { createUbikaApp } from '../server';
import { generateAuthToken } from '../server/auth';
import { CommerceRepository } from '../server/commerce/repository';

async function runTest() {
  injectTestFixtures();
  const app = createUbikaApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const BASE_URL = `http://127.0.0.1:${address.port}`;

  const userB = db.createUser({
    id: 'usr_com_b',
    email: 'b@commerce.com',
    passwordHash: 'hash',
    name: 'Admin B',
    role: 'COMPANY_ADMIN',
    companyId: 'comp_commerce_B',
    createdAt: Date.now(),
    active: true,
  });

  const tokenB = generateAuthToken(userB);

  const prodA = CommerceRepository.createProduct({
    id: 'prod_a_1',
    companyId: 'comp_commerce_A',
    name: 'Producto A',
    code: 'SKU-A-01',
    barcode: '779000000001',
    salePrice: 100,
    costPrice: 50,
    stock: 50,
    minStock: 5,
    maxStock: 100,
    taxRate: 21,
    categoryId: 'cat_1',
    status: 'ACTIVE',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const res = await fetch(`${BASE_URL}/api/v1/commerce/products/${prodA.id}`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });

  assert(res.status === 404 || res.status === 403, 'Empresa B no debe poder ver producto de Empresa A');
  const prodFoundByB = CommerceRepository.getProductByIdForCompany(prodA.id, 'comp_commerce_B');
  assert(!prodFoundByB, 'Repository debe retornar null para producto ajeno');

  server.close();
  console.log('✅ [PASÓ] UBIKA COMMERCE TENANT ISOLATION TEST');
}

runTest().catch(err => {
  console.error('❌ [FALLÓ] Test tenant isolation:', err);
  process.exit(1);
});
