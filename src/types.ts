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
  category: 'Restaurante / Comidas' | 'Farmacia / Salud' | 'Mensajería y Cadetería' | 'Servicios Técnicos' | 'Supermercado / Almacén' | 'Distribuidora' | 'Gastronomía';
  address: string;
  phone: string;
  city: string;
  activeOrdersCount: number;
  totalDriversCount: number;
  businessType?: 'LOGISTICS' | 'FOOD' | 'HYBRID';
  foodEnabled?: boolean;
}

export function isFoodAuthorizedCompany(company?: Company | null): boolean {
  if (!company) return false;
  if (company.foodEnabled === false) return false;
  return company.businessType === 'FOOD' || company.businessType === 'HYBRID';
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
  
  // Logistics Task Type & Food Integration
  taskType?: 'FOOD_DELIVERY' | 'FOOD_PICKUP' | 'PARCEL' | 'DOCUMENT';
  foodOrderId?: string | null;
  itemsSummary?: string;
}

export type EventType =
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
  | 'LOCATION_PURGED'
  | 'FOOD_ORDER_CREATED'
  | 'FOOD_ORDER_ACCEPTED'
  | 'FOOD_ORDER_CANCELLED'
  | 'FOOD_ORDER_PREPARING'
  | 'FOOD_ORDER_READY'
  | 'FOOD_DELIVERY_ASSIGNED'
  | 'FOOD_ORDER_PICKUP_READY'
  | 'FOOD_ORDER_PICKED_UP'
  | 'FOOD_PAYMENT_PENDING'
  | 'FOOD_PAYMENT_APPROVED'
  | 'FOOD_PAYMENT_REJECTED'
  | 'FOOD_DELIVERY_STARTED'
  | 'FOOD_DELIVERY_COMPLETED';

export interface DeliveryEvent {
  id: string;
  companyId?: string;
  deliveryId: string;
  orderNumber: number;
  type: EventType;
  description: string;
  timestamp: number;
  author: string;
  actorId?: string;
  actorRole?: string;
  metadata?: Record<string, any>;
}

// ==========================================
// UBIKA FOOD - GASTRONOMIC PLATFORM MODELS
// ==========================================

export interface FoodSchedule {
  dayOfWeek: number; // 0=Sunday, 1=Monday... 6=Saturday
  openTime: string; // e.g. "12:00"
  closeTime: string; // e.g. "23:00"
  isOpen: boolean;
}

export interface FoodBankInfo {
  bankName: string;
  alias: string;
  cbu: string;
  holderName: string;
  cuit?: string;
}

export interface FoodStore {
  companyId: string;
  foodEnabled: boolean;
  name: string;
  description: string;
  address: string;
  phone: string;
  whatsappNumber: string;
  logoUrl?: string;
  coverImageUrl?: string;
  isOpenManual: boolean; // Merchant toggle: Force Open / Closed
  schedule: FoodSchedule[];
  bankInfo: FoodBankInfo;
  createdAt: number;
  updatedAt: number;
}

export interface FoodCategory {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  icon?: string;
  displayOrder: number;
  sortOrder?: number;
  active: boolean;
  isActive?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface FoodOption {
  id: string;
  name: string;
  price: number;
}

export interface FoodOptionGroup {
  id: string;
  name: string; // e.g. "Adicionales", "Salsa", "Cocción"
  required: boolean;
  minSelections?: number;
  maxSelections?: number;
  options: FoodOption[];
}

export interface FoodProduct {
  id: string;
  companyId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  displayOrder: number;
  optionGroups?: FoodOptionGroup[];
}

export interface FoodShippingRate {
  companyId: string;
  baseFee: number;
  includedKm: number; // e.g. 2 km included in baseFee
  perKmFee: number; // e.g. $500 per km above includedKm
  maxDistanceKm: number; // e.g. 15 km max delivery radius
  freeShippingThreshold?: number | null; // Optional free shipping above amount
  storeLatitude: number;
  storeLongitude: number;
}

export interface FoodOrderItemSelection {
  optionGroupId: string;
  optionGroupName: string;
  optionId: string;
  optionName: string;
  price: number;
}

export interface FoodOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  selectedOptions: FoodOrderItemSelection[];
  itemNotes?: string;
  totalPrice: number;
}

export type FoodDeliveryType = 'FOOD_DELIVERY' | 'FOOD_PICKUP';
export type FoodPaymentMethod = 'TRANSFER' | 'MERCADOPAGO' | 'CASH';
export type FoodPaymentStatus = 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED' | 'REFUNDED';
export type FoodOrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'ASSIGNED'
  | 'DRIVER_ACCEPTED'
  | 'IN_TRANSIT'
  | 'NEAR_DESTINATION'
  | 'DELIVERED'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'CANCELLED';

export interface FoodOrder {
  id: string;
  orderNumber: number;
  companyId: string;
  deliveryType: FoodDeliveryType;
  items: FoodOrderItem[];
  subtotal: number;
  shippingCost: number;
  totalAmount: number;
  
  // Customer
  recipientName: string;
  recipientPhone: string;
  generalNotes?: string;
  
  // Location & Address
  deliveryAddress?: string;
  recipientLocation?: LocationCoords | null;
  
  // Payment
  paymentMethod: FoodPaymentMethod;
  paymentStatus: FoodPaymentStatus;
  bankTransferReportedAt?: number;
  
  // Pickup Reservation Code
  pickupCode?: string; // Unique 5-char code for pickup verification e.g. "A7K29"
  pickupCodeUsedAt?: number;
  pickedUpAt?: number;
  
  // Security Tracking Token for public URLs
  publicTrackingToken?: string;
  
  // Core Logistics Task Link
  deliveryId?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  
  // Timestamps & Audit
  orderStatus: FoodOrderStatus;
  createdAt: number;
  updatedAt: number;
  privacyPolicyPurged?: boolean;
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
