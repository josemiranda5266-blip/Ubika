import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Send,
  UserCheck,
  XCircle,
  Truck,
  Search,
} from 'lucide-react';
import { DeliveryEvent } from '../../types';
import { formatTimestamp } from '../../utils/geo';

interface AuditEventsViewProps {
  events: DeliveryEvent[];
}

export const AuditEventsView: React.FC<AuditEventsViewProps> = ({ events }) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEvents = events.filter((evt) => {
    const matchesSearch =
      evt.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evt.orderNumber.toString().includes(searchTerm) ||
      evt.author.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || evt.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const getEventIcon = (type: DeliveryEvent['type']) => {
    switch (type) {
      case 'DELIVERY_CREATED':
        return <Send className="w-4 h-4 text-orange-500" />;
      case 'DRIVER_ASSIGNED':
        return <Truck className="w-4 h-4 text-blue-600" />;
      case 'DRIVER_ACCEPTED':
        return <UserCheck className="w-4 h-4 text-emerald-600" />;
      case 'DRIVER_REJECTED':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'DELIVERY_STARTED':
        return <Truck className="w-4 h-4 text-blue-600" />;
      case 'LOCATION_REQUESTED':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'LOCATION_SHARED':
        return <MapPin className="w-4 h-4 text-emerald-600" />;
      case 'DRIVER_ARRIVED':
        return <MapPin className="w-4 h-4 text-orange-500" />;
      case 'DELIVERY_COMPLETED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'DELIVERY_CANCELLED':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'LOCATION_PURGED':
        return <XCircle className="w-4 h-4 text-purple-600" />;
      default:
        return <Activity className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Bar */}
      <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Registro de Eventos y Auditoría</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Flujo cronológico en tiempo real de todas las operaciones logísticas y cambios de estado
          </p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
          <input
            id="search-events"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por pedido #, descripción o autor..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 w-full sm:w-auto overflow-x-auto">
          {['all', 'DELIVERY_CREATED', 'LOCATION_SHARED', 'DELIVERY_COMPLETED'].map((ft) => (
            <button
              key={ft}
              id={`filter-event-${ft}`}
              type="button"
              onClick={() => setFilterType(ft)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all capitalize whitespace-nowrap ${
                filterType === ft
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {ft === 'all'
                ? 'Todos'
                : ft === 'DELIVERY_CREATED'
                ? 'Creados'
                : ft === 'LOCATION_SHARED'
                ? 'Ubicación GPS'
                : 'Completados'}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline List */}
      <div className="bg-white rounded-[24px] sm:rounded-[28px] border border-slate-100 shadow-xs p-4 sm:p-6">
        <div className="relative border-l-2 border-slate-100 pl-4 sm:pl-6 ml-2 sm:ml-4 space-y-4 sm:space-y-6">
          {filteredEvents.map((evt) => (
            <div key={evt.id} className="relative group">
              {/* Dot Icon */}
              <div className="absolute -left-[27px] sm:-left-[35px] top-0.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white border-2 border-slate-200 group-hover:border-orange-500 flex items-center justify-center shadow-xs transition-colors">
                {getEventIcon(evt.type)}
              </div>

              {/* Event Content */}
              <div className="bg-slate-50/80 group-hover:bg-slate-50 rounded-2xl p-3.5 sm:p-4 border border-slate-100 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-200">
                      Pedido #{evt.orderNumber}
                    </span>
                    <span className="text-xs font-extrabold text-slate-900">{evt.type}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatTimestamp(evt.timestamp)}</span>
                  </div>
                </div>

                <p className="text-xs font-medium text-slate-700 leading-relaxed">{evt.description}</p>

                <div className="mt-2 pt-2 border-t border-slate-200/50 flex items-center justify-between text-[10px] text-slate-400 font-bold">
                  <span>Autor: {evt.author}</span>
                  <span className="font-mono">ID: {evt.id}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
