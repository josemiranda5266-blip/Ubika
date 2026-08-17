import './setup_env';
import 'dotenv/config';
import assert from 'assert';
import { injectTestFixtures } from '../server/db';
import { CommerceRepository } from '../server/commerce/repository';
import { CommerceService } from '../server/commerce/service';

async function runTest() {
  console.log('====================================================');
  console.log('🔒 TEST: UBIKA COMMERCE MULTI-PRODUCT DEADLOCK & CONCURRENCY');
  console.log('====================================================\n');

  injectTestFixtures();
  const compId = `comp_multi_lock_${Date.now()}`;
  const userId = 'usr_1';

  // Ensure cash session
  CommerceService.openCashSession(compId, userId, 50000);

  // Product A (stock = 10)
  const productA = CommerceRepository.createProduct({
    id: `prod_lock_A_${Date.now()}`,
    companyId: compId,
    name: 'Producto Lock A',
    code: 'SKU-LOCK-A',
    barcode: '779000000701',
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

  // Product B (stock = 10)
  const productB = CommerceRepository.createProduct({
    id: `prod_lock_B_${Date.now()}`,
    companyId: compId,
    name: 'Producto Lock B',
    code: 'SKU-LOCK-B',
    barcode: '779000000702',
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

  const initialMovements = CommerceRepository.getStockMovementsByCompany(compId).length;
  assert(initialMovements === 0, 'No debe haber movimientos previos para esta empresa');

  // Execute simultaneous opposite-order multi-product sales
  // Venta 1: A (3) + B (2) -> Subtotal 500, Tax 105, Total 605
  // Venta 2: B (4) + A (5) -> Subtotal 900, Tax 189, Total 1089

  const salePromise1 = CommerceService.finalizeSale({
    companyId: compId,
    items: [
      { productId: productA.id, quantity: 3 },
      { productId: productB.id, quantity: 2 },
    ],
    payments: [{ method: 'CASH', amount: 605 }],
    userId,
    idempotencyKey: `idem_multi_sale_1_${Date.now()}`
  });

  const salePromise2 = CommerceService.finalizeSale({
    companyId: compId,
    items: [
      { productId: productB.id, quantity: 4 },
      { productId: productA.id, quantity: 5 },
    ],
    payments: [{ method: 'CASH', amount: 1089 }],
    userId,
    idempotencyKey: `idem_multi_sale_2_${Date.now()}`
  });

  // Execute both concurrently with a timeout guard against deadlocks
  const timeoutGuard = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('DEADLOCK_DETECTED_TIMEOUT')), 5000)
  );

  const [sale1, sale2] = await Promise.race([
    Promise.all([salePromise1, salePromise2]),
    timeoutGuard as any
  ]);

  assert(sale1 && sale1.status === 'COMPLETED', 'Venta 1 debe completarse exitosamente');
  assert(sale2 && sale2.status === 'COMPLETED', 'Venta 2 debe completarse exitosamente');

  // Verify stock correctness
  const finalProdA = CommerceRepository.getProductByIdForCompany(productA.id, compId);
  const finalProdB = CommerceRepository.getProductByIdForCompany(productB.id, compId);

  // A stock: 10 - 3 - 5 = 2
  // B stock: 10 - 2 - 4 = 4
  assert(finalProdA?.stock === 2, `Stock de Producto A debe ser 2, pero es ${finalProdA?.stock}`);
  assert(finalProdB?.stock === 4, `Stock de Producto B debe ser 4, pero es ${finalProdB?.stock}`);

  // Verify stock movements: 2 products in Sale 1 + 2 products in Sale 2 = exactly 4 movements
  const finalMovements = CommerceRepository.getStockMovementsByCompany(compId);
  const newMovements = finalMovements.length - initialMovements;
  assert(newMovements === 4, `Se esperaban 4 nuevos movimientos de stock, pero se registraron ${newMovements}`);

  console.log('✅ [PASÓ] UBIKA COMMERCE MULTI-PRODUCT LOCK TEST');
}

runTest().catch(err => {
  console.error('❌ [FALLÓ] Test multi-lock:', err);
  process.exit(1);
});
