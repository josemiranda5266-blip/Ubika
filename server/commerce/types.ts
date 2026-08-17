export interface CommerceCategory {
  id: string;
  companyId: string;
  branchId?: string;
  name: string;
  description?: string;
  createdAt: number;
}

export interface CommerceProduct {
  id: string;
  companyId: string;
  branchId?: string;
  name: string;
  description?: string;
  code?: string;
  barcode?: string;
  categoryId: string;
  costPrice: number;
  salePrice: number;
  taxRate: number; // e.g. 21.0 for 21%
  stock: number;
  minStock: number;
  maxStock: number;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  createdAt: number;
  updatedAt: number;
}

export interface CommerceCustomer {
  id: string;
  companyId: string;
  name: string;
  email?: string;
  phone?: string;
  documentNumber?: string;
  documentType?: 'DNI' | 'CUIT' | 'CUIL' | 'PASSPORT';
  address?: string;
  accountBalance: number;
  creditLimit: number;
  taxCondition: 'RESPONSABLE_INSCRIPTO' | 'MONOTRIBUTO' | 'CONSUMIDOR_FINAL' | 'EXENTO';
  createdAt: number;
}

export interface StockMovement {
  id: string;
  productId: string;
  companyId: string;
  branchId?: string;
  type: 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'VENTA' | 'DEVOLUCION' | 'TRANSFERENCIA';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  userId: string;
  createdAt: number;
}

export interface CashSession {
  id: string;
  companyId: string;
  branchId?: string;
  userId: string;
  openedAt: number;
  closedAt?: number;
  closedBy?: string;
  initialCash: number;
  expectedCash?: number;
  countedCash?: number;
  difference?: number;
  status: 'OPEN' | 'CLOSED';
  notes?: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  subtotal: number;
  total: number;
}

export interface SalePayment {
  id: string;
  method: 'CASH' | 'DEBIT' | 'CREDIT' | 'TRANSFER' | 'MERCADO_PAGO' | 'ACCOUNT';
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'REJECTED' | 'REFUNDED';
  externalReference?: string;
  providerResponse?: any;
  createdAt: number;
}

export interface Sale {
  id: string;
  companyId: string;
  branchId?: string;
  customerId?: string;
  cashSessionId?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  surcharge: number;
  tax: number;
  total: number;
  payments: SalePayment[];
  status: 'DRAFT' | 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
  idempotencyKey?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface Invoice {
  id: string;
  companyId: string;
  saleId: string;
  voucherType: 'FACTURA_A' | 'FACTURA_B' | 'FACTURA_C' | 'TICKET';
  pointOfSale: number;
  invoiceNumber: number;
  cuit: string;
  customerDocument: string;
  customerName: string;
  subtotal: number;
  tax: number;
  total: number;
  cae: string;
  caeExpiration: string;
  status: 'APPROVED' | 'REJECTED' | 'PENDING' | 'SIMULATED';
  arcaResponse?: any;
  createdAt: number;
}
