import type { DatabaseSchema } from '../db';
import type { SalonDatabaseState } from './local-repository';

/**
 * Adds the Salon tables collection to an existing UBIKA database in a
 * non-destructive way. It never creates demo tables and never removes data.
 */
export function migrateSalonDatabase(db: DatabaseSchema & SalonDatabaseState): boolean {
  if (Array.isArray(db.restaurant_tables)) return false;
  db.restaurant_tables = [];
  return true;
}
