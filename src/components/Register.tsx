import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, Building2, User, Phone, Loader2, ArrowLeft } from 'lucide-react';
import { setStoredAuth, StoredUser } from '../utils/api';

interface RegisterProps {
  onRegisterSuccess: (user: StoredUser, token: string) => void;
  onCancel: () => void;
}

export const Register: React.FC<RegisterProps> = ({ onRegisterSuccess, onCancel }) => {
  const [companyName, setCompanyName] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('Mensajería y Cadetería');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [legalConsent, setLegalConsent] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (!legalConsent) {
      setError('Debe aceptar la Política de Privacidad y los Términos y Condiciones.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, responsibleName, email, phone, category, password, privacyPolicyAccepted: legalConsent, termsOfServiceAccepted: legalConsent }),
      });
      if (res.ok) {
        const data = await res.json();
        setStoredAuth(data.token, data.user);
        onRegisterSuccess(data.user, data.token);
      } else {
        const errData = await res.json();
        setError(errData.error || 'Error al registrar el comercio');
      }
    } catch (err) {
      setError('Ocurrió un error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="register-container" className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200/80 shadow-xl overflow-hidden p-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onCancel} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
              Registrar Comercio
            </h1>
            <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
              Cuenta de Administrador
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-bold flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full mt-1.5 shrink-0" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Nombre del Comercio/Empresa</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" required value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/15 focus:border-orange-500" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Nombre del Responsable</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" required value={responsibleName} onChange={e => setResponsibleName(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/15 focus:border-orange-500" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/15 focus:border-orange-500" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Teléfono</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/15 focus:border-orange-500" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Tipo de Negocio</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/15 focus:border-orange-500">
              <option value="Gastronomía">Gastronomía / Restaurante</option>
              <option value="Mensajería y Cadetería">Mensajería y Cadetería</option>
              <option value="Farmacia / Salud">Farmacia / Salud</option>
              <option value="Supermercado / Almacén">Supermercado / Almacén</option>
              <option value="Distribuidora">Distribuidora</option>
              <option value="Servicios Técnicos">Servicios Técnicos</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/15 focus:border-orange-500" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Confirmar</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/15 focus:border-orange-500" />
              </div>
            </div>
          </div>
          
          <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] leading-5 text-slate-600 font-medium">
            <input type="checkbox" checked={legalConsent} onChange={e => setLegalConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-orange-500" />
            <span>Acepto los Términos y Condiciones y la Política de Privacidad, y autorizo el tratamiento de mis datos personales conforme a la Ley 25.326.</span>
          </label>
          <button type="submit" disabled={loading || !legalConsent} className="w-full mt-6 flex items-center justify-center gap-2 py-3 bg-orange-500 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-orange-600 transition-all disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Completar Registro</span>}
          </button>
        </form>
      </div>
    </div>
  );
};
