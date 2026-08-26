/**
 * UBIKA - Unified application shell
 * Public tracking/menu links remain URL-addressable; authenticated users use one role-aware workspace.
 */
import React, { useEffect, useState } from 'react';
import { CustomerWebApp } from './components/CustomerWebApp';
import { Login } from './components/Login';
import { UnifiedCommerceWorkspace } from './components/UnifiedCommerceWorkspace';
import { getStoredToken, getStoredUser, clearStoredAuth, StoredUser } from './utils/api';
import { LogOut, User } from 'lucide-react';

export default function App() {
  const [customerToken, setCustomerToken] = useState('');
  const [authToken, setAuthToken] = useState<string | null>(getStoredToken());
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(getStoredUser());
  const [publicMode, setPublicMode] = useState<'none' | 'tracking' | 'food'>('none');

  useEffect(() => {
    const checkPublicRoute = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#track/')) {
        const token = hash.replace('#track/', '');
        if (token) {
          setCustomerToken(token);
          setPublicMode('tracking');
          return;
        }
      }
      if (hash === '#food' || hash === '#food/admin' || hash.startsWith('#food/company/') || hash.startsWith('#food/order/')) {
        setPublicMode('food');
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const queryToken = params.get('token');
      if (queryToken) {
        setCustomerToken(queryToken);
        setPublicMode('tracking');
        return;
      }
      setPublicMode('none');
    };
    checkPublicRoute();
    window.addEventListener('hashchange', checkPublicRoute);
    return () => window.removeEventListener('hashchange', checkPublicRoute);
  }, []);

  const handleOpenCustomerLink = (token: string) => {
    setCustomerToken(token);
    setPublicMode('tracking');
    window.location.hash = `#track/${token}`;
  };

  const handleLoginSuccess = (user: StoredUser, token: string) => {
    setAuthToken(token);
    setCurrentUser(user);
    setPublicMode('none');
    window.location.hash = '';
  };

  const handleLogout = () => {
    clearStoredAuth();
    setAuthToken(null);
    setCurrentUser(null);
    setPublicMode('none');
    window.location.hash = '';
  };

  if (publicMode === 'tracking') {
    return <CustomerWebApp token={customerToken} onBackToDriver={() => setPublicMode('none')} />;
  }

  if (publicMode === 'food' && !authToken) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center">
          <div className="text-2xl font-black">UBIKA</div>
          <h1 className="text-xl font-black mt-2">Menú público</h1>
          <p className="text-sm text-slate-500 mt-2">El menú público permanece separado de las sesiones de empleados.</p>
        </div>
      </div>
    );
  }

  if (!authToken || !currentUser) return <Login onLoginSuccess={handleLoginSuccess} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 p-2 rounded-xl text-white font-black">U</div>
          <div>
            <div className="text-xl font-black tracking-tighter">UBIKA</div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Plataforma unificada</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-black text-slate-800 flex items-center justify-end gap-1"><User className="w-3.5 h-3.5 text-slate-400" />{currentUser.name}</div>
            <div className="text-[9px] font-black uppercase text-orange-500 tracking-wider">{currentUser.role}</div>
          </div>
          <button id="btn-global-logout" type="button" onClick={handleLogout} title="Cerrar sesión" className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition-all"><LogOut className="w-4 h-4" /></button>
        </div>
      </header>
      <UnifiedCommerceWorkspace user={currentUser} onOpenCustomerLink={handleOpenCustomerLink} />
    </div>
  );
}
