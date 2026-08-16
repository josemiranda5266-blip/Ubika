import React, { useState } from 'react';
import {
  X,
  PlusCircle,
  Phone,
  User,
  Package,
  DollarSign,
  FileText,
  AlertTriangle,
  Send,
  Truck,
  Bike,
  Car,
} from 'lucide-react';
import { Driver, TaskPriority, VehicleType } from '../../types';
import { apiFetch } from '../../utils/api';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  drivers: Driver[];
  companyId: string;
  onTaskCreated: () => void;
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({
  isOpen,
  onClose,
  drivers,
  companyId,
  onTaskCreated,
}) => {
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Transferencia / MP' | 'Tarjeta al recibir' | 'Pagado online'>('Efectivo');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientPhone.trim()) {
      setError('El teléfono del destinatario es obligatorio.');
      return;
    }
    if (!description.trim()) {
      setError('La descripción del pedido es obligatoria.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          driverId: selectedDriverId || undefined,
          recipientName: recipientName.trim(),
          recipientPhone: recipientPhone.trim(),
          description: description.trim(),
          instructions: instructions.trim(),
          amount: amount.trim() ? (amount.startsWith('$') ? amount : `$${amount}`) : '',
          paymentMethod,
          priority,
          notes: notes.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al despachar la tarea');
      }

      onTaskCreated();
      onClose();
      // Reset form
      setRecipientName('');
      setRecipientPhone('');
      setDescription('');
      setInstructions('');
      setAmount('');
      setNotes('');
      setSelectedDriverId('');
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error');
    } finally {
      setLoading(false);
    }
  };

  const getVehicleIcon = (v: VehicleType) => {
    if (v === 'bici') return <Bike className="w-3.5 h-3.5" />;
    if (v === 'camioneta' || v === 'auto') return <Car className="w-3.5 h-3.5" />;
    return <Truck className="w-3.5 h-3.5" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white border border-slate-100 rounded-[28px] sm:rounded-[32px] shadow-2xl p-4 sm:p-8 overflow-y-auto max-h-[92vh] text-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-orange-50 text-orange-500 border border-orange-100 shadow-sm shrink-0">
              <PlusCircle className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">Nueva Tarea de Entrega</h3>
              <p className="text-[10px] sm:text-xs text-orange-600 font-extrabold uppercase tracking-tight">UBIKA CONTROL — Despacho</p>
            </div>
          </div>
          <button
            id="new-task-modal-close"
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 sm:mt-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
          {/* Section 1: Cliente */}
          <div className="bg-slate-50 p-3.5 sm:p-5 rounded-[20px] sm:rounded-[24px] border border-slate-100 space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-orange-500" />
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">1. Datos del Cliente / Destinatario</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Nombre del Cliente</label>
                <input
                  id="task-client-name"
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  className="w-full px-4 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Teléfono / WhatsApp <span className="text-orange-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-4 top-3 sm:top-3.5" />
                  <input
                    id="task-client-phone"
                    type="tel"
                    required
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="Ej. +54 9 385 599-2311"
                    className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Entrega */}
          <div className="bg-slate-50 p-3.5 sm:p-5 rounded-[20px] sm:rounded-[24px] border border-slate-100 space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">2. Detalle del Pedido</h4>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Descripción / Artículos <span className="text-orange-500">*</span>
              </label>
              <textarea
                id="task-description"
                required
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej. 2 pizzas especiales grandes + 1 gaseosa 2.25L"
                className="w-full px-4 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Importe a Cobrar (Opcional)</label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-slate-400 absolute left-4 top-3 sm:top-3.5" />
                  <input
                    id="task-amount"
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Ej. 18.500"
                    className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Método de Pago</label>
                <select
                  id="task-payment-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-4 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia / MP">Transferencia / Mercado Pago</option>
                  <option value="Tarjeta al recibir">Tarjeta al recibir</option>
                  <option value="Pagado online">Pagado online</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Instrucciones y Prioridad */}
          <div className="bg-slate-50 p-3.5 sm:p-5 rounded-[20px] sm:rounded-[24px] border border-slate-100 space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-500" />
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">3. Instrucciones de Entrega</h4>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Instrucciones Especiales para el Repartidor</label>
              <textarea
                id="task-instructions"
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Ej. Llevar vuelto de $10.000. Llamar al llegar. Casa con portón negro."
                className="w-full px-4 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
              />
            </div>

            {/* Prioridad */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Nivel de Prioridad</label>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <button
                  type="button"
                  id="task-priority-normal"
                  onClick={() => setPriority('normal')}
                  className={`py-2 sm:py-2.5 px-2 sm:px-3 rounded-2xl text-xs font-black border transition-all min-h-[42px] ${
                    priority === 'normal'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  🟢 Normal
                </button>
                <button
                  type="button"
                  id="task-priority-alta"
                  onClick={() => setPriority('alta')}
                  className={`py-2 sm:py-2.5 px-2 sm:px-3 rounded-2xl text-xs font-black border transition-all min-h-[42px] ${
                    priority === 'alta'
                      ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-200'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-orange-50'
                  }`}
                >
                  🟠 Alta
                </button>
                <button
                  type="button"
                  id="task-priority-urgente"
                  onClick={() => setPriority('urgente')}
                  className={`py-2 sm:py-2.5 px-2 sm:px-3 rounded-2xl text-xs font-black border transition-all min-h-[42px] ${
                    priority === 'urgente'
                      ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-200'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-red-50'
                  }`}
                >
                  🔴 Urgente
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Asignación de Repartidor */}
          <div className="bg-slate-50 p-3.5 sm:p-5 rounded-[20px] sm:rounded-[24px] border border-slate-100 space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">4. Asignación a Repartidor</h4>
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                {drivers.filter((d) => d.status === 'disponible').length} disponibles
              </span>
            </div>

            <div>
              <select
                id="task-select-driver"
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              >
                <option value="">Selección Automática (Primer disponible)</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.internalId}) — {d.vehicle.toUpperCase()} —{' '}
                    {d.status === 'disponible' ? '🟢 Disponible' : d.status === 'en_tarea' ? '🔵 En Tarea' : '⚪ Pausado'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 sm:gap-3">
            <button
              id="new-task-btn-cancel"
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-3 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              id="new-task-btn-submit"
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs sm:text-sm rounded-2xl shadow-xl shadow-orange-200 transition-all active:scale-95 disabled:opacity-50 min-h-[44px]"
            >
              <Send className="w-4 h-4" />
              <span>{loading ? 'Creando...' : 'CREAR Y ASIGNAR TAREA'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
