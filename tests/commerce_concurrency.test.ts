import './setup_env';
import 'dotenv/config';
import assert from 'assert';
import { injectTestFixtures } from '../server/db';
import { CommerceRepository } from '../server/commerce/repository';
import { CommerceService } from '../server/commerce/service';

async function runTest() {
  injectTestFixtures();
  const compId = 'comp_conc_1';

  const existingCash = CommerceRepository.getCurrentOpenCashSession(compId, 'usr_1');
  if (!existingCash) {
    CommerceService.openCashSession(compId, 'usr_1', 10000);
  }

  const product = CommerceRepository.createProduct({
    id: 'prod_conc_1',
    companyId: compId,
    name: 'Producto Concurrente',
    code: 'SKU-CONC',
    barcode: '779000000002',
    salePrice: 100,
    costPrice: 50,
    stock: 5,
    minStock: 1,
    maxStock: 50,
    taxRate: 21,
    categoryId: 'cat_1',
    status: 'ACTIVE',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(
      CommerceService.finalizeSale({
        companyId: compId,
        items: [{ productId: product.id, quantity: 1 }],
        payments: [{ method: 'CASH', amount: 121 }], // 100 + 21% tax = 121 total
        userId: 'usr_1',
        idempotencyKey: `idem_conc_${i}`
      }).catch(err => {
        return { error: err.message };
      })
    );
  }

  const results = await Promise.all(promises);
  const successes = results.filter((r: any) => !r.error);
  const failures = results.filter((r: any) => r.error);

  assert(successes.length === 5, `Deben completarse exactamente 5 ventas, pero se completaron ${successes.length}`);
  assert(failures.length === 5, `Deben fallar exactamente 5 ventas, pero fallaron ${failures.length}`);

  const finalProduct = CommerceRepository.getProductByIdForCompany(product.id, compId);
  assert(finalProduct?.stock === 0, `El stock final debe ser 0, pero es ${finalProduct?.stock}`);

  console.log('✅ [PASÓ] UBIKA COMMERCE STOCK CONCURRENCY TEST');
}

runTest().catch(err => {
  console.error('❌ [FALLÓ] Test concurrency:', err);
  process.exit(1);
});
