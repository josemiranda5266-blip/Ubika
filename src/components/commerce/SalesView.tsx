import React, { useState, useEffect } from 'react';
import { Receipt, Search, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { getStoredToken } from '../../utils/api';

export function SalesView() {
  const [sales, setSales] = useState<any[]>([]);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [voucherType, setVoucherType] = useState<'FACTURA_A' | 'FACTURA_B' | 'FACTURA_C' | 'TICKET'>('FACTURA_B');
  const [customerDoc, setCustomerDoc] = useState('20333333339');
  const [customerName, setCustomerName] = useState('Consumidor Final');
  const [fiscalResult, setFiscalResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const token = getStoredToken();

  const fetchSales = async () => {
    try {
      const res = await fetch('/api/v1/commerce/sales', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setSales(await res.json());
    } catch (err) {
      console.error('Error fetching sales:', err);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const handleFiscalize = async (saleId: string) => {
    setLoading(true);
    setError('');
    setFiscalResult(null);
    try {
      const res = await fetch('/api/v1/commerce/fiscal/invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          saleId,
          customerDocument: customerDoc,
          customerName,
          voucherType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al fiscalizar con ARCA');
      setFiscalResult(data);
      fetchSales();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900">Historial de Ventas Comerciales</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-black text-[10px]">
              <tr>
                <th className="p-4">ID Venta</th>
                <th className="p-4">Fecha / Hora</th>
                <th className="p-4">Items</th>
                <th className="p-4">Método Pago</th>
                <th className="p-4 text-right">Total</th>
                <th className="p-4">Estado</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {sales.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="p-4 font-mono font-bold text-slate-600">{s.id}</td>
                  <td className="p-4 text-slate-500">{new Date(s.createdAt).toLocaleString()}</td>
                  <td className="p-4">{s.items.length} productos</td>
                  <td className="p-4 font-bold">{s.payments[0]?.method || 'CASH'}</td>
                  <td className="p-4 text-right font-black text-slate-900">${s.total.toLocaleString()}</td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase">
                      {s.status}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => setSelectedSale(s)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-orange-600 hover:text-white text-slate-700 rounded-xl font-bold transition-colors"
                    >
                      Detalle / Facturar
                    </button>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">No hay ventas registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sale Detail & Fiscalization Modal */}
      {selectedSale && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900">Detalle de Venta #{selectedSale.id}</h3>
                <span className="text-xs text-slate-500">{new Date(selectedSale.createdAt).toLocaleString()}</span>
              </div>
              <button
                onClick={() => { setSelectedSale(null); setFiscalResult(null); setError(''); }}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {fiscalResult && (
              <div className="mb-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
                <div className="flex items-center gap-2 text-emerald-900 font-black text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>¡Factura Fiscalizada con Éxito (ARCA WSFE)!</span>
                </div>
                <p className="text-xs text-emerald-700">CAE: {fiscalResult.cae} | Vto: {fiscalResult.caeExpiration}</p>
                <p className="text-xs text-emerald-700">Comprobante Nº: {fiscalResult.pointOfSale}-{fiscalResult.invoiceNumber}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-black text-[10px]">
                    <tr>
                      <th className="p-3">Producto</th>
                      <th className="p-3 text-right">Cant</th>
                      <th className="p-3 text-right">P. Unit</th>
                      <th className="p-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {selectedSale.items.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-3 font-bold text-slate-900">{item.productName}</td>
                        <td className="p-3 text-right">{item.quantity}</td>
                        <td className="p-3 text-right">${item.unitPrice.toLocaleString()}</td>
                        <td className="p-3 text-right font-black">${item.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl space-y-1 text-xs font-medium text-slate-700">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${selectedSale.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA / Impuestos:</span>
                  <span>${selectedSale.tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total:</span>
                  <span>${selectedSale.total.toLocaleString()}</span>
                </div>
              </div>

              {/* Fiscalization Form */}
              <div className="p-4 border border-orange-200 bg-orange-50/50 rounded-2xl space-y-3">
                <h4 className="text-xs font-black text-orange-900 uppercase">Fiscalización Electrónica ARCA</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Tipo Comprobante</label>
                    <select
                      value={voucherType}
                      onChange={e => setVoucherType(e.target.value as any)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="FACTURA_B">Factura B (Consumidor Final)</option>
                      <option value="FACTURA_A">Factura A (Responsable Inscripto)</option>
                      <option value="FACTURA_C">Factura C (Monotributo)</option>
                      <option value="TICKET">Ticket Fiscal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">CUIT / DNI Cliente</label>
                    <input
                      type="text"
                      value={customerDoc}
                      onChange={e => setCustomerDoc(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
                <button
                  onClick={() => handleFiscalize(selectedSale.id)}
                  disabled={loading}
                  className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md transition-colors"
                >
                  {loading ? 'Fiscalizando con ARCA...' : 'Emitir Factura Electrónica ARCA'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
