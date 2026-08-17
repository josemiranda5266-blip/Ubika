import './setup_env';
import 'dotenv/config';
import assert from 'assert';
import { injectTestFixtures } from '../server/db';
import { CommerceService } from '../server/commerce/service';

async function runTest() {
  console.log('====================================================');
  console.log('🔒 TEST: UBIKA COMMERCE CASH SESSIONS');
  console.log('====================================================\n');

  injectTestFixtures();
  const compId = `comp_cash_${Date.now()}`;
  const userId = `usr_cash_${Date.now()}`;

  const session = CommerceService.openCashSession(compId, userId, 1000);
  assert(session && session.status === 'OPEN', 'La caja debe abrirse correctamente');
  assert(session.initialCash === 1000, 'El efectivo inicial debe ser 1000');

  const closed = CommerceService.closeCashSession(session.id, compId, 1000, 'Cierre OK', userId, 'COMPANY_ADMIN');
  assert(closed && closed.status === 'CLOSED', 'La caja debe cerrarse correctamente');

  console.log('✅ [PASÓ] UBIKA COMMERCE CASH TEST EXITOSO');
}

runTest().catch(err => {
  console.error('❌ [FALLÓ] Test Cash fallido:', err);
  process.exit(1);
});
