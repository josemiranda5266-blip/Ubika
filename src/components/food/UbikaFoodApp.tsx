import React, { useState, useEffect } from 'react';
import {
  Utensils,
  ShoppingBag,
  Store,
  ChevronDown,
  Building2,
  Phone,
  MapPin,
  ExternalLink,
  ShieldCheck,
  CheckCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { FoodCustomerView } from './FoodCustomerView';
import { FoodMerchantPanel } from './FoodMerchantPanel';
import { KitchenPanel } from './KitchenPanel';
import { Company, Driver, FoodStore } from '../../types';
import { apiFetch, getStoredToken, setStoredAuth, getStoredUser } from '../../utils/api';

interface UbikaFoodAppProps {
  initialCompanyId?: string;
  initialOrderId?: string;
  initialViewMode?: 'customer' | 'merchant';
  onBackToControl?: () => void;
}

interface FoodStoreInfo {
  companyId: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  whatsappNumber: string;
  isOpenManual: boolean;
  category: string;
}

export const UbikaFoodApp: React.FC<UbikaFoodAppProps> = ({
  initialCompanyId = 'comp_food_don_pedro_01',
  initialOrderId,
  initialViewMode = 'merchant',
  onBackToControl,
}) => {
  const [foodStores, setFoodStores] = useState<FoodStoreInfo[]>([
    {
      companyId: 'comp_food_don_pedro_01',
      name: 'Hamburguesería Don Pedro',
      description: 'Hamburguesas artesanales, papas fritas y bebidas frescas.',
      address: 'Av. Belgrano 1234, CABA',
      phone: '+54 9 11 4555-8800',
      whatsappNumber: '+54 9 11 4555-8800',
      isOpenManual: true,
      category: 'Gastronomía',
    },
  ]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(initialCompanyId);
  const [mode, setMode] = useState<'customer' | 'merchant'>(initialViewMode);
  const [selectedRole, setSelectedRole] = useState<'COMPANY_ADMIN' | 'KITCHEN'>(() => {
    const user = getStoredUser();
    return (user?.role === 'KITCHEN') ? 'KITCHEN' : 'COMPANY_ADMIN';
  });
  const [foodToken, setFoodToken] = useState<string>('');
  const [foodDrivers, setFoodDrivers] = useState<Driver[]>([]);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);

  // Load authorized food stores from server
  useEffect(() => {
    const fetchStores = async () => {
      try {
        const res = await fetch('/api/food/stores');
        if (res.ok) {
          const data: FoodStoreInfo[] = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setFoodStores(data);
            if (!data.some((s) => s.companyId === selectedCompanyId)) {
              setSelectedCompanyId(data[0].companyId);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load food stores:', err);
      }
    };
    fetchStores();
  }, []);

  // Ensure authenticated session for the selected Food company
  const ensureFoodAuth = async (companyId: string, roleToUse: 'COMPANY_ADMIN' | 'KITCHEN') => {
    setLoadingAuth(true);
    try {
      // Obtain demo session specifically for this food company
      const res = await fetch('/api/auth/demo-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: roleToUse, companyId }),
      });
      if (res.ok) {
        const data = await res.json();
        setFoodToken(data.token);
        setStoredAuth(data.token, data.user);

        // Fetch drivers for this specific food company
        const resDrivers = await fetch(`/api/drivers?companyId=${companyId}`, {
          headers: { Authorization: `Bearer ${data.token}` },
        });
        if (resDrivers.ok) {
          const driversData = await resDrivers.json();
          setFoodDrivers(driversData);
        }
      } else {
        const fallbackToken = getStoredToken();
        if (fallbackToken) setFoodToken(fallbackToken);
      }
    } catch (e) {
      console.error('Error establishing food auth:', e);
      const fallbackToken = getStoredToken();
      if (fallbackToken) setFoodToken(fallbackToken);
    } finally {
      setLoadingAuth(false);
    }
  };

  useEffect(() => {
    ensureFoodAuth(selectedCompanyId, selectedRole);
  }, [selectedCompanyId, selectedRole]);

  // Listen to hash changes for sub-navigation
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash === '#food/admin' || hash.startsWith('#food/admin/')) {
        setMode('merchant');
      } else if (hash === '#food' || hash.startsWith('#food/company/')) {
        setMode('customer');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const activeStore = foodStores.find((s) => s.companyId === selectedCompanyId) || foodStores[0];

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F8FAFC]">
      {/* Top Food Sub-Header / Commerce Context & View Mode Switcher */}
      <div className="bg-white border-b border-slate-200/80 px-4 sm:px-8 py-3 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Left: Active Food Commerce Info & Selector */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl shadow-md shadow-amber-200 shrink-0">
                <Utensils className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                    COMERCIO GASTRONÓMICO
                  </span>
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 hidden sm:inline">
                    UBIKA FOOD
                  </span>
                </div>
                <div className="relative mt-0.5">
                  <select
                    id="food-company-select"
                    value={selectedCompanyId}
                    onChange={(e) => {
                      setSelectedCompanyId(e.target.value);
                      window.location.hash = `#food/company/${e.target.value}`;
                    }}
                    className="appearance-none pr-7 text-sm font-black text-slate-900 bg-transparent focus:outline-none cursor-pointer hover:text-amber-600 transition-colors"
                  >
                    {foodStores.map((s) => (
                      <option key={s.companyId} value={s.companyId}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Sub-View Toggle between Digital Menu (Customer) and Admin Panel (Merchant) */}
          <div className="flex flex-wrap items-center gap-3">
            {mode === 'merchant' && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 shadow-inner">
                <span className="text-[10px] font-black text-slate-400 px-2 uppercase tracking-wider hidden sm:inline">
                  Simular Rol:
                </span>
                <button
                  id="btn-role-admin"
                  type="button"
                  onClick={() => setSelectedRole('COMPANY_ADMIN')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    selectedRole === 'COMPANY_ADMIN'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Admin
                </button>
                <button
                  id="btn-role-kitchen"
                  type="button"
                  onClick={() => setSelectedRole('KITCHEN')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    selectedRole === 'KITCHEN'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cocina
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 shadow-inner">
              <button
                id="food-view-merchant"
                type="button"
                onClick={() => {
                  setMode('merchant');
                  window.location.hash = '#food/admin';
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  mode === 'merchant'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Store className="w-4 h-4 text-amber-400" />
                <span>Panel de Administración</span>
              </button>

              <button
                id="food-view-customer"
                type="button"
                onClick={() => {
                  setMode('customer');
                  window.location.hash = `#food/company/${selectedCompanyId}`;
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  mode === 'customer'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Menú Digital (Clientes)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {mode === 'merchant' ? (
          selectedRole === 'KITCHEN' ? (
            <KitchenPanel
              companyId={selectedCompanyId}
              token={foodToken}
            />
          ) : (
            <FoodMerchantPanel
              companyId={selectedCompanyId}
              token={foodToken}
              drivers={foodDrivers}
              onOpenCustomerView={() => {
                setMode('customer');
                window.location.hash = `#food/company/${selectedCompanyId}`;
              }}
            />
          )
        ) : (
          <FoodCustomerView
            companyId={selectedCompanyId}
            orderIdParam={initialOrderId}
            onBackToApp={onBackToControl}
          />
        )}
      </div>
    </div>
  );
};
