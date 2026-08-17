import './setup_env';
import 'dotenv/config';
import assert from 'assert';
import { injectTestFixtures } from '../server/db';
import { CommerceRepository } from '../server/commerce/repository';
import { CommerceService } from '../server/commerce/service';

async function runTest() {
  console.log('====================================================');
  console.log('🔒 TEST: UBIKA COMMERCE COMPLETE STOCK & MOVEMENT ROLLBACK');
  console.log('====================================================\n');

  injectTestFixtures();
  const runId = Date.now();
  const compId = `comp_rb_real_${runId}`;
  const userId = `usr_${runId}`;

  // Ensure cash session for user
  CommerceService.openCashSession(compId, userId, 10000);

  // Create Product A (stock = 10)
  const productA = CommerceRepository.createProduct({
    id: `prod_rb_A_${runId}`,
    companyId: compId,
    name: 'Producto Rollback A',
    code: 'SKU-RBA',
    barcode: '779000000101',
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

  // Create Product B (stock = 10)
  const productB = CommerceRepository.createProduct({
    id: `prod_rb_B_${runId}`,
    companyId: compId,
    name: 'Producto Rollback B',
    code: 'SKU-RBB',
    barcode: '779000000102',
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

  const initialMovements = CommerceRepository.getStockMovementsByCompany(compId);
  const initialMovementsCount = initialMovements.length;

  // Intercept adjustStock to force an error on Product B AFTER Product A has already been discounted
  const originalAdjustStock = CommerceService.adjustStock;
  let productADiscounted = false;

  (CommerceService as any).adjustStock = async function(productId: string, ...args: any[]) {
    if (productId === productA.id) {
      const res = await originalAdjustStock.apply(CommerceService, [productId, ...args] as any);
      productADiscounted = true;
      return res;
    }
    if (productId === productB.id && productADiscounted) {
      throw new Error('FORCED_SIMULATED_ERROR_AFTER_PRODUCT_A_DISCOUNTED');
    }
    return originalAdjustStock.apply(CommerceService, [productId, ...args] as any);
  };

  const totalAmount = (5 * 100 * 1.21) + (5 * 100 * 1.21); // 1210
  const idempotencyKey = `idem_test_rollback_real_${runId}`;

  try {
    await CommerceService.finalizeSale({
      companyId: compId,
      items: [
        { productId: productA.id, quantity: 5 },
        { productId: productB.id, quantity: 5 },
      ],
      payments: [{ method: 'CASH', amount: totalAmount }],
      userId,
      idempotencyKey,
    });
    assert.fail('La venta debió fallar por el error forzado en Producto B');
  } catch (err: any) {
    assert(
      err.message.includes('FORCED_SIMULATED_ERROR_AFTER_PRODUCT_A_DISCOUNTED'),
      `Error esperado capturado: ${err.message}`
    );
  } finally {
    // Restore original function
    CommerceService.adjustStock = originalAdjustStock;
  }

  // 1. Verify Product A and Product B stock are both fully restored to 10
  const finalProdA = CommerceRepository.getProductByIdForCompany(productA.id, compId);
  const finalProdB = CommerceRepository.getProductByIdForCompany(productB.id, compId);

  assert(finalProdA?.stock === 10, `Stock de Producto A debe ser 10 tras rollback, pero es ${finalProdA?.stock}`);
  assert(finalProdB?.stock === 10, `Stock de Producto B debe ser 10 tras rollback, pero es ${finalProdB?.stock}`);

  // 2. Verify no partial sale was created
  const sales = CommerceRepository.getSalesByCompany(compId);
  const partialSale = sales.find(s => s.idempotencyKey === idempotencyKey);
  assert(!partialSale, 'No debe existir ninguna venta parcial en la base de datos');

  // 3. Verify no orphaned StockMovement was left for Product A or B
  const finalMovements = CommerceRepository.getStockMovementsByCompany(compId);
  const orphanedMovements = finalMovements.filter(
    m => (m.productId === productA.id || m.productId === productB.id) && m.type === 'SALIDA'
  );
  assert(
    orphanedMovements.length === 0,
    `No deben quedar movimientos huérfanos de SALIDA, pero se encontraron ${orphanedMovements.length}`
  );
  assert(
    finalMovements.length === initialMovementsCount,
    `La cantidad total de movimientos de stock (${finalMovements.length}) debe ser igual a la inicial (${initialMovementsCount})`
  );

  console.log('✅ [PASÓ] UBIKA COMMERCE COMPLETE ROLLBACK TEST');
}

runTest().catch(err => {
  console.error('❌ [FALLÓ] Test rollback:', err);
  process.exit(1);
});
