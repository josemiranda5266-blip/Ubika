import React, { useState, useEffect } from 'react';
import { Package, PlusCircle, ArrowUpRight, ArrowDownLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import { getStoredToken } from '../../utils/api';

export function StockView() {
  const [products, setProducts] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [type, setType] = useState<'ENTRADA' | 'SALIDA' | 'AJUSTE'>('ENTRADA');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const token = getStoredToken();

  const fetchData = async () => {
    try {
      const [prodRes, movRes] = await Promise.all([
        fetch('/api/v1/commerce/products', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/v1/commerce/stock/movements', { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      if (prodRes.ok) setProducts(await prodRes.json());
      if (movRes.ok) setMovements(await movRes.json());
    } catch (err) {
      console.error('Error fetching stock data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      setError('Seleccione un producto');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/commerce/stock/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: selectedProduct,
          quantity: parseFloat(quantity || '0'),
          type,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al ajustar stock');
      setQuantity('');
      setReason('');
      setSelectedProduct('');
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock Adjustment Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
            <Package className="h-5 w-5 text-orange-600" />
            <h3 className="text-base font-black text-slate-900">Ajuste de Stock</h3>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAdjust} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1">Producto</label>
              <select
                required
                value={selectedProduct}
                onChange={e => setSelectedProduct(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Seleccione producto...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (Stock actual: {p.stock})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1">Tipo de Movimiento</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as any)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="ENTRADA">Entrada (Ingreso)</option>
                <option value="SALIDA">Salida (Merma / Egreso)</option>
                <option value="AJUSTE">Ajuste Exacto (Inventario)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1">Cantidad</label>
              <input
                type="number"
                step="0.01"
                required
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="Ej. 10"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1">Motivo / Razón</label>
              <input
                type="text"
                required
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Ej. Compra a proveedor, conteo físico"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md transition-colors"
            >
              {loading ? 'Registrando...' : 'Registrar Movimiento'}
            </button>
          </form>
        </div>

        {/* Current Inventory Levels Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900">Niveles de Stock Actuales</h3>
          </div>
          <div className="flex-1 overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-black text-[10px] sticky top-0">
                <tr>
                  <th className="p-4">Código</th>
                  <th className="p-4">Producto</th>
                  <th className="p-4 text-right">Stock</th>
                  <th className="p-4 text-right">Mínimo</th>
                  <th className="p-4">Estado Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {products.map(p => {
                  const isLow = p.stock <= p.minStock;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-4 font-mono font-bold text-slate-500">{p.code || '-'}</td>
                      <td className="p-4 font-bold text-slate-900">{p.name}</td>
                      <td className="p-4 text-right font-black text-slate-900">{p.stock}</td>
                      <td className="p-4 text-right text-slate-500">{p.minStock}</td>
                      <td className="p-4">
                        {isLow ? (
                          <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[10px] font-black uppercase">Stock Bajo</span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase">Óptimo</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Stock Movements Audit Log */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-base font-black text-slate-900">Auditoría de Movimientos de Stock</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-black text-[10px]">
              <tr>
                <th className="p-4">Fecha / Hora</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Producto ID</th>
                <th className="p-4 text-right">Cantidad</th>
                <th className="p-4 text-right">Stock Anterior</th>
                <th className="p-4 text-right">Stock Nuevo</th>
                <th className="p-4">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {movements.map(m => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="p-4 text-slate-500">{new Date(m.createdAt).toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${m.type === 'ENTRADA' ? 'bg-emerald-50 text-emerald-700' : m.type === 'SALIDA' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>
                      {m.type}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-slate-600">{m.productId}</td>
                  <td className="p-4 text-right font-bold">{m.quantity}</td>
                  <td className="p-4 text-right text-slate-500">{m.previousStock}</td>
                  <td className="p-4 text-right font-black text-slate-900">{m.newStock}</td>
                  <td className="p-4 text-slate-600">{m.reason || '-'}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">No hay movimientos registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
