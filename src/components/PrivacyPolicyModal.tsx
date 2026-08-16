import React from 'react';
import { ShieldCheck, Lock, Trash2, Clock, CheckCircle2, X } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white border border-slate-100 rounded-[32px] shadow-2xl p-6 overflow-y-auto max-h-[90vh] text-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-orange-50 text-orange-500 border border-orange-100 shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Privacidad y Seguridad UBIKA</h3>
              <p className="text-xs text-orange-600 font-extrabold uppercase tracking-tight">Arquitectura Privacy by Design</p>
            </div>
          </div>
          <button
            id="privacy-modal-close"
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="mt-5 space-y-4 text-sm">
          {/* Card 1: Consentimiento */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
            <div className="flex items-center gap-2 text-green-700 font-extrabold">
              <Lock className="w-4 h-4 text-green-600" />
              <span>1. Consentimiento Explícito y Voluntario</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              La ubicación del cliente jamás se obtiene ni se comparte de forma automática. Requiere que el destinatario
              abra el enlace y presione conscientemente el botón «Compartir mi ubicación».
            </p>
          </div>

          {/* Card 2: Temporalidad */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
            <div className="flex items-center gap-2 text-blue-700 font-extrabold">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>2. Sesiones Temporales y Expirables</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Cada enlace cuenta con un token criptográfico único y expira automáticamente en un máximo de 60 minutos o al
              marcarse la entrega como finalizada.
            </p>
          </div>

          {/* Card 3: Purga de datos */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
            <div className="flex items-center gap-2 text-orange-700 font-extrabold">
              <Trash2 className="w-4 h-4 text-orange-600" />
              <span>3. Eliminación Inmediata de Coordenadas</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Al presionar «Entrega Realizada» o «Cancelar», las coordenadas GPS se borran permanentemente de los
              servidores. El historial únicamente conserva la descripción del pedido y el estado final.
            </p>
          </div>

          {/* Card 4: Cero instalación */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
            <div className="flex items-center gap-2 text-indigo-700 font-extrabold">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>4. Sin Instalación de Aplicaciones para el Cliente</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              El cliente no necesita descargar ninguna app, ni registrar cuenta, ni conceder permisos permanentes en segundo plano.
            </p>
          </div>

          {/* Proteccion contra abuso */}
          <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-600 space-y-1 font-medium">
            <span className="font-black text-slate-900 block">Protección Anti-Abuso:</span>
            <p>
              UBIKA cuenta con límites de tasa (rate limiting), monitoreo de actividad inusual y un sistema de reporte directo.
              Cualquier uso indebido para rastreo no autorizado resulta en el bloqueo inmediato del repartidor.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          <button
            id="privacy-modal-btn-accept"
            type="button"
            onClick={onClose}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl transition-all shadow-md shadow-orange-200 text-sm"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
