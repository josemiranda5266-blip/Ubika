import { AsyncLocalStorage } from 'node:async_hooks';
import { CommerceRepository } from './repository';
import {
  CommerceProduct,
  Sale,
  StockMovement,
  CashSession,
} from './types';
import { PaymentProviderService } from './payments';
import { ArcaFiscalService } from './fiscal';
import { db, saveDatabaseSync } from '../db';

// Mutex map for idempotency keys
const idempotencyLocks = new Map<string, Promise<Sale>>();

// Product Concurrency Locks (Mutex per product ID for serialization)
const productLocks = new Map<string, Promise<any>>();
const lockContext = new AsyncLocalStorage<Set<string>>();

async function withProductLock<T>(productId: string, fn: () => Promise<T> | T): Promise<T> {
  const activeLocks = lockContext.getStore() || new Set<string>();
  if (activeLocks.has(productId)) {
    // Already held in this async execution flow (re-entrant)
    return await fn();
  }

  const nextLocks = new Set(activeLocks);
  nextLocks.add(productId);

  return lockContext.run(nextLocks, async () => {
    const previousLock = productLocks.get(productId) || Promise.resolve();
    let releaseLock: () => void = () => {};
    const newLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    const chainedLock = previousLock.then(() => newLock);
    productLocks.set(productId, chainedLock);

    await previousLock;
    try {
      return await fn();
    } finally {
      releaseLock();
      if (productLocks.get(productId) === chainedLock) {
        productLocks.delete(productId);
      }
    }
  });
}

async function withMultipleProductLocks<T>(productIds: string[], fn: () => Promise<T> | T): Promise<T> {
  const sortedIds = Array.from(new Set(productIds)).sort();
  async function acquire(index: number): Promise<T> {
    if (index >= sortedIds.length) {
      return await fn();
    }
    return withProductLock(sortedIds[index], () => acquire(index + 1));
  }
  return acquire(0);
}

export const CommerceService = {
  // Categories
  getCategories(companyId: string) {
    return CommerceRepository.getCategoriesByCompany(companyId);
  },
  createCategory(data: any, companyId: string) {
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      throw new Error('CATEGORY_NAME_REQUIRED');
    }
    const category = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyId,
      branchId: data.branchId,
      name: data.name.trim(),
      description: data.description || '',
      createdAt: Date.now(),
    };
    return CommerceRepository.createCategory(category);
  },
  updateCategory(id: string, companyId: string, updates: any) {
    const cat = CommerceRepository.getCategoryByIdForCompany(id, companyId);
    if (!cat) return null;
    const allowed: Partial<any> = {};
    if (updates.name !== undefined) allowed.name = String(updates.name).trim();
    if (updates.description !== undefined) allowed.description = String(updates.description);
    return CommerceRepository.updateCategory(id, allowed);
  },
  deleteCategory(id: string, companyId: string) {
    const cat = CommerceRepository.getCategoryByIdForCompany(id, companyId);
    if (!cat) return false;
    return CommerceRepository.deleteCategory(id);
  },

  // Products
  getProducts(companyId: string) {
    return CommerceRepository.getProductsByCompany(companyId);
  },
  getProduct(id: string, companyId: string) {
    return CommerceRepository.getProductByIdForCompany(id, companyId) || null;
  },
  createProduct(data: any, companyId: string) {
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      throw new Error('PRODUCT_NAME_REQUIRED');
    }
    const salePrice = Number(data.salePrice);
    const costPrice = Number(data.costPrice || 0);
    const taxRate = Number(data.taxRate ?? 21);
    const initialStock = Number(data.stock || 0);

    if (!Number.isFinite(salePrice) || salePrice < 0) throw new Error('INVALID_SALE_PRICE');
    if (!Number.isFinite(costPrice) || costPrice < 0) throw new Error('INVALID_COST_PRICE');
    if (!Number.isFinite(taxRate) || taxRate < 0) throw new Error('INVALID_TAX_RATE');
    if (!Number.isFinite(initialStock) || initialStock < 0) throw new Error('INVALID_STOCK');

    const product: CommerceProduct = {
      id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyId,
      branchId: data.branchId,
      name: data.name.trim(),
      description: data.description || '',
      code: data.code || '',
      barcode: data.barcode || '',
      categoryId: data.categoryId || '',
      costPrice,
      salePrice,
      taxRate,
      stock: initialStock,
      minStock: Number(data.minStock || 5),
      maxStock: Number(data.maxStock || 100),
      status: data.status || 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return CommerceRepository.createProduct(product);
  },
  updateProduct(id: string, companyId: string, updates: any) {
    const product = CommerceRepository.getProductByIdForCompany(id, companyId);
    if (!product) return null;

    // Strict whitelist: prevent mass assignment of id, companyId, stock, createdAt, etc.
    const allowedUpdates: Partial<CommerceProduct> = {};
    if (updates.name !== undefined) {
      if (typeof updates.name !== 'string' || !updates.name.trim()) throw new Error('INVALID_PRODUCT_NAME');
      allowedUpdates.name = updates.name.trim();
    }
    if (updates.description !== undefined) allowedUpdates.description = String(updates.description);
    if (updates.code !== undefined) allowedUpdates.code = String(updates.code);
    if (updates.barcode !== undefined) allowedUpdates.barcode = String(updates.barcode);
    if (updates.categoryId !== undefined) allowedUpdates.categoryId = String(updates.categoryId);
    if (updates.branchId !== undefined) allowedUpdates.branchId = updates.branchId;
    if (updates.status !== undefined) allowedUpdates.status = updates.status;

    if (updates.costPrice !== undefined) {
      const cp = Number(updates.costPrice);
      if (!Number.isFinite(cp) || cp < 0) throw new Error('INVALID_COST_PRICE');
      allowedUpdates.costPrice = cp;
    }
    if (updates.salePrice !== undefined) {
      const sp = Number(updates.salePrice);
      if (!Number.isFinite(sp) || sp < 0) throw new Error('INVALID_SALE_PRICE');
      allowedUpdates.salePrice = sp;
    }
    if (updates.taxRate !== undefined) {
      const tr = Number(updates.taxRate);
      if (!Number.isFinite(tr) || tr < 0) throw new Error('INVALID_TAX_RATE');
      allowedUpdates.taxRate = tr;
    }
    if (updates.minStock !== undefined) allowedUpdates.minStock = Number(updates.minStock);
    if (updates.maxStock !== undefined) allowedUpdates.maxStock = Number(updates.maxStock);

    return CommerceRepository.updateProduct(id, allowedUpdates);
  },
  deleteProduct(id: string, companyId: string) {
    const product = CommerceRepository.getProductByIdForCompany(id, companyId);
    if (!product) return false;
    return CommerceRepository.deleteProduct(id);
  },

  // Customers
  getCustomers(companyId: string) {
    return CommerceRepository.getCustomersByCompany(companyId);
  },
  getCustomer(id: string, companyId: string) {
    return CommerceRepository.getCustomerByIdForCompany(id, companyId) || null;
  },
  createCustomer(data: any, companyId: string) {
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      throw new Error('CUSTOMER_NAME_REQUIRED');
    }
    const customer = {
      id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyId,
      name: data.name.trim(),
      email: data.email || '',
      phone: data.phone || '',
      documentNumber: data.documentNumber || '',
      documentType: data.documentType || 'DNI',
      address: data.address || '',
      accountBalance: Number(data.accountBalance || 0),
      creditLimit: Number(data.creditLimit || 0),
      taxCondition: data.taxCondition || 'CONSUMIDOR_FINAL',
      createdAt: Date.now(),
    };
    return CommerceRepository.createCustomer(customer);
  },
  updateCustomer(id: string, companyId: string, updates: any) {
    const customer = CommerceRepository.getCustomerByIdForCompany(id, companyId);
    if (!customer) return null;

    const allowed: Partial<any> = {};
    if (updates.name !== undefined) allowed.name = String(updates.name).trim();
    if (updates.email !== undefined) allowed.email = String(updates.email);
    if (updates.phone !== undefined) allowed.phone = String(updates.phone);
    if (updates.documentNumber !== undefined) allowed.documentNumber = String(updates.documentNumber);
    if (updates.documentType !== undefined) allowed.documentType = updates.documentType;
    if (updates.address !== undefined) allowed.address = String(updates.address);
    if (updates.accountBalance !== undefined) allowed.accountBalance = Number(updates.accountBalance);
    if (updates.creditLimit !== undefined) allowed.creditLimit = Number(updates.creditLimit);
    if (updates.taxCondition !== undefined) allowed.taxCondition = updates.taxCondition;

    return CommerceRepository.updateCustomer(id, allowed);
  },
  deleteCustomer(id: string, companyId: string) {
    const cust = CommerceRepository.getCustomerByIdForCompany(id, companyId);
    if (!cust) return false;
    return CommerceRepository.deleteCustomer(id);
  },

  // Stock
  getStockMovements(companyId: string) {
    return CommerceRepository.getStockMovementsByCompany(companyId);
  },
  async adjustStock(productId: string, companyId: string, quantity: number, type: 'ENTRADA' | 'SALIDA' | 'AJUSTE', reason: string, userId: string, branchId?: string) {
    return withProductLock(productId, async () => {
      const product = CommerceRepository.getProductByIdForCompany(productId, companyId);
      if (!product) throw new Error('PRODUCT_NOT_FOUND');

      const qty = Number(quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error('INVALID_QUANTITY_MUST_BE_POSITIVE');
      }

      const previousStock = product.stock;
      let newStock = previousStock;
      if (type === 'ENTRADA') newStock += qty;
      else if (type === 'SALIDA') newStock -= qty;
      else if (type === 'AJUSTE') newStock = qty;

      if (newStock < 0) {
        throw new Error('INSUFFICIENT_STOCK_NEGATIVE_RESULT');
      }

      CommerceRepository.updateProduct(productId, { stock: newStock });

      const movement: StockMovement = {
        id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        productId,
        companyId,
        branchId,
        type,
        quantity: qty,
        previousStock,
        newStock,
        reason: reason || 'Ajuste de inventario',
        userId,
        createdAt: Date.now(),
      };
      return CommerceRepository.createStockMovement(movement);
    });
  },

  // Cash
  getCashSessions(companyId: string) {
    return CommerceRepository.getCashSessionsByCompany(companyId);
  },
  getCurrentCashSession(companyId: string, userId?: string) {
    return CommerceRepository.getCurrentOpenCashSession(companyId, userId);
  },
  openCashSession(companyId: string, userId: string, initialCash: number, branchId?: string) {
    const existing = CommerceRepository.getCurrentOpenCashSession(companyId, userId);
    if (existing) throw new Error('CASH_SESSION_ALREADY_OPEN');

    const initCash = Number(initialCash || 0);
    if (!Number.isFinite(initCash) || initCash < 0) throw new Error('INVALID_INITIAL_CASH');

    const session: CashSession = {
      id: `cash_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyId,
      branchId,
      userId,
      openedAt: Date.now(),
      initialCash: initCash,
      status: 'OPEN',
    };
    return CommerceRepository.createCashSession(session);
  },
  closeCashSession(sessionId: string, companyId: string, countedCash: number, notes?: string, userId?: string, userRole?: string) {
    const session = CommerceRepository.getCashSessionByIdForCompany(sessionId, companyId);
    if (!session || session.status !== 'OPEN') {
      throw new Error('CASH_SESSION_NOT_FOUND_OR_CLOSED');
    }

    if (userId && userRole && userRole !== 'SUPER_ADMIN' && userRole !== 'COMPANY_ADMIN' && session.userId !== userId) {
      throw new Error('UNAUTHORIZED_CASH_SESSION_CLOSURE');
    }

    const counted = Number(countedCash);
    if (!Number.isFinite(counted) || counted < 0) throw new Error('INVALID_COUNTED_CASH');

    const sales = CommerceRepository.getSalesByCompany(companyId);
    const sessionSales = sales.filter(s => s.cashSessionId === sessionId || (s.createdAt >= session.openedAt && (!session.closedAt || s.createdAt <= session.closedAt)));
    
    let cashSalesTotal = 0;
    for (const s of sessionSales) {
      for (const p of s.payments) {
        if (p.method === 'CASH') {
          cashSalesTotal += Number(p.amount || 0);
        }
      }
    }

    const expectedCash = session.initialCash + cashSalesTotal;
    const difference = counted - expectedCash;

    return CommerceRepository.updateCashSession(sessionId, {
      closedAt: Date.now(),
      closedBy: userId,
      countedCash: counted,
      expectedCash,
      difference,
      status: 'CLOSED',
      notes: notes || '',
    });
  },

  // Sales
  getSales(companyId: string) {
    return CommerceRepository.getSalesByCompany(companyId);
  },
  getSale(id: string, companyId: string) {
    return CommerceRepository.getSaleByIdForCompany(id, companyId) || null;
  },

  async finalizeSale(saleData: {
    companyId: string;
    branchId?: string;
    customerId?: string;
    items: { productId: string; quantity: number; unitPrice?: number; discount?: number }[];
    payments: { method: 'CASH' | 'DEBIT' | 'CREDIT' | 'TRANSFER' | 'MERCADO_PAGO' | 'ACCOUNT'; amount: number }[];
    discount?: number;
    surcharge?: number;
    idempotencyKey?: string;
    userId: string;
  }): Promise<Sale> {
    const { companyId, branchId, customerId, items, payments, discount = 0, surcharge = 0, idempotencyKey, userId } = saleData;

    if (idempotencyKey) {
      if (idempotencyLocks.has(idempotencyKey)) {
        return idempotencyLocks.get(idempotencyKey)!;
      }
    }

    const promise = (async () => {
      if (idempotencyKey) {
        const existing = CommerceRepository.getSaleByIdempotencyKey(companyId, idempotencyKey);
        if (existing) return existing;
      }

      const productIds = items.map(i => i.productId);

      return withMultipleProductLocks(productIds, async () => {
        if (idempotencyKey) {
          const existing = CommerceRepository.getSaleByIdempotencyKey(companyId, idempotencyKey);
          if (existing) return existing;
        }

        const hasCash = payments.some(p => p.method === 'CASH');
        let openCash = undefined;
        if (hasCash) {
          openCash = CommerceRepository.getCurrentOpenCashSession(companyId, userId);
          if (!openCash) {
            throw new Error('CASH_SESSION_REQUIRED_FOR_CASH_PAYMENTS');
          }
        } else {
          openCash = CommerceRepository.getCurrentOpenCashSession(companyId, userId);
        }

        if (!Array.isArray(items) || items.length === 0) {
          throw new Error('SALE_ITEMS_REQUIRED');
        }

        let subtotal = 0;
        let totalTax = 0;
        const verifiedItems = [];

        for (const rawItem of items) {
          const productId = rawItem.productId;
          const product = CommerceRepository.getProductByIdForCompany(productId, companyId);
          if (!product) {
            throw new Error(`PRODUCT_NOT_FOUND_OR_UNAUTHORIZED:${productId}`);
          }

          const qty = Number(rawItem.quantity);
          if (!Number.isFinite(qty) || qty <= 0) {
            throw new Error('INVALID_QUANTITY_MUST_BE_POSITIVE');
          }

          if (product.stock < qty) {
            throw new Error(`INSUFFICIENT_STOCK_FOR_PRODUCT:${product.name}`);
          }

          const unitPrice = Number(product.salePrice);
          if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            throw new Error('INVALID_PRODUCT_PRICE');
          }

          const itemDiscount = Number(rawItem.discount || 0);
          if (!Number.isFinite(itemDiscount) || itemDiscount < 0) {
            throw new Error('INVALID_ITEM_DISCOUNT');
          }

          const itemSubtotal = (unitPrice * qty) - itemDiscount;
          if (itemSubtotal < 0) throw new Error('ITEM_SUBTOTAL_CANNOT_BE_NEGATIVE');

          const itemTax = itemSubtotal * (product.taxRate / 100);

          subtotal += itemSubtotal;
          totalTax += itemTax;

          verifiedItems.push({
            productId: product.id,
            productName: product.name,
            quantity: qty,
            unitPrice,
            discount: itemDiscount,
            taxRate: product.taxRate,
            subtotal: itemSubtotal,
            total: itemSubtotal + itemTax,
          });
        }

        const netDiscount = Number(discount || 0);
        if (!Number.isFinite(netDiscount) || netDiscount < 0 || netDiscount > subtotal) {
          throw new Error('INVALID_DISCOUNT_AMOUNT');
        }

        const netSurcharge = Number(surcharge || 0);
        if (!Number.isFinite(netSurcharge) || netSurcharge < 0) {
          throw new Error('INVALID_SURCHARGE_AMOUNT');
        }

        const grandTotal = Math.max(0, subtotal - netDiscount + netSurcharge + totalTax);

        if (!Array.isArray(payments) || payments.length === 0) {
          throw new Error('PAYMENTS_REQUIRED');
        }

        const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        if (!Number.isFinite(totalPayments) || Math.abs(totalPayments - grandTotal) > 0.05) {
          throw new Error('PAYMENT_AMOUNT_MISMATCH_WITH_TOTAL');
        }

        const saleId = `sale_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const processedPayments = [];
        for (const p of payments) {
          let extRef = undefined;
          let provResp = undefined;
          let payStatus: 'COMPLETED' | 'PENDING' = 'COMPLETED';

          const pAmount = Number(p.amount);
          if (!Number.isFinite(pAmount) || pAmount <= 0) {
            throw new Error('INVALID_PAYMENT_AMOUNT');
          }

          if (p.method === 'MERCADO_PAGO') {
            const mpResult = await PaymentProviderService.createPayment({
              companyId,
              saleId,
              amount: pAmount,
              paymentMethod: 'credit_card',
              idempotencyKey: idempotencyKey ? `${idempotencyKey}_pay` : undefined,
            });
            extRef = mpResult.externalReference;
            provResp = mpResult.providerResponse;
            payStatus = mpResult.success ? 'COMPLETED' : 'PENDING';
          }

          processedPayments.push({
            id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            method: p.method,
            amount: pAmount,
            status: payStatus,
            externalReference: extRef,
            providerResponse: provResp,
            createdAt: Date.now(),
          });
        }

        const stockAdjustmentsMade: { productId: string; qty: number; previousStock: number; movementId: string }[] = [];
        let saleCreated = false;

        try {
          for (const vItem of verifiedItems) {
            const productBefore = CommerceRepository.getProductByIdForCompany(vItem.productId, companyId);
            if (!productBefore || productBefore.stock < vItem.quantity) {
              throw new Error(`INSUFFICIENT_STOCK_DURING_ADJUSTMENT:${vItem.productId}`);
            }
            const prevStock = productBefore.stock;
            const mov = await CommerceService.adjustStock(
              vItem.productId,
              companyId,
              vItem.quantity,
              'SALIDA',
              `Venta #${saleId}`,
              userId,
              branchId
            );
            stockAdjustmentsMade.push({
              productId: vItem.productId,
              qty: vItem.quantity,
              previousStock: prevStock,
              movementId: mov.id
            });
          }

          const sale: Sale = {
            id: saleId,
            companyId,
            branchId,
            customerId,
            cashSessionId: openCash ? openCash.id : undefined,
            items: verifiedItems,
            subtotal,
            discount: netDiscount,
            surcharge: netSurcharge,
            tax: totalTax,
            total: grandTotal,
            payments: processedPayments,
            status: 'COMPLETED',
            idempotencyKey,
            createdBy: userId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          const createdSale = CommerceRepository.createSale(sale);
          saleCreated = true;
          return createdSale;

        } catch (txnErr) {
          // Comprehensive Full Rollback
          // 1. Revert product stocks
          for (const adj of stockAdjustmentsMade) {
            try {
              CommerceRepository.updateProduct(adj.productId, { stock: adj.previousStock });
            } catch (rollbackErr) {
              console.error('[CRITICAL ROLLBACK ERROR]: Failed to restore stock for product', adj.productId, rollbackErr);
            }
          }
          // 2. Delete created StockMovements (no orphaned records)
          const movementIds = stockAdjustmentsMade.map(adj => adj.movementId).filter(Boolean);
          if (movementIds.length > 0) {
            try {
              CommerceRepository.deleteStockMovementsByIds(movementIds);
            } catch (movErr) {
              console.error('[CRITICAL ROLLBACK ERROR]: Failed to purge stock movements', movErr);
            }
          }
          // 3. Purge partial sale if created
          if (saleCreated) {
            try {
              const state = db.getRawState() as any;
              if (state.commerce_sales) {
                state.commerce_sales = state.commerce_sales.filter((s: any) => s.id !== saleId);
                saveDatabaseSync();
              }
            } catch (salesRollbackErr) {
              console.error('[CRITICAL ROLLBACK ERROR]: Failed to remove partial sale', saleId, salesRollbackErr);
            }
          }
          throw txnErr;
        }
      });
    })();

    if (idempotencyKey) {
      idempotencyLocks.set(idempotencyKey, promise);
      try {
        return await promise;
      } finally {
        idempotencyLocks.delete(idempotencyKey);
      }
    }

    return await promise;
  },

  async fiscalizeSale(saleId: string, companyId: string, customerDoc: string, customerName: string, voucherType: 'FACTURA_A' | 'FACTURA_B' | 'FACTURA_C' | 'TICKET') {
    const sale = CommerceRepository.getSaleByIdForCompany(saleId, companyId);
    if (!sale) throw new Error('SALE_NOT_FOUND');

    const arcaResult = await ArcaFiscalService.authorizeSaleInvoice(sale, customerDoc, customerName, voucherType);
    if (!arcaResult.success) {
      throw new Error(`ARCA_FISCALIZATION_FAILED:${arcaResult.error}`);
    }

    const isSimulated = process.env.NODE_ENV === 'test' || !process.env.ARCA_CERTIFICATE_BASE64;

    const invoice = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyId,
      saleId,
      voucherType,
      pointOfSale: arcaResult.pointOfSale || 1,
      invoiceNumber: arcaResult.invoiceNumber || 1,
      cuit: customerDoc || '',
      customerName: customerName || 'Consumidor Final',
      customerDocument: customerDoc || '',
      subtotal: sale.subtotal,
      tax: sale.tax,
      total: sale.total,
      cae: arcaResult.cae || '00000000000000',
      caeExpiration: arcaResult.caeExpiration || '20261231',
      status: (isSimulated ? 'SIMULATED' : 'APPROVED') as any,
      arcaResponse: arcaResult.response,
      createdAt: Date.now(),
    };

    return CommerceRepository.createInvoice(invoice);
  }
};
