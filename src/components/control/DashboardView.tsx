import React from 'react';
import {
  Truck,
  Package,
  CheckCircle2,
  AlertTriangle,
  Clock,
  PlusCircle,
  MapPin,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  Send,
  Phone,
  User,
} from 'lucide-react';
import { DashboardMetrics, Delivery, Driver } from '../../types';
import { formatDistance, formatTimestamp } from '../../utils/geo';
import { FleetMapView } from './FleetMapView';

interface DashboardViewProps {
  metrics: DashboardMetrics;
  drivers: Driver[];
  deliveries: Delivery[];
  onOpenNewTask: () => void;
  onNavigateToTab: (tab: string) => void;
  onSelectDriverOnMap: (driverId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  drivers,
  deliveries,
  onOpenNewTask,
  onNavigateToTab,
  onSelectDriverOnMap,
}) => {
  const inProgressDeliveries = deliveries.filter(
    (d) =>
      d.status === 'en_camino' ||
      d.status === 'cerca' ||
      d.status === 'ubicacion_compartida' ||
      d.status === 'esperando_autorizacion' ||
      d.status === 'asignado'
  );

  return (
    <div className="space-y-4 sm:space-y-6 animate-fadeIn">
      {/* Top Welcome / Action Banner */}
      <div className="bg-white p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] border border-slate-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Panel de Operaciones</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-700 border border-orange-200">
              UBIKA CONTROL
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Coordinación, seguimiento en tiempo real y despacho de cadetería y entregas
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="dash-btn-new-task"
            type="button"
            onClick={onOpenNewTask}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-black text-xs rounded-2xl shadow-xl shadow-orange-200 transition-all min-h-[44px]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>NUEVA TAREA DE ENTREGA</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards Grid (Responsive 2 to 4 cols) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Repartidores Activos */}
        <div className="bg-white p-4 sm:p-5 rounded-[22px] sm:rounded-[28px] border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider">Repartidores</span>
            <div className="p-2 sm:p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
              <Truck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4">
            <div className="flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">{metrics.activeDrivers}</span>
              <span className="text-[10px] sm:text-xs font-bold text-slate-400">activos</span>
            </div>
            <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-emerald-600 font-extrabold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{metrics.availableDrivers} disponibles</span>
            </div>
          </div>
        </div>

        {/* Card 2: Entregas En Curso */}
        <div className="bg-white p-4 sm:p-5 rounded-[22px] sm:rounded-[28px] border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider">En Curso</span>
            <div className="p-2 sm:p-2.5 rounded-2xl bg-orange-50 text-orange-500 border border-orange-100">
              <Package className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4">
            <div className="flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">{metrics.inProgressDeliveries}</span>
              <span className="text-[10px] sm:text-xs font-bold text-slate-400">pedidos</span>
            </div>
            <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-blue-600 font-extrabold flex items-center gap-1 truncate">
              <span>{metrics.pendingDeliveries} pendientes</span>
            </div>
          </div>
        </div>

        {/* Card 3: Entregas Completadas */}
        <div className="bg-white p-4 sm:p-5 rounded-[22px] sm:rounded-[28px] border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider">Completadas</span>
            <div className="p-2 sm:p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4">
            <div className="flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">{metrics.completedDeliveries}</span>
              <span className="text-[10px] sm:text-xs font-bold text-slate-400">hoy</span>
            </div>
            <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-slate-500 font-extrabold truncate">
              Caja: <span className="text-slate-900 font-black">{metrics.totalRevenue}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Demoradas / Urgentes */}
        <div className="bg-white p-4 sm:p-5 rounded-[22px] sm:rounded-[28px] border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider">Alertas</span>
            <div className="p-2 sm:p-2.5 rounded-2xl bg-red-50 text-red-600 border border-red-100">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4">
            <div className="flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">{metrics.delayedDeliveries}</span>
              <span className="text-[10px] sm:text-xs font-bold text-slate-400">demoras</span>
            </div>
            <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-red-600 font-extrabold flex items-center gap-1 truncate">
              <span>{metrics.cancelledDeliveries} canceladas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Operations Split (Map + Active Live Deliveries) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left 2 Cols: Live Fleet Map */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-500" />
              <h2 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">Mapa de Operaciones en Vivo</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToTab('map')}
              className="text-xs text-orange-600 hover:text-orange-700 font-black flex items-center gap-1"
            >
              <span>Ver mapa</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <FleetMapView
            drivers={drivers}
            deliveries={deliveries}
            onSelectDriver={(id) => id && onSelectDriverOnMap(id)}
          />
        </div>

        {/* Right 1 Col: Live Active Dispatch Feed */}
        <div className="space-y-3 flex flex-col">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              <h2 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
                Despacho Activo ({inProgressDeliveries.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToTab('history')}
              className="text-xs text-slate-500 hover:text-slate-900 font-bold"
            >
              Ver todo
            </button>
          </div>

          <div className="bg-white rounded-[24px] sm:rounded-[32px] border border-slate-100 shadow-xs p-3.5 sm:p-4 flex-1 space-y-3 overflow-y-auto max-h-[450px] lg:max-h-[650px]">
            {inProgressDeliveries.length === 0 ? (
              <div className="py-12 sm:py-16 text-center text-slate-400 text-xs font-bold space-y-2">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
                <p>No hay entregas pendientes en este momento.</p>
              </div>
            ) : (
              inProgressDeliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="p-3.5 sm:p-4 rounded-[20px] sm:rounded-[24px] bg-slate-50/80 hover:bg-slate-50 border border-slate-100 transition-all space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-black text-orange-600">#{delivery.orderNumber}</span>
                      <h4 className="text-xs font-black text-slate-900 mt-0.5">
                        {delivery.recipientName || 'Cliente sin nombre'}
                      </h4>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        delivery.priority === 'urgente'
                          ? 'bg-red-100 text-red-700'
                          : delivery.status === 'cerca'
                          ? 'bg-orange-100 text-orange-700 animate-pulse'
                          : delivery.status === 'en_camino'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {delivery.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 font-medium line-clamp-2">{delivery.description}</p>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500 font-bold">
                    <span className="flex items-center gap-1 truncate mr-2">
                      <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{delivery.driverName}</span>
                    </span>

                    {delivery.recipientLocation ? (
                      <span className="text-emerald-600 font-extrabold flex items-center gap-1 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        GPS Cliente
                      </span>
                    ) : (
                      <span className="text-amber-600 font-bold shrink-0">Esperando GPS</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
