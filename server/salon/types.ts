export type RestaurantTableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';

export type DiningOrderOrigin = 'WAITER' | 'TABLE_QR';

export type DiningOrderStatus =
  | 'OPEN'
  | 'SENT_TO_KITCHEN'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'REQUESTED_BILL'
  | 'CLOSED'
  | 'CANCELLED';

/**
 * Persistent configuration for a physical table in a business.
 * The QR token is public-facing and must never contain company/user secrets.
 */
export interface RestaurantTable {
  id: string;
  companyId: string;
  branchId?: string;
  number: number;
  name?: string;
  capacity: number;
  area?: string;
  status: RestaurantTableStatus;
  active: boolean;
  publicQrToken: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Canonical salon command. This is operational state, not a financial sale.
 * A Sale is created only when the account is actually charged/finalized.
 */
export interface DiningOrder {
  id: string;
  companyId: string;
  branchId?: string;
  tableId: string;
  waiterId?: string;
  waiterName?: string;
  origin: DiningOrderOrigin;
  status: DiningOrderStatus;
  foodOrderId?: string;
  saleId?: string;
  customerId?: string;
  customerName?: string;
  items: DiningOrderItem[];
  notes?: string;
  subtotal: number;
  total: number;
  createdAt: number;
  updatedAt: number;
  closedAt?: number;
}

export interface DiningOrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  selections?: Array<{
    groupId: string;
    optionId: string;
    name: string;
    price: number;
  }>;
}

/**
 * Public resolution result for a scanned table QR.
 * Never expose internal user identifiers, credentials, or private company data.
 */
export interface PublicTableQrResolution {
  companyId: string;
  tableId: string;
  tableNumber: number;
  tableName?: string;
  area?: string;
  active: boolean;
}

export const RESTAURANT_TABLE_STATUSES: readonly RestaurantTableStatus[] = [
  'AVAILABLE',
  'OCCUPIED',
  'RESERVED',
] as const;

export const DINING_ORDER_STATUSES: readonly DiningOrderStatus[] = [
  'OPEN',
  'SENT_TO_KITCHEN',
  'PREPARING',
  'READY',
  'SERVED',
  'REQUESTED_BILL',
  'CLOSED',
  'CANCELLED',
] as const;
