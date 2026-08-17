import React, { useState, useEffect } from 'react';
import { Lock, Unlock, DollarSign, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { getStoredToken } from '../../utils/api';

export function CajaView() {
  const [currentCash, setCurrentCash] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [initialCash, setInitialCash] = useState<string>('0');
  const [countedCash, setCountedCash] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const token = getStoredToken();

  const fetchCashData = async () => {
    try {
      const [currRes, listRes] = await Promise.all([
        fetch('/api/v1/commerce/cash/current', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/v1/commerce/cash', { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      if (currRes.ok) setCurrentCash(await currRes.json());
      if (listRes.ok) setSessions(await listRes.json());
    } catch (err) {
      console.error('Error fetching cash sessions:', err);
    }
  };

  useEffect(() => {
    fetchCashData();
  }, []);

  const handleOpenCash = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/commerce/cash/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ initialCash: parseFloat(initialCash || '0') }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al abrir caja');
      setCurrentCash(data);
      fetchCashData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCash) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/commerce/cash/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId: currentCash.id, countedCash: parseFloat(countedCash || '0'), notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cerrar caja');
      setCurrentCash(null);
      setCountedCash('');
      setNotes('');
      fetchCashData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current Cash Session Control */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-6 w-6 text-orange-600" />
                <h3 className="text-base font-black text-slate-900">Estado de Caja Actual</h3>
              </div>
              {currentCash ? (
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-black uppercase rounded-full flex items-center gap-1">
                  <Unlock className="h-3.5 w-3.5" /> Abierta
                </span>
              ) : (
                <span className="px-3 py-1 bg-rose-50 text-rose-700 text-xs font-black uppercase rounded-full flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" /> Cerrada
                </span>
              )}
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {currentCash ? (
              <form onSubmit={handleCloseCash} className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-xs font-medium text-slate-600">
                  <div className="flex justify-between">
                    <span>Apertura:</span>
                    <span className="font-bold text-slate-900">{new Date(currentCash.openedAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Efectivo Inicial:</span>
                    <span className="font-bold text-slate-900">${currentCash.initialCash.toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">Efectivo Contado en Caja ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={countedCash}
                    onChange={e => setCountedCash(e.target.value)}
                    placeholder="Ej. 25000"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">Notas / Observaciones</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Opcional"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md transition-colors"
                >
                  {loading ? 'Cerrando Caja...' : 'Cerrar Turno de Caja'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleOpenCash} className="space-y-4">
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Para operar el punto de venta (POS) y cobrar en efectivo, es necesario abrir una sesión de caja registrando el fondo inicial.
                </p>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">Fondo Inicial en Efectivo ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={initialCash}
                    onChange={e => setInitialCash(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md transition-colors"
                >
                  {loading ? 'Abriendo Caja...' : 'Abrir Caja'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Cash Summary Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-4 mb-4">Información de Caja</h3>
          <div className="space-y-4 text-xs font-medium text-slate-600">
            <div className="p-4 rounded-xl bg-orange-50 border border-orange-100 text-orange-900">
              <h4 className="font-black mb-1">Control de Turnos</h4>
              <p className="text-[11px] leading-relaxed">
                Todas las operaciones de venta en efectivo se vinculan de forma estricta a la sesión de caja activa del usuario autenticado. Las cajas cerradas quedan bloqueadas contra modificaciones.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cash Sessions History */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-base font-black text-slate-900">Historial de Sesiones de Caja</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-black text-[10px]">
              <tr>
                <th className="p-4">ID Sesión</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Apertura</th>
                <th className="p-4">Cierre</th>
                <th className="p-4 text-right">Inicial</th>
                <th className="p-4 text-right">Contado</th>
                <th className="p-4 text-right">Diferencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {sessions.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="p-4 font-mono font-bold text-slate-600">{s.id}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${s.status === 'OPEN' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="p-4">{new Date(s.openedAt).toLocaleString()}</td>
                  <td className="p-4">{s.closedAt ? new Date(s.closedAt).toLocaleString() : '-'}</td>
                  <td className="p-4 text-right">${s.initialCash.toLocaleString()}</td>
                  <td className="p-4 text-right">{s.countedCash !== undefined ? `$${s.countedCash.toLocaleString()}` : '-'}</td>
                  <td className="p-4 text-right font-bold">
                    {s.difference !== undefined ? (
                      <span className={s.difference === 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        ${s.difference.toLocaleString()}
                      </span>
                    ) : '-'}
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">No hay registros de cajas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
