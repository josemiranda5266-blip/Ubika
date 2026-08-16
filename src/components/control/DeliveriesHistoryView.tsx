import React, { useState } from 'react';
import {
  Search,
  Filter,
  Calendar,
  User,
  Truck,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  FileText,
  MapPin,
  ChevronDown,
  PlusCircle,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { Delivery, Driver, DeliveryStatus, TaskPriority } from '../../types';
import { formatTimestamp } from '../../utils/geo';

interface DeliveriesHistoryViewProps {
  deliveries: Delivery[];
  drivers: Driver[];
  onOpenTaskDetails?: (delivery: Delivery) => void;
  onOpenNewTask?: () => void;
}

export const DeliveriesHistoryView: React.FC<DeliveriesHistoryViewProps> = ({
  deliveries,
  drivers,
  onOpenTaskDetails,
  onOpenNewTask,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const activeFiltersCount =
    (selectedDriver !== 'all' ? 1 : 0) +
    (selectedStatus !== 'all' ? 1 : 0) +
    (selectedPriority !== 'all' ? 1 : 0);

  const clearFilters = () => {
    setSelectedDriver('all');
    setSelectedStatus('all');
    setSelectedPriority('all');
    setSearchTerm('');
  };

  const filteredDeliveries = deliveries.filter((d) => {
    const matchesSearch =
      d.orderNumber.toString().includes(searchTerm) ||
      d.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.recipientName && d.recipientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      d.recipientPhone.includes(searchTerm);

    const matchesDriver = selectedDriver === 'all' || d.driverId === selectedDriver;
    const matchesStatus = selectedStatus === 'all' || d.status === selectedStatus;
    const matchesPriority = selectedPriority === 'all' || d.priority === selectedPriority;

    return matchesSearch && matchesDriver && matchesStatus && matchesPriority;
  });

  const getStatusBadge = (status: DeliveryStatus) => {
    switch (status) {
      case 'entregado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            Entregado
          </span>
        );
      case 'en_camino':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            En camino
          </span>
        );
      case 'cerca':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-orange-50 text-orange-700 border border-orange-200">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping"></span>
            Cerca
          </span>
        );
      case 'ubicacion_compartida':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
            <MapPin className="w-3 h-3 text-emerald-600" />
            GPS Activo
          </span>
        );
      case 'esperando_autorizacion':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Esperando cliente
          </span>
        );
      case 'asignado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-purple-50 text-purple-700 border border-purple-200">
            Asignado
          </span>
        );
      case 'cancelado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-slate-100 text-slate-600 border border-slate-200">
            Cancelado
          </span>
        );
      case 'rechazado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-red-50 text-red-700 border border-red-200">
            Rechazado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgente':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-red-100 text-red-700">🔴 URGENTE</span>;
      case 'alta':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-orange-100 text-orange-700">🟠 ALTA</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">Normal</span>;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fadeIn">
      {/* Top Header */}
      <div className="bg-white p-4 sm:p-6 rounded-[24px] sm:rounded-[28px] border border-slate-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Historial y Despacho de Entregas</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-100 text-orange-800">
              {filteredDeliveries.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Registro operativo centralizado con trazabilidad de pedidos en tiempo real
          </p>
        </div>

        {onOpenNewTask && (
          <button
            id="history-btn-new-task"
            type="button"
            onClick={onOpenNewTask}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-black text-xs rounded-2xl shadow-lg shadow-orange-200 transition-all min-h-[44px]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>NUEVA TAREA</span>
          </button>
        )}
      </div>

      {/* Filters Bar: Desktop Grid & Mobile Search + Filter Sheet Button */}
      <div className="bg-white p-3.5 sm:p-4 rounded-[20px] sm:rounded-[24px] border border-slate-100 shadow-xs">
        {/* Mobile Filter Trigger Row */}
        <div className="flex items-center gap-2 lg:hidden">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              id="history-search-mobile"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar pedido, cliente..."
              className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          <button
            id="history-btn-filter-sheet"
            type="button"
            onClick={() => setIsFilterSheetOpen(true)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-black border transition-all min-h-[42px] ${
              activeFiltersCount > 0
                ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-200'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-white text-orange-600 text-[10px] font-black flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Desktop Filters Grid */}
        <div className="hidden lg:grid grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              id="history-search-desktop"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por #, cliente, descripción..."
              className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          <select
            id="history-filter-driver"
            value={selectedDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="all">Todos los Repartidores</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.internalId})
              </option>
            ))}
          </select>

          <select
            id="history-filter-status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="all">Todos los Estados</option>
            <option value="entregado">Entregado</option>
            <option value="en_camino">En camino</option>
            <option value="cerca">Cerca</option>
            <option value="ubicacion_compartida">GPS Compartido</option>
            <option value="esperando_autorizacion">Esperando Cliente</option>
            <option value="asignado">Asignado</option>
            <option value="cancelado">Cancelado</option>
          </select>

          <select
            id="history-filter-priority"
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="all">Todas las Prioridades</option>
            <option value="urgente">🔴 Urgente</option>
            <option value="alta">🟠 Alta</option>
            <option value="normal">🟢 Normal</option>
          </select>
        </div>
      </div>

      {/* Deliveries: Mobile & Tablet Card-based List View (<1024px) */}
      <div className="block lg:hidden space-y-3">
        {filteredDeliveries.length === 0 ? (
          <div className="bg-white rounded-[24px] p-10 text-center text-slate-400 font-bold text-xs border border-slate-100 shadow-xs space-y-2">
            <CheckCircle2 className="w-8 h-8 mx-auto text-slate-300" />
            <p>No se encontraron tareas con los filtros seleccionados.</p>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-orange-600 font-black hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          filteredDeliveries.map((delivery) => (
            <div
              key={delivery.id}
              className="bg-white rounded-[24px] p-4 border border-slate-100 shadow-xs space-y-3"
            >
              {/* Card Header: Order # + Priority + Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black text-orange-600 bg-orange-50 px-2.5 py-1 rounded-xl border border-orange-200">
                    #{delivery.orderNumber}
                  </span>
                  {getPriorityBadge(delivery.priority)}
                </div>
                <div>{getStatusBadge(delivery.status)}</div>
              </div>

              {/* Card Body: Client & Description */}
              <div className="space-y-1">
                <div className="text-sm font-black text-slate-900 flex items-center justify-between">
                  <span>{delivery.recipientName || 'Cliente sin nombre'}</span>
                  <span className="text-xs text-slate-500 font-bold">{delivery.recipientPhone}</span>
                </div>
                <p className="text-xs text-slate-600 font-medium line-clamp-2">{delivery.description}</p>
              </div>

              {/* Card Footer: Driver info + Amount + Action Button */}
              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 truncate">
                  <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{delivery.driverName}</span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {delivery.amount && (
                    <span className="text-xs font-black text-slate-900">{delivery.amount}</span>
                  )}
                  <button
                    id={`mobile-btn-view-${delivery.id}`}
                    type="button"
                    onClick={() => setSelectedDelivery(delivery)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-800 font-black text-xs rounded-xl transition-colors min-h-[38px]"
                  >
                    Detalle
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Deliveries Table (Desktop >= 1024px) */}
      <div className="hidden lg:block bg-white rounded-[28px] border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-extrabold uppercase tracking-wider">
              <tr>
                <th className="py-4 px-5">Pedido</th>
                <th className="py-4 px-4">Cliente</th>
                <th className="py-4 px-4">Repartidor</th>
                <th className="py-4 px-4">Descripción</th>
                <th className="py-4 px-4">Prioridad</th>
                <th className="py-4 px-4">Estado</th>
                <th className="py-4 px-4">Importe</th>
                <th className="py-4 px-4">Fecha / Hora</th>
                <th className="py-4 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                    No se encontraron entregas con los filtros seleccionados
                  </td>
                </tr>
              ) : (
                filteredDeliveries.map((delivery) => (
                  <tr key={delivery.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-5 font-black text-slate-900">
                      <span className="font-mono text-orange-600">#{delivery.orderNumber}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-900">{delivery.recipientName || 'Sin nombre'}</div>
                      <div className="text-[11px] text-slate-400 font-medium">{delivery.recipientPhone}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-slate-400" />
                        <span>{delivery.driverName}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 max-w-xs">
                      <p className="truncate text-slate-600 font-semibold">{delivery.description}</p>
                      {delivery.instructions && (
                        <p className="text-[10px] text-slate-400 truncate italic">"{delivery.instructions}"</p>
                      )}
                    </td>
                    <td className="py-4 px-4">{getPriorityBadge(delivery.priority)}</td>
                    <td className="py-4 px-4">{getStatusBadge(delivery.status)}</td>
                    <td className="py-4 px-4 font-black text-slate-900">
                      {delivery.amount || '-'}
                      {delivery.paymentMethod && (
                        <div className="text-[10px] text-slate-400 font-medium">{delivery.paymentMethod}</div>
                      )}
                    </td>
                    <td className="py-4 px-4 text-[11px] text-slate-500 font-semibold">
                      {formatTimestamp(delivery.createdAt)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        id={`btn-view-details-${delivery.id}`}
                        type="button"
                        onClick={() => setSelectedDelivery(delivery)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-700 rounded-xl font-black text-xs transition-all min-h-[36px]"
                      >
                        Ver Detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Filter Sheet */}
      {isFilterSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-xs animate-fadeIn lg:hidden">
          <div className="flex-1" onClick={() => setIsFilterSheetOpen(false)} />
          <div className="bg-white rounded-t-[32px] border-t border-slate-100 p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto animate-slideUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-orange-500" />
                <h3 className="text-base font-black text-slate-900">Filtrar Tareas</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterSheetOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Repartidor Asignado</label>
                <select
                  value={selectedDriver}
                  onChange={(e) => setSelectedDriver(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900"
                >
                  <option value="all">Todos los Repartidores</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.internalId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Estado de la Entrega</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900"
                >
                  <option value="all">Todos los Estados</option>
                  <option value="entregado">Entregado</option>
                  <option value="en_camino">En camino</option>
                  <option value="cerca">Cerca</option>
                  <option value="ubicacion_compartida">GPS Compartido</option>
                  <option value="esperando_autorizacion">Esperando Cliente</option>
                  <option value="asignado">Asignado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Nivel de Prioridad</label>
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900"
                >
                  <option value="all">Todas las Prioridades</option>
                  <option value="urgente">🔴 Urgente</option>
                  <option value="alta">🟠 Alta</option>
                  <option value="normal">🟢 Normal</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={clearFilters}
                className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl min-h-[44px]"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => setIsFilterSheetOpen(false)}
                className="flex-1 py-3 bg-orange-500 text-white font-black text-xs rounded-2xl shadow-md min-h-[44px]"
              >
                Aplicar Filtros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Modal (Responsive Dialog / Sheet) */}
      {selectedDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white border border-slate-100 rounded-[28px] sm:rounded-[32px] shadow-2xl p-5 sm:p-6 text-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] sm:text-xs text-orange-600 font-black tracking-widest uppercase">
                  Detalle Operativo
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900">Pedido #{selectedDelivery.orderNumber}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDelivery(null)}
                className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
                <span className="font-black text-slate-500 uppercase text-[10px]">Descripción del Pedido</span>
                <p className="text-sm font-bold text-slate-900">{selectedDelivery.description}</p>
                {selectedDelivery.instructions && (
                  <p className="text-xs text-slate-600 font-medium">Instrucciones: {selectedDelivery.instructions}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="font-bold text-slate-400 text-[10px] uppercase">Cliente</span>
                  <div className="font-black text-slate-900 text-xs mt-0.5">
                    {selectedDelivery.recipientName || 'Sin especificar'}
                  </div>
                  <div className="text-slate-500 font-medium">{selectedDelivery.recipientPhone}</div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="font-bold text-slate-400 text-[10px] uppercase">Repartidor</span>
                  <div className="font-black text-slate-900 text-xs mt-0.5">{selectedDelivery.driverName}</div>
                  <div className="text-slate-500 font-medium">{selectedDelivery.driverPhone}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="font-bold text-slate-400 text-[10px] uppercase">Importe</span>
                  <div className="font-black text-slate-900 text-sm mt-0.5">
                    {selectedDelivery.amount || 'Sin cobrar'}
                  </div>
                  <div className="text-slate-500 font-medium">{selectedDelivery.paymentMethod}</div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="font-bold text-slate-400 text-[10px] uppercase">Estado</span>
                  <div className="mt-1">{getStatusBadge(selectedDelivery.status)}</div>
                </div>
              </div>

              {selectedDelivery.trackingToken && (
                <div className="p-3.5 rounded-2xl bg-orange-50/70 border border-orange-200/80 space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-orange-700">Enlace de Ubicación del Cliente</span>
                  <div className="font-mono text-[11px] text-slate-700 bg-white p-2 rounded-xl border border-orange-200 truncate select-all">
                    {typeof window !== 'undefined' ? `${window.location.origin}/c/${selectedDelivery.trackingToken}` : `/c/${selectedDelivery.trackingToken}`}
                  </div>
                </div>
              )}

              {selectedDelivery.privacyPolicyPurged && (
                <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-800 text-[11px] font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Privacidad aplicada: Coordenadas GPS purgadas permanentemente tras la entrega.</span>
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDelivery(null)}
                className="w-full sm:w-auto px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-2xl shadow-md min-h-[44px]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

