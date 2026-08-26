import type { Firestore, Query } from 'firebase-admin/firestore';
import type { RestaurantTable, RestaurantTableStatus } from './types';
import type { RestaurantTableRepository } from './repository';

const TABLES_COLLECTION = 'tables';

function assertCompanyId(companyId: string): void {
  if (!companyId || companyId.trim().length === 0) throw new Error('COMPANY_ID_REQUIRED');
}

function tableCollection(db: Firestore, companyId: string) {
  assertCompanyId(companyId);
  return db.collection('companies').doc(companyId).collection(TABLES_COLLECTION);
}

export class FirestoreRestaurantTableRepository implements RestaurantTableRepository {
  constructor(private readonly db: Firestore) {}

  async create(table: RestaurantTable): Promise<RestaurantTable> {
    assertCompanyId(table.companyId);
    const ref = tableCollection(this.db, table.companyId).doc(table.id);
    if ((await ref.get()).exists) throw new Error('TABLE_ID_ALREADY_EXISTS');
    if (await this.findActiveNumber(table.companyId, table.branchId, table.number)) throw new Error('TABLE_NUMBER_ALREADY_EXISTS');
    if (await this.getByQrToken(table.publicQrToken)) throw new Error('TABLE_QR_TOKEN_ALREADY_EXISTS');
    await ref.create(table);
    return table;
  }

  async getById(companyId: string, tableId: string): Promise<RestaurantTable | null> {
    const snapshot = await tableCollection(this.db, companyId).doc(tableId).get();
    return snapshot.exists ? snapshot.data() as RestaurantTable : null;
  }

  async getByQrToken(token: string): Promise<RestaurantTable | null> {
    if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return null;
    const snapshot = await this.db.collectionGroup(TABLES_COLLECTION)
      .where('publicQrToken', '==', token).limit(1).get();
    if (snapshot.empty) return null;
    const table = snapshot.docs[0].data() as RestaurantTable;
    return table.active ? table : null;
  }

  async list(companyId: string, branchId?: string): Promise<RestaurantTable[]> {
    let query: Query = tableCollection(this.db, companyId).orderBy('number', 'asc');
    if (branchId) query = query.where('branchId', '==', branchId);
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => doc.data() as RestaurantTable);
  }

  async update(
    companyId: string,
    tableId: string,
    patch: Partial<Pick<RestaurantTable, 'number' | 'name' | 'capacity' | 'area' | 'active' | 'publicQrToken' | 'updatedAt'>>,
  ): Promise<RestaurantTable> {
    const ref = tableCollection(this.db, companyId).doc(tableId);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new Error('TABLE_NOT_FOUND');
    const current = snapshot.data() as RestaurantTable;
    if (patch.number !== undefined && patch.number !== current.number &&
        await this.findActiveNumber(companyId, current.branchId, patch.number, tableId)) {
      throw new Error('TABLE_NUMBER_ALREADY_EXISTS');
    }
    if (patch.publicQrToken && patch.publicQrToken !== current.publicQrToken) {
      const duplicate = await this.getByQrToken(patch.publicQrToken);
      if (duplicate && duplicate.id !== tableId) throw new Error('TABLE_QR_TOKEN_ALREADY_EXISTS');
    }
    await ref.update(patch);
    return { ...current, ...patch } as RestaurantTable;
  }

  async setStatus(companyId: string, tableId: string, status: RestaurantTableStatus): Promise<RestaurantTable> {
    return this.update(companyId, tableId, { status });
  }

  private async findActiveNumber(companyId: string, branchId: string | undefined, number: number, excludeTableId?: string): Promise<RestaurantTable | null> {
    let query: Query = tableCollection(this.db, companyId)
      .where('number', '==', number).where('active', '==', true);
    if (branchId) query = query.where('branchId', '==', branchId);
    const snapshot = await query.limit(10).get();
    return snapshot.docs.map((doc) => doc.data() as RestaurantTable)
      .find((table) => table.id !== excludeTableId) ?? null;
  }
}
