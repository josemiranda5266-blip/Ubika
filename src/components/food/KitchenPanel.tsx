import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChefHat,
  Utensils,
  Play,
  FileText,
  BadgeAlert,
  Inbox
} from 'lucide-react';
import { FoodOrder } from '../../types';

interface KitchenPanelProps {
  companyId?: string;
  token?: string;
}

export const KitchenPanel: React.FC<KitchenPanelProps> = ({
  companyId,
  token,
}) => {
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PREPARING'>('ALL');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    if (!companyId || !token) {
      setError('Sesión de cocina inválida o expirada.');
      setLoading(false);
      return;
    }
    fetchKitchenOrders();
    // Auto refresh every 30 seconds
    const interval = setInterval(fetchKitchenOrders, 30000);
    return () => clearInterval(interval);
  }, [token, companyId]);

  const fetchKitchenOrders = async () => {
    if (!token) return;
    try {
      setError(null);
      const res = await fetch('/api/food/kitchen/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error('Error al obtener los pedidos de cocina');
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        // We only want to show kitchen-relevant orders: PENDING and PREPARING
        setOrders(data);
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchKitchenOrders();
  };

  const handleUpdateStatus = async (orderId: string, nextStatus: 'PREPARING' | 'READY') => {
    try {
      const res = await fetch(`/api/food/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderStatus: nextStatus }),
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || 'Error al actualizar el estado del pedido');
        return;
      }

      // Local update
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, orderStatus: nextStatus === 'READY' ? (o.deliveryType === 'FOOD_PICKUP' ? 'READY_FOR_PICKUP' : 'READY') : nextStatus } : o))
      );
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Error de red al actualizar el estado');
    }
  };

  // Filter orders to show only PENDING and PREPARING (or recently READY for positive feedback if any, but the spec says "Estados visibles: PENDING, PREPARING")
  const activeOrders = orders.filter((o) => ['PENDING', 'PREPARING'].includes(o.orderStatus));

  const filteredOrders = activeOrders.filter((o) => {
    if (filter === 'PENDING') return o.orderStatus === 'PENDING';
    if (filter === 'PREPARING') return o.orderStatus === 'PREPARING';
    return true;
  });

  // Sort orders: PREPARING first, then PENDING (or oldest first so they get prepared in order)
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (a.orderStatus === 'PREPARING' && b.orderStatus === 'PENDING') return -1;
    if (a.orderStatus === 'PENDING' && b.orderStatus === 'PREPARING') return 1;
    return a.createdAt - b.createdAt; // Oldest first
  });

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  };

  const getElapsedTime = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Recién ingresado';
    return `Hace ${diffMins} min`;
  };

  return (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8" id="kitchen-panel-root">
      {/* Kitchen Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/85 shadow-xs">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-md">
              <ChefHat className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-200">
                MÓDULO DE PRODUCCIÓN
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                Monitor de Cocina
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-500 font-bold">Pedidos Activos</p>
              <p className="text-lg font-black text-slate-900">{activeOrders.length}</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-black transition-all"
              id="btn-refresh-kitchen"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Sincronizar</span>
            </button>
          </div>
        </div>

        {/* Filters and Counters */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
          <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                filter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Todos ({activeOrders.length})
            </button>
            <button
              onClick={() => setFilter('PENDING')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                filter === 'PENDING'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Pendientes ({activeOrders.filter((o) => o.orderStatus === 'PENDING').length})
            </button>
            <button
              onClick={() => setFilter('PREPARING')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                filter === 'PREPARING'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              En Cocina ({activeOrders.filter((o) => o.orderStatus === 'PREPARING').length})
            </button>
          </div>

          <div className="text-xs font-bold text-slate-500 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
            <span>Actualización en tiempo real activa</span>
          </div>
        </div>
      </div>

      {/* Main Content / Grid */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-4" />
            <p className="text-sm font-bold text-slate-600">Cargando comandas de cocina...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center max-w-lg mx-auto">
            <BadgeAlert className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className="text-sm font-black text-red-900 mb-2">Error de Conexión</p>
            <p className="text-xs text-red-600 mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : sortedOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-16 text-center shadow-xs max-w-xl mx-auto">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Inbox className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-base font-black text-slate-800 mb-1">Sin pedidos pendientes</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              No hay comandas para preparar en este momento. ¡Buen trabajo!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedOrders.map((order) => {
              const isPending = order.orderStatus === 'PENDING';
              const isPreparing = order.orderStatus === 'PREPARING';

              return (
                <div
                  key={order.id}
                  id={`kitchen-order-${order.orderNumber}`}
                  className={`bg-white rounded-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-xs ${
                    isPreparing
                      ? 'border-emerald-200 ring-2 ring-emerald-500/10'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Card Header */}
                  <div className={`p-5 flex items-center justify-between border-b ${
                    isPreparing ? 'bg-emerald-50/40 border-emerald-100' : 'bg-slate-50/50 border-slate-100'
                  }`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-slate-900">
                          Pedido #{order.orderNumber}
                        </span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                          order.deliveryType === 'FOOD_DELIVERY'
                            ? 'bg-blue-50 text-blue-700 border-blue-100'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                        }`}>
                          {order.deliveryType === 'FOOD_DELIVERY' ? 'ENVÍO' : 'TAKE AWAY'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold mt-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatTime(order.createdAt)} ({getElapsedTime(order.createdAt)})</span>
                      </div>
                    </div>

                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                      isPending
                        ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {isPending ? 'Pendiente' : 'En Cocina'}
                    </span>
                  </div>

                  {/* Card Body: Items List */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="space-y-4">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex gap-3">
                            <span className="text-sm font-black text-slate-800 shrink-0 min-w-[20px]">
                              {item.quantity}x
                            </span>
                            <div className="flex-1">
                              <p className="text-xs font-black text-slate-900">
                                {item.productName}
                              </p>
                              
                              {/* Selected modifiers/options */}
                              {item.selections && item.selections.length > 0 && (
                                <div className="mt-1.5 pl-2 border-l border-slate-200 space-y-0.5">
                                  {item.selections.map((sel, sIdx) => (
                                    <p key={sIdx} className="text-[10px] text-slate-500 font-bold">
                                      + {sel.optionName}
                                    </p>
                                  ))}
                                </div>
                              )}

                              {/* Item specific notes */}
                              {item.notes && (
                                <p className="mt-1 text-[10px] italic text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 inline-block font-bold">
                                  Nota: {item.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* General order notes */}
                      {order.generalNotes && (
                        <div className="mt-5 p-3 bg-slate-50 rounded-xl border border-slate-100 flex gap-2">
                          <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                          <div className="text-[11px] text-slate-600 font-bold leading-relaxed">
                            <span className="text-slate-800 block text-[10px] font-black uppercase tracking-wider mb-0.5">
                              Notas del Cliente:
                            </span>
                            {order.generalNotes}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="p-5 pt-0">
                    {isPending ? (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'PREPARING')}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-2 transition-all"
                        id={`btn-prep-${order.id}`}
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>COMENZAR PREPARACIÓN</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'READY')}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-2 transition-all"
                        id={`btn-ready-${order.id}`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>MARCAR PEDIDO LISTO</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
