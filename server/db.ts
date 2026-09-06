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
import { WithdrawalRequest } from './legal/types';

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
  privacyPolicyAccepted: boolean;
  privacyPolicyAcceptedAt: number;
  termsOfServiceAccepted: boolean;
  termsOfServiceAcceptedAt?: number;
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
  if (!password || typeof password !== 'string') return { valid: false, error: 'Contraseña requerida' };
  if (password.length < 8) return { valid: false, error: 'La contraseña debe tener al menos 8 caracteres' };
  const weakPasswords = ['password', '12345678', '123456789', 'qwerty123', '123456784', '123456785'];
  if (weakPasswords.includes(password.toLowerCase()) || /^(123456|password|qwerty)/i.test(password)) return { valid: false, error: 'La contraseña es demasiado débil o común. Por favor elija una más segura.' };
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
  driver_locations: { id: string; deliveryId?: string; driverId: string; companyId: string; latitude: number; longitude: number; accuracy: number; speed?: number | null; timestamp: number; }[];
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
  withdrawal_requests?: WithdrawalRequest[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = path.join(DATA_DIR, 'ubika_persistent_db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

let dbState: DatabaseSchema;
let lastBackupTime = 0;

export function hashToken(token: string): string { return crypto.createHash('sha256').update(token).digest('hex'); }

export function createBackup(): string | null {
  if (!dbState) return null;
  try {
    const backupFile = path.join(BACKUPS_DIR, `ubika_backup_${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(dbState, null, 2), 'utf-8');
    const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.startsWith('ubika_backup_') && f.endsWith('.json')).sort();
    while (files.length > 10) { const oldest = files.shift(); if (oldest) fs.unlinkSync(path.join(BACKUPS_DIR, oldest)); }
    return backupFile;
  } catch (err) { console.error('[DB Backup Error]:', err); return null; }
}

function createInitialSeedData(): DatabaseSchema {
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (!adminPassword) return { version: 2, companies: [], users: [], drivers: [], deliveries: [], location_sessions: [], events: [], driver_locations: [], food_stores: [], food_categories: [], food_products: [], food_shipping_rates: [], food_orders: [] };
  const salt = bcrypt.genSaltSync(10);
  const adminPasswordHash = bcrypt.hashSync(adminPassword, salt);
  const initialCompany = { id: 'comp_default_admin', name: 'Sede Central', category: 'Mensajería y Cadetería' as const, address: 'Ubicación Principal', phone: '', city: '', activeOrdersCount: 0, totalDriversCount: 0, businessType: 'LOGISTICS' as const, foodEnabled: false };
  const initialAdmin = { id: 'usr_admin_master', email: 'admin@ubika.local', passwordHash: adminPasswordHash, name: 'Administrador Principal', role: 'SUPER_ADMIN' as const, companyId: 'comp_default_admin', createdAt: Date.now(), active: true, privacyPolicyAccepted: true, privacyPolicyAcceptedAt: Date.now(), termsOfServiceAccepted: true, termsOfServiceAcceptedAt: Date.now() };
  return { version: 2, companies: [initialCompany], users: [initialAdmin], drivers: [], deliveries: [], location_sessions: [], events: [], driver_locations: [], food_stores: [], food_categories: [], food_products: [], food_shipping_rates: [], food_orders: [], invitations: [], password_resets: [] };
}

// @ts-ignore
export function injectTestFixtures() {
  // @ts-ignore
  const db: any = dbState;
  let changed = false;
  const adminPassword = process.env['INITIAL_ADMIN_PASSWORD'] || 'test';
  const driverPassword = process.env['INITIAL_DRIVER_PASSWORD'] || 'test';
  const salt = bcrypt.genSaltSync(10);
  const adminPasswordHash = bcrypt.hashSync(adminPassword, salt);
  const driverPasswordHash = bcrypt.hashSync(driverPassword, salt);
  if (!db.companies.find(c => c.id === 'comp_ubika_piloto')) { db.companies.push({ id: 'comp_ubika_piloto', name: 'UBIKA PILOTO', category: 'Mensajería y Cadetería', address: '', phone: '', city: '', activeOrdersCount: 1, totalDriversCount: 1, businessType: 'LOGISTICS', foodEnabled: false }); changed = true; }
  if (!db.companies.find(c => c.id === 'comp_centro_logistico_01')) { db.companies.push({ id: 'comp_centro_logistico_01', name: 'Logística Express Centro', category: 'Mensajería y Cadetería', address: '', phone: '', city: '', activeOrdersCount: 2, totalDriversCount: 4, businessType: 'LOGISTICS', foodEnabled: false }); changed = true; }
  if (!db.companies.find(c => c.id === 'comp_farma_norte_02')) { db.companies.push({ id: 'comp_farma_norte_02', name: 'Farmacia Norte', category: 'Farmacia / Salud', address: '', phone: '', city: '', activeOrdersCount: 0, totalDriversCount: 1, businessType: 'LOGISTICS', foodEnabled: false }); changed = true; }
  if (!db.companies.find(c => c.id === 'comp_food_don_pedro_01')) { db.companies.push({ id: 'comp_food_don_pedro_01', name: 'Hamburguesería Don Pedro' as any, address: '', phone: '', city: '', activeOrdersCount: 0, totalDriversCount: 0, businessType: 'FOOD', foodEnabled: true }); changed = true; }
  if (!db.users.find(u => u.id === 'usr_admin_piloto')) { db.users.push({ id: 'usr_admin_piloto', email: 'admin@ubikapiloto.com', passwordHash: adminPasswordHash, name: 'ADMIN PILOTO', role: 'COMPANY_ADMIN', companyId: 'comp_ubika_piloto', createdAt: Date.now(), active: true }); changed = true; }
  if (!db.users.find(u => u.id === 'usr_driver_piloto')) { db.users.push({ id: 'usr_driver_piloto', email: 'driver@ubikapiloto.com', passwordHash: driverPasswordHash, name: 'DRIVER PILOTO', role: 'DRIVER', companyId: 'comp_ubika_piloto', driverId: 'drv_piloto', createdAt: Date.now(), active: true }); changed = true; }
  if (!db.users.find(u => u.id === 'usr_don_pedro_01')) { db.users.push({ id: 'usr_don_pedro_01', email: 'donpedro@ubikafood.com', passwordHash: adminPasswordHash, name: 'Admin Don Pedro', role: 'COMPANY_ADMIN', companyId: 'comp_food_don_pedro_01', createdAt: Date.now(), active: true }); changed = true; }
  if (!db.users.find(u => u.id === 'usr_cocina_don_pedro_01')) { db.users.push({ id: 'usr_cocina_don_pedro_01', email: 'cocina@ubikafood.com', passwordHash: adminPasswordHash, name: 'Cocina Don Pedro', role: 'KITCHEN', companyId: 'comp_food_don_pedro_01', createdAt: Date.now(), active: true }); changed = true; }
  if (!db.users.find(u => u.id === 'usr_admin_01')) { db.users.push({ id: 'usr_admin_01', email: 'admin@logisticaexpress.com', passwordHash: adminPasswordHash, name: 'Martín Rodríguez', role: 'COMPANY_ADMIN', companyId: 'comp_centro_logistico_01', createdAt: Date.now(), active: true }); changed = true; }
  if (!db.users.find(u => u.id === 'usr_dispatcher_01')) { db.users.push({ id: 'usr_dispatcher_01', email: 'despacho@logisticaexpress.com', passwordHash: adminPasswordHash, name: 'Ana Gómez', role: 'DISPATCHER', companyId: 'comp_centro_logistico_01', createdAt: Date.now(), active: true }); changed = true; }
  if (!db.drivers.find(d => d.id === 'drv_piloto')) { db.drivers.push({ id: 'drv_piloto', companyId: 'comp_ubika_piloto', name: 'DRIVER PILOTO', email: 'driver@ubikapiloto.com', phone: '', vehicle: 'moto', status: 'disponible', internalId: 'PILOTO-01', createdAt: Date.now(), totalDeliveries: 0, rating: 5, lastActiveAt: Date.now(), speedKmH: 0 }); changed = true; }
  if (!db.drivers.find(d => d.id === 'drv_farma_01')) { db.drivers.push({ id: 'drv_farma_01', companyId: 'comp_farma_norte_02', name: 'Esteban Morales', email: 'esteban@farmanorte.com', phone: '', vehicle: 'moto', status: 'disponible', internalId: 'F-01', createdAt: Date.now(), totalDeliveries: 10, rating: 4.8, lastActiveAt: Date.now(), speedKmH: 0 }); changed = true; }
  if (!db.drivers.find(d => d.id === 'drv_don_pedro_01')) { db.drivers.push({ id: 'drv_don_pedro_01', companyId: 'comp_food_don_pedro_01', name: 'Cadete Pedro Jr', email: 'pedrojr@ubikafood.com', phone: '', vehicle: 'moto', status: 'disponible', internalId: 'DP-01', createdAt: Date.now(), totalDeliveries: 15, rating: 5.0, lastActiveAt: Date.now(), speedKmH: 0 }); changed = true; }
  db.food_stores = db.food_stores || []; db.food_categories = db.food_categories || []; db.food_products = db.food_products || []; db.food_shipping_rates = db.food_shipping_rates || []; db.food_orders = db.food_orders || [];
  if (changed) saveDatabaseSync();
}

function migrateFoodData(db: DatabaseSchema): boolean { return false; }

function loadDatabase() {
  const dbExists = fs.existsSync(DB_FILE);
  if (dbExists) {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.companies)) throw new Error('Base de datos inválida: se esperaban colecciones users y companies');
    dbState = parsed as DatabaseSchema;
  } else { dbState = createInitialSeedData(); }
  dbState.drivers = Array.isArray(dbState.drivers) ? dbState.drivers : [];
  dbState.deliveries = Array.isArray(dbState.deliveries) ? dbState.deliveries : [];
  dbState.location_sessions = Array.isArray(dbState.location_sessions) ? dbState.location_sessions : [];
  dbState.events = Array.isArray(dbState.events) ? dbState.events : [];
  dbState.driver_locations = Array.isArray(dbState.driver_locations) ? dbState.driver_locations : [];
  dbState.food_stores = Array.isArray(dbState.food_stores) ? dbState.food_stores : [];
  dbState.food_categories = Array.isArray(dbState.food_categories) ? dbState.food_categories : [];
  dbState.food_products = Array.isArray(dbState.food_products) ? dbState.food_products : [];
  dbState.food_shipping_rates = Array.isArray(dbState.food_shipping_rates) ? dbState.food_shipping_rates : [];
  dbState.food_orders = Array.isArray(dbState.food_orders) ? dbState.food_orders : [];
  dbState.invitations = Array.isArray(dbState.invitations) ? dbState.invitations : [];
  dbState.password_resets = Array.isArray(dbState.password_resets) ? dbState.password_resets : [];
  dbState.commerce_categories = Array.isArray(dbState.commerce_categories) ? dbState.commerce_categories : [];
  dbState.commerce_products = Array.isArray(dbState.commerce_products) ? dbState.commerce_products : [];
  dbState.commerce_customers = Array.isArray(dbState.commerce_customers) ? dbState.commerce_customers : [];
  dbState.commerce_stock_movements = Array.isArray(dbState.commerce_stock_movements) ? dbState.commerce_stock_movements : [];
  dbState.commerce_cash_sessions = Array.isArray(dbState.commerce_cash_sessions) ? dbState.commerce_cash_sessions : [];
  dbState.commerce_sales = Array.isArray(dbState.commerce_sales) ? dbState.commerce_sales : [];
  dbState.commerce_invoices = Array.isArray(dbState.commerce_invoices) ? dbState.commerce_invoices : [];
  dbState.withdrawal_requests = Array.isArray(dbState.withdrawal_requests) ? dbState.withdrawal_requests : [];
  const migrated = migrateFoodData(dbState);
  if (migrated) saveDatabaseSync();
}

export function saveDatabaseSync() {
  const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tempFile, JSON.stringify(dbState, null, 2), 'utf-8');
  fs.renameSync(tempFile, DB_FILE);
  const now = Date.now();
  if (now - lastBackupTime >= 30 * 60 * 1000) { createBackup(); lastBackupTime = now; }
}

loadDatabase();

export const db = {
  getRawState: () => dbState,
  getUserById: (userId: string) => dbState.users.find(u => u.id === userId),
  getUserByEmail: (email: string) => dbState.users.find(u => u.email.toLowerCase() === email.toLowerCase()),
  createUser: (user: UserRecordInput) => { const normalized = { ...user, privacyPolicyAccepted: user.privacyPolicyAccepted ?? false, privacyPolicyAcceptedAt: user.privacyPolicyAcceptedAt ?? 0, termsOfServiceAccepted: user.termsOfServiceAccepted ?? false }; dbState.users.push(normalized); saveDatabaseSync(); return normalized; },
  updateUser: (userId: string, updates: Partial<UserRecord>) => { const idx = dbState.users.findIndex(u => u.id === userId); if (idx === -1) return null; dbState.users[idx] = { ...dbState.users[idx], ...updates }; saveDatabaseSync(); return dbState.users[idx]; },
  createInvitation: (inv: InvitationRecord) => { dbState.invitations = dbState.invitations || []; dbState.invitations.forEach(i => { if (i.email.toLowerCase() === inv.email.toLowerCase() && !i.used) { i.used = true; i.usedAt = Date.now(); } }); dbState.invitations.push(inv); saveDatabaseSync(); return inv; },
  getInvitationByHash: (hash: string) => { dbState.invitations = dbState.invitations || []; return dbState.invitations.find(i => i.tokenHash === hash); },
  updateInvitation: (id: string, updates: Partial<InvitationRecord>) => { dbState.invitations = dbState.invitations || []; const idx = dbState.invitations.findIndex(i => i.id === id); if (idx === -1) return null; dbState.invitations[idx] = { ...dbState.invitations[idx], ...updates }; saveDatabaseSync(); return dbState.invitations[idx]; },
  createPasswordReset: (pr: PasswordResetRecord) => { dbState.password_resets = dbState.password_resets || []; dbState.password_resets.forEach(p => { if (p.email.toLowerCase() === pr.email.toLowerCase() && !p.used) { p.used = true; p.usedAt = Date.now(); } }); dbState.password_resets.push(pr); saveDatabaseSync(); return pr; },
  getPasswordResetByHash: (hash: string) => { dbState.password_resets = dbState.password_resets || []; return dbState.password_resets.find(p => p.tokenHash === hash); },
  updatePasswordReset: (id: string, updates: Partial<PasswordResetRecord>) => { dbState.password_resets = dbState.password_resets || []; const idx = dbState.password_resets.findIndex(p => p.id === id); if (idx === -1) return null; dbState.password_resets[idx] = { ...dbState.password_resets[idx], ...updates }; saveDatabaseSync(); return dbState.password_resets[idx]; },
  getDriversByCompany: (companyId: string) => dbState.drivers.filter(d => d.companyId === companyId),
  getDriverById: (driverId: string) => dbState.drivers.find(d => d.id === driverId),
  createDriver: (driver: Driver) => { dbState.drivers.push(driver); saveDatabaseSync(); return driver; },
  updateDriver: (driverId: string, updates: Partial<Driver>) => { const idx = dbState.drivers.findIndex(d => d.id === driverId); if (idx === -1) return null; dbState.drivers[idx] = { ...dbState.drivers[idx], ...updates }; saveDatabaseSync(); return dbState.drivers[idx]; },
  getDeliveriesByCompany: (companyId: string) => dbState.deliveries.filter(d => d.companyId === companyId),
  getDeliveriesByDriver: (driverId: string) => dbState.deliveries.filter(d => d.driverId === driverId),
  getDeliveryById: (deliveryId: string) => dbState.deliveries.find(d => d.id === deliveryId),
  createDelivery: (delivery: Delivery) => { dbState.deliveries.unshift(delivery); saveDatabaseSync(); return delivery; },
  updateDelivery: (deliveryId: string, updates: Partial<Delivery>) => { const idx = dbState.deliveries.findIndex(d => d.id === deliveryId); if (idx === -1) return null; dbState.deliveries[idx] = { ...dbState.deliveries[idx], ...updates }; saveDatabaseSync(); return dbState.deliveries[idx]; },
  createLocationSession: (session: LocationSessionRecord) => { dbState.location_sessions.push(session); saveDatabaseSync(); return session; },
  getSessionByToken: (token: string): LocationSessionRecord | undefined => {
    const hash = hashToken(token);
    const session = dbState.location_sessions.find(s => s.sessionTokenHash === hash);
    if (!session) return undefined;
    if (session.status === 'CANCELLED' || session.status === 'PURGED') return undefined;
    if (Date.now() >= session.expiresAt) {
      if (session.status !== 'EXPIRED') {
        session.status = 'EXPIRED';
        session.endedAt = session.endedAt || Date.now();
        session.recipientLocation = null;
        saveDatabaseSync();
      }
      return undefined;
    }
    return session;
  },
  updateSession: (id: string, updates: Partial<LocationSessionRecord>) => { const idx = dbState.location_sessions.findIndex(s => s.id === id); if (idx === -1) return null; dbState.location_sessions[idx] = { ...dbState.location_sessions[idx], ...updates }; saveDatabaseSync(); return dbState.location_sessions[idx]; },
  createEvent: (event: DeliveryEvent) => { dbState.events.push(event); saveDatabaseSync(); return event; },
  recordDriverLocation: (location: any) => { const record = { ...location, id: `loc_${crypto.randomUUID()}` }; dbState.driver_locations.push(record); saveDatabaseSync(); return record; },
  getAllCompanies: () => dbState.companies,
  getCompanyById: (companyId: string) => dbState.companies.find(c => c.id === companyId),
  getFoodStoreByCompanyId: (companyId: string) => dbState.food_stores?.find(s => s.companyId === companyId),
  getFoodCategoriesByCompanyId: (companyId: string) => (dbState.food_categories || []).filter(c => c.companyId === companyId),
  getFoodProductsByCompanyId: (companyId: string) => (dbState.food_products || []).filter(p => p.companyId === companyId),
  getFoodShippingRateByCompanyId: (companyId: string) => dbState.food_shipping_rates?.find(r => r.companyId === companyId),
  getFoodOrdersByCompanyId: (companyId: string) => (dbState.food_orders || []).filter(o => o.companyId === companyId),
  getFoodOrderById: (orderId: string) => (dbState.food_orders || []).find(o => o.id === orderId),
};
