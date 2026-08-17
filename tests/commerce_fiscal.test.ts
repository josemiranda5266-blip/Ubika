import './setup_env';
import 'dotenv/config';
import assert from 'assert';
import { injectTestFixtures } from '../server/db';
import { CommerceRepository } from '../server/commerce/repository';
import { ArcaFiscalService } from '../server/commerce/fiscal';

async function runTest() {
  console.log('====================================================');
  console.log('🔒 TEST: UBIKA COMMERCE ARCA FISCAL WSFE BLOCK');
  console.log('====================================================\n');

  injectTestFixtures();
  const compId = 'comp_fisc_1';

  // Configure dummy/mock certificates in env
  process.env.ARCA_CERT = '-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAP...DUMMY_CERT...\n-----END CERTIFICATE-----';
  process.env.ARCA_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...DUMMY_KEY...\n-----END RSA PRIVATE KEY-----';

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
  
  // Strict assertions per audit guidelines
  assert(fiscalResult.status !== 'APPROVED', 'NUNCA debe devolver status = APPROVED sin WSFE real');
  assert(fiscalResult.status === 'SIMULATED', 'El estado debe ser estrictamente SIMULATED');
  assert(fiscalResult.cae === undefined, 'NUNCA debe generar o presentar un CAE falso o aleatorio');
  assert(fiscalResult.caeExpiration === undefined, 'No debe generar fecha de vencimiento de CAE falso');
  assert(fiscalResult.response?.error === 'ARCA_WSFE_NOT_CONFIGURED', 'La respuesta debe indicar ARCA_WSFE_NOT_CONFIGURED');

  console.log('✅ [PASÓ] UBIKA COMMERCE ARCA FISCAL WSFE BLOCK TEST');
}

runTest().catch(err => {
  console.error('❌ [FALLÓ] Test Fiscal fallido:', err);
  process.exit(1);
});
