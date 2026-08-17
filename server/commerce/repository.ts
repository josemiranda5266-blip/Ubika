import { db } from '../db';
import {
  CommerceCategory,
  CommerceProduct,
  CommerceCustomer,
  StockMovement,
  CashSession,
  Sale,
  Invoice,
} from './types';

export const CommerceRepository = {
  // Categories
  getCategoriesByCompany: (companyId: string): CommerceCategory[] => {
    const state = db.getRawState();
    const categories = (state as any).commerce_categories || [];
    return categories.filter((c: CommerceCategory) => c.companyId === companyId);
  },
  getCategoryById: (id: string): CommerceCategory | undefined => {
    const state = db.getRawState();
    const categories = (state as any).commerce_categories || [];
    return categories.find((c: CommerceCategory) => c.id === id);
  },
  createCategory: (category: CommerceCategory): CommerceCategory => {
    const state = db.getRawState() as any;
    if (!state.commerce_categories) state.commerce_categories = [];
    state.commerce_categories.push(category);
    db.createBackup(); // or save via persistence
    return category;
  },
  updateCategory: (id: string, updates: Partial<CommerceCategory>): CommerceCategory | null => {
    const state = db.getRawState() as any;
    const categories = state.commerce_categories || [];
    const idx = categories.findIndex((c: CommerceCategory) => c.id === id);
    if (idx === -1) return null;
    categories[idx] = { ...categories[idx], ...updates };
    return categories[idx];
  },
  deleteCategory: (id: string): boolean => {
    const state = db.getRawState() as any;
    const categories = state.commerce_categories || [];
    const initialLen = categories.length;
    state.commerce_categories = categories.filter((c: CommerceCategory) => c.id !== id);
    return state.commerce_categories.length < initialLen;
  },

  // Products
  getProductsByCompany: (companyId: string): CommerceProduct[] => {
    const state = db.getRawState();
    const products = (state as any).commerce_products || [];
    return products.filter((p: CommerceProduct) => p.companyId === companyId);
  },
  getProductById: (id: string): CommerceProduct | undefined => {
    const state = db.getRawState();
    const products = (state as any).commerce_products || [];
    return products.find((p: CommerceProduct) => p.id === id);
  },
  createProduct: (product: CommerceProduct): CommerceProduct => {
    const state = db.getRawState() as any;
    if (!state.commerce_products) state.commerce_products = [];
    state.commerce_products.push(product);
    return product;
  },
  updateProduct: (id: string, updates: Partial<CommerceProduct>): CommerceProduct | null => {
    const state = db.getRawState() as any;
    const products = state.commerce_products || [];
    const idx = products.findIndex((p: CommerceProduct) => p.id === id);
    if (idx === -1) return null;
    products[idx] = { ...products[idx], ...updates, updatedAt: Date.now() };
    return products[idx];
  },
  deleteProduct: (id: string): boolean => {
    const state = db.getRawState() as any;
    const products = state.commerce_products || [];
    const initialLen = products.length;
    state.commerce_products = products.filter((p: CommerceProduct) => p.id !== id);
    return state.commerce_products.length < initialLen;
  },

  // Customers
  getCustomersByCompany: (companyId: string): CommerceCustomer[] => {
    const state = db.getRawState();
    const customers = (state as any).commerce_customers || [];
    return customers.filter((c: CommerceCustomer) => c.companyId === companyId);
  },
  getCustomerById: (id: string): CommerceCustomer | undefined => {
    const state = db.getRawState();
    const customers = (state as any).commerce_customers || [];
    return customers.find((c: CommerceCustomer) => c.id === id);
  },
  createCustomer: (customer: CommerceCustomer): CommerceCustomer => {
    const state = db.getRawState() as any;
    if (!state.commerce_customers) state.commerce_customers = [];
    state.commerce_customers.push(customer);
    return customer;
  },
  updateCustomer: (id: string, updates: Partial<CommerceCustomer>): CommerceCustomer | null => {
    const state = db.getRawState() as any;
    const customers = state.commerce_customers || [];
    const idx = customers.findIndex((c: CommerceCustomer) => c.id === id);
    if (idx === -1) return null;
    customers[idx] = { ...customers[idx], ...updates };
    return customers[idx];
  },
  deleteCustomer: (id: string): boolean => {
    const state = db.getRawState() as any;
    const customers = state.commerce_customers || [];
    const initialLen = customers.length;
    state.commerce_customers = customers.filter((c: CommerceCustomer) => c.id !== id);
    return state.commerce_customers.length < initialLen;
  },

  // Stock Movements
  getStockMovementsByCompany: (companyId: string): StockMovement[] => {
    const state = db.getRawState();
    const movements = (state as any).commerce_stock_movements || [];
    return movements.filter((m: StockMovement) => m.companyId === companyId);
  },
  createStockMovement: (movement: StockMovement): StockMovement => {
    const state = db.getRawState() as any;
    if (!state.commerce_stock_movements) state.commerce_stock_movements = [];
    state.commerce_stock_movements.unshift(movement);
    return movement;
  },

  // Cash Sessions
  getCashSessionsByCompany: (companyId: string): CashSession[] => {
    const state = db.getRawState();
    const sessions = (state as any).commerce_cash_sessions || [];
    return sessions.filter((s: CashSession) => s.companyId === companyId);
  },
  getCurrentOpenCashSession: (companyId: string, userId?: string): CashSession | undefined => {
    const state = db.getRawState();
    const sessions = (state as any).commerce_cash_sessions || [];
    return sessions.find((s: CashSession) => s.companyId === companyId && s.status === 'OPEN' && (!userId || s.userId === userId));
  },
  createCashSession: (session: CashSession): CashSession => {
    const state = db.getRawState() as any;
    if (!state.commerce_cash_sessions) state.commerce_cash_sessions = [];
    state.commerce_cash_sessions.unshift(session);
    return session;
  },
  updateCashSession: (id: string, updates: Partial<CashSession>): CashSession | null => {
    const state = db.getRawState() as any;
    const sessions = state.commerce_cash_sessions || [];
    const idx = sessions.findIndex((s: CashSession) => s.id === id);
    if (idx === -1) return null;
    sessions[idx] = { ...sessions[idx], ...updates };
    return sessions[idx];
  },

  // Sales
  getSalesByCompany: (companyId: string): Sale[] => {
    const state = db.getRawState();
    const sales = (state as any).commerce_sales || [];
    return sales.filter((s: Sale) => s.companyId === companyId);
  },
  getSaleById: (id: string): Sale | undefined => {
    const state = db.getRawState();
    const sales = (state as any).commerce_sales || [];
    return sales.find((s: Sale) => s.id === id);
  },
  getSaleByIdempotencyKey: (key: string): Sale | undefined => {
    const state = db.getRawState();
    const sales = (state as any).commerce_sales || [];
    return sales.find((s: Sale) => s.idempotencyKey === key);
  },
  createSale: (sale: Sale): Sale => {
    const state = db.getRawState() as any;
    if (!state.commerce_sales) state.commerce_sales = [];
    state.commerce_sales.unshift(sale);
    return sale;
  },
  updateSale: (id: string, updates: Partial<Sale>): Sale | null => {
    const state = db.getRawState() as any;
    const sales = state.commerce_sales || [];
    const idx = sales.findIndex((s: Sale) => s.id === id);
    if (idx === -1) return null;
    sales[idx] = { ...sales[idx], ...updates, updatedAt: Date.now() };
    return sales[idx];
  },

  // Invoices
  getInvoicesByCompany: (companyId: string): Invoice[] => {
    const state = db.getRawState();
    const invoices = (state as any).commerce_invoices || [];
    return invoices.filter((i: Invoice) => i.companyId === companyId);
  },
  createInvoice: (invoice: Invoice): Invoice => {
    const state = db.getRawState() as any;
    if (!state.commerce_invoices) state.commerce_invoices = [];
    state.commerce_invoices.unshift(invoice);
    return invoice;
  },
};
