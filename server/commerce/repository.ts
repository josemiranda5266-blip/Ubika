import { db, saveDatabaseSync } from '../db';
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
  getCategoryByIdForCompany: (id: string, companyId: string): CommerceCategory | undefined => {
    const cat = CommerceRepository.getCategoryById(id);
    if (!cat || cat.companyId !== companyId) return undefined;
    return cat;
  },
  createCategory: (category: CommerceCategory): CommerceCategory => {
    const state = db.getRawState() as any;
    if (!state.commerce_categories) state.commerce_categories = [];
    const idx = state.commerce_categories.findIndex((c: CommerceCategory) => c.id === category.id);
    if (idx >= 0) {
      state.commerce_categories[idx] = category;
    } else {
      state.commerce_categories.push(category);
    }
    saveDatabaseSync();
    return category;
  },
  updateCategory: (id: string, updates: Partial<CommerceCategory>): CommerceCategory | null => {
    const state = db.getRawState() as any;
    const categories = state.commerce_categories || [];
    const idx = categories.findIndex((c: CommerceCategory) => c.id === id);
    if (idx === -1) return null;
    categories[idx] = { ...categories[idx], ...updates };
    saveDatabaseSync();
    return categories[idx];
  },
  deleteCategory: (id: string): boolean => {
    const state = db.getRawState() as any;
    const categories = state.commerce_categories || [];
    const initialLen = categories.length;
    state.commerce_categories = categories.filter((c: CommerceCategory) => c.id !== id);
    if (state.commerce_categories.length < initialLen) {
      saveDatabaseSync();
      return true;
    }
    return false;
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
  getProductByIdForCompany: (id: string, companyId: string): CommerceProduct | undefined => {
    const product = CommerceRepository.getProductById(id);
    if (!product || product.companyId !== companyId) return undefined;
    return product;
  },
  createProduct: (product: CommerceProduct): CommerceProduct => {
    const state = db.getRawState() as any;
    if (!state.commerce_products) state.commerce_products = [];
    const idx = state.commerce_products.findIndex((p: CommerceProduct) => p.id === product.id);
    if (idx >= 0) {
      state.commerce_products[idx] = product;
    } else {
      state.commerce_products.push(product);
    }
    saveDatabaseSync();
    return product;
  },
  updateProduct: (id: string, updates: Partial<CommerceProduct>): CommerceProduct | null => {
    const state = db.getRawState() as any;
    const products = state.commerce_products || [];
    const idx = products.findIndex((p: CommerceProduct) => p.id === id);
    if (idx === -1) return null;
    products[idx] = { ...products[idx], ...updates, updatedAt: Date.now() };
    saveDatabaseSync();
    return products[idx];
  },
  deleteProduct: (id: string): boolean => {
    const state = db.getRawState() as any;
    const products = state.commerce_products || [];
    const initialLen = products.length;
    state.commerce_products = products.filter((p: CommerceProduct) => p.id !== id);
    if (state.commerce_products.length < initialLen) {
      saveDatabaseSync();
      return true;
    }
    return false;
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
  getCustomerByIdForCompany: (id: string, companyId: string): CommerceCustomer | undefined => {
    const cust = CommerceRepository.getCustomerById(id);
    if (!cust || cust.companyId !== companyId) return undefined;
    return cust;
  },
  createCustomer: (customer: CommerceCustomer): CommerceCustomer => {
    const state = db.getRawState() as any;
    if (!state.commerce_customers) state.commerce_customers = [];
    const idx = state.commerce_customers.findIndex((c: CommerceCustomer) => c.id === customer.id);
    if (idx >= 0) {
      state.commerce_customers[idx] = customer;
    } else {
      state.commerce_customers.push(customer);
    }
    saveDatabaseSync();
    return customer;
  },
  updateCustomer: (id: string, updates: Partial<CommerceCustomer>): CommerceCustomer | null => {
    const state = db.getRawState() as any;
    const customers = state.commerce_customers || [];
    const idx = customers.findIndex((c: CommerceCustomer) => c.id === id);
    if (idx === -1) return null;
    customers[idx] = { ...customers[idx], ...updates };
    saveDatabaseSync();
    return customers[idx];
  },
  deleteCustomer: (id: string): boolean => {
    const state = db.getRawState() as any;
    const customers = state.commerce_customers || [];
    const initialLen = customers.length;
    state.commerce_customers = customers.filter((c: CommerceCustomer) => c.id !== id);
    if (state.commerce_customers.length < initialLen) {
      saveDatabaseSync();
      return true;
    }
    return false;
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
    saveDatabaseSync();
    return movement;
  },
  deleteStockMovement: (id: string): boolean => {
    const state = db.getRawState() as any;
    const movements = state.commerce_stock_movements || [];
    const initialLen = movements.length;
    state.commerce_stock_movements = movements.filter((m: StockMovement) => m.id !== id);
    if (state.commerce_stock_movements.length < initialLen) {
      saveDatabaseSync();
      return true;
    }
    return false;
  },
  deleteStockMovementsByIds: (ids: string[]): void => {
    if (!ids || ids.length === 0) return;
    const state = db.getRawState() as any;
    const idsSet = new Set(ids);
    state.commerce_stock_movements = (state.commerce_stock_movements || []).filter((m: StockMovement) => !idsSet.has(m.id));
    saveDatabaseSync();
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
  getCashSessionById: (id: string): CashSession | undefined => {
    const state = db.getRawState();
    const sessions = (state as any).commerce_cash_sessions || [];
    return sessions.find((s: CashSession) => s.id === id);
  },
  getCashSessionByIdForCompany: (id: string, companyId: string): CashSession | undefined => {
    const session = CommerceRepository.getCashSessionById(id);
    if (!session || session.companyId !== companyId) return undefined;
    return session;
  },
  createCashSession: (session: CashSession): CashSession => {
    const state = db.getRawState() as any;
    if (!state.commerce_cash_sessions) state.commerce_cash_sessions = [];
    const idx = state.commerce_cash_sessions.findIndex((c: CashSession) => c.id === session.id);
    if (idx >= 0) {
      state.commerce_cash_sessions[idx] = session;
    } else {
      state.commerce_cash_sessions.unshift(session);
    }
    saveDatabaseSync();
    return session;
  },
  updateCashSession: (id: string, updates: Partial<CashSession>): CashSession | null => {
    const state = db.getRawState() as any;
    const sessions = state.commerce_cash_sessions || [];
    const idx = sessions.findIndex((s: CashSession) => s.id === id);
    if (idx === -1) return null;
    sessions[idx] = { ...sessions[idx], ...updates };
    saveDatabaseSync();
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
  getSaleByIdForCompany: (id: string, companyId: string): Sale | undefined => {
    const sale = CommerceRepository.getSaleById(id);
    if (!sale || sale.companyId !== companyId) return undefined;
    return sale;
  },
  getSaleByIdempotencyKey: (companyId: string, key: string): Sale | undefined => {
    const state = db.getRawState();
    const sales = (state as any).commerce_sales || [];
    return sales.find((s: Sale) => s.companyId === companyId && s.idempotencyKey === key);
  },
  createSale: (sale: Sale): Sale => {
    const state = db.getRawState() as any;
    if (!state.commerce_sales) state.commerce_sales = [];
    const idx = state.commerce_sales.findIndex((s: Sale) => s.id === sale.id);
    if (idx >= 0) {
      state.commerce_sales[idx] = sale;
    } else {
      state.commerce_sales.unshift(sale);
    }
    saveDatabaseSync();
    return sale;
  },
  updateSale: (id: string, updates: Partial<Sale>): Sale | null => {
    const state = db.getRawState() as any;
    const sales = state.commerce_sales || [];
    const idx = sales.findIndex((s: Sale) => s.id === id);
    if (idx === -1) return null;
    sales[idx] = { ...sales[idx], ...updates, updatedAt: Date.now() };
    saveDatabaseSync();
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
    const idx = state.commerce_invoices.findIndex((i: Invoice) => i.id === invoice.id);
    if (idx >= 0) {
      state.commerce_invoices[idx] = invoice;
    } else {
      state.commerce_invoices.unshift(invoice);
    }
    saveDatabaseSync();
    return invoice;
  },

  // Branches
  getBranchByIdForCompany: (id: string, companyId: string): any => {
    const state = db.getRawState() as any;
    const branches = state.commerce_branches || [];
    const found = branches.find((b: any) => b.id === id && b.companyId === companyId);
    if (found) return found;
    const company = db.getCompanyById(companyId) as any;
    if (company && Array.isArray(company.branches)) {
      return company.branches.find((b: any) => (typeof b === 'string' ? b === id : b.id === id));
    }
    return null;
  },
};
