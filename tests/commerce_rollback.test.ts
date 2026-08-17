import './setup_env';
import 'dotenv/config';
import assert from 'assert';
import { injectTestFixtures } from '../server/db';
import { CommerceRepository } from '../server/commerce/repository';
import { CommerceService } from '../server/commerce/service';

async function runTest() {
  injectTestFixtures();
  const compId = 'comp_rb_1';

  const existingCash = CommerceRepository.getCurrentOpenCashSession(compId, 'usr_1');
  if (!existingCash) {
    CommerceService.openCashSession(compId, 'usr_1', 10000);
  }

  const product = CommerceRepository.createProduct({
    id: 'prod_rb_1',
    companyId: compId,
    name: 'Producto Rollback',
    code: 'SKU-RB',
    barcode: '779000000004',
    salePrice: 100,
    costPrice: 50,
    stock: 10,
    minStock: 2,
    maxStock: 50,
    taxRate: 21,
    categoryId: 'cat_1',
    status: 'ACTIVE',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  try {
    await CommerceService.finalizeSale({
      companyId: compId,
      items: [{ productId: product.id, quantity: 5 }],
      payments: [{ method: 'CASH', amount: 10 }],
      userId: 'usr_1',
    });
    assert.fail('Debe fallar por discrepancia en pagos');
  } catch (err: any) {
    assert(err.message.includes('PAYMENT_AMOUNT_MISMATCH'), `Error esperado: ${err.message}`);
  }

  const currentProd = CommerceRepository.getProductByIdForCompany(product.id, compId);
  assert(currentProd?.stock === 10, `El stock debe haberse restaurado a 10 tras el rollback, pero es ${currentProd?.stock}`);

  console.log('✅ [PASÓ] UBIKA COMMERCE ROLLBACK TEST');
}

runTest().catch(err => {
  console.error('❌ [FALLÓ] Test rollback:', err);
  process.exit(1);
});
