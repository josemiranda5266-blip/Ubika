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
} from '../src/types';

export type UserRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'DISPATCHER' | 'DRIVER' | 'CLIENT';

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

export interface LocationSessionRecord {
  id: string;
  deliveryId: string;
  companyId: string;
  rawToken: string; // Stored securely
  sessionTokenHash: string; // SHA-256 for fast/safe lookup
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
}

const DATA_DIR = path.join(process.cwd(), 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = path.join(DATA_DIR, 'ubika_persistent_db.json');

// Ensure data and backup directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// In-memory cache synced with disk
let dbState: DatabaseSchema;
let lastBackupTime = 0;

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Creates a timestamped backup of the database in /data/backups/
 */
export function createBackup(): string | null {
  if (!dbState) return null;
  try {
    const backupFile = path.join(BACKUPS_DIR, `ubika_backup_${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(dbState, null, 2), 'utf-8');
    
    // Maintain max 10 backups by cleaning older ones
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter((f) => f.startsWith('ubika_backup_') && f.endsWith('.json'))
      .sort();
    
    while (files.length > 10) {
      const oldest = files.shift();
      if (oldest) {
        fs.unlinkSync(path.join(BACKUPS_DIR, oldest));
      }
    }
    return backupFile;
  } catch (err) {
    console.error('[DB Backup Error]:', err);
    return null;
  }
}

/**
 * Initialize Default Seed Data if DB file is fresh or demo seed requested
 */
function createInitialSeedData(): DatabaseSchema {
  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';
  const shouldSeedDemo = process.env.SEED_DEMO_DATA === 'true' || (isDev && process.env.SEED_DEMO_DATA !== 'false');

  if (!shouldSeedDemo) {
    return {
      version: 1,
      companies: [],
      users: [],
      drivers: [],
      deliveries: [],
      location_sessions: [],
      events: [],
      driver_locations: [],
    };
  }

  const salt = bcrypt.genSaltSync(10);
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'UbikaAdminSecure2026!';
  const driverPassword = process.env.INITIAL_DRIVER_PASSWORD || 'UbikaDriverSecure2026!';

  const adminPasswordHash = bcrypt.hashSync(adminPassword, salt);
  const driverPasswordHash = bcrypt.hashSync(driverPassword, salt);

  const pilotoCompany: Company = {
    id: 'comp_ubika_piloto',
    name: 'UBIKA PILOTO',
    category: 'Mensajería y Cadetería',
    address: 'Av. Belgrano 450, Santiago del Estero',
    phone: '+54 9 385 555-0000',
    city: 'Santiago del Estero',
    activeOrdersCount: 1,
    totalDriversCount: 1,
  };

  const initialCompany: Company = {
    id: 'comp_centro_logistico_01',
    name: 'Logística Express Centro',
    category: 'Mensajería y Cadetería',
    address: 'Av. Corrientes 1250, CABA',
    phone: '+54 11 4321-8800',
    city: 'Buenos Aires',
    activeOrdersCount: 2,
    totalDriversCount: 4,
  };

  const initialCompany2: Company = {
    id: 'comp_farma_norte_02',
    name: 'Farmacia & Distribuidora Norte',
    category: 'Farmacia / Salud',
    address: 'Av. Cabildo 2400, CABA',
    phone: '+54 11 4780-9900',
    city: 'Buenos Aires',
    activeOrdersCount: 0,
    totalDriversCount: 1,
  };

  const initialUsers: UserRecord[] = [
    // UBIKA PILOTO Official Admin & Driver Users
    {
      id: 'usr_admin_piloto',
      email: 'admin@ubikapiloto.com',
      passwordHash: adminPasswordHash,
      name: 'ADMIN PILOTO',
      role: 'COMPANY_ADMIN',
      companyId: 'comp_ubika_piloto',
      phone: '+54 9 385 555-0001',
      createdAt: Date.now() - 30 * 86400000,
      active: true,
    },
    {
      id: 'usr_driver_piloto',
      email: 'driver@ubikapiloto.com',
      passwordHash: driverPasswordHash,
      name: 'DRIVER PILOTO',
      role: 'DRIVER',
      companyId: 'comp_ubika_piloto',
      driverId: 'drv_piloto',
      phone: '+54 9 385 555-0101',
      createdAt: Date.now() - 20 * 86400000,
      active: true,
    },
    {
      id: 'usr_admin_01',
      email: 'admin@logisticaexpress.com',
      passwordHash: adminPasswordHash,
      name: 'Martín Rodríguez (Admin)',
      role: 'COMPANY_ADMIN',
      companyId: 'comp_centro_logistico_01',
      phone: '+54 9 11 5555-0101',
      createdAt: Date.now() - 30 * 86400000,
      active: true,
    },
    {
      id: 'usr_dispatcher_01',
      email: 'despacho@logisticaexpress.com',
      passwordHash: adminPasswordHash,
      name: 'Carla Méndez (Despachadora)',
      role: 'DISPATCHER',
      companyId: 'comp_centro_logistico_01',
      phone: '+54 9 11 5555-0102',
      createdAt: Date.now() - 20 * 86400000,
      active: true,
    },
    {
      id: 'usr_driver_01',
      email: 'driver1@logisticaexpress.com',
      passwordHash: driverPasswordHash,
      name: 'Carlos Mendoza',
      role: 'DRIVER',
      companyId: 'comp_centro_logistico_01',
      driverId: 'drv_01',
      phone: '+54 9 11 5555-1234',
      createdAt: Date.now() - 15 * 86400000,
      active: true,
    },
    {
      id: 'usr_driver_02',
      email: 'driver2@logisticaexpress.com',
      passwordHash: driverPasswordHash,
      name: 'Gonzalo Silva',
      role: 'DRIVER',
      companyId: 'comp_centro_logistico_01',
      driverId: 'drv_02',
      phone: '+54 9 11 5555-5678',
      createdAt: Date.now() - 10 * 86400000,
      active: true,
    },
    // Company 2 user for multi-tenant isolation testing
    {
      id: 'usr_admin_farma_02',
      email: 'admin@farmanorte.com',
      passwordHash: adminPasswordHash,
      name: 'Dra. Silvina Ramos',
      role: 'COMPANY_ADMIN',
      companyId: 'comp_farma_norte_02',
      phone: '+54 9 11 4780-9901',
      createdAt: Date.now() - 10 * 86400000,
      active: true,
    },
  ];

  const initialDrivers: Driver[] = [
    {
      id: 'drv_piloto',
      companyId: 'comp_ubika_piloto',
      name: 'DRIVER PILOTO',
      phone: '+54 9 385 555-0101',
      email: 'driver@ubikapiloto.com',
      internalId: 'PILOTO-01',
      vehicle: 'moto',
      status: 'disponible',
      createdAt: Date.now() - 20 * 86400000,
      totalDeliveries: 0,
      rating: 5.0,
      lastActiveAt: Date.now(),
      speedKmH: 0,
      currentLocation: {
        latitude: -27.7889,
        longitude: -64.2619,
        accuracy: 8,
        updatedAt: Date.now(),
        speed: 0,
      },
    },
    {
      id: 'drv_01',
      companyId: 'comp_centro_logistico_01',
      name: 'Carlos Mendoza',
      phone: '+54 9 11 5555-1234',
      email: 'carlos.mendoza@ubika.app',
      internalId: 'R-01',
      vehicle: 'moto',
      status: 'en_tarea',
      createdAt: Date.now() - 15 * 86400000,
      totalDeliveries: 142,
      rating: 4.9,
      lastActiveAt: Date.now(),
      speedKmH: 28,
      currentLocation: {
        latitude: -34.6037,
        longitude: -58.3816,
        accuracy: 8,
        updatedAt: Date.now(),
        speed: 28,
        heading: 145,
      },
    },
    {
      id: 'drv_02',
      companyId: 'comp_centro_logistico_01',
      name: 'Gonzalo Silva',
      phone: '+54 9 11 5555-5678',
      email: 'gonzalo.silva@ubika.app',
      internalId: 'R-02',
      vehicle: 'moto',
      status: 'disponible',
      createdAt: Date.now() - 10 * 86400000,
      totalDeliveries: 89,
      rating: 4.8,
      lastActiveAt: Date.now(),
      speedKmH: 0,
      currentLocation: {
        latitude: -34.6083,
        longitude: -58.3712,
        accuracy: 12,
        updatedAt: Date.now(),
        speed: 0,
      },
    },
    {
      id: 'drv_03',
      companyId: 'comp_centro_logistico_01',
      name: 'Valentina Rossi',
      phone: '+54 9 11 5555-9012',
      email: 'valentina.rossi@ubika.app',
      internalId: 'R-03',
      vehicle: 'bici',
      status: 'disponible',
      createdAt: Date.now() - 5 * 86400000,
      totalDeliveries: 34,
      rating: 5.0,
      lastActiveAt: Date.now(),
      speedKmH: 14,
      currentLocation: {
        latitude: -34.5889,
        longitude: -58.3965,
        accuracy: 6,
        updatedAt: Date.now(),
        speed: 14,
      },
    },
    {
      id: 'drv_04',
      companyId: 'comp_centro_logistico_01',
      name: 'Lucas Benítez',
      phone: '+54 9 11 5555-3456',
      email: 'lucas.benitez@ubika.app',
      internalId: 'R-04',
      vehicle: 'auto',
      status: 'pausado',
      createdAt: Date.now() - 8 * 86400000,
      totalDeliveries: 67,
      rating: 4.7,
      lastActiveAt: Date.now() - 15 * 60000,
      speedKmH: 0,
      currentLocation: {
        latitude: -34.6158,
        longitude: -58.4333,
        accuracy: 10,
        updatedAt: Date.now() - 15 * 60000,
      },
    },
    {
      id: 'drv_farma_01',
      companyId: 'comp_farma_norte_02',
      name: 'Esteban Morales',
      phone: '+54 9 11 4780-1122',
      email: 'esteban@farmanorte.com',
      internalId: 'FN-01',
      vehicle: 'moto',
      status: 'disponible',
      createdAt: Date.now() - 4 * 86400000,
      totalDeliveries: 12,
      rating: 4.9,
      lastActiveAt: Date.now(),
    },
  ];

  const now = Date.now();
  const demoToken1 = 'tok_demo_live_c1a892f03b87';
  const demoToken2 = 'tok_demo_live_e5f88421d019';

  const initialDeliveries: Delivery[] = [
    {
      id: 'del_1001',
      orderNumber: 1001,
      companyId: 'comp_centro_logistico_01',
      driverId: 'drv_01',
      driverName: 'Carlos Mendoza',
      driverPhone: '+54 9 11 5555-1234',
      driverVehicle: 'moto',
      recipientPhone: '+54 9 11 4444-9988',
      recipientName: 'Sofía Navarro',
      description: 'Documentación legal y contrato firmado',
      instructions: 'Piso 4, Dpto B. Timbre blanco con etiqueta Navarro.',
      amount: '$ 4.800',
      paymentMethod: 'Efectivo',
      priority: 'urgente',
      notes: 'Solicitar DNI al entregar',
      sessionToken: demoToken1,
      status: 'en_camino',
      createdAt: now - 25 * 60000,
      assignedAt: now - 23 * 60000,
      acceptedAt: now - 22 * 60000,
      startedAt: now - 18 * 60000,
      authorizedAt: now - 16 * 60000,
      expiresAt: now + 3 * 3600000,
      recipientLocation: {
        latitude: -34.5955,
        longitude: -58.3792,
        accuracy: 9,
        updatedAt: now - 16 * 60000,
        addressHint: 'Esmeralda y Paraguay, CABA',
        noteFromRecipient: 'Estoy en portería esperando',
      },
      driverLocation: {
        latitude: -34.6037,
        longitude: -58.3816,
        accuracy: 8,
        updatedAt: now,
        speed: 28,
        heading: 145,
      },
      routeHistory: [
        { latitude: -34.6083, longitude: -58.3712, timestamp: now - 18 * 60000, speed: 0 },
        { latitude: -34.6050, longitude: -58.3750, timestamp: now - 10 * 60000, speed: 30 },
        { latitude: -34.6037, longitude: -58.3816, timestamp: now, speed: 28 },
      ],
      distanceMeters: 940,
      etaMinutes: 4,
      privacyPolicyPurged: false,
    },
    {
      id: 'del_1002',
      orderNumber: 1002,
      companyId: 'comp_centro_logistico_01',
      driverId: 'drv_02',
      driverName: 'Gonzalo Silva',
      driverPhone: '+54 9 11 5555-5678',
      driverVehicle: 'moto',
      recipientPhone: '+54 9 11 3333-7711',
      recipientName: 'Mariano Castro',
      description: 'Caja con repuestos electrónicos',
      instructions: 'Dejar en recepción de guardia',
      amount: '$ 12.500',
      paymentMethod: 'Transferencia / MP',
      priority: 'alta',
      sessionToken: demoToken2,
      status: 'esperando_autorizacion',
      createdAt: now - 10 * 60000,
      assignedAt: now - 9 * 60000,
      acceptedAt: now - 8 * 60000,
      expiresAt: now + 4 * 3600000,
      privacyPolicyPurged: false,
    },
  ];

  const initialSessions: LocationSessionRecord[] = [
    {
      id: 'sess_del_1001',
      deliveryId: 'del_1001',
      companyId: 'comp_centro_logistico_01',
      rawToken: demoToken1,
      sessionTokenHash: hashToken(demoToken1),
      createdAt: now - 25 * 60000,
      expiresAt: now + 3 * 3600000,
      authorizedAt: now - 16 * 60000,
      status: 'ACTIVE',
      recipientLocation: {
        latitude: -34.5955,
        longitude: -58.3792,
        accuracy: 9,
        updatedAt: now - 16 * 60000,
        addressHint: 'Esmeralda y Paraguay, CABA',
        noteFromRecipient: 'Estoy en portería esperando',
      },
    },
    {
      id: 'sess_del_1002',
      deliveryId: 'del_1002',
      companyId: 'comp_centro_logistico_01',
      rawToken: demoToken2,
      sessionTokenHash: hashToken(demoToken2),
      createdAt: now - 10 * 60000,
      expiresAt: now + 4 * 3600000,
      status: 'ACTIVE',
    },
  ];

  const initialEvents: DeliveryEvent[] = [
    {
      id: 'ev_01',
      companyId: 'comp_centro_logistico_01',
      deliveryId: 'del_1001',
      orderNumber: 1001,
      type: 'DELIVERY_CREATED',
      description: 'Tarea creada desde UBIKA CONTROL por Despacho Central.',
      timestamp: now - 25 * 60000,
      author: 'Despacho Central',
      actorId: 'usr_dispatcher_01',
      actorRole: 'DISPATCHER',
    },
    {
      id: 'ev_02',
      companyId: 'comp_centro_logistico_01',
      deliveryId: 'del_1001',
      orderNumber: 1001,
      type: 'DRIVER_ASSIGNED',
      description: 'Asignado al repartidor Carlos Mendoza (R-01).',
      timestamp: now - 23 * 60000,
      author: 'Despacho Central',
      actorId: 'usr_dispatcher_01',
      actorRole: 'DISPATCHER',
    },
    {
      id: 'ev_03',
      companyId: 'comp_centro_logistico_01',
      deliveryId: 'del_1001',
      orderNumber: 1001,
      type: 'DRIVER_ACCEPTED',
      description: 'El repartidor aceptó la tarea en UBIKA DRIVER.',
      timestamp: now - 22 * 60000,
      author: 'Carlos Mendoza',
      actorId: 'drv_01',
      actorRole: 'DRIVER',
    },
    {
      id: 'ev_04',
      companyId: 'comp_centro_logistico_01',
      deliveryId: 'del_1001',
      orderNumber: 1001,
      type: 'DELIVERY_STARTED',
      description: 'El repartidor inició el viaje hacia el destino.',
      timestamp: now - 18 * 60000,
      author: 'Carlos Mendoza',
      actorId: 'drv_01',
      actorRole: 'DRIVER',
    },
    {
      id: 'ev_05',
      companyId: 'comp_centro_logistico_01',
      deliveryId: 'del_1001',
      orderNumber: 1001,
      type: 'LOCATION_SHARED',
      description: 'El destinatario autorizó y compartió su posición GPS precisa.',
      timestamp: now - 16 * 60000,
      author: 'Sofía Navarro',
      actorRole: 'CLIENT',
    },
  ];

  return {
    version: 1,
    companies: [pilotoCompany, initialCompany, initialCompany2],
    users: initialUsers,
    drivers: initialDrivers,
    deliveries: initialDeliveries,
    location_sessions: initialSessions,
    events: initialEvents,
    driver_locations: [],
  };
}

/**
 * Load database from disk or create seed file
 */
export function loadDatabase(): DatabaseSchema {
  if (dbState) return dbState;

  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      dbState = JSON.parse(raw);
      
      const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';
      const shouldSeedDemo = process.env.SEED_DEMO_DATA === 'true' || (isDev && process.env.SEED_DEMO_DATA !== 'false');

      if (shouldSeedDemo) {
        // Ensure piloto test company & drivers exist in development/demo mode
        const seed = createInitialSeedData();
        let changed = false;
        if (seed.companies.length > 0 && !dbState.companies.some((c) => c.id === 'comp_ubika_piloto')) {
          dbState.companies.unshift(seed.companies[0]);
          changed = true;
        }
        for (const u of seed.users) {
          const existingIdx = dbState.users.findIndex((x) => x.id === u.id);
          if (existingIdx === -1) {
            dbState.users.push(u);
            changed = true;
          } else if (u.passwordHash && dbState.users[existingIdx].passwordHash !== u.passwordHash) {
            dbState.users[existingIdx].passwordHash = u.passwordHash;
            changed = true;
          }
        }
        for (const d of seed.drivers.filter((d) => d.companyId === 'comp_ubika_piloto')) {
          if (!dbState.drivers.some((x) => x.id === d.id)) {
            dbState.drivers.push(d);
            changed = true;
          }
        }
        if (changed) {
          saveDatabaseSync();
        }
      }

      console.log(`[DB] Base de datos persistente cargada con éxito desde ${DB_FILE}`);
      return dbState;
    }
  } catch (err) {
    console.error('[DB Error] Error leyendo base de datos existente, reconstruyendo semilla:', err);
  }

  // If file doesn't exist or failed to parse, initialize seed and save
  dbState = createInitialSeedData();
  saveDatabaseSync();
  console.log(`[DB] Archivo de persistencia inicial creado en ${DB_FILE}`);
  return dbState;
}

/**
 * Save database to disk atomically with temporary file rename
 */
export function saveDatabaseSync(): void {
  if (!dbState) return;
  try {
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(dbState, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);

    // Auto-backup if more than 30 minutes since last backup
    const now = Date.now();
    if (now - lastBackupTime > 30 * 60 * 1000) {
      lastBackupTime = now;
      createBackup();
    }
  } catch (err) {
    console.error('[DB Error] Error guardando base de datos persistente:', err);
  }
}

// Initial load
loadDatabase();

/**
 * Database Operations Interface (Scoped and Multi-tenant safe)
 */
export const db = {
  // Companies
  getCompanyById: (companyId: string): Company | undefined => {
    return dbState.companies.find((c) => c.id === companyId);
  },
  getAllCompanies: (): Company[] => {
    return [...dbState.companies];
  },
  updateCompany: (companyId: string, updates: Partial<Company>): Company | null => {
    const idx = dbState.companies.findIndex((c) => c.id === companyId);
    if (idx === -1) return null;
    dbState.companies[idx] = { ...dbState.companies[idx], ...updates };
    saveDatabaseSync();
    return dbState.companies[idx];
  },

  // Users
  getUserByEmail: (email: string): UserRecord | undefined => {
    return dbState.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },
  getUserById: (userId: string): UserRecord | undefined => {
    return dbState.users.find((u) => u.id === userId);
  },
  createUser: (user: UserRecord): UserRecord => {
    dbState.users.push(user);
    saveDatabaseSync();
    return user;
  },

  // Drivers (Scoped by Company)
  getDriversByCompany: (companyId: string): Driver[] => {
    return dbState.drivers.filter((d) => d.companyId === companyId);
  },
  getDriverById: (driverId: string): Driver | undefined => {
    return dbState.drivers.find((d) => d.id === driverId);
  },
  createDriver: (driver: Driver): Driver => {
    dbState.drivers.push(driver);
    saveDatabaseSync();
    return driver;
  },
  updateDriver: (driverId: string, updates: Partial<Driver>): Driver | null => {
    const idx = dbState.drivers.findIndex((d) => d.id === driverId);
    if (idx === -1) return null;
    dbState.drivers[idx] = { ...dbState.drivers[idx], ...updates };
    saveDatabaseSync();
    return dbState.drivers[idx];
  },

  // Deliveries (Scoped by Company or Driver)
  getDeliveriesByCompany: (companyId: string): Delivery[] => {
    return dbState.deliveries.filter((d) => d.companyId === companyId);
  },
  getDeliveriesByDriver: (driverId: string): Delivery[] => {
    return dbState.deliveries.filter((d) => d.driverId === driverId);
  },
  getDeliveryById: (deliveryId: string): Delivery | undefined => {
    return dbState.deliveries.find((d) => d.id === deliveryId);
  },
  createDelivery: (delivery: Delivery): Delivery => {
    dbState.deliveries.unshift(delivery);
    saveDatabaseSync();
    return delivery;
  },
  updateDelivery: (deliveryId: string, updates: Partial<Delivery>): Delivery | null => {
    const idx = dbState.deliveries.findIndex((d) => d.id === deliveryId);
    if (idx === -1) return null;
    dbState.deliveries[idx] = { ...dbState.deliveries[idx], ...updates };
    saveDatabaseSync();
    return dbState.deliveries[idx];
  },

  // Location Sessions (Cryptographic Token Storage & Expiration)
  createLocationSession: (session: LocationSessionRecord): LocationSessionRecord => {
    dbState.location_sessions.push(session);
    saveDatabaseSync();
    return session;
  },
  getSessionByToken: (token: string): LocationSessionRecord | undefined => {
    const hash = hashToken(token);
    return dbState.location_sessions.find((s) => s.sessionTokenHash === hash || s.rawToken === token);
  },
  updateSession: (id: string, updates: Partial<LocationSessionRecord>): LocationSessionRecord | null => {
    const idx = dbState.location_sessions.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    dbState.location_sessions[idx] = { ...dbState.location_sessions[idx], ...updates };
    saveDatabaseSync();
    return dbState.location_sessions[idx];
  },

  // Events (Immutable Audit Log Scoped by Company)
  getEventsByCompany: (companyId: string): DeliveryEvent[] => {
    return dbState.events
      .filter((e) => (e as any).companyId === companyId)
      .sort((a, b) => b.timestamp - a.timestamp);
  },
  getEventsByDelivery: (deliveryId: string): DeliveryEvent[] => {
    return dbState.events
      .filter((e) => e.deliveryId === deliveryId)
      .sort((a, b) => a.timestamp - b.timestamp);
  },
  createEvent: (event: DeliveryEvent): DeliveryEvent => {
    dbState.events.unshift(event);
    saveDatabaseSync();
    return event;
  },

  // Record Driver Location History (Operational Throttling)
  recordDriverLocation: (record: {
    driverId: string;
    deliveryId?: string;
    companyId: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    speed?: number | null;
    timestamp: number;
  }): void => {
    dbState.driver_locations.push({
      id: `loc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      ...record,
    });
    // Cap in-memory history per driver to reasonable limits (last 1000 points)
    if (dbState.driver_locations.length > 5000) {
      dbState.driver_locations = dbState.driver_locations.slice(-3000);
    }
    saveDatabaseSync();
  },

  // Driver Location History query
  getDriverLocationHistory: (driverId: string, since?: number) => {
    return dbState.driver_locations
      .filter((l) => l.driverId === driverId && (!since || l.timestamp >= since))
      .sort((a, b) => a.timestamp - b.timestamp);
  },

  // Raw Export for backup or tests
  createBackup: (): string => {
    saveDatabaseSync();
    const backupFileName = `ubika_backup_${Date.now()}.json`;
    const backupPath = path.join(DATA_DIR, backupFileName);
    fs.copyFileSync(DB_FILE, backupPath);
    return backupFileName;
  },
  getRawState: (): DatabaseSchema => dbState,
  reloadFromDisk: (): DatabaseSchema => {
    dbState = undefined as any;
    return loadDatabase();
  },
};
