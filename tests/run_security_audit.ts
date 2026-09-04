// Preload test-only persistence fixtures before importing the audit suite.
// Then materialize them through the DB module and reload from disk so the audit
// always observes the exact same tenant fixtures in memory.
import './setup_env';
import './ensure_audit_fixtures';

const { db, injectTestFixtures } = await import('../server/db');
injectTestFixtures();
db.reloadFromDisk();

await import('./security_and_flow.test');
