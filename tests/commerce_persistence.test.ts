import './setup_env';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { injectTestFixtures, db, saveDatabaseSync } from '../server/db';
import { CommerceRepository } from '../server/commerce/repository';
import { CommerceService } from '../server/commerce/service';

const DB_FILE = path.join(process.cwd(), 'data', 'ubika_persistent_db.json');

async function runTest() {
  console.log('====================================================');
  console.log('🔒 TEST: UBIKA COMMERCE FULL PERSISTENCE & CORRUPTION SHIELD');
  console.log('====================================================\n');

  injectTestFixtures();
  const compId = 'comp_pers_1';

  // 1. Create entities across all modules
  // A) Category & Product
  const cat = CommerceRepository.createCategory({
    id: 'cat_pers_1',
    companyId: compId,
    name: 'Categoría Persistencia',
    description: 'Cat desc',
    createdAt: Date.now(),
  });

  const prod = CommerceRepository.createProduct({
    id: 'prod_pers_1',
    companyId: compId,
    name: 'Producto Persistencia',
    code: 'SKU-PERS-1',
    barcode: '779000000888',
    salePrice: 250,
    costPrice: 100,
    stock: 40,
    minStock: 5,
    maxStock: 100,
    taxRate: 21,
    categoryId: cat.id,
    status: 'ACTIVE',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // B) Cash session
  const cash = CommerceRepository.createCashSession({
    id: 'cash_pers_1',
    companyId: compId,
    userId: 'usr_1',
    openedAt: Date.now(),
    initialCash: 15000,
    status: 'OPEN',
  });

  // C) Sale
  const sale = CommerceRepository.createSale({
    id: 'sale_pers_1',
    companyId: compId,
    cashSessionId: cash.id,
    items: [{
      productId: prod.id,
      productName: prod.name,
      quantity: 2,
      unitPrice: 250,
      discount: 0,
      taxRate: 21,
      subtotal: 500,
      total: 605,
    }],
    subtotal: 500,
    discount: 0,
    surcharge: 0,
    tax: 105,
    total: 605,
    payments: [{
      id: 'pay_pers_1',
      method: 'CASH',
      amount: 605,
      status: 'COMPLETED',
      createdAt: Date.now(),
    }],
    status: 'COMPLETED',
    idempotencyKey: 'idem_pers_1',
    createdBy: 'usr_1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // D) Stock Movement
  const mov = CommerceRepository.createStockMovement({
    id: 'mov_pers_1',
    productId: prod.id,
    companyId: compId,
    type: 'SALIDA',
    quantity: 2,
    previousStock: 42,
    newStock: 40,
    reason: `Venta #${sale.id}`,
    userId: 'usr_1',
    createdAt: Date.now(),
  });

  // E) Invoice
  const invoice = CommerceRepository.createInvoice({
    id: 'inv_pers_1',
    saleId: sale.id,
    companyId: compId,
    voucherType: 'FACTURA_B',
    pointOfSale: 1,
    invoiceNumber: 1001,
    cuit: '20333333339',
    customerName: 'Cliente Persistente',
    customerDocument: '20333333339',
    subtotal: 500,
    tax: 105,
    total: 605,
    cae: 'SIMULATED_CAE_TEST',
    caeExpiration: '2026-12-31',
    status: 'SIMULATED',
    createdAt: Date.now(),
  });

  // Save database explicitly to disk
  saveDatabaseSync();

  // Reload database cleanly from disk
  const reloadedState = db.reloadFromDisk();

  // Verify all entities exist in reloaded state
  const reloadedProd = CommerceRepository.getProductByIdForCompany(prod.id, compId);
  assert(reloadedProd !== undefined, 'Producto debe persistir en disco');
  assert(reloadedProd?.name === 'Producto Persistencia', 'Datos de producto deben coincidir');
  assert(reloadedProd?.stock === 40, 'Stock de producto debe coincidir');

  const reloadedSale = CommerceRepository.getSaleByIdForCompany(sale.id, compId);
  assert(reloadedSale !== undefined, 'Venta debe persistir en disco');
  assert(reloadedSale?.total === 605, 'Total de venta debe coincidir');

  const reloadedMovs = CommerceRepository.getStockMovementsByCompany(compId);
  const reloadedMov = reloadedMovs.find(m => m.id === mov.id);
  assert(reloadedMov !== undefined, 'Movimiento de stock debe persistir en disco');
  assert(reloadedMov?.newStock === 40, 'Nuevo stock en movimiento debe coincidir');

  const reloadedCash = CommerceRepository.getCashSessionByIdForCompany(cash.id, compId);
  assert(reloadedCash !== undefined, 'Sesión de caja debe persistir en disco');
  assert(reloadedCash?.initialCash === 15000, 'Monto inicial de caja debe coincidir');

  const reloadedInvoices = CommerceRepository.getInvoicesByCompany(compId);
  const reloadedInv = reloadedInvoices.find(i => i.id === invoice.id);
  assert(reloadedInv !== undefined, 'Factura debe persistir en disco');
  assert(reloadedInv?.cae === 'SIMULATED_CAE_TEST', 'CAE de factura debe coincidir');

  console.log('✅ A-G) Todas las entidades persistieron y fueron verificadas tras reloadFromDisk()');

  // Backup current valid content for restore
  const validJsonContent = fs.readFileSync(DB_FILE, 'utf-8');

  // Test Corrupt DB file handling
  const corruptedContent = '<<<INVALID_CORRUPTED_JSON_DATA_HEADER\n{"users": [corrupt';
  fs.writeFileSync(DB_FILE, corruptedContent, 'utf-8');

  try {
    db.reloadFromDisk();
    assert.fail('El servidor debió lanzar un ERROR FATAL y detenerse ante un archivo de BD corrupto');
  } catch (fatalErr: any) {
    assert(
      fatalErr.message.includes('FATAL_DB_CORRUPTED') || fatalErr.message.includes('corrupto'),
      `Error esperado capturado: ${fatalErr.message}`
    );
  }

  // Verify corrupt file was preserved and NOT silently overwritten
  const diskAfterFatal = fs.readFileSync(DB_FILE, 'utf-8');
  assert(diskAfterFatal === corruptedContent, 'El archivo corrupto debe preservarse intacto sin ser sobrescrito');

  // Restore valid DB
  fs.writeFileSync(DB_FILE, validJsonContent, 'utf-8');
  db.reloadFromDisk();

  console.log('✅ H) Blindaje de corrupción verificado: Error fatal lanzado y archivo protegido');
  console.log('✅ [PASÓ] UBIKA COMMERCE PERSISTENCE TEST');
}

runTest().catch(err => {
  console.error('❌ [FALLÓ] Test persistence:', err);
  process.exit(1);
});
