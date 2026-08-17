import { CommerceRepository } from './repository';
import {
  CommerceProduct,
  Sale,
  StockMovement,
  CashSession,
} from './types';
import { PaymentProviderService } from './payments';
import { ArcaFiscalService } from './fiscal';

export const CommerceService = {
  // Categories
  getCategories(companyId: string) {
    return CommerceRepository.getCategoriesByCompany(companyId);
  },
  createCategory(data: any, companyId: string) {
    const category = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyId,
      branchId: data.branchId,
      name: data.name,
      description: data.description,
      createdAt: Date.now(),
    };
    return CommerceRepository.createCategory(category);
  },

  // Products
  getProducts(companyId: string) {
    return CommerceRepository.getProductsByCompany(companyId);
  },
  getProduct(id: string, companyId: string) {
    const product = CommerceRepository.getProductById(id);
    if (!product || product.companyId !== companyId) return null;
    return product;
  },
  createProduct(data: any, companyId: string) {
    const product: CommerceProduct = {
      id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyId,
      branchId: data.branchId,
      name: data.name,
      description: data.description,
      code: data.code,
      barcode: data.barcode,
      categoryId: data.categoryId,
      costPrice: Number(data.costPrice || 0),
      salePrice: Number(data.salePrice || 0),
      taxRate: Number(data.taxRate || 21),
      stock: Number(data.stock || 0),
      minStock: Number(data.minStock || 5),
      maxStock: Number(data.maxStock || 100),
      status: data.status || 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return CommerceRepository.createProduct(product);
  },
  updateProduct(id: string, companyId: string, updates: any) {
    const product = CommerceRepository.getProductById(id);
    if (!product || product.companyId !== companyId) return null;
    return CommerceRepository.updateProduct(id, updates);
  },
  deleteProduct(id: string, companyId: string) {
    const product = CommerceRepository.getProductById(id);
    if (!product || product.companyId !== companyId) return false;
    return CommerceRepository.deleteProduct(id);
  },

  // Customers
  getCustomers(companyId: string) {
    return CommerceRepository.getCustomersByCompany(companyId);
  },
  createCustomer(data: any, companyId: string) {
    const customer = {
      id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      documentNumber: data.documentNumber,
      documentType: data.documentType || 'DNI',
      address: data.address,
      accountBalance: Number(data.accountBalance || 0),
      creditLimit: Number(data.creditLimit || 0),
      taxCondition: data.taxCondition || 'CONSUMIDOR_FINAL',
      createdAt: Date.now(),
    };
    return CommerceRepository.createCustomer(customer);
  },

  // Stock
  getStockMovements(companyId: string) {
    return CommerceRepository.getStockMovementsByCompany(companyId);
  },
  adjustStock(productId: string, companyId: string, quantity: number, type: 'ENTRADA' | 'SALIDA' | 'AJUSTE', reason: string, userId: string, branchId?: string) {
    const product = CommerceRepository.getProductById(productId);
    if (!product || product.companyId !== companyId) throw new Error('PRODUCT_NOT_FOUND');

    const previousStock = product.stock;
    let newStock = previousStock;
    if (type === 'ENTRADA') newStock += quantity;
    else if (type === 'SALIDA') newStock -= quantity;
    else if (type === 'AJUSTE') newStock = quantity;

    if (newStock < 0) throw new Error('INSUFFICIENT_STOCK');

    CommerceRepository.updateProduct(productId, { stock: newStock });

    const movement: StockMovement = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      productId,
      companyId,
      branchId,
      type,
      quantity,
      previousStock,
      newStock,
      reason,
      userId,
      createdAt: Date.now(),
    };
    return CommerceRepository.createStockMovement(movement);
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

    const session: CashSession = {
      id: `cash_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyId,
      branchId,
      userId,
      openedAt: Date.now(),
      initialCash: Number(initialCash || 0),
      status: 'OPEN',
    };
    return CommerceRepository.createCashSession(session);
  },
  closeCashSession(sessionId: string, companyId: string, countedCash: number, notes?: string) {
    const sessions = CommerceRepository.getCashSessionsByCompany(companyId);
    const session = sessions.find(s => s.id === sessionId);
    if (!session || session.status !== 'OPEN') throw new Error('CASH_SESSION_NOT_FOUND_OR_CLOSED');

    const expectedCash = session.initialCash; // plus cash sales sum
    const difference = countedCash - expectedCash;

    return CommerceRepository.updateCashSession(sessionId, {
      closedAt: Date.now(),
      countedCash: Number(countedCash || 0),
      expectedCash,
      difference,
      status: 'CLOSED',
      notes,
    });
  },

  // Sales & FinalizeSale (Critical Operation)
  getSales(companyId: string) {
    return CommerceRepository.getSalesByCompany(companyId);
  },
  getSale(id: string, companyId: string) {
    const sale = CommerceRepository.getSaleById(id);
    if (!sale || sale.companyId !== companyId) return null;
    return sale;
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

    // 1. Idempotency check
    if (idempotencyKey) {
      const existing = CommerceRepository.getSaleByIdempotencyKey(idempotencyKey);
      if (existing) return existing;
    }

    // 2. Validate open cash session if cash payment exists
    const hasCash = payments.some(p => p.method === 'CASH');
    if (hasCash) {
      const openCash = CommerceRepository.getCurrentOpenCashSession(companyId, userId);
      if (!openCash) {
        throw new Error('CASH_SESSION_REQUIRED_FOR_CASH_PAYMENTS');
      }
    }

    // 3. Verify products, calculate server-side totals, prices, taxes & stock
    let subtotal = 0;
    let totalTax = 0;
    const verifiedItems = [];

    for (const rawItem of items) {
      const product = CommerceRepository.getProductById(rawItem.productId);
      if (!product || product.companyId !== companyId) {
        throw new Error(`PRODUCT_NOT_FOUND_OR_UNAUTHORIZED:${rawItem.productId}`);
      }

      const qty = Number(rawItem.quantity || 0);
      if (qty <= 0) throw new Error('INVALID_QUANTITY');

      if (product.stock < qty) {
        throw new Error(`INSUFFICIENT_STOCK_FOR_PRODUCT:${product.name}`);
      }

      // Catalog real price verification (prevent client price manipulation)
      const unitPrice = product.salePrice;
      const itemDiscount = Number(rawItem.discount || 0);
      const itemSubtotal = (unitPrice * qty) - itemDiscount;
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
    const netSurcharge = Number(surcharge || 0);
    const grandTotal = Math.max(0, subtotal - netDiscount + netSurcharge + totalTax);

    // Verify payments total matches grand total
    const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    if (Math.abs(totalPayments - grandTotal) > 0.05) {
      throw new Error('PAYMENT_AMOUNT_MISMATCH_WITH_TOTAL');
    }

    const saleId = `sale_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const openCash = CommerceRepository.getCurrentOpenCashSession(companyId, userId);

    // 4. Process payments (e.g. Mercado Pago if applicable)
    const processedPayments = [];
    for (const p of payments) {
      let extRef = undefined;
      let provResp = undefined;
      let payStatus: 'COMPLETED' | 'PENDING' = 'COMPLETED';

      if (p.method === 'MERCADO_PAGO') {
        const mpResult = await PaymentProviderService.createPayment({
          companyId,
          saleId,
          amount: p.amount,
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
        amount: p.amount,
        status: payStatus,
        externalReference: extRef,
        providerResponse: provResp,
        createdAt: Date.now(),
      });
    }

    // 5. Deduct stock and record stock movements atomically
    for (const vItem of verifiedItems) {
      CommerceService.adjustStock(
        vItem.productId,
        companyId,
        vItem.quantity,
        'SALIDA',
        `Venta #${saleId}`,
        userId,
        branchId
      );
    }

    // 6. Create Sale Record
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

    return CommerceRepository.createSale(sale);
  },

  async fiscalizeSale(saleId: string, companyId: string, customerDoc: string, customerName: string, voucherType: 'FACTURA_A' | 'FACTURA_B' | 'FACTURA_C' | 'TICKET') {
    const sale = CommerceRepository.getSaleById(saleId);
    if (!sale || sale.companyId !== companyId) throw new Error('SALE_NOT_FOUND');

    const arcaResult = await ArcaFiscalService.authorizeSaleInvoice(sale, customerDoc, customerName, voucherType);
    if (!arcaResult.success) {
      throw new Error(`ARCA_FISCALIZATION_FAILED:${arcaResult.error}`);
    }

    const invoice = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyId,
      saleId,
      voucherType,
      pointOfSale: arcaResult.pointOfSale || 1,
      invoiceNumber: arcaResult.invoiceNumber || 1,
      cuit: customerDoc,
      customerName,
      customerDocument: customerDoc,
      subtotal: sale.subtotal,
      tax: sale.tax,
      total: sale.total,
      cae: arcaResult.cae || '00000000000000',
      caeExpiration: arcaResult.caeExpiration || '20261231',
      status: 'APPROVED' as const,
      arcaResponse: arcaResult.response,
      createdAt: Date.now(),
    };

    return CommerceRepository.createInvoice(invoice);
  }
};
