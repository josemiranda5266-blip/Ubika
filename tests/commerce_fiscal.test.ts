import './setup_env';
import 'dotenv/config';
import assert from 'assert';
import { injectTestFixtures } from '../server/db';
import { CommerceRepository } from '../server/commerce/repository';
import { ArcaFiscalService } from '../server/commerce/fiscal';

async function runTest() {
  console.log('====================================================');
  console.log('🔒 TEST: UBIKA COMMERCE ARCA FISCAL SIMULATION');
  console.log('====================================================\n');

  injectTestFixtures();
  const compId = 'comp_fisc_1';

  const sale = CommerceRepository.createSale({
    id: 'sale_fisc_1',
    companyId: compId,
    items: [],
    subtotal: 1000,
    discount: 0,
    surcharge: 0,
    tax: 210,
    total: 1210,
    payments: [],
    status: 'COMPLETED',
    createdBy: 'usr_1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const fiscalResult = await ArcaFiscalService.authorizeSaleInvoice(sale, '20333333339', 'Consumidor Final', 'FACTURA_B');
  assert(fiscalResult.success === true, 'La fiscalización debe ser exitosa');
  assert(fiscalResult.status === 'SIMULATED', 'Sin certificados de producción, el estado debe ser estrictamente SIMULATED');
  assert(fiscalResult.cae?.startsWith('SIMULATED'), 'El CAE simulado debe indicarlo explícitamente');

  console.log('✅ [PASÓ] UBIKA COMMERCE FISCAL TEST EXITOSO');
}

runTest().catch(err => {
  console.error('❌ [FALLÓ] Test Fiscal fallido:', err);
  process.exit(1);
});
