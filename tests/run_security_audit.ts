// Preload test-only persistence fixtures before importing the audit suite.
// This avoids ESM dependency evaluation loading server/db before setup_env writes fixtures.
import './setup_env';
import './ensure_audit_fixtures';

await import('./security_and_flow.test');
