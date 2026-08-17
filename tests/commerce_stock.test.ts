import './setup_env';
import 'dotenv/config';
import assert from 'assert';
import { injectTestFixtures } from '../server/db';
import { CommerceRepository } from '../server/commerce/repository';
import { CommerceService } from '../server/commerce/service';

async function runTest() {
  injectTestFixtures();
  const compId = 'comp_stock_1';

  const product = CommerceRepository.createProduct({
    id: 'prod_stk_1',
    companyId: compId,
    name: 'Producto Stock',
    code: 'SKU-STK',
    barcode: '779000000003',
    salePrice: 200,
    costPrice: 100,
    stock: 10,
    minStock: 2,
    maxStock: 50,
    taxRate: 21,
    categoryId: 'cat_1',
    status: 'ACTIVE',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  await CommerceService.adjustStock(product.id, compId, 5, 'ENTRADA', 'Compra proveedor', 'usr_1');
  const updatedProd = CommerceRepository.getProductByIdForCompany(product.id, compId);
  assert(updatedProd?.stock === 15, 'El stock debe aumentar a 15 tras entrada de 5');

  console.log('✅ [PASÓ] UBIKA COMMERCE STOCK TEST');
}

runTest().catch(err => {
  console.error('❌ [FALLÓ] Test stock:', err);
  process.exit(1);
});
