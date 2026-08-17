import React, { useState } from 'react';
import { POSView } from './POSView';
import { CajaView } from './CajaView';
import { StockView } from './StockView';
import { ProductsView } from './ProductsView';
import { CustomersView } from './CustomersView';
import { SalesView } from './SalesView';
import { ShoppingCart, DollarSign, Package, Users, Receipt, Layers } from 'lucide-react';

export function UbikaCommerceApp() {
  const [activeTab, setActiveTab] = useState<'pos' | 'caja' | 'stock' | 'products' | 'customers' | 'sales'>('pos');

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F8FAFC]">
      {/* Commerce Navigation Sub-Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between overflow-x-auto shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black">
            C
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900">UBIKA COMMERCE</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Punto de Venta & Gestión Comercial</p>
          </div>
        </div>

        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('pos')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${activeTab === 'pos' ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <ShoppingCart className="h-4 w-4" /> POS (Caja)
          </button>
          <button
            onClick={() => setActiveTab('caja')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${activeTab === 'caja' ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <DollarSign className="h-4 w-4" /> Turnos de Caja
          </button>
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${activeTab === 'stock' ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Package className="h-4 w-4" /> Stock e Inventario
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${activeTab === 'products' ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Layers className="h-4 w-4" /> Productos
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${activeTab === 'customers' ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Users className="h-4 w-4" /> Clientes
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${activeTab === 'sales' ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Receipt className="h-4 w-4" /> Ventas & Facturación
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 overflow-y-auto">
        {activeTab === 'pos' && <POSView />}
        {activeTab === 'caja' && <CajaView />}
        {activeTab === 'stock' && <StockView />}
        {activeTab === 'products' && <ProductsView />}
        {activeTab === 'customers' && <CustomersView />}
        {activeTab === 'sales' && <SalesView />}
      </div>
    </div>
  );
}
