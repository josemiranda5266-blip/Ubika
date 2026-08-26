import React, { useMemo, useState } from 'react';
import { LayoutDashboard, Store, Utensils, Truck, ChefHat, Users, ShieldCheck } from 'lucide-react';
import { DriverApp } from './DriverApp';
import { UbikaControl } from './control/UbikaControl';
import { UbikaFoodApp } from './food/UbikaFoodApp';
import { UbikaCommerceApp } from './commerce/UbikaCommerceApp';
import { roleCanAccessModule, type CommerceModule, type UbikaRole } from '../../server/roles';
import type { StoredUser } from '../utils/api';

interface UnifiedCommerceWorkspaceProps {
  user: StoredUser;
  onOpenCustomerLink: (token: string) => void;
}

type WorkspaceView = 'control' | 'commerce' | 'food' | 'driver' | 'kitchen' | 'mozo';

function has(user: StoredUser, module: CommerceModule): boolean {
  return roleCanAccessModule(user.role as UbikaRole, module);
}

export const UnifiedCommerceWorkspace: React.FC<UnifiedCommerceWorkspaceProps> = ({ user, onOpenCustomerLink }) => {
  const initialView = useMemo<WorkspaceView>(() => {
    if (user.role === 'DRIVER') return 'driver';
    if (user.role === 'KITCHEN') return 'kitchen';
    if (user.role === 'MOZO') return 'mozo';
    if (user.role === 'COMPANY_ADMIN' || user.role === 'SUPER_ADMIN') return 'control';
    return 'commerce';
  }, [user.role]);

  const [view, setView] = useState<WorkspaceView>(initialView);

  const navigation = [
    has(user, 'dashboard') && { id: 'control' as const, label: 'Inicio', icon: LayoutDashboard },
    has(user, 'pos') && { id: 'commerce' as const, label: 'Comercio', icon: Store },
    has(user, 'kitchen') && { id: 'kitchen' as const, label: 'Cocina', icon: ChefHat },
    has(user, 'tables') && { id: 'mozo' as const, label: 'Salón', icon: Users },
    has(user, 'delivery') && { id: 'driver' as const, label: 'Delivery', icon: Truck },
    has(user, 'menu') && { id: 'food' as const, label: 'Food / Menú', icon: Utensils },
  ].filter(Boolean) as Array<{ id: WorkspaceView; label: string; icon: React.ElementType }>;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-orange-500" />
            <span className="text-lg font-black tracking-tight">UBIKA</span>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Workspace</span>
          </div>
          <div className="text-[10px] font-bold text-slate-500 mt-0.5">{user.name} · {user.role}</div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto max-w-[70vw]">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black whitespace-nowrap transition-all ${view === id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 min-h-0 overflow-auto">
        {view === 'control' && <UbikaControl onOpenCustomerLink={onOpenCustomerLink} />}
        {view === 'commerce' && <UbikaCommerceApp />}
        {view === 'food' && <UbikaFoodApp initialCompanyId={user.companyId} initialViewMode="merchant" />}
        {view === 'driver' && <DriverApp onOpenCustomerLink={onOpenCustomerLink} />}
        {view === 'kitchen' && <UbikaFoodApp initialCompanyId={user.companyId} initialViewMode="merchant" />}
        {view === 'mozo' && (
          <div className="p-6 max-w-5xl mx-auto w-full">
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <Users className="w-6 h-6 text-orange-500" />
                <h1 className="text-xl font-black">Salón y mesas</h1>
              </div>
              <p className="text-sm text-slate-600 leading-6">
                Este espacio queda reservado para el flujo de mozo: mesas, comandas, envío a cocina y solicitud de cuenta.
                El rol ya está protegido en el núcleo de autorización; la persistencia de mesas/comandas se incorporará en el siguiente bloque para evitar datos duplicados o estados ficticios.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
