import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, Loader2, Info } from 'lucide-react';
import { setStoredAuth, StoredUser } from '../utils/api';

interface LoginProps {
  onLoginSuccess: (user: StoredUser, token: string) => void;
}

import { Register } from './Register';
export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor, ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        setStoredAuth(data.token, data.user);
        onLoginSuccess(data.user, data.token);
      } else {
        const errData = await res.json();
        setError(errData.error || 'Credenciales inválidas');
      }
    } catch (err) {
      console.error('Error durante la autenticación:', err);
      setError('Ocurrió un error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  if (isRegistering) {
    return <Register onRegisterSuccess={onLoginSuccess} onCancel={() => setIsRegistering(false)} />;
  }

  return (
    <div id="login-container" className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div id="login-card" className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-xl overflow-hidden p-8">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3.5 bg-orange-500 text-white rounded-2xl shadow-lg shadow-orange-100 mb-4">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
            Plataforma Ubika
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
            Control de Logística y Gastronomía
          </p>
        </div>

        {error && (
          <div id="login-error" className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-bold flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full mt-1.5 shrink-0" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@ejemplo.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/15 focus:border-orange-500 transition-all"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/15 focus:border-orange-500 transition-all"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            id="btn-login"
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-orange-500 transition-all disabled:opacity-50 disabled:hover:bg-slate-900 active:scale-[0.98]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Iniciando Sesión...</span>
              </>
            ) : (
              <span>Ingresar a la Plataforma</span>
            )}
          </button>
        </form>
        <div className="mb-5 rounded-xl border border-orange-200 bg-orange-50 p-3 text-center">
          <a href="#legal/consumer" className="text-xs font-black uppercase tracking-wider text-orange-700 hover:text-orange-900">
            BOTÓN DE ARREPENTIMIENTO / BAJA DE SERVICIO
          </a>
        </div>
        <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col gap-3">
          <button type="button" onClick={() => alert('Para recuperar su contraseña, por favor contacte a soporte técnico en soporte@ubika.app (Funcionalidad en desarrollo)')} className="text-[11px] font-bold text-slate-500 hover:text-orange-500 transition-colors uppercase tracking-wider">
            ¿Olvidaste tu contraseña?
          </button>
          <div className="flex flex-col items-center gap-2 mt-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">¿Todavía no tienes una cuenta?</span>
            <button type="button" onClick={() => setIsRegistering(true)} className="w-full py-2.5 border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-black uppercase tracking-wider transition-all">
              REGISTRAR MI COMERCIO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
