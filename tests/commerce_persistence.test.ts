import './setup_env';
import 'dotenv/config';
import assert from 'assert';
import { injectTestFixtures, saveDatabaseSync } from '../server/db';

async function runTest() {
  injectTestFixtures();
  
  try {
    saveDatabaseSync();
    assert(true, 'saveDatabaseSync completado exitosamente');
  } catch (err) {
    assert.fail(`La persistencia falló: ${err}`);
  }

  console.log('✅ [PASÓ] UBIKA COMMERCE PERSISTENCE TEST');
}

runTest().catch(err => {
  console.error('❌ [FALLÓ] Test persistence:', err);
  process.exit(1);
});
