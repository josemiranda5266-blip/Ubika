import React, { useState } from 'react';
import {
  UserCheck,
  Plus,
  Search,
  Truck,
  Bike,
  Car,
  Phone,
  Mail,
  MapPin,
  Clock,
  Shield,
  Star,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Edit2,
  Power,
  ExternalLink,
} from 'lucide-react';
import { Driver, DriverStatus, VehicleType } from '../../types';
import { apiFetch } from '../../utils/api';

interface DriversManagementViewProps {
  drivers: Driver[];
  companyId: string;
  onRefresh: () => void;
  onSelectDriverOnMap?: (driver: Driver) => void;
}

export const DriversManagementView: React.FC<DriversManagementViewProps> = ({
  drivers,
  companyId,
  onRefresh,
  onSelectDriverOnMap,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  // New Driver Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [internalId, setInternalId] = useState('');
  const [vehicle, setVehicle] = useState<VehicleType>('moto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredDrivers = drivers.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.internalId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.phone.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: DriverStatus) => {
    switch (status) {
      case 'disponible':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Disponible
          </span>
        );
      case 'en_tarea':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            En Tarea
          </span>
        );
      case 'pausado':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Pausado
          </span>
        );
      case 'desconectado':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-600 border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            Desconectado
          </span>
        );
      case 'inactivo':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-50 text-red-700 border border-red-200">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            Inactivo
          </span>
        );
    }
  };

  const getVehicleIcon = (v: VehicleType) => {
    if (v === 'bici') return <Bike className="w-4 h-4 text-emerald-600" />;
    if (v === 'camioneta' || v === 'auto') return <Car className="w-4 h-4 text-blue-600" />;
    return <Truck className="w-4 h-4 text-orange-500" />;
  };

  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError('Nombre y teléfono son obligatorios');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          internalId: internalId.trim(),
          vehicle,
        }),
      });

      if (!res.ok) throw new Error('Error al registrar repartidor');

      onRefresh();
      setIsAddModalOpen(false);
      setName('');
      setPhone('');
      setEmail('');
      setInternalId('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDriverStatus = async (driver: Driver) => {
    const nextStatus: DriverStatus = driver.status === 'inactivo' ? 'disponible' : driver.status === 'disponible' ? 'pausado' : 'disponible';
    try {
      await apiFetch(`/api/drivers/${driver.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-[28px] border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Gestión de Repartidores</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {drivers.length} cadetes registrados en la flota de tu empresa
          </p>
        </div>

        <button
          id="btn-add-driver"
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-2xl shadow-md shadow-orange-200 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>NUEVO REPARTIDOR</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
          <input
            id="search-drivers"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, ID interno (ej. R-01) o teléfono..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 w-full sm:w-auto overflow-x-auto">
          {['all', 'disponible', 'en_tarea', 'pausado', 'inactivo'].map((st) => (
            <button
              key={st}
              id={`filter-driver-${st}`}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all capitalize whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {st === 'all' ? 'Todos' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Drivers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
        {filteredDrivers.map((driver) => (
          <div
            key={driver.id}
            className="bg-white rounded-[24px] sm:rounded-[28px] border border-slate-100 shadow-xs p-4 sm:p-5 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-700 text-xs sm:text-sm shrink-0">
                    {driver.internalId}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-900 truncate">{driver.name}</h3>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-bold mt-0.5">
                      {getVehicleIcon(driver.vehicle)}
                      <span className="capitalize">{driver.vehicle}</span>
                      <span>•</span>
                      <div className="flex items-center text-amber-500">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span className="text-[10px] font-black ml-0.5">{driver.rating}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="shrink-0">{getStatusBadge(driver.status)}</div>
              </div>

              {/* Details & Location */}
              <div className="mt-3 sm:mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600 font-medium">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Phone className="w-3.5 h-3.5" /> Teléfono
                  </span>
                  <span className="font-bold text-slate-800">{driver.phone}</span>
                </div>

                <div className="flex items-center justify-between text-slate-600 font-medium">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Entregas Realizadas
                  </span>
                  <span className="font-black text-slate-900">{driver.totalDeliveries} completadas</span>
                </div>

                {driver.activeDeliveryId && (
                  <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-[11px] text-blue-900 font-bold flex items-center justify-between">
                    <span>📦 Tarea activa en curso</span>
                    <span className="font-mono">{driver.activeDeliveryId}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="mt-4 sm:mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                id={`btn-view-map-driver-${driver.id}`}
                type="button"
                onClick={() => onSelectDriverOnMap?.(driver)}
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-orange-50 hover:text-orange-600 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 min-h-[42px]"
              >
                <MapPin className="w-3.5 h-3.5 text-orange-500" />
                <span>Ver en Mapa</span>
              </button>

              <button
                id={`btn-toggle-status-driver-${driver.id}`}
                type="button"
                onClick={() => handleToggleDriverStatus(driver)}
                title="Cambiar estado"
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors min-w-[42px] min-h-[42px] flex items-center justify-center"
              >
                <Power className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* New Driver Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-white border border-slate-100 rounded-[28px] sm:rounded-[32px] shadow-2xl p-5 sm:p-6 text-slate-900 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base sm:text-lg font-black text-slate-900">Alta de Nuevo Repartidor</h3>
            <p className="text-xs text-orange-600 font-extrabold uppercase tracking-tight mb-4">UBIKA CONTROL</p>

            {error && (
              <div className="p-3 mb-4 rounded-xl bg-red-50 text-red-600 text-xs font-bold">{error}</div>
            )}

            <form onSubmit={handleCreateDriver} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Lucas Ferreyra"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono / WhatsApp *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej. +54 9 385 411-2233"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ID Interno</label>
                  <input
                    type="text"
                    value={internalId}
                    onChange={(e) => setInternalId(e.target.value)}
                    placeholder="Ej. R-05"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Vehículo</label>
                  <select
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  >
                    <option value="moto">Moto</option>
                    <option value="bici">Bicicleta</option>
                    <option value="auto">Automóvil</option>
                    <option value="camioneta">Camioneta</option>
                    <option value="a_pie">A pie</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="repartidor@empresa.com"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl min-h-[42px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black rounded-xl shadow-md min-h-[42px]"
                >
                  {loading ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
