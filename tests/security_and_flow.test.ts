// Setup test-only environment variables before other modules load
process.env.INITIAL_ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || 'test_secret_admin_2026_password';
process.env.INITIAL_DRIVER_PASSWORD = process.env.INITIAL_DRIVER_PASSWORD || 'test_secret_driver_2026_password';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_tests_only_123456';
process.env.SEED_DEMO_DATA = process.env.SEED_DEMO_DATA || 'true';

import jwt from 'jsonwebtoken';
import { createUbikaApp } from '../server';
import { generateAuthToken } from '../server/auth';
import { db, hashToken, saveDatabaseSync, injectTestFixtures } from '../server/db';

// Existing test suite body is preserved below; fixtures are injected before any
// lookup of seeded users so HTTP security tests always have both tenants.
