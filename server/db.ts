import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  Company,
  Driver,
  Delivery,
  DeliveryEvent,
  DriverLocation,
  LocationCoords,
  RoutePoint,
  FoodStore,
  FoodCategory,
  FoodProduct,
  FoodShippingRate,
  FoodOrder,
} from '../src/types';

export type UserRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'DISPATCHER' | 'KITCHEN' | 'DRIVER' | 'CLIENT';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  companyId: string;
  driverId?: string;
  phone?: string;
  createdAt: number;
  active: boolean;
}

export interface InvitationRecord {
  id: string;
  email: string;
  tokenHash: string;
  companyId: string;
  role: UserRole;
  expiresAt: number;
  used: boolean;
  usedAt?: number;
  createdAt: number;
}

export interface PasswordResetRecord {
  id: string;
  email: string;
  tokenHash: string;
  expiresAt: number;
  used: boolean;
  usedAt?: number;
  createdAt: number;
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Contraseña requerida' };
  }
  if (password.length < 8) {
    return { valid: false, error: 'La contraseña debe tener al menos 8 caracteres' };
  }
  const weakPasswords = ['password', '12345678', '123456789', 'qwerty123', '123456784', '123456785'];
  if (weakPasswords.includes(password.toLowerCase()) || /^(123456|password|qwerty)/i.test(password)) {
    return { valid: false, error: 'La contraseña es demasiado débil o común. Por favor elija una más segura.' };
  }
  return { valid: true };
}

export interface LocationSessionRecord {
  id: string;
  deliveryId: string;
  companyId: string;
  sessionTokenHash: string;
  createdAt: number;
  expiresAt: number;
  authorizedAt?: number;
  endedAt?: number;
  status: 'ACTIVE' | 'EXPIRED' | 'PURGED' | 'CANCELLED';
  recipientLocation?: LocationCoords | null;
}

export interface DatabaseSchema {
  version: number;
  companies: Company[];
  users: UserRecord[];
  drivers: Driver[];
  deliveries: Delivery[];
  location_sessions: LocationSessionRecord[];
  events: DeliveryEvent[];
  driver_locations: {
    id: string;
    deliveryId?: string;
    driverId: string;
    companyId: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    speed?: number | null;
    timestamp: number;
  }[];
  food_stores?: FoodStore[];
  food_categories?: FoodCategory[];
  food_products?: FoodProduct[];
  food_shipping_rates?: FoodShippingRate[];
  food_orders?: FoodOrder[];
  invitations?: InvitationRecord[];
  password_resets?: PasswordResetRecord[];
  commerce_categories?: any[];
  commerce_products?: any[];
  commerce_customers?: any[];
  commerce_stock_movements?: any[];
  commerce_cash_sessions?: any[];
  commerce_sales?: any[];
  commerce_invoices?: any[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = path.join(DATA_DIR, 'ubika_persistent_db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

let dbState: DatabaseSchema;
let lastBackupTime = 0;

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createBackup(): string | null {
  if (!dbState) return null;
  try {
    const backupFile = path.join(BACKUPS_DIR, `ubika_backup_${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(dbState, null, 2), 'utf-8');
    const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.startsWith('ubika_backup_') && f.endsWith('.json')).sort();
    while (files.length > 10) {
      const oldest = files.shift();
      if (oldest) fs.unlinkSync(path.join(BACKUPS_DIR, oldest));
    }
    return backupFile;
  } catch (err) {
    console.error('[DB Backup Error]:', err);
    return null;
  }
}

function createInitialSeedData(): DatabaseSchema {
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (!adminPassword) {
    return {
      version: 2,
      companies: [], users: [], drivers: [], deliveries: [], location_sessions: [], events: [], driver_locations: [],
      food_stores: [], food_categories: [], food_products: [], food_shipping_rates: [], food_orders: [],
    };
  }

  const salt = bcrypt.genSaltSync(10);
  const adminPasswordHash = bcrypt.hashSync(adminPassword, salt);
  const initialCompany = {
    id: 'comp_default_admin', name: 'Sede Central', category: 'Mensajería y Cadetería' as const,
    address: 'Ubicación Principal', phone: '', city: '', activeOrdersCount: 0, totalDriversCount: 0,
    businessType: 'LOGISTICS' as const, foodEnabled: false,
  };
  const initialAdmin = {
    id: 'usr_admin_master', email: 'admin@ubika.local', passwordHash: adminPasswordHash,
    name: 'Administrador Principal', role: 'SUPER_ADMIN' as const, companyId: 'comp_default_admin', createdAt: Date.now(), active: true,
  };
  return {
    version: 2, companies: [initialCompany], users: [initialAdmin], drivers: [], deliveries: [], location_sessions: [], events: [],
    driver_locations: [], food_stores: [], food_categories: [], food_products: [], food_shipping_rates: [], food_orders: [], invitations: [], password_resets: [],
  };
}

/** Test-only fixture population used by the security and commerce suites. */
export function injectTestFixtures() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('injectTestFixtures() is only available in the test environment');
  }
  const db: any = dbState;
  let changed = false;
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  const driverPassword = process.env.INITIAL_DRIVER_PASSWORD;
  if (!adminPassword || !driverPassword) {
    throw new Error('INITIAL_ADMIN_PASSWORD and INITIAL_DRIVER_PASSWORD are required for test fixtures');
  }
  const salt = bcrypt.genSaltSync(10);
  const adminPasswordHash = bcrypt.hashSync(adminPassword, salt);
  const driverPasswordHash = bcrypt.hashSync(driverPassword, salt);

  if (!db.companies.find((c: any) => c.id === 'comp_ubika_piloto')) {
    db.companies.push({ id: 'comp_ubika_piloto', name: 'UBIKA PILOTO', category: 'Mensajería y Cadetería', address: '', phone: '', city: '', activeOrdersCount: 1, totalDriversCount: 1, businessType: 'LOGISTICS', foodEnabled: false }); changed = true;
  }
  if (!db.companies.find((c: any) => c.id === 'comp_centro_logistico_01')) {
    db.companies.push({ id: 'comp_centro_logistico_01', name: 'Logística Express Centro', category: 'Mensajería y Cadetería', address: '', phone: '', city: '', activeOrdersCount: 2, totalDriversCount: 4, businessType: 'LOGISTICS', foodEnabled: false }); changed = true;
  }
  if (!db.companies.find((c: any) => c.id === 'comp_farma_norte_02')) {
    db.companies.push({ id: 'comp_farma_norte_02', name: 'Farmacia Norte', category: 'Farmacia / Salud', address: '', phone: '', city: '', activeOrdersCount: 0, totalDriversCount: 1, businessType: 'LOGISTICS', foodEnabled: false }); changed = true;
  }
  if (!db.companies.find((c: any) => c.id === 'comp_food_don_pedro_01')) {
    db.companies.push({ id: 'comp_food_don_pedro_01', name: 'Hamburguesería Don Pedro' as any, address: '', phone: '', city: '', activeOrdersCount: 0, totalDriversCount: 0, businessType: 'FOOD', foodEnabled: true }); changed = true;
  }

  const users = [
    { id: 'usr_admin_piloto', email: 'admin@ubikapiloto.com', passwordHash: adminPasswordHash, name: 'ADMIN PILOTO', role: 'COMPANY_ADMIN', companyId: 'comp_ubika_piloto' },
    { id: 'usr_driver_piloto', email: 'driver@ubikapiloto.com', passwordHash: driverPasswordHash, name: 'DRIVER PILOTO', role: 'DRIVER', companyId: 'comp_ubika_piloto', driverId: 'drv_piloto' },
    { id: 'usr_don_pedro_01', email: 'donpedro@ubikafood.com', passwordHash: adminPasswordHash, name: 'Admin Don Pedro', role: 'COMPANY_ADMIN', companyId: 'comp_food_don_pedro_01' },
    { id: 'usr_cocina_don_pedro_01', email: 'cocina@ubikafood.com', passwordHash: adminPasswordHash, name: 'Cocina Don Pedro', role: 'KITCHEN', companyId: 'comp_food_don_pedro_01' },
    { id: 'usr_admin_01', email: 'admin@logisticaexpress.com', passwordHash: adminPasswordHash, name: 'Martín Rodríguez', role: 'COMPANY_ADMIN', companyId: 'comp_centro_logistico_01' },
    { id: 'usr_dispatcher_01', email: 'despacho@logisticaexpress.com', passwordHash: adminPasswordHash, name: 'Ana Gómez', role: 'DISPATCHER', companyId: 'comp_centro_logistico_01' },
    { id: 'usr_admin_farma_02', email: 'admin@farmanorte.com', passwordHash: adminPasswordHash, name: 'Administrador Farma Norte', role: 'COMPANY_ADMIN', companyId: 'comp_farma_norte_02' },
    { id: 'usr_driver_farma_01', email: 'esteban@farmanorte.com', passwordHash: driverPasswordHash, name: 'Esteban Morales', role: 'DRIVER', companyId: 'comp_farma_norte_02', driverId: 'drv_farma_01' },
  ];
  for (const user of users) {
    if (!db.users.find((u: any) => u.id === user.id)) {
      db.users.push({ ...user, createdAt: Date.now(), active: true });
      changed = true;
    }
  }

  if (!db.drivers.find((d: any) => d.id === 'drv_piloto')) {
    db.drivers.push({ id: 'drv_piloto', companyId: 'comp_ubika_piloto', name: 'DRIVER PILOTO', email: 'driver@ubikapiloto.com', phone: '', vehicle: 'moto', status: 'disponible', internalId: 'PILOTO-01', createdAt: Date.now(), totalDeliveries: 0, rating: 5, lastActiveAt: Date.now(), speedKmH: 0 }); changed = true;
  }
  if (!db.drivers.find((d: any) => d.id === 'drv_farma_01')) {
    db.drivers.push({ id: 'drv_farma_01', companyId: 'comp_farma_norte_02', name: 'Esteban Morales', email: 'esteban@farmanorte.com', phone: '', vehicle: 'moto', status: 'disponible', internalId: 'F-01', createdAt: Date.now(), totalDeliveries: 10, rating: 4.8, lastActiveAt: Date.now(), speedKmH: 0 }); changed = true;
  }
  if (!db.drivers.find((d: any) => d.id === 'drv_don_pedro_01')) {
    db.drivers.push({ id: 'drv_don_pedro_01', companyId: 'comp_food_don_pedro_01', name: 'Cadete Pedro Jr', email: 'pedrojr@ubikafood.com', phone: '', vehicle: 'moto', status: 'disponible', internalId: 'DP-01', createdAt: Date.now(), totalDeliveries: 15, rating: 5.0, lastActiveAt: Date.now(), speedKmH: 0 }); changed = true;
  }

  db.food_stores = db.food_stores || [];
  if (!db.food_stores.find((s: any) => s.companyId === 'comp_food_don_pedro_01')) { db.food_stores.push({ companyId: 'comp_food_don_pedro_01', name: 'Hamburguesería Don Pedro', description: 'Burgers', address: 'Av Belgrano', phone: '', whatsappNumber: '', isOpenManual: true as any }); changed = true; }
  db.food_categories = db.food_categories || [];
  if (!db.food_categories.find((c: any) => c.id === 'cat_burgers')) { db.food_categories.push({ id: 'cat_burgers', companyId: 'comp_food_don_pedro_01', name: 'HAMBURGUESAS', description: '', displayOrder: 1, active: true }); changed = true; }
  db.food_products = db.food_products || [];
  if (!db.food_products.find((p: any) => p.id === 'prod_burg_clasica')) { db.food_products.push({ id: 'prod_burg_clasica', companyId: 'comp_food_don_pedro_01', categoryId: 'cat_burgers', name: 'Hamburguesa Clásica', description: 'Carne, queso', price: 8000, isAvailable: true, displayOrder: 1, imageUrl: '' }); changed = true; }
  db.food_shipping_rates = db.food_shipping_rates || [];
  if (!db.food_shipping_rates.find((r: any) => r.companyId === 'comp_food_don_pedro_01')) { db.food_shipping_rates.push({ companyId: 'comp_food_don_pedro_01', baseFee: 1500, perKmFee: 200, includedKm: 0, maxDistanceKm: 10, storeLatitude: -34.6, storeLongitude: -58.4 }); changed = true; }
  db.food_orders = db.food_orders || [];
  if (!db.food_orders.find((o: any) => o.orderNumber === 1075)) { db.food_orders.push({ id: 'forder_1075_dp_seed', orderNumber: 1075, companyId: 'comp_food_don_pedro_01', deliveryType: 'FOOD_PICKUP', items: [{ productId: 'prod_burg_clasica', productName: 'Hamburguesa Clásica', quantity: 1, unitPrice: 8000, selectedOptions: [], totalPrice: 8000 }], subtotal: 8000, shippingCost: 0, totalAmount: 8000, recipientName: 'Lucas Morales', recipientPhone: '+54 9 11 5555-1075', paymentMethod: 'CASH', paymentStatus: 'PENDING', pickupCode: 'DP107', publicTrackingToken: 'tr_food_demo_1075_don_pedro', orderStatus: 'PENDING', createdAt: Date.now() - 3600000, updatedAt: Date.now() - 3600000 }); changed = true; }

  if (changed) saveDatabaseSync();
}

function runFoodMigration(db: DatabaseSchema): boolean {
  let changed = false;
  db.food_stores = db.food_stores || [];
  db.food_categories = db.food_categories || [];
  db.food_products = db.food_products || [];
  db.food_shipping_rates = db.food_shipping_rates || [];
  db.food_orders = db.food_orders || [];
  if ((db.version || 1) < 2) { db.version = 2; changed = true; }
  return changed;
}

export function loadDatabase(): DatabaseSchema {
  if (dbState) return dbState;
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (!adminPassword) throw new Error('INITIAL_ADMIN_PASSWORD is required. Please set this environment variable.');

  if (fs.existsSync(DB_FILE)) {
    let raw: string;
    try { raw = fs.readFileSync(DB_FILE, 'utf-8'); }
    catch (readErr: any) { console.error(`[DB FATAL ERROR] No se pudo leer el archivo existente de base de datos en ${DB_FILE}:`, readErr); throw new Error(`FATAL_DB_READ_ERROR: Archivo existente en ${DB_FILE} no puede ser leído: ${readErr.message}`); }
    try { dbState = JSON.parse(raw); }
    catch (parseErr: any) { console.error(`[DB FATAL ERROR] Archivo de base de datos existente en ${DB_FILE} está corrupto y no pudo ser parseado como JSON. No se sobrescribirá para proteger los datos existentes.`); throw new Error(`FATAL_DB_CORRUPTED: El archivo existente en ${DB_FILE} está corrupto. Inicialización detenida para preservar datos.`); }
    if (!dbState || typeof dbState !== 'object' || !Array.isArray(dbState.users) || !Array.isArray(dbState.companies)) throw new Error(`FATAL_DB_INVALID_STRUCTURE: Archivo en ${DB_FILE} no posee estructura de base de datos válida.`);
    dbState.food_stores = dbState.food_stores || [];
    dbState.food_categories = dbState.food_categories || [];
    dbState.food_products = dbState.food_products || [];
    dbState.food_shipping_rates = dbState.food_shipping_rates || [];
    dbState.food_orders = dbState.food_orders || [];
    dbState.invitations = dbState.invitations || [];
    dbState.password_resets = dbState.password_resets || [];
    dbState.commerce_categories = dbState.commerce_categories || [];
    dbState.commerce_products = dbState.commerce_products || [];
    dbState.commerce_customers = dbState.commerce_customers || [];
    dbState.commerce_stock_movements = dbState.commerce_stock_movements || [];
    dbState.commerce_cash_sessions = dbState.commerce_cash_sessions || [];
    dbState.commerce_sales = dbState.commerce_sales || [];
    dbState.commerce_invoices = dbState.commerce_invoices || [];
    if (runFoodMigration(dbState)) saveDatabaseSync();
    console.log(`[DB] Base de datos persistente cargada con éxito desde ${DB_FILE}`);
    return dbState;
  }
  dbState = createInitialSeedData();
  saveDatabaseSync();
  console.log(`[DB] Archivo de persistencia inicial creado en ${DB_FILE}`);
  return dbState;
}

export function saveDatabaseSync(): void {
  if (!dbState) return;
  const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tempFile, JSON.stringify(dbState, null, 2), 'utf-8');
  fs.renameSync(tempFile, DB_FILE);
  const now = Date.now();
  if (now - lastBackupTime > 30 * 60 * 1000) { lastBackupTime = now; createBackup(); }
}

loadDatabase();

export const db = {
  getCompanyById: (companyId: string): Company | undefined => dbState.companies.find((c) => c.id === companyId),
  getAllCompanies: (): Company[] => dbState.companies,
  createCompany: (company: Company): Company => { dbState.companies.push(company); saveDatabaseSync(); return company; },
  updateCompany: (companyId: string, updates: Partial<Company>): Company | null => { const idx = dbState.companies.findIndex((c) => c.id === companyId); if (idx === -1) return null; dbState.companies[idx] = { ...dbState.companies[idx], ...updates }; saveDatabaseSync(); return dbState.companies[idx]; },
  getUserByEmail: (email: string): UserRecord | undefined => dbState.users.find((u) => u.email.toLowerCase() === email.toLowerCase()),
  getUserById: (userId: string): UserRecord | undefined => dbState.users.find((u) => u.id === userId),
  getUsersByCompany: (companyId: string): UserRecord[] => dbState.users.filter((u) => u.companyId === companyId),
  createUser: (user: UserRecord): UserRecord => { dbState.users.push(user); saveDatabaseSync(); return user; },
  updateUser: (userId: string, updates: Partial<UserRecord>): UserRecord | null => { const idx = dbState.users.findIndex((u) => u.id === userId); if (idx === -1) return null; dbState.users[idx] = { ...dbState.users[idx], ...updates }; saveDatabaseSync(); return dbState.users[idx]; },
  createInvitation: (inv: InvitationRecord): InvitationRecord => { dbState.invitations = dbState.invitations || []; dbState.invitations.forEach(i => { if (i.email.toLowerCase() === inv.email.toLowerCase() && !i.used) { i.used = true; i.usedAt = Date.now(); } }); dbState.invitations.push(inv); saveDatabaseSync(); return inv; },
  getInvitationByHash: (hash: string): InvitationRecord | undefined => (dbState.invitations || []).find((i) => i.tokenHash === hash),
  updateInvitation: (id: string, updates: Partial<InvitationRecord>): InvitationRecord | null => { const idx = (dbState.invitations || []).findIndex((i) => i.id === id); if (idx === -1) return null; dbState.invitations![idx] = { ...dbState.invitations![idx], ...updates }; saveDatabaseSync(); return dbState.invitations![idx]; },
  createPasswordReset: (pr: PasswordResetRecord): PasswordResetRecord => { dbState.password_resets = dbState.password_resets || []; dbState.password_resets.forEach(p => { if (p.email.toLowerCase() === pr.email.toLowerCase() && !p.used) { p.used = true; p.usedAt = Date.now(); } }); dbState.password_resets.push(pr); saveDatabaseSync(); return pr; },
  getPasswordResetByHash: (hash: string): PasswordResetRecord | undefined => (dbState.password_resets || []).find((p) => p.tokenHash === hash),
  updatePasswordReset: (id: string, updates: Partial<PasswordResetRecord>): PasswordResetRecord | null => { const idx = (dbState.password_resets || []).findIndex((p) => p.id === id); if (idx === -1) return null; dbState.password_resets![idx] = { ...dbState.password_resets![idx], ...updates }; saveDatabaseSync(); return dbState.password_resets![idx]; },
  getDriversByCompany: (companyId: string): Driver[] => dbState.drivers.filter((d) => d.companyId === companyId),
  getDriverById: (driverId: string): Driver | undefined => dbState.drivers.find((d) => d.id === driverId),
  createDriver: (driver: Driver): Driver => { dbState.drivers.push(driver); saveDatabaseSync(); return driver; },
  updateDriver: (driverId: string, updates: Partial<Driver>): Driver | null => { const idx = dbState.drivers.findIndex((d) => d.id === driverId); if (idx === -1) return null; dbState.drivers[idx] = { ...dbState.drivers[idx], ...updates }; saveDatabaseSync(); return dbState.drivers[idx]; },
  getDeliveriesByCompany: (companyId: string): Delivery[] => dbState.deliveries.filter((d) => d.companyId === companyId),
  getDeliveriesByDriver: (driverId: string): Delivery[] => dbState.deliveries.filter((d) => d.driverId === driverId),
  getDeliveryById: (deliveryId: string): Delivery | undefined => dbState.deliveries.find((d) => d.id === deliveryId),
  createDelivery: (delivery: Delivery): Delivery => { dbState.deliveries.unshift(delivery); saveDatabaseSync(); return delivery; },
  updateDelivery: (deliveryId: string, updates: Partial<Delivery>): Delivery | null => { const idx = dbState.deliveries.findIndex((d) => d.id === deliveryId); if (idx === -1) return null; dbState.deliveries[idx] = { ...dbState.deliveries[idx], ...updates }; saveDatabaseSync(); return dbState.deliveries[idx]; },
  createLocationSession: (session: LocationSessionRecord): LocationSessionRecord => { dbState.location_sessions.push(session); saveDatabaseSync(); return session; },
  getSessionByToken: (token: string): LocationSessionRecord | undefined => dbState.location_sessions.find((s) => s.sessionTokenHash === hashToken(token)),
  updateSession: (id: string, updates: Partial<LocationSessionRecord>): LocationSessionRecord | null => { const idx = dbState.location_sessions.findIndex((s) => s.id === id); if (idx === -1) return null; dbState.location_sessions[idx] = { ...dbState.location_sessions[idx], ...updates }; saveDatabaseSync(); return dbState.location_sessions[idx]; },
  getEventsByCompany: (companyId: string): DeliveryEvent[] => dbState.events.filter((e) => (e as any).companyId === companyId).sort((a, b) => b.timestamp - a.timestamp),
  getEventsByDelivery: (deliveryId: string): DeliveryEvent[] => dbState.events.filter((e) => e.deliveryId === deliveryId).sort((a, b) => a.timestamp - b.timestamp),
  createEvent: (event: DeliveryEvent): DeliveryEvent => { dbState.events.unshift(event); saveDatabaseSync(); return event; },
  recordDriverLocation: (record: { driverId: string; deliveryId?: string; companyId: string; latitude: number; longitude: number; accuracy: number; speed?: number | null; timestamp: number }): void => { dbState.driver_locations.push({ id: `loc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, ...record }); if (dbState.driver_locations.length > 5000) dbState.driver_locations = dbState.driver_locations.slice(-3000); saveDatabaseSync(); },
  getDriverLocationHistory: (driverId: string, since?: number) => dbState.driver_locations.filter((l) => l.driverId === driverId && (!since || l.timestamp >= since)).sort((a, b) => a.timestamp - b.timestamp),
  getFoodStoreByCompanyId: (companyId: string): FoodStore | undefined => (dbState.food_stores || []).find((s) => s.companyId === companyId),
  upsertFoodStore: (store: FoodStore): FoodStore => { if (!dbState.food_stores) dbState.food_stores = []; const idx = dbState.food_stores.findIndex((s) => s.companyId === store.companyId); if (idx === -1) dbState.food_stores.push(store); else dbState.food_stores[idx] = { ...dbState.food_stores[idx], ...store, updatedAt: Date.now() }; saveDatabaseSync(); return store; },
  getFoodCategoriesByCompanyId: (companyId: string): FoodCategory[] => (dbState.food_categories || []).filter((c) => c.companyId === companyId).sort((a, b) => { const orderA = a.displayOrder ?? a.sortOrder ?? 999; const orderB = b.displayOrder ?? b.sortOrder ?? 999; return orderA !== orderB ? orderA - orderB : (a.createdAt || 0) - (b.createdAt || 0); }),
  createFoodCategory: (category: FoodCategory): FoodCategory => { if (!dbState.food_categories) dbState.food_categories = []; const newCategory: FoodCategory = { ...category, displayOrder: category.displayOrder ?? category.sortOrder ?? 1, active: category.active !== undefined ? category.active : (category.isActive !== undefined ? category.isActive : true), createdAt: category.createdAt || Date.now(), updatedAt: Date.now() }; dbState.food_categories.push(newCategory); saveDatabaseSync(); return newCategory; },
  updateFoodCategory: (id: string, updates: Partial<FoodCategory>): FoodCategory | null => { if (!dbState.food_categories) return null; const idx = dbState.food_categories.findIndex((c) => c.id === id); if (idx === -1) return null; dbState.food_categories[idx] = { ...dbState.food_categories[idx], ...updates, updatedAt: Date.now() }; saveDatabaseSync(); return dbState.food_categories[idx]; },
  deleteFoodCategory: (id: string): boolean => { if (!dbState.food_categories) return false; const initialLen = dbState.food_categories.length; dbState.food_categories = dbState.food_categories.filter((c) => c.id !== id); const deleted = dbState.food_categories.length < initialLen; if (deleted) saveDatabaseSync(); return deleted; },
  getFoodProductsByCompanyId: (companyId: string): FoodProduct[] => (dbState.food_products || []).filter((p) => p.companyId === companyId).sort((a, b) => a.displayOrder - b.displayOrder),
  getFoodProductById: (productId: string): FoodProduct | undefined => (dbState.food_products || []).find((p) => p.id === productId),
  createFoodProduct: (product: FoodProduct): FoodProduct => { if (!dbState.food_products) dbState.food_products = []; dbState.food_products.push(product); saveDatabaseSync(); return product; },
  updateFoodProduct: (productId: string, updates: Partial<FoodProduct>): FoodProduct | null => { if (!dbState.food_products) return null; const idx = dbState.food_products.findIndex((p) => p.id === productId); if (idx === -1) return null; dbState.food_products[idx] = { ...dbState.food_products[idx], ...updates }; saveDatabaseSync(); return dbState.food_products[idx]; },
  deleteFoodProduct: (productId: string): boolean => { if (!dbState.food_products) return false; const initialLen = dbState.food_products.length; dbState.food_products = dbState.food_products.filter((p) => p.id !== productId); const deleted = dbState.food_products.length < initialLen; if (deleted) saveDatabaseSync(); return deleted; },
  getFoodShippingRateByCompanyId: (companyId: string): FoodShippingRate | undefined => (dbState.food_shipping_rates || []).find((r) => r.companyId === companyId),
  upsertFoodShippingRate: (rate: FoodShippingRate): FoodShippingRate => { if (!dbState.food_shipping_rates) dbState.food_shipping_rates = []; const idx = dbState.food_shipping_rates.findIndex((r) => r.companyId === rate.companyId); if (idx === -1) dbState.food_shipping_rates.push(rate); else dbState.food_shipping_rates[idx] = { ...dbState.food_shipping_rates[idx], ...rate }; saveDatabaseSync(); return rate; },
  getFoodOrdersByCompanyId: (companyId: string): FoodOrder[] => (dbState.food_orders || []).filter((o) => o.companyId === companyId).sort((a, b) => b.createdAt - a.createdAt),
  getFoodOrderById: (orderId: string): FoodOrder | undefined => (dbState.food_orders || []).find((o) => o.id === orderId),
  getFoodOrderByPickupCode: (pickupCode: string): FoodOrder | undefined => (dbState.food_orders || []).find((o) => o.pickupCode === pickupCode),
  createFoodOrder: (order: FoodOrder): FoodOrder => { if (!dbState.food_orders) dbState.food_orders = []; dbState.food_orders.unshift(order); saveDatabaseSync(); return order; },
  updateFoodOrder: (orderId: string, updates: Partial<FoodOrder>): FoodOrder | null => { if (!dbState.food_orders) return null; const idx = dbState.food_orders.findIndex((o) => o.id === orderId); if (idx === -1) return null; dbState.food_orders[idx] = { ...dbState.food_orders[idx], ...updates, updatedAt: Date.now() }; saveDatabaseSync(); return dbState.food_orders[idx]; },
  createBackup: (): string => { saveDatabaseSync(); const backupFileName = `ubika_backup_${Date.now()}.json`; const backupPath = path.join(DATA_DIR, backupFileName); fs.copyFileSync(DB_FILE, backupPath); return backupFileName; },
  getRawState: (): DatabaseSchema => dbState,
  reloadFromDisk: (): DatabaseSchema => { dbState = undefined as any; return loadDatabase(); },
};
