/**
 * UBIKA - Platform Data Models & Types
 * Coordinación, Seguimiento y Gestión Logística
 */

export type DeliveryStatus =
  | 'asignado'
  | 'esperando_autorizacion'
  | 'ubicacion_compartida'
  | 'en_camino'
  | 'cerca'
  | 'entregado'
  | 'rechazado'
  | 'cancelado'
  | 'expirado'
  | 'fallido';

export type TaskPriority = 'normal' | 'alta' | 'urgente';

export type DriverStatus = 'disponible' | 'en_tarea' | 'pausado' | 'desconectado' | 'inactivo';

export type VehicleType = 'moto' | 'bici' | 'auto' | 'a_pie' | 'camioneta';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  updatedAt: number;
  addressHint?: string;
  noteFromRecipient?: string;
}

export interface DriverLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  updatedAt: number;
  speed?: number | null;
  heading?: number | null;
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  speed?: number | null;
}

export interface Company {
  id: string;
  name: string;
  category: 'Restaurante / Comidas' | 'Farmacia / Salud' | 'Mensajería y Cadetería' | 'Servicios Técnicos' | 'Supermercado / Almacén' | 'Distribuidora';
  address: string;
  phone: string;
  city: string;
  activeOrdersCount: number;
  totalDriversCount: number;
}

export interface Driver {
  id: string;
  companyId: string;
  name: string;
  phone: string;
  email: string;
  internalId: string; // e.g. "R-03"
  vehicle: VehicleType;
  status: DriverStatus;
  createdAt: number;
  currentLocation?: DriverLocation | null;
  activeDeliveryId?: string | null;
  totalDeliveries: number;
  rating: number;
  lastActiveAt: number;
  speedKmH?: number;
}

export interface Delivery {
  id: string;
  orderNumber: number;
  companyId: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  driverVehicle: VehicleType;
  recipientPhone: string;
  recipientName?: string;
  description: string;
  instructions?: string;
  amount?: string;
  paymentMethod?: 'Efectivo' | 'Transferencia / MP' | 'Tarjeta al recibir' | 'Pagado online';
  priority: TaskPriority;
  notes?: string;
  sessionToken: string;
  status: DeliveryStatus;
  
  // Timestamps
  createdAt: number;
  assignedAt?: number;
  acceptedAt?: number;
  startedAt?: number;
  arrivedAt?: number;
  endedAt?: number;
  expiresAt: number;
  authorizedAt?: number;

  // Locations & Navigation
  recipientLocation?: LocationCoords | null;
  driverLocation?: DriverLocation | null;
  routeHistory?: RoutePoint[];
  distanceMeters?: number;
  etaMinutes?: number;
  privacyPolicyPurged?: boolean;
}

export interface DeliveryEvent {
  id: string;
  companyId?: string;
  deliveryId: string;
  orderNumber: number;
  type:
    | 'DELIVERY_CREATED'
    | 'DRIVER_ASSIGNED'
    | 'DRIVER_ACCEPTED'
    | 'DRIVER_REJECTED'
    | 'DELIVERY_STARTED'
    | 'LOCATION_REQUESTED'
    | 'LOCATION_SHARED'
    | 'DRIVER_ARRIVED'
    | 'DELIVERY_COMPLETED'
    | 'DELIVERY_CANCELLED'
    | 'LOCATION_PURGED';
  description: string;
  timestamp: number;
  author: string;
  actorId?: string;
  actorRole?: string;
  metadata?: Record<string, any>;
}

export interface PublicSessionData {
  id: string;
  orderNumber: number;
  driverName: string;
  driverPhone: string;
  driverVehicle: VehicleType;
  recipientPhoneMasked: string;
  recipientName?: string;
  description: string;
  instructions?: string;
  amount?: string;
  status: DeliveryStatus;
  createdAt: number;
  expiresAt: number;
  isExpired: boolean;
  isAuthorized: boolean;
  driverLocation?: {
    latitude: number;
    longitude: number;
    updatedAt: number;
  } | null;
  distanceMeters?: number;
  recipientHasLocation?: boolean;
}

export interface DriverProfile {
  id: string;
  name: string;
  phone: string;
  vehicle: VehicleType;
  businessName?: string;
  totalDeliveries: number;
  autoPurgePrivacyMinutes: number;
}

export interface DashboardMetrics {
  activeDrivers: number;
  availableDrivers: number;
  pendingDeliveries: number;
  inProgressDeliveries: number;
  completedDeliveries: number;
  delayedDeliveries: number;
  cancelledDeliveries: number;
  totalRevenue: string;
}

export interface WhatsAppMessagePayload {
  recipientPhone: string;
  customerUrl: string;
  messageText: string;
  orderNumber: number;
  description: string;
}
