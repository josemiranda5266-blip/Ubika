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
  food_stores?: FoodStore[];
  food_categories?: FoodCategory[];
  food_products?: FoodProduct[];
  food_shipping_rates?: FoodShippingRate[];
  food_orders?: FoodOrder[];
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
  const shouldSeedDemo = process.env.SEED_DEMO_DATA === 'true';

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

  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  const driverPassword = process.env.INITIAL_DRIVER_PASSWORD;

  if (!adminPassword || !driverPassword) {
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
    businessType: 'LOGISTICS',
    foodEnabled: false,
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
    businessType: 'LOGISTICS',
    foodEnabled: false,
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
    businessType: 'LOGISTICS',
    foodEnabled: false,
  };

  const foodCompanyDonPedro: Company = {
    id: 'comp_food_don_pedro_01',
    name: 'Hamburguesería Don Pedro',
    category: 'Gastronomía',
    address: 'Av. Belgrano 1234, CABA',
    phone: '+54 9 11 4555-8800',
    city: 'Buenos Aires',
    activeOrdersCount: 0,
    totalDriversCount: 0,
    businessType: 'FOOD',
    foodEnabled: true,
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
    // Company 2 users for multi-tenant isolation testing
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
    {
      id: 'usr_driver_farma_02',
      email: 'driver@farmanorte.com',
      passwordHash: driverPasswordHash,
      name: 'Roberto Farma Driver',
      role: 'DRIVER',
      companyId: 'comp_farma_norte_02',
      driverId: 'drv_farma_01',
      phone: '+54 9 11 4780-9902',
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

  const initialFoodStores: FoodStore[] = [
    {
      companyId: 'comp_food_don_pedro_01',
      foodEnabled: true,
      name: 'Hamburguesería Don Pedro',
      description: 'Las mejores hamburguesas artesanales con carne 100% novillo y papas fritas caseras.',
      address: 'Av. Belgrano 1234, CABA',
      phone: '+54 9 11 4555-8800',
      whatsappNumber: '5491145558800',
      logoUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=300&auto=format&fit=crop&q=80',
      coverImageUrl: 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=1000&auto=format&fit=crop&q=80',
      isOpenManual: true,
      schedule: [
        { dayOfWeek: 0, openTime: '19:00', closeTime: '01:00', isOpen: true },
        { dayOfWeek: 1, openTime: '19:00', closeTime: '01:00', isOpen: true },
        { dayOfWeek: 2, openTime: '19:00', closeTime: '01:00', isOpen: true },
        { dayOfWeek: 3, openTime: '19:00', closeTime: '01:00', isOpen: true },
        { dayOfWeek: 4, openTime: '19:00', closeTime: '01:00', isOpen: true },
        { dayOfWeek: 5, openTime: '19:00', closeTime: '02:00', isOpen: true },
        { dayOfWeek: 6, openTime: '19:00', closeTime: '02:00', isOpen: true },
      ],
      bankInfo: {
        bankName: 'Banco Galicia',
        alias: 'DON.PEDRO.BURGER',
        cbu: '0070123400000012345678',
        holderName: 'Hamburguesería Don Pedro S.R.L.',
        cuit: '30-71234567-8',
      },
      createdAt: Date.now() - 30 * 86400000,
      updatedAt: Date.now(),
    },
  ];

  const initialFoodCategories: FoodCategory[] = [
    { id: 'cat_burgers', companyId: 'comp_food_don_pedro_01', name: 'HAMBURGUESAS', description: 'Incluyen papas fritas', displayOrder: 1, active: true },
    { id: 'cat_papas', companyId: 'comp_food_don_pedro_01', name: 'PAPAS FRITAS', description: 'Papas caseras corte bastón', displayOrder: 2, active: true },
    { id: 'cat_bebidas', companyId: 'comp_food_don_pedro_01', name: 'BEBIDAS', description: 'Bebidas frías 500ml', displayOrder: 3, active: true },
  ];

  const initialFoodProducts: FoodProduct[] = [
    {
      id: 'prod_burg_clasica',
      companyId: 'comp_food_don_pedro_01',
      categoryId: 'cat_burgers',
      name: 'Hamburguesa Clásica',
      description: '180g de medallón novillo, queso cheddar, lechuga, tomate y salsa especial Don Pedro.',
      price: 8000,
      imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=80',
      isAvailable: true,
      displayOrder: 1,
      optionGroups: [
        {
          id: 'optgrp_add',
          name: 'Adicionales',
          required: false,
          maxSelections: 3,
          options: [
            { id: 'opt_queso', name: 'Queso Cheddar Extra', price: 500 },
            { id: 'opt_huevo', name: 'Huevo frito', price: 500 },
            { id: 'opt_panceta', name: 'Panceta crocante', price: 1000 },
          ],
        },
      ],
    },
    {
      id: 'prod_burg_completa',
      companyId: 'comp_food_don_pedro_01',
      categoryId: 'cat_burgers',
      name: 'Hamburguesa Completa',
      description: 'Doble medallón 360g, cuádruple cheddar, panceta ahumada, huevo frito y cebolla caramelizada.',
      price: 9500,
      imageUrl: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=500&auto=format&fit=crop&q=80',
      isAvailable: true,
      displayOrder: 2,
      optionGroups: [
        {
          id: 'optgrp_add_c',
          name: 'Adicionales',
          required: false,
          maxSelections: 3,
          options: [
            { id: 'opt_c_queso', name: 'Queso Cheddar Extra', price: 500 },
            { id: 'opt_c_huevo', name: 'Huevo frito', price: 500 },
            { id: 'opt_c_panceta', name: 'Panceta crocante', price: 1000 },
          ],
        },
      ],
    },
    {
      id: 'prod_papas_clasicas',
      companyId: 'comp_food_don_pedro_01',
      categoryId: 'cat_papas',
      name: 'Papas Clásicas',
      description: 'Porción generosa de papas bastón crocantes.',
      price: 3000,
      imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500&auto=format&fit=crop&q=80',
      isAvailable: true,
      displayOrder: 1,
    },
    {
      id: 'prod_gaseosa',
      companyId: 'comp_food_don_pedro_01',
      categoryId: 'cat_bebidas',
      name: 'Gaseosa 500ml',
      description: 'Coca-Cola, Sprite o Fanta bien fría.',
      price: 2000,
      isAvailable: true,
      displayOrder: 1,
    },
  ];

  const initialShippingRates: FoodShippingRate[] = [
    {
      companyId: 'comp_food_don_pedro_01',
      baseFee: 1500,
      includedKm: 2,
      perKmFee: 500,
      maxDistanceKm: 12,
      freeShippingThreshold: 30000,
      storeLatitude: -34.6037,
      storeLongitude: -58.3816,
    },
  ];

  return {
    version: 2,
    companies: [pilotoCompany, initialCompany, initialCompany2, foodCompanyDonPedro],
    users: initialUsers,
    drivers: initialDrivers,
    deliveries: initialDeliveries,
    location_sessions: initialSessions,
    events: initialEvents,
    driver_locations: [],
    food_stores: initialFoodStores,
    food_categories: initialFoodCategories,
    food_products: initialFoodProducts,
    food_shipping_rates: initialShippingRates,
    food_orders: [],
  };
}

/**
 * Multi-tenant Food Migration Helper
 * Ensures comp_centro_logistico_01 and comp_ubika_piloto do not have food stores/products,
 * and comp_food_don_pedro_01 is properly created and populated.
 */
function runFoodMigration(db: DatabaseSchema): boolean {
  let changed = false;

  // 1. Ensure comp_food_don_pedro_01 exists in companies
  let donPedroComp = db.companies.find((c) => c.id === 'comp_food_don_pedro_01');
  if (!donPedroComp) {
    donPedroComp = {
      id: 'comp_food_don_pedro_01',
      name: 'Hamburguesería Don Pedro',
      category: 'Gastronomía',
      address: 'Av. Belgrano 1234, CABA',
      phone: '+54 9 11 4555-8800',
      city: 'Buenos Aires',
      activeOrdersCount: 0,
      totalDriversCount: 0,
      businessType: 'FOOD',
      foodEnabled: true,
    };
    db.companies.push(donPedroComp);
    changed = true;
  } else {
    if (donPedroComp.businessType !== 'FOOD' || donPedroComp.foodEnabled !== true) {
      donPedroComp.businessType = 'FOOD';
      donPedroComp.foodEnabled = true;
      changed = true;
    }
  }

  // Ensure admin user for comp_food_don_pedro_01 exists
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Ubika2026!Admin';
  const pwdHash = bcrypt.hashSync(adminPassword, 10);
  let donPedroUser = db.users.find((u) => u.companyId === 'comp_food_don_pedro_01' || u.email === 'donpedro@ubikafood.com');
  if (!donPedroUser) {
    db.users.push({
      id: 'usr_don_pedro_01',
      companyId: 'comp_food_don_pedro_01',
      name: 'Admin Don Pedro',
      email: 'donpedro@ubikafood.com',
      passwordHash: pwdHash,
      role: 'COMPANY_ADMIN',
      createdAt: Date.now(),
      active: true,
    });
    changed = true;
  } else {
    donPedroUser.passwordHash = pwdHash;
    donPedroUser.role = 'COMPANY_ADMIN';
    donPedroUser.companyId = 'comp_food_don_pedro_01';
    donPedroUser.active = true;
    changed = true;
  }

  // Ensure driver for comp_farma_norte_02 exists
  if (!db.drivers.some((d) => d.id === 'drv_farma_01')) {
    db.drivers.push({
      id: 'drv_farma_01',
      companyId: 'comp_farma_norte_02',
      name: 'Esteban Morales',
      phone: '+54 9 11 4780-1122',
      email: 'esteban@farmanorte.com',
      internalId: 'F-01',
      vehicle: 'moto',
      status: 'disponible',
      createdAt: Date.now() - 10 * 86400000,
      totalDeliveries: 10,
      rating: 4.8,
      lastActiveAt: Date.now(),
      speedKmH: 0,
    });
    changed = true;
  }

  // 2. Ensure logistics companies are businessType: 'LOGISTICS' and foodEnabled: false
  for (const c of db.companies) {
    if (!c.businessType) {
      if (c.category === 'Gastronomía' || c.category === 'Restaurante / Comidas') {
        c.businessType = 'FOOD';
        c.foodEnabled = c.foodEnabled !== undefined ? c.foodEnabled : true;
      } else {
        c.businessType = 'LOGISTICS';
        c.foodEnabled = false;
      }
      changed = true;
    }
  }

  const centroLogistico = db.companies.find((c) => c.id === 'comp_centro_logistico_01');
  if (centroLogistico) {
    if (centroLogistico.businessType !== 'LOGISTICS' || centroLogistico.foodEnabled !== false) {
      centroLogistico.businessType = 'LOGISTICS';
      centroLogistico.foodEnabled = false;
      changed = true;
    }
  }

  const ubikaPiloto = db.companies.find((c) => c.id === 'comp_ubika_piloto');
  if (ubikaPiloto) {
    if (ubikaPiloto.businessType !== 'LOGISTICS' || ubikaPiloto.foodEnabled !== false) {
      ubikaPiloto.businessType = 'LOGISTICS';
      ubikaPiloto.foodEnabled = false;
      changed = true;
    }
  }

  // 3. Ensure food arrays exist
  db.food_stores = db.food_stores || [];
  db.food_categories = db.food_categories || [];
  db.food_products = db.food_products || [];
  db.food_shipping_rates = db.food_shipping_rates || [];
  db.food_orders = db.food_orders || [];

  // Reassign Don Pedro food store if assigned to logistics companies
  for (const store of db.food_stores) {
    if (store.companyId === 'comp_centro_logistico_01' || store.companyId === 'comp_ubika_piloto') {
      if (store.name.includes('Don Pedro') || store.name.includes('Hamburguesería')) {
        store.companyId = 'comp_food_don_pedro_01';
        store.foodEnabled = true;
      }
      changed = true;
    }
  }

  // Remove any remaining food store tied to logistics companies
  const originalStoresLen = db.food_stores.length;
  db.food_stores = db.food_stores.filter(
    (s) => s.companyId !== 'comp_centro_logistico_01' && s.companyId !== 'comp_ubika_piloto'
  );
  if (db.food_stores.length !== originalStoresLen) changed = true;

  // Reassign categories
  for (const cat of db.food_categories) {
    if (cat.companyId === 'comp_centro_logistico_01' || cat.companyId === 'comp_ubika_piloto') {
      cat.companyId = 'comp_food_don_pedro_01';
      changed = true;
    }
  }

  // Reassign products
  for (const prod of db.food_products) {
    if (prod.companyId === 'comp_centro_logistico_01' || prod.companyId === 'comp_ubika_piloto') {
      prod.companyId = 'comp_food_don_pedro_01';
      changed = true;
    }
  }

  // Reassign shipping rates
  for (const rate of db.food_shipping_rates) {
    if (rate.companyId === 'comp_centro_logistico_01' || rate.companyId === 'comp_ubika_piloto') {
      rate.companyId = 'comp_food_don_pedro_01';
      changed = true;
    }
  }

  // Ensure Don Pedro has store, categories, products, shipping rates
  const seed = createInitialSeedData();
  const seedStores = seed.food_stores || [];
  const seedCategories = seed.food_categories || [];
  const seedProducts = seed.food_products || [];
  const seedShippingRates = seed.food_shipping_rates || [];

  if (!db.food_stores.some((s) => s.companyId === 'comp_food_don_pedro_01') && seedStores.length > 0) {
    db.food_stores.push(seedStores[0]);
    changed = true;
  }
  if (!db.food_categories.some((c) => c.companyId === 'comp_food_don_pedro_01') && seedCategories.length > 0) {
    db.food_categories.push(...seedCategories);
    changed = true;
  }
  if (!db.food_products.some((p) => p.companyId === 'comp_food_don_pedro_01') && seedProducts.length > 0) {
    db.food_products.push(...seedProducts);
    changed = true;
  }
  if (!db.food_shipping_rates.some((r) => r.companyId === 'comp_food_don_pedro_01') && seedShippingRates.length > 0) {
    db.food_shipping_rates.push(...seedShippingRates);
    changed = true;
  }

  // Final check: filter out any food entries remaining on logistics companies
  db.food_categories = db.food_categories.filter(
    (c) => c.companyId !== 'comp_centro_logistico_01' && c.companyId !== 'comp_ubika_piloto'
  );
  db.food_products = db.food_products.filter(
    (p) => p.companyId !== 'comp_centro_logistico_01' && p.companyId !== 'comp_ubika_piloto'
  );
  db.food_shipping_rates = db.food_shipping_rates.filter(
    (r) => r.companyId !== 'comp_centro_logistico_01' && r.companyId !== 'comp_ubika_piloto'
  );

  if ((db.version || 1) < 2) {
    db.version = 2;
    changed = true;
  }

  return changed;
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
      
      const shouldSeedDemo = process.env.SEED_DEMO_DATA === 'true';

      if (shouldSeedDemo) {
        // Ensure piloto test company & drivers exist in development/demo mode
        const seed = createInitialSeedData();
        let changed = false;
        for (const c of seed.companies) {
          if (!dbState.companies.some((x) => x.id === c.id)) {
            dbState.companies.push(c);
            changed = true;
          }
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
        for (const d of seed.drivers) {
          if (!dbState.drivers.some((x) => x.id === d.id)) {
            dbState.drivers.push(d);
            changed = true;
          }
        }
        if (seed.food_stores) {
          if (!dbState.food_stores) dbState.food_stores = [];
          for (const fsItem of seed.food_stores) {
            if (!dbState.food_stores.some((s) => s.companyId === fsItem.companyId)) {
              dbState.food_stores.push(fsItem);
              changed = true;
            }
          }
        }
        if (seed.food_categories) {
          if (!dbState.food_categories) dbState.food_categories = [];
          for (const fc of seed.food_categories) {
            if (!dbState.food_categories.some((c) => c.id === fc.id)) {
              dbState.food_categories.push(fc);
              changed = true;
            }
          }
        }
        if (seed.food_products) {
          if (!dbState.food_products) dbState.food_products = [];
          for (const fp of seed.food_products) {
            if (!dbState.food_products.some((p) => p.id === fp.id)) {
              dbState.food_products.push(fp);
              changed = true;
            }
          }
        }
        if (seed.food_shipping_rates) {
          if (!dbState.food_shipping_rates) dbState.food_shipping_rates = [];
          for (const sr of seed.food_shipping_rates) {
            if (!dbState.food_shipping_rates.some((r) => r.companyId === sr.companyId)) {
              dbState.food_shipping_rates.push(sr);
              changed = true;
            }
          }
        }
        if (changed) {
          saveDatabaseSync();
        }
      }

      // Ensure all arrays are initialized
      dbState.food_stores = dbState.food_stores || [];
      dbState.food_categories = dbState.food_categories || [];
      dbState.food_products = dbState.food_products || [];
      dbState.food_shipping_rates = dbState.food_shipping_rates || [];
      dbState.food_orders = dbState.food_orders || [];

      // Run Food multi-tenant isolation migration
      const migrationChanged = runFoodMigration(dbState);
      if (migrationChanged) {
        saveDatabaseSync();
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
  getUsersByCompany: (companyId: string): UserRecord[] => {
    return dbState.users.filter((u) => u.companyId === companyId);
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
    return dbState.location_sessions.find((s) => s.sessionTokenHash === hash);
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

  // --- UBIKA FOOD DAO METHODS ---
  getFoodStoreByCompanyId: (companyId: string): FoodStore | undefined => {
    return (dbState.food_stores || []).find((s) => s.companyId === companyId);
  },
  upsertFoodStore: (store: FoodStore): FoodStore => {
    if (!dbState.food_stores) dbState.food_stores = [];
    const idx = dbState.food_stores.findIndex((s) => s.companyId === store.companyId);
    if (idx === -1) {
      dbState.food_stores.push(store);
    } else {
      dbState.food_stores[idx] = { ...dbState.food_stores[idx], ...store, updatedAt: Date.now() };
    }
    saveDatabaseSync();
    return store;
  },

  getFoodCategoriesByCompanyId: (companyId: string): FoodCategory[] => {
    return (dbState.food_categories || [])
      .filter((c) => c.companyId === companyId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  },
  createFoodCategory: (category: FoodCategory): FoodCategory => {
    if (!dbState.food_categories) dbState.food_categories = [];
    dbState.food_categories.push(category);
    saveDatabaseSync();
    return category;
  },
  updateFoodCategory: (id: string, updates: Partial<FoodCategory>): FoodCategory | null => {
    if (!dbState.food_categories) return null;
    const idx = dbState.food_categories.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    dbState.food_categories[idx] = { ...dbState.food_categories[idx], ...updates };
    saveDatabaseSync();
    return dbState.food_categories[idx];
  },
  deleteFoodCategory: (id: string): boolean => {
    if (!dbState.food_categories) return false;
    const initialLen = dbState.food_categories.length;
    dbState.food_categories = dbState.food_categories.filter((c) => c.id !== id);
    const deleted = dbState.food_categories.length < initialLen;
    if (deleted) saveDatabaseSync();
    return deleted;
  },

  getFoodProductsByCompanyId: (companyId: string): FoodProduct[] => {
    return (dbState.food_products || [])
      .filter((p) => p.companyId === companyId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  },
  getFoodProductById: (productId: string): FoodProduct | undefined => {
    return (dbState.food_products || []).find((p) => p.id === productId);
  },
  createFoodProduct: (product: FoodProduct): FoodProduct => {
    if (!dbState.food_products) dbState.food_products = [];
    dbState.food_products.push(product);
    saveDatabaseSync();
    return product;
  },
  updateFoodProduct: (productId: string, updates: Partial<FoodProduct>): FoodProduct | null => {
    if (!dbState.food_products) return null;
    const idx = dbState.food_products.findIndex((p) => p.id === productId);
    if (idx === -1) return null;
    dbState.food_products[idx] = { ...dbState.food_products[idx], ...updates };
    saveDatabaseSync();
    return dbState.food_products[idx];
  },
  deleteFoodProduct: (productId: string): boolean => {
    if (!dbState.food_products) return false;
    const initialLen = dbState.food_products.length;
    dbState.food_products = dbState.food_products.filter((p) => p.id !== productId);
    const deleted = dbState.food_products.length < initialLen;
    if (deleted) saveDatabaseSync();
    return deleted;
  },

  getFoodShippingRateByCompanyId: (companyId: string): FoodShippingRate | undefined => {
    return (dbState.food_shipping_rates || []).find((r) => r.companyId === companyId);
  },
  upsertFoodShippingRate: (rate: FoodShippingRate): FoodShippingRate => {
    if (!dbState.food_shipping_rates) dbState.food_shipping_rates = [];
    const idx = dbState.food_shipping_rates.findIndex((r) => r.companyId === rate.companyId);
    if (idx === -1) {
      dbState.food_shipping_rates.push(rate);
    } else {
      dbState.food_shipping_rates[idx] = { ...dbState.food_shipping_rates[idx], ...rate };
    }
    saveDatabaseSync();
    return rate;
  },

  getFoodOrdersByCompanyId: (companyId: string): FoodOrder[] => {
    return (dbState.food_orders || [])
      .filter((o) => o.companyId === companyId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
  getFoodOrderById: (orderId: string): FoodOrder | undefined => {
    return (dbState.food_orders || []).find((o) => o.id === orderId);
  },
  getFoodOrderByPickupCode: (pickupCode: string): FoodOrder | undefined => {
    return (dbState.food_orders || []).find((o) => o.pickupCode === pickupCode);
  },
  createFoodOrder: (order: FoodOrder): FoodOrder => {
    if (!dbState.food_orders) dbState.food_orders = [];
    dbState.food_orders.unshift(order);
    saveDatabaseSync();
    return order;
  },
  updateFoodOrder: (orderId: string, updates: Partial<FoodOrder>): FoodOrder | null => {
    if (!dbState.food_orders) return null;
    const idx = dbState.food_orders.findIndex((o) => o.id === orderId);
    if (idx === -1) return null;
    dbState.food_orders[idx] = { ...dbState.food_orders[idx], ...updates, updatedAt: Date.now() };
    saveDatabaseSync();
    return dbState.food_orders[idx];
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
