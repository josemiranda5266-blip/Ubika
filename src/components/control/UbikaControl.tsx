import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Map,
  Users,
  PlusCircle,
  History,
  Route,
  Activity,
  Building2,
  ChevronDown,
  RefreshCw,
  Menu,
  X,
  Wifi,
  WifiOff,
  Bell,
  Shield,
  CheckCircle2,
  ChevronRight,
  Package,
} from 'lucide-react';
import { Company, DashboardMetrics, Delivery, Driver, DeliveryEvent } from '../../types';
import { apiFetch, getStoredToken, getStoredUser } from '../../utils/api';
import { DashboardView } from './DashboardView';
import { FleetMapView } from './FleetMapView';
import { DriversManagementView } from './DriversManagementView';
import { DeliveriesHistoryView } from './DeliveriesHistoryView';
import { RouteHistoryView } from './RouteHistoryView';
import { AuditEventsView } from './AuditEventsView';
import { NewTaskModal } from './NewTaskModal';

interface UbikaControlProps {
  onOpenCustomerLink?: (token: string) => void;
}

export type ControlTab = 'dashboard' | 'history' | 'map' | 'drivers' | 'routes' | 'audit';

export const UbikaControl: React.FC<UbikaControlProps> = ({ onOpenCustomerLink }) => {
  const currentUser = getStoredUser();
  const [currentTab, setCurrentTab] = useState<ControlTab>('dashboard');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    const user = getStoredUser();
    if (user?.companyId && user.companyId !== 'comp_ubika_piloto') {
      return user.companyId;
    }
    return 'comp_centro_logistico_01';
  });
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [events, setEvents] = useState<DeliveryEvent[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    activeDrivers: 0,
    availableDrivers: 0,
    pendingDeliveries: 0,
    inProgressDeliveries: 0,
    completedDeliveries: 0,
    delayedDeliveries: 0,
    cancelledDeliveries: 0,
    totalRevenue: '$0',
  });
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [selectedDriverIdOnMap, setSelectedDriverIdOnMap] = useState<string | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load Companies (Strict LOGISTICS tenant isolation)
  const fetchCompanies = async () => {
    try {
      const res = await apiFetch('/api/companies');
      if (res.ok) {
        const data: Company[] = await res.json();
        // Strict LOGISTICS filter: Exclude pure FOOD companies
        const logisticsOnly = data.filter(
          (c) => c.businessType === 'LOGISTICS' || (!c.businessType && c.category !== 'Gastronomía')
        );
        setCompanies(logisticsOnly);
        
        const user = getStoredUser();
        if (user?.companyId && user.companyId !== 'comp_ubika_piloto') {
          setSelectedCompanyId(user.companyId);
        } else if (logisticsOnly.length > 0 && !logisticsOnly.some((c) => c.id === selectedCompanyId)) {
          setSelectedCompanyId(logisticsOnly[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Load all operational data
  const fetchData = async () => {
    try {
      setIsRefreshing(true);
      const [resMetrics, resDrivers, resDeliveries, resEvents] = await Promise.all([
        apiFetch(`/api/metrics?companyId=${selectedCompanyId}`),
        apiFetch(`/api/drivers?companyId=${selectedCompanyId}`),
        apiFetch(`/api/deliveries?companyId=${selectedCompanyId}`),
        apiFetch(`/api/events?companyId=${selectedCompanyId}`),
      ]);

      if (resMetrics.ok) setMetrics(await resMetrics.json());
      if (resDrivers.ok) setDrivers(await resDrivers.json());
      if (resDeliveries.ok) setDeliveries(await resDeliveries.json());
      if (resEvents.ok) setEvents(await resEvents.json());
    } catch (e) {
      console.error('Error polling data', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000); // 3s real-time poll
    return () => clearInterval(interval);
  }, [selectedCompanyId]);

  const activeCompany = companies.find((c) => c.id === selectedCompanyId) || companies[0];

  const handleSelectDriverOnMap = (driverId: string) => {
    setSelectedDriverIdOnMap(driverId);
    setCurrentTab('map');
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'history', label: 'Tareas / Despacho', icon: Package, badge: metrics.inProgressDeliveries > 0 ? metrics.inProgressDeliveries : null },
    { id: 'map', label: 'Mapa de Flota', icon: Map, badge: drivers.filter((d) => d.status === 'disponible').length },
    { id: 'drivers', label: 'Repartidores', icon: Users, badge: drivers.length },
    { id: 'routes', label: 'Recorridos', icon: Route, badge: null },
    { id: 'audit', label: 'Auditoría', icon: Activity, badge: null },
  ] as const;

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F8FAFC] pb-20 md:pb-6">
      {/* Offline Status Banner */}
      {!isOnline && (
        <div className="bg-red-600 text-white px-4 py-2.5 text-xs font-black flex items-center justify-center gap-2 shadow-md z-50 animate-fadeIn">
          <WifiOff className="w-4 h-4 shrink-0 animate-bounce" />
          <span>🔴 Sin conexión a Internet — Los cambios no se sincronizarán hasta recuperar conectividad.</span>
        </div>
      )}

      {/* Main Top Header & Brand Bar */}
      <header className="bg-white border-b border-slate-200/80 px-3 sm:px-6 lg:px-8 py-3 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Company Selector with Category Pill */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-2xl bg-orange-500 text-white shadow-md shadow-orange-200 shrink-0">
              <Building2 className="w-4 h-4 sm:w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider hidden xs:inline">
                  EMPRESA / COMERCIO
                </span>
                {activeCompany && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-orange-50 text-orange-600 border border-orange-200">
                    {activeCompany.category}
                  </span>
                )}
              </div>
              <div className="relative mt-0.5 max-w-[200px] sm:max-w-xs">
                {currentUser?.companyId && currentUser.companyId !== 'comp_ubika_piloto' ? (
                  <span className="text-xs sm:text-sm font-black text-slate-900 block px-0.5">
                    {activeCompany?.name || 'Cargando empresa...'}
                  </span>
                ) : (
                  <>
                    <select
                      id="control-company-select"
                      value={selectedCompanyId}
                      onChange={(e) => setSelectedCompanyId(e.target.value)}
                      className="w-full appearance-none pr-6 text-xs sm:text-sm font-black text-slate-900 bg-transparent focus:outline-none cursor-pointer truncate"
                    >
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-0 top-1 pointer-events-none" />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Quick Action & Status Indicators */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Live Sync Pulse */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] font-bold text-slate-600">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="hidden md:inline">{isOnline ? 'En Vivo (3s)' : 'Desconectado'}</span>
            </div>

            {/* Quick New Task Button */}
            <button
              id="control-top-btn-new-task"
              type="button"
              onClick={() => setIsNewTaskModalOpen(true)}
              className="flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-black text-xs rounded-xl sm:rounded-2xl shadow-md shadow-orange-200 transition-all min-h-[42px]"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden xs:inline">NUEVA TAREA</span>
              <span className="xs:hidden">NUEVA</span>
            </button>
          </div>
        </div>
      </header>

      {/* Desktop / Tablet Navigation Tab Bar */}
      <nav aria-label="Navegación principal" className="hidden md:block bg-white border-b border-slate-200/80 px-4 sm:px-8 py-2 sticky top-[61px] z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`tab-control-${item.id}`}
                  type="button"
                  onClick={() => setCurrentTab(item.id as ControlTab)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap min-h-[40px] ${
                    isActive
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge !== null && item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>{metrics.activeDrivers} repartidores en calle</span>
          </div>
        </div>
      </nav>

      {/* Main Content Body (Responsive Mobile, Tablet & Desktop) */}
      <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
        {currentTab === 'dashboard' && (
          <DashboardView
            metrics={metrics}
            drivers={drivers}
            deliveries={deliveries}
            onOpenNewTask={() => setIsNewTaskModalOpen(true)}
            onNavigateToTab={(t) => setCurrentTab(t as ControlTab)}
            onSelectDriverOnMap={handleSelectDriverOnMap}
          />
        )}

        {currentTab === 'map' && (
          <FleetMapView
            drivers={drivers}
            deliveries={deliveries}
            selectedDriverId={selectedDriverIdOnMap}
            onSelectDriver={(id) => setSelectedDriverIdOnMap(id)}
          />
        )}

        {currentTab === 'drivers' && (
          <DriversManagementView
            drivers={drivers}
            companyId={selectedCompanyId}
            onRefresh={fetchData}
            onSelectDriverOnMap={(d) => handleSelectDriverOnMap(d.id)}
          />
        )}

        {currentTab === 'history' && (
          <DeliveriesHistoryView
            deliveries={deliveries}
            drivers={drivers}
            onOpenNewTask={() => setIsNewTaskModalOpen(true)}
          />
        )}

        {currentTab === 'routes' && <RouteHistoryView drivers={drivers} deliveries={deliveries} />}

        {currentTab === 'audit' && <AuditEventsView events={events} />}
      </main>

      {/* Mobile Bottom Thumb Navigation Bar (Thumb-optimized, 4 primary items) */}
      <nav aria-label="Navegación móvil" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 shadow-2xl flex items-center justify-around">
        <button
          id="mobile-nav-dashboard"
          type="button"
          onClick={() => setCurrentTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all min-h-[48px] min-w-[64px] ${
            currentTab === 'dashboard'
              ? 'text-orange-600 font-black scale-105'
              : 'text-slate-400 font-bold hover:text-slate-600'
          }`}
        >
          <LayoutDashboard className={`w-5 h-5 ${currentTab === 'dashboard' ? 'text-orange-500' : ''}`} />
          <span className="text-[10px] mt-0.5">Inicio</span>
        </button>

        <button
          id="mobile-nav-history"
          type="button"
          onClick={() => setCurrentTab('history')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all min-h-[48px] min-w-[64px] relative ${
            currentTab === 'history'
              ? 'text-orange-600 font-black scale-105'
              : 'text-slate-400 font-bold hover:text-slate-600'
          }`}
        >
          <Package className={`w-5 h-5 ${currentTab === 'history' ? 'text-orange-500' : ''}`} />
          <span className="text-[10px] mt-0.5">Tareas</span>
          {metrics.inProgressDeliveries > 0 && (
            <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-white">
              {metrics.inProgressDeliveries}
            </span>
          )}
        </button>

        <button
          id="mobile-nav-map"
          type="button"
          onClick={() => setCurrentTab('map')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all min-h-[48px] min-w-[64px] relative ${
            currentTab === 'map'
              ? 'text-orange-600 font-black scale-105'
              : 'text-slate-400 font-bold hover:text-slate-600'
          }`}
        >
          <Map className={`w-5 h-5 ${currentTab === 'map' ? 'text-orange-500' : ''}`} />
          <span className="text-[10px] mt-0.5">Flota</span>
          {drivers.filter((d) => d.status === 'disponible').length > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
          )}
        </button>

        <button
          id="mobile-nav-more"
          type="button"
          onClick={() => setIsMoreMenuOpen(true)}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all min-h-[48px] min-w-[64px] ${
            ['drivers', 'routes', 'audit'].includes(currentTab)
              ? 'text-orange-600 font-black'
              : 'text-slate-400 font-bold hover:text-slate-600'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Más</span>
        </button>
      </nav>

      {/* Mobile "Más" Bottom Sheet Drawer */}
      {isMoreMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          {/* Backdrop Tap to Close */}
          <div className="flex-1" onClick={() => setIsMoreMenuOpen(false)} />

          <div className="bg-white rounded-t-[32px] border-t border-slate-100 p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto animate-slideUp">
            {/* Sheet Handle & Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-50 text-orange-600 font-black text-xs">UBIKA</div>
                <h3 className="text-base font-black text-slate-900">Opciones y Herramientas</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Items */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setCurrentTab('drivers');
                  setIsMoreMenuOpen(false);
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-orange-50 text-slate-900 font-bold text-sm border border-slate-100 transition-colors min-h-[48px]"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span>Gestión de Repartidores</span>
                    <p className="text-[11px] text-slate-400 font-medium">{drivers.length} cadetes registrados</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentTab('routes');
                  setIsMoreMenuOpen(false);
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-orange-50 text-slate-900 font-bold text-sm border border-slate-100 transition-colors min-h-[48px]"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-orange-50 text-orange-600">
                    <Route className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span>Historial de Recorridos</span>
                    <p className="text-[11px] text-slate-400 font-medium">Trazabilidad de rutas y tiempos</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentTab('audit');
                  setIsMoreMenuOpen(false);
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-orange-50 text-slate-900 font-bold text-sm border border-slate-100 transition-colors min-h-[48px]"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span>Registro de Auditoría</span>
                    <p className="text-[11px] text-slate-400 font-medium">{events.length} eventos registrados</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Quick Company Switcher in Drawer */}
            <div className="p-4 rounded-2xl bg-slate-100/80 border border-slate-200/80 space-y-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                Cambiar de Empresa Activa
              </span>
              <div className="space-y-1.5">
                {companies.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCompanyId(c.id);
                      setIsMoreMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition-all ${
                      selectedCompanyId === c.id
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span>{c.name}</span>
                    <span className="text-[10px] opacity-80 uppercase">{c.category}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* System Info Banner */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 space-y-1 text-center">
              <p className="font-bold text-slate-800">UBIKA CONTROL v3.0 (Responsive Web & PWA)</p>
              <p>Optimizada para pantalla táctil y escritorio. GPS y Privacidad activa.</p>
            </div>
          </div>
        </div>
      )}

      {/* New Task Modal */}
      <NewTaskModal
        isOpen={isNewTaskModalOpen}
        onClose={() => setIsNewTaskModalOpen(false)}
        drivers={drivers}
        companyId={selectedCompanyId}
        onTaskCreated={fetchData}
      />
    </div>
  );
};

