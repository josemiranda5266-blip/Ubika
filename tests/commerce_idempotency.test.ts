import './setup_env';
import 'dotenv/config';
import assert from 'assert';
import { injectTestFixtures } from '../server/db';
import { CommerceRepository } from '../server/commerce/repository';

async function runTest() {
  console.log('====================================================');
  console.log('🔒 TEST: UBIKA COMMERCE IDEMPOTENCY + TENANT');
  console.log('====================================================\n');

  injectTestFixtures();

  const compA = 'comp_idem_A';
  const compB = 'comp_idem_B';
  const key = 'idem_key_123';

  const saleA = CommerceRepository.createSale({
    id: 'sale_a_1',
    companyId: compA,
    items: [],
    subtotal: 100,
    discount: 0,
    surcharge: 0,
    tax: 21,
    total: 121,
    payments: [],
    status: 'COMPLETED',
    idempotencyKey: key,
    createdBy: 'usr_1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Querying idempotency key with correct companyId should return saleA
  const foundA = CommerceRepository.getSaleByIdempotencyKey(compA, key);
  assert(foundA && foundA.id === saleA.id, 'Debe encontrar la venta con key para compA');

  // Querying idempotency key with different companyId (compB) must NOT return saleA
  const foundB = CommerceRepository.getSaleByIdempotencyKey(compB, key);
  assert(!foundB, 'Jamás debe retornar venta de otra empresa con la misma idempotency key');

  console.log('✅ [PASÓ] UBIKA COMMERCE IDEMPOTENCY TEST EXITOSO');
}

runTest().catch(err => {
  console.error('❌ [FALLÓ] Test Idempotencia fallido:', err);
  process.exit(1);
});
