/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DriverApp } from './components/DriverApp';
import { CustomerWebApp } from './components/CustomerWebApp';
import { UbikaControl } from './components/control/UbikaControl';
import { UbikaFoodApp } from './components/food/UbikaFoodApp';
import { UbikaCommerceApp } from './components/commerce/UbikaCommerceApp';
import { Login } from './components/Login';
import { ConsumerRights } from './components/ConsumerRights';
import { WithdrawalModal } from './components/legal/WithdrawalModal';
import { getStoredToken, getStoredUser, clearStoredAuth, StoredUser } from './utils/api';
import { Smartphone, Globe, LayoutDashboard, Truck, Utensils, Store, LogOut, User, RotateCcw } from 'lucide-react';

export default function App() {
  const [viewMode, setViewMode] = useState<'control' | 'driver' | 'customer' | 'food' | 'commerce'>('control');
  const [customerToken, setCustomerToken] = useState<string>('');
  const [foodCompanyId, setFoodCompanyId] = useState<string | undefined>(undefined);
  const [foodOrderId, setFoodOrderId] = useState<string | undefined>(undefined);
  const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false);
  const [currentHash, setCurrentHash] = useState<string>(() => (typeof window !== 'undefined' ? window.location.hash : ''));
  
  // Real authentication state
  const [authToken, setAuthToken] = useState<string | null>(getStoredToken());
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(getStoredUser());

  // Detect hash changes or URL params for #track/:token, #food, #food/admin, #food/company/:companyId, #food/order/:orderId, #legal/consumer
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      setCurrentHash(hash);

      if (hash.startsWith('#track/')) {
        const token = hash.replace('#track/', '');
        if (token) {
          setCustomerToken(token);
          setViewMode('customer');
          return;
        }
      }

      if (hash === '#food' || hash === '#food/admin' || hash.startsWith('#food/')) {
        setViewMode('food');
        if (hash.startsWith('#food/company/')) {
          const companyId = hash.replace('#food/company/', '');
          if (companyId) setFoodCompanyId(companyId);
        } else if (hash.startsWith('#food/order/')) {
          const orderId = hash.replace('#food/order/', '');
          if (orderId) setFoodOrderId(orderId);
        }
        return;
      }

      if (hash === '#commerce') {
        setViewMode('commerce');
        return;
      }

      if (hash === '#arrepentimiento' || hash === '#desistimiento') {
        setIsWithdrawalOpen(true);
      }

      const params = new URLSearchParams(window.location.search);
      const queryToken = params.get('token');
      if (queryToken) {
        setCustomerToken(queryToken);
        setViewMode('customer');
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const handleOpenCustomerLink = (token: string) => {
    setCustomerToken(token);
    window.location.hash = `#track/${token}`;
    setViewMode('customer');
  };

  const handleBackToDriver = () => {
    window.location.hash = '';
    setViewMode('driver');
  };

  const handleBackToControl = () => {
    window.location.hash = '';
    setViewMode('control');
  };

  const handleLoginSuccess = (user: StoredUser, tokenVal: string) => {
    setAuthToken(tokenVal);
    setCurrentUser(user);
    
    // Proactively route the authenticated user based on their role
    if (user.role === 'DRIVER') {
      setViewMode('driver');
      window.location.hash = '';
    } else if (user.role === 'KITCHEN') {
      setViewMode('food');
      window.location.hash = '#food/admin';
    } else if (user.role === 'COMPANY_ADMIN') {
      if (user.companyId && user.companyId.startsWith('comp_food_')) {
        setViewMode('food');
        window.location.hash = '#food/admin';
      } else {
        setViewMode('control');
        window.location.hash = '';
      }
    }
  };

  const handleLogout = () => {
    clearStoredAuth();
    setAuthToken(null);
    setCurrentUser(null);
    setViewMode('control');
    window.location.hash = '';
  };

  // Consumer rights are intentionally public and reachable from the first access without login.
  if (currentHash === '#legal/consumer') {
    return <ConsumerRights />;
  }

  // Determine if authentication is required for the current view
  const isFoodCustomerMenu = viewMode === 'food' && window.location.hash.includes('/company/');
  const isPublicTracking = viewMode === 'customer';
  const authRequired = !isFoodCustomerMenu && !isPublicTracking;

  // Render Login page if authentication is required and not present
  if (authRequired && !authToken) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Top Experience Switcher Bar */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 z-50 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500 p-2 rounded-xl text-white shadow-md shadow-orange-200">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black tracking-tighter text-slate-900">UBIKA</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-50 text-orange-600 border border-orange-200">
                  PLATFORM
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">Coordinación Logística y Gastronomía</p>
            </div>
          </div>
        </div>

        {/* 4-Way Experience Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 shadow-inner w-full sm:w-auto justify-center overflow-x-auto">
          <button
            id="app-mode-control"
            type="button"
            onClick={handleBackToControl}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              viewMode === 'control'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-orange-400" />
            <span>UBIKA CONTROL</span>
          </button>

          <button
            id="app-mode-driver"
            type="button"
            onClick={handleBackToDriver}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              viewMode === 'driver'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>UBIKA DRIVER</span>
          </button>

          <button
            id="app-mode-customer"
            type="button"
            onClick={() => setViewMode('customer')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              viewMode === 'customer'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>UBIKA CLIENT</span>
          </button>

          <button
            id="app-mode-food"
            type="button"
            onClick={() => {
              window.location.hash = '#food/admin';
              setViewMode('food');
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              viewMode === 'food'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>UBIKA FOOD 🍔</span>
          </button>

          <button
            id="app-mode-commerce"
            type="button"
            onClick={() => {
              window.location.hash = '#commerce';
              setViewMode('commerce');
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              viewMode === 'commerce'
                ? 'bg-orange-600 text-white shadow-md shadow-orange-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>UBIKA COMMERCE 🛒</span>
          </button>
        </div>

        {/* User profile & Logout */}
        {authToken && currentUser && (
          <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
            <div className="text-right hidden md:block">
              <div className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {currentUser.name}
              </div>
              <div className="text-[9px] font-black uppercase text-orange-500 tracking-wider">
                {currentUser.role}
              </div>
            </div>
            <button
              id="btn-global-logout"
              type="button"
              onClick={handleLogout}
              title="Cerrar Sesión"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200/60 transition-all shadow-xs"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Botón de Arrepentimiento - Acceso directo legal sin barreras (Disp. 954/2025) */}
        <div className="border-l border-slate-200 pl-3">
          <button
            id="btn-withdrawal-legal"
            type="button"
            onClick={() => setIsWithdrawalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200 border border-slate-200 transition-all shadow-xs"
            title="Botón de Arrepentimiento (Defensa del Consumidor - Ley 24.240 y Disp. 954/2025)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-orange-600" />
            <span className="hidden md:inline">Botón de</span>
            <span>Arrepentimiento</span>
          </button>
        </div>
      </header>

      {/* App views */}
      <div className="flex-1 flex flex-col">
        {viewMode === 'control' && <UbikaControl onOpenCustomerLink={handleOpenCustomerLink} />}
        {viewMode === 'driver' && <DriverApp onOpenCustomerLink={handleOpenCustomerLink} />}
        {viewMode === 'customer' && (
          <CustomerWebApp token={customerToken} onBackToDriver={handleBackToDriver} />
        )}
        {viewMode === 'food' && (
          <UbikaFoodApp
            initialCompanyId={foodCompanyId}
            initialOrderId={foodOrderId}
            initialViewMode="merchant"
            onBackToControl={handleBackToControl}
          />
        )}
        {viewMode === 'commerce' && <UbikaCommerceApp />}
      </div>

      {/* Modal de Desistimiento / Arrepentimiento */}
      <WithdrawalModal
        isOpen={isWithdrawalOpen}
        onClose={() => setIsWithdrawalOpen(false)}
      />
    </div>
  );
}
