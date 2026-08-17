import './setup_env';
import 'dotenv/config';
import assert from 'assert';
import { injectTestFixtures } from '../server/db';
import { CommerceRepository } from '../server/commerce/repository';
import { CommerceService } from '../server/commerce/service';

async function runTest() {
  console.log('====================================================');
  console.log('🔒 TEST: UBIKA COMMERCE ROLLBACK + IDEMPOTENCY RETRY');
  console.log('====================================================\n');

  injectTestFixtures();
  const runId = Date.now();
  const compId = `comp_idem_rb_${runId}`;
  const userId = `usr_${runId}`;

  // Ensure cash session
  CommerceService.openCashSession(compId, userId, 20000);

  // Create products
  const productA = CommerceRepository.createProduct({
    id: `prod_irb_A_${runId}`,
    companyId: compId,
    name: 'Producto IdemRB A',
    code: 'SKU-IRB-A',
    barcode: '779000000901',
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

  const productB = CommerceRepository.createProduct({
    id: `prod_irb_B_${runId}`,
    companyId: compId,
    name: 'Producto IdemRB B',
    code: 'SKU-IRB-B',
    barcode: '779000000902',
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

  const idempotencyKey = `idem_key_rollback_and_retry_${runId}`;

  // Step 1: Force error after modifying stock on attempt 1
  const originalAdjustStock = CommerceService.adjustStock;
  let attemptNumber = 1;

  (CommerceService as any).adjustStock = async function(productId: string, ...args: any[]) {
    if (attemptNumber === 1 && productId === productB.id) {
      throw new Error('SIMULATED_FAILURE_ON_ATTEMPT_1');
    }
    return originalAdjustStock.apply(CommerceService, [productId, ...args] as any);
  };

  const salePayload = {
    companyId: compId,
    items: [
      { productId: productA.id, quantity: 2 },
      { productId: productB.id, quantity: 3 },
    ],
    payments: [{ method: 'CASH' as const, amount: (2 * 100 * 1.21) + (3 * 100 * 1.21) }], // 605
    userId,
    idempotencyKey,
  };

  try {
    await CommerceService.finalizeSale(salePayload);
    assert.fail('El intento 1 debió fallar');
  } catch (err: any) {
    assert(err.message.includes('SIMULATED_FAILURE_ON_ATTEMPT_1'), `Error de intento 1 capturado: ${err.message}`);
  } finally {
    CommerceService.adjustStock = originalAdjustStock;
  }

  // Verify no phantom sale exists
  const phantomSale = CommerceRepository.getSaleByIdempotencyKey(compId, idempotencyKey);
  assert(phantomSale === undefined, 'No debe existir venta fantasma registrada tras el rollback');

  // Verify stock was restored
  const prodAAfterRollback = CommerceRepository.getProductByIdForCompany(productA.id, compId);
  const prodBAfterRollback = CommerceRepository.getProductByIdForCompany(productB.id, compId);
  assert(prodAAfterRollback?.stock === 10, 'Stock de A debe ser 10');
  assert(prodBAfterRollback?.stock === 10, 'Stock de B debe ser 10');

  // Step 2: Retry with the EXACT same idempotency key (normal flow)
  attemptNumber = 2;
  const retrySale = await CommerceService.finalizeSale(salePayload);

  assert(retrySale !== undefined, 'El reintento con la misma idempotencyKey debe procesarse');
  assert(retrySale.status === 'COMPLETED', 'La venta debe estar COMPLETED');
  assert(retrySale.idempotencyKey === idempotencyKey, 'La clave de idempotencia debe coincidir');

  // Verify updated stock
  const prodAFinal = CommerceRepository.getProductByIdForCompany(productA.id, compId);
  const prodBFinal = CommerceRepository.getProductByIdForCompany(productB.id, compId);
  assert(prodAFinal?.stock === 8, `Stock final de A debe ser 8, pero es ${prodAFinal?.stock}`);
  assert(prodBFinal?.stock === 7, `Stock final de B debe ser 7, pero es ${prodBFinal?.stock}`);

  // Step 3: Call a third time with the same key -> must return the exact same completed sale without modifying stock
  const cachedSale = await CommerceService.finalizeSale(salePayload);
  assert(cachedSale.id === retrySale.id, 'Tercer llamado debe retornar la misma venta idempotente');
  
  const prodAThird = CommerceRepository.getProductByIdForCompany(productA.id, compId);
  assert(prodAThird?.stock === 8, 'El stock no debe cambiar en llamadas subsecuentes');

  console.log('✅ [PASÓ] UBIKA COMMERCE ROLLBACK + IDEMPOTENCY RETRY TEST');
}

runTest().catch(err => {
  console.error('❌ [FALLÓ] Test rollback idempotency:', err);
  process.exit(1);
});
