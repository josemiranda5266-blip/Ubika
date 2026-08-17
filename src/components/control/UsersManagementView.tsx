import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, Plus, Power, Key } from 'lucide-react';
import { apiFetch } from '../../utils/api';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  driverId?: string;
}

export const UsersManagementView: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('DRIVER');
  const [driverId, setDriverId] = useState('');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ inviteUrl: string; inviteToken: string } | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await apiFetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !role) {
      setFormError('Nombre, email y rol son obligatorios');
      return;
    }
    setFormLoading(true);
    setFormError('');
    setInviteResult(null);

    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role, driverId: role === 'DRIVER' ? driverId : undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setInviteResult({
          inviteUrl: data.inviteUrl || `/#accept-invite?token=${data.inviteToken}`,
          inviteToken: data.inviteToken,
        });
        fetchUsers();
        setName(''); setEmail(''); setRole('DRIVER'); setDriverId('');
      } else {
        const data = await res.json();
        setFormError(data.error || 'Error al crear invitación');
      }
    } catch (err) {
      setFormError('Error de red');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 animate-fadeIn max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <User className="w-5 h-5 text-orange-500" />
            Gestión de Personal
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Cuentas de acceso para tus empleados</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-orange-500 transition-colors"
        >
          <Plus className="w-4 h-4" /> Nuevo Empleado
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="px-6 py-4">Usuario</th>
                <th className="px-6 py-4">Rol</th>
                <th className="px-6 py-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{u.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" /> {u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider">
                      <Shield className="w-3 h-3" /> {u.role}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {u.active ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Inactivo
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-lg font-black text-slate-900 mb-4">Crear Acceso de Empleado</h3>
            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold">{formError}</div>
            )}
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Correo (Usuario)</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-orange-500" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rol</label>
                <select value={role} onChange={e => setRole(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-orange-500">
                  <option value="DRIVER">Cadete / Repartidor (DRIVER)</option>
                  <option value="KITCHEN">Cocina / Preparación (KITCHEN)</option>
                  <option value="DISPATCHER">Despacho / Mostrador (DISPATCHER)</option>
                </select>
              </div>
              {role === 'DRIVER' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ID de Repartidor (Opcional si ya está creado en Gestión)</label>
                  <input type="text" value={driverId} onChange={e => setDriverId(e.target.value)} placeholder="Ej: drv_12345" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-orange-500" />
                  <p className="text-[10px] text-slate-400 mt-1">Si el repartidor ya fue cargado en 'Gestión de Repartidores', ingresa su ID aquí para vincularlo.</p>
                </div>
              )}
              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Cancelar</button>
                <button type="submit" disabled={formLoading} className="px-6 py-2 bg-orange-500 text-white font-black text-sm rounded-xl hover:bg-orange-600 shadow-md">
                  {formLoading ? 'Guardando...' : 'Crear Empleado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
