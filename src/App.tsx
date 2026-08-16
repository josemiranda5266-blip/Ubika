/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DriverApp } from './components/DriverApp';
import { CustomerWebApp } from './components/CustomerWebApp';
import { UbikaControl } from './components/control/UbikaControl';
import { UbikaFoodApp } from './components/food/UbikaFoodApp';
import { Smartphone, Globe, LayoutDashboard, Building2, Truck, Shield, Utensils } from 'lucide-react';

export default function App() {
  const [viewMode, setViewMode] = useState<'control' | 'driver' | 'customer' | 'food'>('control');
  const [customerToken, setCustomerToken] = useState<string>('tok_demo_demo842');
  const [foodCompanyId, setFoodCompanyId] = useState<string>('comp_food_don_pedro_01');
  const [foodOrderId, setFoodOrderId] = useState<string | undefined>(undefined);

  // Detect hash changes or URL params for #track/:token, #food, #food/admin, #food/company/:companyId, #food/order/:orderId
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
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
      </div>
    </div>
  );
}
