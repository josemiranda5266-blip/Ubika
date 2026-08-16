import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  Clock,
  CheckCircle2,
  Navigation,
  Share2,
  Phone,
  MessageCircle,
  AlertCircle,
  Truck,
  Bike,
  Car,
  ShieldCheck,
  MapPin,
  RefreshCw,
  Search,
  ExternalLink,
  Lock,
  ChevronRight,
  User,
  History,
  Settings,
  Trash2,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { Delivery, DeliveryStatus, DriverProfile, VehicleType } from '../types';
import { formatDistance, formatEta, formatTimestamp, watchBrowserPosition } from '../utils/geo';
import { apiFetch, getStoredToken, setStoredAuth } from '../utils/api';
import { MapView } from './MapView';
import { DeliveryModal } from './DeliveryModal';
import { PrivacyPolicyModal } from './PrivacyPolicyModal';

interface DriverAppProps {
  onOpenCustomerLink: (token: string) => void;
}

export const DriverApp: React.FC<DriverAppProps> = ({ onOpenCustomerLink }) => {
  // Navigation tabs: 'new' | 'active' | 'history' | 'profile'
  const [activeTab, setActiveTab] = useState<'new' | 'active' | 'history' | 'profile'>('new');

  // Deliveries list
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [selectedShareDelivery, setSelectedShareDelivery] = useState<Delivery | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  // Driver Profile
  const [profile, setProfile] = useState<DriverProfile>({
    id: 'drv_01',
    name: 'Carlos Repartos',
    phone: '+54 9 385 412-8899',
    vehicle: 'moto',
    businessName: 'Express Santiago',
    totalDeliveries: 42,
    autoPurgePrivacyMinutes: 60,
  });

  // Driver GPS Tracking
  const [driverGpsActive, setDriverGpsActive] = useState(true);
  const [driverCoords, setDriverCoords] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);

  // Form State for "Nueva Entrega"
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Search in History
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'entregado' | 'cancelado'>('all');

  // Load Deliveries from Server
  const ensureDriverAuth = async () => {
    if (!getStoredToken()) {
      try {
        const res = await fetch('/api/auth/demo-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'DRIVER' }),
        });
        if (res.ok) {
          const data = await res.json();
          setStoredAuth(data.token, data.user);
        }
      } catch (err) {
        console.error('Driver auth bootstrap failed:', err);
      }
    }
  };

  const fetchDeliveries = async () => {
    try {
      await ensureDriverAuth();
      const res = await apiFetch('/api/deliveries');
      if (res.ok) {
        const data: Delivery[] = await res.json();
        setDeliveries(data);

        // If no active delivery selected, auto-select the latest non-completed one
        const activeOne = data.find(
          (d) => d.status !== 'entregado' && d.status !== 'cancelado' && d.status !== 'expirado'
        );
        if (activeOne && !activeDeliveryId) {
          setActiveDeliveryId(activeOne.id);
        }
      }
    } catch (err) {
      console.error('Error fetching deliveries', err);
    }
  };

  useEffect(() => {
    fetchDeliveries();
    const interval = setInterval(fetchDeliveries, 3000); // Polling every 3s
    return () => clearInterval(interval);
  }, []);

  // Driver GPS Watcher
  useEffect(() => {
    if (!driverGpsActive) return;

    const cleanup = watchBrowserPosition(
      (pos) => {
        setDriverCoords({ latitude: pos.latitude, longitude: pos.longitude, accuracy: pos.accuracy });

        // If there's an active delivery, broadcast driver location to backend
        if (activeDeliveryId) {
          apiFetch(`/api/deliveries/${activeDeliveryId}/driver-location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: pos.latitude,
              longitude: pos.longitude,
              accuracy: pos.accuracy,
            }),
          }).catch((e) => console.error(e));
        }
      },
      (err) => {
        console.warn('Driver GPS error / not granted:', err.message);
        // Fallback default coordinates if browser blocks GPS in iframe
        if (!driverCoords) {
          setDriverCoords({ latitude: -27.7885, longitude: -64.2612, accuracy: 10 });
        }
      }
    );

    return () => cleanup();
  }, [driverGpsActive, activeDeliveryId]);

  // Active delivery object
  const activeDelivery = deliveries.find((d) => d.id === activeDeliveryId) || deliveries[0] || null;

  // Handle Create Delivery
  const handleCreateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientPhone.trim()) {
      setError('Por favor ingresa el número de teléfono del cliente.');
      return;
    }
    if (!description.trim()) {
      setError('Por favor escribe qué debes entregar.');
      return;
    }

    setError(null);
    setFormSubmitting(true);

    try {
      const res = await apiFetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientPhone: recipientPhone.trim(),
          recipientName: recipientName.trim(),
          description: description.trim(),
          instructions: instructions.trim(),
          amount: amount.trim(),
          notes: notes.trim(),
          driverName: profile.name,
          driverPhone: profile.phone,
          driverVehicle: profile.vehicle,
          driverLocation: driverCoords,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al crear la entrega');
      }

      const newDel: Delivery = await res.json();
      setDeliveries((prev) => [newDel, ...prev]);
      setActiveDeliveryId(newDel.id);

      // Reset form
      setRecipientPhone('');
      setRecipientName('');
      setDescription('');
      setInstructions('');
      setAmount('');
      setNotes('');

      // Open share modal immediately
      setSelectedShareDelivery(newDel);
      setIsShareModalOpen(true);
      setActiveTab('active');
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Accept / Reject Task from Central Dispatch
  const handleAcceptTask = async (deliveryId: string) => {
    try {
      const res = await apiFetch(`/api/deliveries/${deliveryId}/accept`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: profile.id }),
      });
      if (res.ok) {
        const updated: Delivery = await res.json();
        setDeliveries((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        setActiveDeliveryId(updated.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectTask = async (deliveryId: string) => {
    try {
      const res = await apiFetch(`/api/deliveries/${deliveryId}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: profile.id, reason: 'Repartidor ocupado en otra zona' }),
      });
      if (res.ok) {
        fetchDeliveries();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Status Update (En Camino, Llegué, Entregado, Cancelar)
  const handleUpdateStatus = async (deliveryId: string, status: DeliveryStatus) => {
    try {
      const endpoint =
        status === 'en_camino'
          ? `/api/deliveries/${deliveryId}/start`
          : status === 'cerca'
          ? `/api/deliveries/${deliveryId}/arrive`
          : status === 'entregado'
          ? `/api/deliveries/${deliveryId}/complete`
          : `/api/deliveries/${deliveryId}/status`;

      const res = await apiFetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated: Delivery = await res.json();
        setDeliveries((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete from history
  const handleDeleteDelivery = async (id: string) => {
    if (!window.confirm('¿Deseas eliminar este registro del historial?')) return;
    try {
      await apiFetch(`/api/deliveries/${id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Eliminado por el operador' }),
      });
      setDeliveries((prev) => prev.filter((d) => d.id !== id));
      if (activeDeliveryId === id) {
        setActiveDeliveryId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Helper Preset tags for rapid description entry
  const applyPreset = (text: string) => {
    setDescription((prev) => (prev ? `${prev}, ${text}` : text));
  };

  // Vehicle Icon helper
  const renderVehicleIcon = (type: VehicleType, className = 'w-4 h-4') => {
    if (type === 'bici') return <Bike className={className} />;
    if (type === 'auto' || type === 'camioneta') return <Car className={className} />;
    return <Truck className={className} />;
  };

  // Status Badge Component
  const renderStatusBadge = (status: DeliveryStatus) => {
    switch (status) {
      case 'esperando_autorizacion':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-600 border border-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Esperando
          </span>
        );
      case 'ubicacion_compartida':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-green-500/20 text-green-700 border border-green-300">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Ubicación en vivo
          </span>
        );
      case 'en_camino':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-500/20 text-blue-700 border border-blue-300">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
            En camino
          </span>
        );
      case 'cerca':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-purple-500/20 text-purple-700 border border-purple-300 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            ¡Llegando!
          </span>
        );
      case 'entregado':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-green-500 text-white shadow-sm">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            Entregado
          </span>
        );
      case 'rechazado':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
            Rechazado
          </span>
        );
      case 'cancelado':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-500/10 text-red-600 border border-red-200">
            Cancelado
          </span>
        );
      case 'expirado':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-400 border border-slate-200">
            Expirado
          </span>
        );
      default:
        return null;
    }
  };

  const activeDeliveriesList = deliveries.filter(
    (d) => d.status !== 'entregado' && d.status !== 'cancelado' && d.status !== 'expirado'
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 relative">
      {/* Top Driver Subheader / Status Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 border-2 border-white shadow-md flex items-center justify-center text-white font-black text-sm">
            <User className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-slate-900">{profile.name}</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-green-50 text-green-700 border border-green-200">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                Online
              </span>
            </div>
            <p className="text-xs text-slate-400 font-semibold">{profile.businessName} • ID #{profile.id}</p>
          </div>
        </div>

        {/* Tab switcher navigation pills */}
        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-full sm:w-auto overflow-x-auto">
          <button
            id="nav-tab-new"
            type="button"
            onClick={() => setActiveTab('new')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === 'new'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nueva Entrega</span>
          </button>

          <button
            id="nav-tab-active"
            type="button"
            onClick={() => setActiveTab('active')}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === 'active'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Navigation className="w-4 h-4" />
            <span>En Curso</span>
            {activeDeliveriesList.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-orange-300 animate-ping"></span>
            )}
          </button>

          <button
            id="nav-tab-history"
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === 'history'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historial ({deliveries.length})</span>
          </button>

          <button
            id="nav-tab-profile"
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === 'profile'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Ajustes</span>
          </button>

          <button
            id="driver-btn-open-privacy"
            type="button"
            onClick={() => setIsPrivacyModalOpen(true)}
            className="p-2 text-slate-400 hover:text-orange-500 rounded-xl transition-colors ml-1"
            title="Políticas de Privacidad"
          >
            <ShieldCheck className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <main className="flex-1 pb-16 space-y-6">
        {/* ================= TAB 1: NUEVA ENTREGA (VIBRANT PALETTE GRID) ================= */}
        {activeTab === 'new' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fadeIn">
            {/* Left Column: Form Card */}
            <div className="lg:col-span-6 flex flex-col gap-6">
              <div className="bg-white rounded-[32px] p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-2 h-8 bg-orange-500 rounded-full"></div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Nueva Entrega</h2>
                </div>

                {error && (
                  <div className="mb-4 p-4 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleCreateDelivery} className="space-y-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-5">
                    {/* Phone Input */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Teléfono del Cliente (WhatsApp) *
                      </label>
                      <input
                        id="driver-input-phone"
                        type="tel"
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        placeholder="Ej. 3854128832"
                        required
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white outline-none transition-colors"
                      />
                    </div>

                    {/* Customer Name */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Nombre del Cliente (Opcional)
                      </label>
                      <input
                        id="driver-input-name"
                        type="text"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="Ej. Jorge M."
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white outline-none transition-colors"
                      />
                    </div>

                    {/* Order Description */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Descripción del Pedido *
                      </label>
                      <textarea
                        id="driver-input-desc"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="¿Qué estás entregando? (ej. 2 pizzas grandes + gaseosa)"
                        rows={2}
                        required
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-base font-medium text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white outline-none resize-none transition-colors"
                      />

                      {/* Fast Presets */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => applyPreset('Comida / Pedido')}
                          className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold border border-orange-200 transition-colors"
                        >
                          🍕 Comida
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('Paquete / Encomienda')}
                          className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold border border-orange-200 transition-colors"
                        >
                          📦 Paquete
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('Documentación bancaria')}
                          className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold border border-orange-200 transition-colors"
                        >
                          📄 Documentos
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('Medicamentos')}
                          className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold border border-orange-200 transition-colors"
                        >
                          💊 Farmacia
                        </button>
                      </div>
                    </div>

                    {/* Instructions & Amount */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Instrucciones / Notas
                        </label>
                        <input
                          id="driver-input-instructions"
                          type="text"
                          value={instructions}
                          onChange={(e) => setInstructions(e.target.value)}
                          placeholder="Llevar vuelto de $10.000 / Casa rejas negras"
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Monto a Cobrar
                        </label>
                        <input
                          id="driver-input-amount"
                          type="text"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="$14.500 en efectivo"
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 text-xs font-bold text-orange-600 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white outline-none transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submit CTA Button */}
                  <button
                    id="driver-btn-submit-delivery"
                    type="submit"
                    disabled={formSubmitting}
                    className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-black py-4.5 rounded-2xl text-lg shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-3 mt-6 disabled:opacity-50"
                  >
                    <Navigation className="w-5 h-5 fill-white" />
                    <span>{formSubmitting ? 'GENERANDO SOLICITUD...' : 'SOLICITAR UBICACIÓN'}</span>
                  </button>
                </form>
              </div>

              {/* Dark Capsule Status Block */}
              {activeDelivery && (
                <div className="bg-slate-900 rounded-[32px] p-6 flex items-center justify-between text-white shadow-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center">
                      <Navigation className="w-6 h-6 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Última Solicitud</p>
                      <p className="font-bold text-sm text-slate-100">
                        #{activeDelivery.orderNumber} • {activeDelivery.recipientName || activeDelivery.recipientPhone}
                      </p>
                    </div>
                  </div>
                  {renderStatusBadge(activeDelivery.status)}
                </div>
              )}
            </div>

            {/* Right Column: Live Map Preview & Fast Actions */}
            <div className="lg:col-span-6 flex flex-col gap-6">
              {activeDelivery ? (
                <div className="bg-white rounded-[32px] p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex-1 flex flex-col justify-between space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                      <div>
                        <h3 className="text-xl font-extrabold text-slate-900">Seguimiento en Vivo</h3>
                        <p className="text-xs text-slate-400 font-semibold">Pedido #{activeDelivery.orderNumber}</p>
                      </div>
                    </div>
                    {renderStatusBadge(activeDelivery.status)}
                  </div>

                  {/* Embedded Live Map */}
                  <div className="relative">
                    <MapView
                      driverLocation={driverCoords}
                      recipientLocation={activeDelivery.recipientLocation}
                      driverVehicle={profile.vehicle}
                      recipientName={activeDelivery.recipientName || 'Cliente'}
                      className="h-80 w-full"
                    />

                    {/* Floating Metrics Overlay Card */}
                    <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white z-10">
                      <div className="flex items-center gap-4">
                        <div className="text-center border-r border-slate-200 pr-4">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Distancia</p>
                          <p className="text-xl font-black text-slate-900">
                            {formatDistance(activeDelivery.distanceMeters)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Tiempo Est.</p>
                          <p className="text-xl font-black text-slate-900">
                            {formatEta(activeDelivery.etaMinutes)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions under map */}
                  <div className="space-y-3 pt-2">
                    <div className="flex gap-3">
                      <button
                        id="driver-btn-open-share-modal"
                        type="button"
                        onClick={() => {
                          setSelectedShareDelivery(activeDelivery);
                          setIsShareModalOpen(true);
                        }}
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-extrabold py-4 rounded-2xl text-sm shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                      >
                        <MessageCircle className="w-4 h-4 fill-white" />
                        <span>Reenviar WhatsApp / QR</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenCustomerLink(activeDelivery.sessionToken)}
                        className="px-5 border-2 border-slate-200 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-100 transition-all text-xs flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Vista Cliente</span>
                      </button>
                    </div>

                    {/* Delivery Status buttons */}
                    {activeDelivery.status !== 'entregado' && activeDelivery.status !== 'cancelado' && (
                      <div className="flex gap-3">
                        <button
                          id="driver-btn-mark-delivered"
                          type="button"
                          onClick={() => handleUpdateStatus(activeDelivery.id, 'entregado')}
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white font-black py-4 rounded-2xl text-base shadow-lg shadow-green-100 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                          <CheckCircle2 className="w-5 h-5 stroke-[3]" />
                          <span>ENTREGA REALIZADA</span>
                        </button>

                        <button
                          id="driver-btn-cancel-delivery"
                          type="button"
                          onClick={() => {
                            if (window.confirm('¿Deseas cancelar esta entrega?')) {
                              handleUpdateStatus(activeDelivery.id, 'cancelado');
                            }
                          }}
                          className="px-6 border-2 border-slate-200 text-slate-400 font-bold py-4 rounded-2xl hover:bg-slate-100 hover:text-slate-600 transition-all text-xs"
                        >
                          CANCELAR
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-[32px] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex-1 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-500">
                    <Truck className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900">Listo para tu primera entrega</h3>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Completa el formulario para solicitar la ubicación por WhatsApp y verás la ruta y distancia en tiempo real aquí.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 2: ENTREGA ACTIVA / EN CURSO (LIVE MAP & CONTROLS) ================= */}
        {activeTab === 'active' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Active Deliveries Picker if multiple */}
            {activeDeliveriesList.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {activeDeliveriesList.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setActiveDeliveryId(d.id)}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all ${
                      d.id === activeDelivery?.id
                        ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    #{d.orderNumber} · {d.recipientName || d.recipientPhone}
                  </button>
                ))}
              </div>
            )}

            {activeDelivery ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Card: Status and Info */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-white rounded-[32px] p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-8 bg-orange-500 rounded-full"></div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Pedido #{activeDelivery.orderNumber}
                          </p>
                          <h2 className="text-xl font-black text-slate-900">
                            {activeDelivery.recipientName || activeDelivery.recipientPhone}
                          </h2>
                        </div>
                      </div>
                      {renderStatusBadge(activeDelivery.status)}
                    </div>

                    {/* Order Description */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-xs font-semibold text-slate-700">📦 {activeDelivery.description}</p>
                    </div>

                    {/* Metrics Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 rounded-2xl bg-orange-50/50 border border-orange-100">
                        <p className="text-[10px] font-bold text-orange-600 uppercase tracking-tight">Distancia</p>
                        <p className="text-2xl font-black text-slate-900 mt-0.5">
                          {formatDistance(activeDelivery.distanceMeters)}
                        </p>
                      </div>
                      <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tight">Tiempo Estimado</p>
                        <p className="text-2xl font-black text-slate-900 mt-0.5">
                          {formatEta(activeDelivery.etaMinutes)}
                        </p>
                      </div>
                    </div>

                    {/* Recipient Note */}
                    {activeDelivery.recipientLocation?.noteFromRecipient && (
                      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">
                          Indicación del Cliente:
                        </p>
                        <p className="font-semibold">{activeDelivery.recipientLocation.noteFromRecipient}</p>
                      </div>
                    )}

                    {/* Amount & Instructions */}
                    {(activeDelivery.amount || activeDelivery.instructions) && (
                      <div className="pt-3 border-t border-slate-100 text-xs space-y-2 text-slate-600">
                        {activeDelivery.amount && (
                          <div className="flex justify-between font-bold">
                            <span className="text-slate-400">Monto a Cobrar:</span>
                            <span className="text-orange-600 font-extrabold text-sm">{activeDelivery.amount}</span>
                          </div>
                        )}
                        {activeDelivery.instructions && (
                          <div className="text-xs text-slate-500">
                            <strong>Instrucciones:</strong> {activeDelivery.instructions}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Buttons */}
                    <div className="space-y-3 pt-2">
                      <button
                        id="driver-btn-open-share-modal-active"
                        type="button"
                        onClick={() => {
                          setSelectedShareDelivery(activeDelivery);
                          setIsShareModalOpen(true);
                        }}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-extrabold py-3.5 px-4 rounded-2xl text-xs shadow-md shadow-orange-200 transition-all flex items-center justify-center gap-2"
                      >
                        <MessageCircle className="w-4 h-4 fill-white" />
                        <span>Reenviar WhatsApp / QR / Enlace</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenCustomerLink(activeDelivery.sessionToken)}
                        className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-2xl border border-slate-200 text-xs flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir Vista del Cliente</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Card: Full Interactive Map and Flow Controls */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="bg-white rounded-[32px] p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                        <h3 className="text-xl font-extrabold text-slate-900">Navegación en Vivo</h3>
                      </div>
                      <span className="text-xs font-semibold text-slate-400">
                        {activeDelivery.recipientLocation
                          ? `GPS actualizado ${formatTimestamp(activeDelivery.recipientLocation.updatedAt)}`
                          : 'Esperando señal GPS...'}
                      </span>
                    </div>

                    <MapView
                      driverLocation={driverCoords}
                      recipientLocation={activeDelivery.recipientLocation}
                      driverVehicle={profile.vehicle}
                      recipientName={activeDelivery.recipientName || 'Cliente'}
                      className="h-96 w-full"
                    />

                    {/* Status Action Workflow Buttons */}
                    {activeDelivery.status !== 'entregado' && activeDelivery.status !== 'cancelado' && (
                      <div className="space-y-3 pt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {activeDelivery.status !== 'en_camino' && activeDelivery.status !== 'cerca' && (
                            <button
                              id="driver-btn-mark-on-the-way"
                              type="button"
                              onClick={() => handleUpdateStatus(activeDelivery.id, 'en_camino')}
                              className="py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2"
                            >
                              <Navigation className="w-4 h-4 fill-white" />
                              <span>MARCAR EN CAMINO</span>
                            </button>
                          )}

                          {activeDelivery.status === 'en_camino' && (
                            <button
                              id="driver-btn-mark-arrived"
                              type="button"
                              onClick={() => handleUpdateStatus(activeDelivery.id, 'cerca')}
                              className="py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-purple-100 transition-all flex items-center justify-center gap-2"
                            >
                              <MapPin className="w-4 h-4" />
                              <span>ESTOY AFUERA / CERCA</span>
                            </button>
                          )}

                          <button
                            id="driver-btn-mark-delivered-active"
                            type="button"
                            onClick={() => handleUpdateStatus(activeDelivery.id, 'entregado')}
                            className={`py-4 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-green-100 transition-all flex items-center justify-center gap-2 ${
                              activeDelivery.status === 'en_camino' || activeDelivery.status === 'cerca'
                                ? 'col-span-1'
                                : 'col-span-full'
                            }`}
                          >
                            <CheckCircle2 className="w-5 h-5 stroke-[3]" />
                            <span>ENTREGA REALIZADA</span>
                          </button>
                        </div>

                        <div className="text-center pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('¿Estás seguro de cancelar esta entrega?')) {
                                handleUpdateStatus(activeDelivery.id, 'cancelado');
                              }
                            }}
                            className="text-xs font-bold text-slate-400 hover:text-red-600 transition-colors"
                          >
                            Cancelar esta entrega
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center rounded-[32px] bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4 max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-3xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto">
                  <Truck className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900">No tienes entregas activas</h3>
                <p className="text-xs text-slate-500">
                  Crea una nueva solicitud para rastrear la ubicación en tiempo real en el mapa.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('new')}
                  className="px-6 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl text-xs transition-all shadow-md shadow-orange-200"
                >
                  Nueva Entrega
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: HISTORIAL DE ENTREGAS ================= */}
        {activeTab === 'history' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-8 bg-orange-500 rounded-full"></div>
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Historial de Entregas</h2>
                  <p className="text-xs text-slate-400 font-semibold">Registro con política de privacidad aplicada</p>
                </div>
              </div>
              <span className="text-xs font-black text-orange-600 bg-orange-50 px-4 py-1.5 rounded-full border border-orange-200">
                {deliveries.length} registros
              </span>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-4 top-3.5 text-slate-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Buscar por cliente, pedido o teléfono..."
                  className="w-full bg-white border-2 border-slate-100 rounded-2xl pl-11 pr-4 py-3 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setHistoryFilter('all')}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                    historyFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Todas ({deliveries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('entregado')}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                    historyFilter === 'entregado'
                      ? 'bg-green-500 text-white shadow-md shadow-green-100'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Entregadas ({deliveries.filter((d) => d.status === 'entregado').length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('cancelado')}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                    historyFilter === 'cancelado'
                      ? 'bg-red-500 text-white shadow-md shadow-red-100'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Canceladas ({deliveries.filter((d) => d.status === 'cancelado').length})
                </button>
              </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {deliveries
                .filter((d) => {
                  if (historyFilter !== 'all' && d.status !== historyFilter) return false;
                  if (!historySearch.trim()) return true;
                  const q = historySearch.toLowerCase();
                  return (
                    d.description.toLowerCase().includes(q) ||
                    (d.recipientName && d.recipientName.toLowerCase().includes(q)) ||
                    d.recipientPhone.includes(q) ||
                    String(d.orderNumber).includes(q)
                  );
                })
                .map((d) => (
                  <div
                    key={d.id}
                    className="p-6 rounded-[32px] bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 text-xs font-black font-mono">
                          #{d.orderNumber}
                        </span>
                        <span className="text-sm font-extrabold text-slate-900">
                          {d.recipientName || d.recipientPhone}
                        </span>
                      </div>
                      {renderStatusBadge(d.status)}
                    </div>

                    <p className="text-xs text-slate-600 font-medium">📦 {d.description}</p>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-100">
                      <span>{new Date(d.createdAt).toLocaleDateString()} · {new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <div className="flex items-center gap-1 text-green-600 font-bold">
                        <Lock className="w-3 h-3" />
                        <span>GPS Purge OK</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {d.status !== 'entregado' && d.status !== 'cancelado' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveDeliveryId(d.id);
                            setActiveTab('active');
                          }}
                          className="text-xs font-black text-orange-500 hover:text-orange-600"
                        >
                          Ver en mapa →
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">Sesión concluida</span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteDelivery(d.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                        title="Borrar registro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

              {deliveries.length === 0 && (
                <div className="col-span-full p-12 text-center rounded-[32px] bg-white border border-slate-100 text-slate-400 text-xs font-semibold">
                  Aún no tienes entregas registradas en el historial.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 4: PERFIL & CONFIGURACIÓN ================= */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
            <div className="p-8 rounded-[32px] bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-6">
              <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-black text-xl shadow-md">
                  <User className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900">{profile.name}</h3>
                  <p className="text-xs text-slate-400 font-semibold">{profile.businessName || 'Repartidor Independiente'}</p>
                </div>
              </div>

              {/* Profile details form */}
              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-400 font-bold uppercase tracking-wider block mb-2">Nombre del Repartidor</label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-900 focus:border-orange-500 focus:bg-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-bold uppercase tracking-wider block mb-2">Teléfono de Contacto</label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-900 focus:border-orange-500 focus:bg-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-bold uppercase tracking-wider block mb-2">Vehículo de Reparto</label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {(['moto', 'bici', 'auto', 'camioneta', 'a_pie'] as VehicleType[]).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setProfile({ ...profile, vehicle: v })}
                        className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 capitalize text-xs font-bold transition-all ${
                          profile.vehicle === v
                            ? 'bg-orange-50 border-orange-500 text-orange-700'
                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {renderVehicleIcon(v, 'w-5 h-5')}
                        <span>{v.replace('_', ' ')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy By Design Card */}
            <div className="p-6 rounded-[32px] bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-orange-600 font-black text-xs">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Arquitectura Privacy by Design</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrivacyModalOpen(true)}
                  className="text-xs text-orange-600 underline font-bold"
                >
                  Ver Términos
                </button>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                UBIKA opera con minimización estricta de datos. No se almacena historial de trayectorias pasadas, y las coordenadas se purgan al instante en que el repartidor marca la entrega finalizada.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* WhatsApp Share & QR Modal */}
      <DeliveryModal
        delivery={selectedShareDelivery}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onOpenCustomerView={(token) => {
          onOpenCustomerLink(token);
          setIsShareModalOpen(false);
        }}
      />

      {/* Privacy Policy Modal */}
      <PrivacyPolicyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
      />
    </div>
  );
};
