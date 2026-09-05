import React, { useState } from 'react';
import { RotateCcw, ShieldCheck, ArrowLeft, CheckCircle2, AlertCircle, Clock, Search } from 'lucide-react';

export const ConsumerRights: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'create' | 'status'>('create');
  const [type, setType] = useState<'PURCHASE_WITHDRAWAL' | 'SERVICE_CANCELLATION'>('PURCHASE_WITHDRAWAL');
  const [form, setForm] = useState({
    saleId: '',
    subscriptionId: '',
    companyId: '',
    consumerName: '',
    consumerEmail: '',
    consumerPhone: '',
    consumerDocument: '',
    reason: '',
    additionalNotes: '',
  });
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Status check state
  const [statusQueryId, setStatusQueryId] = useState('');
  const [statusQueryEmail, setStatusQueryEmail] = useState('');
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [statusResult, setStatusResult] = useState<any | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setResultId(null);
    setIsSubmitting(true);

    try {
      const endpoint = type === 'SERVICE_CANCELLATION' && form.subscriptionId
        ? '/api/legal/service-cancellation'
        : '/api/legal/withdrawal-request';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, type, consentAccepted: consent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo registrar la solicitud');
        return;
      }
      setResultId(data.withdrawalId);
      setResult(`Solicitud registrada: ${data.withdrawalId}. Debe conservar este código.`);
    } catch (err: any) {
      setError(err.message || 'Error de conexión con el servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusError(null);
    setStatusResult(null);
    setIsCheckingStatus(true);

    try {
      const res = await fetch(`/api/legal/withdrawal-status/${encodeURIComponent(statusQueryId.trim())}?email=${encodeURIComponent(statusQueryEmail.trim().toLowerCase())}`);
      const data = await res.json();
      if (!res.ok) {
        setStatusError(data.error || 'No se pudo consultar el estado del trámite');
        return;
      }
      setStatusResult(data);
    } catch (err: any) {
      setStatusError(err.message || 'Error de conexión');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const field = (key: string, label: string, required = true, placeholder = '') => (
    <label className="block text-sm font-semibold text-slate-700">
      <span>{label}</span>
      <input
        required={required}
        placeholder={placeholder}
        value={(form as any)[key]}
        onChange={e => update(key, e.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
      />
    </label>
  );

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8 flex flex-col justify-center items-center">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 sm:p-8 shadow-xl border border-slate-100">
        
        {/* Navigation & Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
          <a
            href="#"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Volver a UBIKA
          </a>
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" /> Canal Oficial Legal
          </span>
        </div>

        <div className="mb-6">
          <span className="text-xs font-black uppercase tracking-widest text-orange-600">
            Derechos del Consumidor (Ley 24.240 y Disp. 954/2025)
          </span>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2">
            <RotateCcw className="w-7 h-7 text-orange-600" />
            Botón de Arrepentimiento / Baja de Servicio
          </h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Canal digital gratuito y de acceso inmediato. No necesitás registrarte ni contar con clave para presentar tu solicitud de revocación de compra o rescisión de servicio.
          </p>
        </div>

        {/* Tab selection */}
        <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
          <button
            type="button"
            onClick={() => { setActiveTab('create'); setError(null); }}
            className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${activeTab === 'create' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Presentar Solicitud
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('status'); setStatusError(null); }}
            className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${activeTab === 'status' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Consultar Estado de Trámite
          </button>
        </div>

        {activeTab === 'create' ? (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setType('PURCHASE_WITHDRAWAL')}
                className={`rounded-xl p-3 text-sm font-bold border transition-all ${type === 'PURCHASE_WITHDRAWAL' ? 'bg-orange-500 text-white border-orange-600 shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}
              >
                Arrepentimiento de Compra
              </button>
              <button
                type="button"
                onClick={() => setType('SERVICE_CANCELLATION')}
                className={`rounded-xl p-3 text-sm font-bold border transition-all ${type === 'SERVICE_CANCELLATION' ? 'bg-orange-500 text-white border-orange-600 shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}
              >
                Baja de Servicio
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field('companyId', 'Código o Nombre del Comercio', false, 'Ej: comp_default o nombre del local')}
              {type === 'PURCHASE_WITHDRAWAL'
                ? field('saleId', 'Identificador de Compra / Pedido', true, 'Ej: sale_... o número de ticket')
                : field('subscriptionId', 'Identificador del Servicio / Contrato', true, 'Ej: sub_... o cuenta')
              }
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {field('consumerName', 'Nombre y Apellido')}
              {field('consumerEmail', 'Correo Electrónico', true, 'email@ejemplo.com')}
              {field('consumerPhone', 'Teléfono de Contacto', true, '+54 9 11 ...')}
            </div>

            {field('consumerDocument', 'DNI / CUIT (opcional)', false, 'Para verificación proporcional')}

            <label className="block text-sm font-semibold text-slate-700">
              <span>Motivo del Desistimiento o Baja (mínimo 10 caracteres)</span>
              <textarea
                required
                rows={3}
                value={form.reason}
                onChange={e => update('reason', e.target.value)}
                placeholder="Describa brevemente la razón de la revocación o solicitud de baja..."
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
              />
            </label>

            {field('additionalNotes', 'Observaciones Adicionales (opcional)', false, 'Datos de cuenta bancaria para reintegro, detalles del producto, etc.')}

            <label className="flex items-start gap-2 text-xs sm:text-sm text-slate-600 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                required
                className="mt-1 rounded text-orange-600 focus:ring-orange-500"
              />
              <span>
                Acepto el tratamiento de los datos estrictamente necesarios para gestionar esta solicitud conforme a la <strong>Ley 25.326</strong> de Protección de los Datos Personales.
              </span>
            </label>

            {error && (
              <div className="rounded-xl bg-red-50 p-3.5 text-sm font-semibold text-red-700 border border-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {result && (
              <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>{result}</span>
                </div>
                <p className="text-xs text-emerald-700">
                  Conservá este código para realizar el seguimiento del trámite sin necesidad de registrarte.
                </p>
                {resultId && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusQueryId(resultId);
                      setStatusQueryEmail(form.consumerEmail);
                      setActiveTab('status');
                    }}
                    className="text-xs font-bold text-emerald-800 underline hover:text-emerald-950 inline-block mt-1"
                  >
                    Ver estado del trámite ahora →
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-3.5 text-sm font-black text-white shadow-md transition-all active:scale-[0.99] disabled:opacity-50"
            >
              {isSubmitting ? 'Registrando trámite...' : 'Enviar Solicitud'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <form onSubmit={checkStatus} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block text-sm font-semibold text-slate-700">
                  <span>Código de Trámite</span>
                  <input
                    required
                    placeholder="Ej: wdrl_12345..."
                    value={statusQueryId}
                    onChange={e => setStatusQueryId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  <span>Correo Electrónico Declarado</span>
                  <input
                    required
                    type="email"
                    placeholder="email@ejemplo.com"
                    value={statusQueryEmail}
                    onChange={e => setStatusQueryEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
                  />
                </label>
              </div>

              {statusError && (
                <div className="rounded-xl bg-red-50 p-3.5 text-sm font-semibold text-red-700 border border-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{statusError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isCheckingStatus}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-3.5 text-sm font-black text-white shadow-md transition-all disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
                {isCheckingStatus ? 'Consultando...' : 'Consultar Estado'}
              </button>
            </form>

            {statusResult && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Código de Gestión</span>
                  <span className="font-mono text-xs font-bold text-slate-800">{statusResult.withdrawalId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Tipo de trámite:</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                    {statusResult.type === 'PURCHASE_WITHDRAWAL' ? 'Arrepentimiento de Compra' : 'Baja de Servicio'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Estado actual:</span>
                  <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                    statusResult.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                    statusResult.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                    statusResult.status === 'PROCESSING' ? 'bg-blue-100 text-blue-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {statusResult.status === 'APPROVED' ? 'APROBADA' :
                     statusResult.status === 'REJECTED' ? 'RECHAZADA' :
                     statusResult.status === 'PROCESSING' ? 'EN PROCESO' : 'PENDIENTE'}
                  </span>
                </div>

                {statusResult.responseMessage && (
                  <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-700">
                    <span className="font-bold block text-slate-900 mb-1">Respuesta del comercio:</span>
                    {statusResult.responseMessage}
                  </div>
                )}

                {statusResult.refundAmount ? (
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span className="font-medium">Monto reintegrado:</span>
                    <span className="font-bold text-emerald-700">${statusResult.refundAmount} ({statusResult.refundMethod || 'Método de pago original'})</span>
                  </div>
                ) : null}

                {statusResult.exceptionApplied && (
                  <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
                    <span className="font-bold block">Excepción legal invocada:</span>
                    {statusResult.exceptionApplied} {statusResult.exceptionJustification && `- ${statusResult.exceptionJustification}`}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
          <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <p>
            Conforme a la normativa legal vigente (Disposición 954/2025 de la Dirección Nacional de Defensa del Consumidor), se le informa de manera inmediata el código de identificación de la gestión y el comercio adoptará las medidas procedentes dentro de las 24 horas.
          </p>
        </div>

      </div>
    </main>
  );
};
