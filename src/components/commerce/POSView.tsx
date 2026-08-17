import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, DollarSign, CheckCircle2, AlertCircle, Search } from 'lucide-react';
import { getStoredToken } from '../../utils/api';

export function POSView() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [currentCash, setCurrentCash] = useState<any>(null);
  const [cart, setCart] = useState<{ product: any; quantity: number; discount: number }[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'DEBIT' | 'CREDIT' | 'TRANSFER' | 'MERCADO_PAGO'>('CASH');
  const [cashAmountPaid, setCashAmountPaid] = useState<string>('');
  const [discount, setDiscount] = useState<string>('0');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successSale, setSuccessSale] = useState<any>(null);

  const token = getStoredToken();

  const fetchData = async () => {
    try {
      const [prodRes, catRes, custRes, cashRes] = await Promise.all([
        fetch('/api/v1/commerce/products', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/v1/commerce/categories', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/v1/commerce/customers', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/v1/commerce/cash/current', { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      if (prodRes.ok) setProducts(await prodRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (custRes.ok) setCustomers(await custRes.json());
      if (cashRes.ok) setCurrentCash(await cashRes.json());
    } catch (err) {
      console.error('Error fetching POS data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1, discount: 0 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean) as any);
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.product.salePrice * item.quantity) - item.discount, 0);
  const netDiscount = parseFloat(discount || '0');
  const tax = cart.reduce((sum, item) => sum + (((item.product.salePrice * item.quantity) - item.discount) * (item.product.taxRate / 100)), 0);
  const grandTotal = Math.max(0, subtotal - netDiscount + tax);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setError('El carrito está vacío');
      return;
    }
    if (paymentMethod === 'CASH' && !currentCash) {
      setError('Debe abrir una caja antes de realizar ventas en efectivo');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        customerId: selectedCustomerId || undefined,
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity, discount: i.discount })),
        payments: [{ method: paymentMethod, amount: grandTotal }],
        discount: netDiscount,
        idempotencyKey: `pos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      };

      const res = await fetch('/api/v1/commerce/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar la venta');
      }

      setSuccessSale(data);
      setCart([]);
      setDiscount('0');
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'ALL' || p.categoryId === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.barcode && p.barcode.includes(searchTerm));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)]">
      {/* Product Catalog Section */}
      <div className="lg:col-span-7 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o código..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-1">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${selectedCategory === 'ALL' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${selectedCategory === cat.id ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3 content-start">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              onClick={() => addToCart(product)}
              className="bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-200 rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-all shadow-xs group"
            >
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{product.code || 'SIN CÓDIGO'}</span>
                <h4 className="text-xs font-bold text-slate-900 group-hover:text-orange-900 line-clamp-2 mt-1">{product.name}</h4>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <span className="text-sm font-black text-slate-900">${product.salePrice.toLocaleString()}</span>
                  <span className="block text-[10px] font-bold text-slate-500">Stock: {product.stock}</span>
                </div>
                <div className="w-7 h-7 rounded-full bg-white group-hover:bg-orange-600 group-hover:text-white text-slate-600 flex items-center justify-center shadow-xs transition-colors">
                  <Plus className="h-4 w-4" />
                </div>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 text-xs font-bold">
              No se encontraron productos disponibles.
            </div>
          )}
        </div>
      </div>

      {/* Cart & Checkout Section */}
      <div className="lg:col-span-5 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-orange-600" />
            <h3 className="text-sm font-black text-slate-900">Venta Actual (POS)</h3>
          </div>
          {currentCash ? (
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase">Caja Abierta</span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[10px] font-black uppercase">Caja Cerrada</span>
          )}
        </div>

        {successSale && (
          <div className="m-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-xs font-black text-emerald-900">¡Venta completada con éxito!</h4>
              <p className="text-[11px] text-emerald-700 mt-0.5">ID: {successSale.id} | Total: ${successSale.total.toLocaleString()}</p>
              <button
                onClick={() => setSuccessSale(null)}
                className="mt-2 px-3 py-1 bg-emerald-600 text-white rounded-xl text-[10px] font-bold"
              >
                Nueva Venta
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="m-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Cart items list */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {cart.map(item => (
            <div key={item.product.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex-1 pr-2">
                <h5 className="text-xs font-bold text-slate-900">{item.product.name}</h5>
                <span className="text-[10px] text-slate-500 font-bold">${item.product.salePrice.toLocaleString()} c/u</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => updateQuantity(item.product.id, -1)} className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100">
                  <Minus className="h-3 w-3" />
                </button>
                <span className="text-xs font-black text-slate-900 w-5 text-center">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.product.id, 1)} className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100">
                  <Plus className="h-3 w-3" />
                </button>
                <button onClick={() => removeFromCart(item.product.id)} className="p-1 text-rose-500 hover:text-rose-700 ml-1">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {cart.length === 0 && !successSale && (
            <div className="py-16 text-center text-slate-400 text-xs font-bold">
              Seleccione productos del catálogo para agregar al carrito.
            </div>
          )}
        </div>

        {/* Totals & Checkout Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-3">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Cliente</label>
            <select
              value={selectedCustomerId}
              onChange={e => setSelectedCustomerId(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Consumidor Final (Sin registrar)</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.documentNumber || 'Sin doc'})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Método de Pago</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as any)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="CASH">Efectivo</option>
                <option value="DEBIT">Tarjeta Débito</option>
                <option value="CREDIT">Tarjeta Crédito</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="MERCADO_PAGO">Mercado Pago</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Descuento ($)</label>
              <input
                type="number"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 space-y-1">
            <div className="flex justify-between text-xs text-slate-500 font-medium">
              <span>Subtotal</span>
              <span>${subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500 font-medium">
              <span>Impuestos (IVA)</span>
              <span>${tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-black text-slate-900 pt-1">
              <span>Total Final</span>
              <span>${grandTotal.toLocaleString()}</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={loading || cart.length === 0}
            className="w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md transition-colors flex items-center justify-center gap-2"
          >
            <DollarSign className="h-4 w-4" />
            {loading ? 'Procesando Venta...' : `Cobrar $${grandTotal.toLocaleString()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
