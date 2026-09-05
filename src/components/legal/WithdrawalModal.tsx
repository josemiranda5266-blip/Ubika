import React, { useState } from 'react';
import { RotateCcw, Search, CheckCircle, AlertCircle, Clock, X, ShieldCheck, Copy, Check } from 'lucide-react';

interface WithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSaleId?: string;
  defaultCompanyId?: string;
}

export function WithdrawalModal({ isOpen, onClose, defaultSaleId, defaultCompanyId }: WithdrawalModalProps) {
  const [activeTab, setActiveTab] = useState<'request' | 'status'>('request');

  // Form state
  const [type, setType] = useState<'PURCHASE_WITHDRAWAL' | 'SERVICE_CANCELLATION'>('PURCHASE_WITHDRAWAL');
  const [saleId, setSaleId] = useState(defaultSaleId || '');
  const [consumerName, setConsumerName] = useState('');
  const [consumerEmail, setConsumerEmail] = useState('');
  const [consumerPhone, setConsumerPhone] = useState('');
  const [consumerDocument, setConsumerDocument] = useState('');
  const [reason, setReason] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);

  // Status check state
  const [lookupId, setLookupId] = useState('');
  const [lookupVerification, setLookupVerification] = useState('');
  const [statusResult, setStatusResult] = useState<any>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successResult, setSuccessResult] = useState<{ id: string; message: string; estimatedResponseDate: number } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      if (!consentAccepted) {
        setErrorMessage('Debe aceptar el tratamiento de datos para procesar el trámite legal.');
        setLoading(false);
        return;
      }

      if (reason.trim().length < 10) {
        setErrorMessage('Por favor indique el motivo del desistimiento (mínimo 10 caracteres).');
        setLoading(false);
        return;
      }

      const payload: any = {
        type,
        saleId: type === 'PURCHASE_WITHDRAWAL' ? saleId.trim() : undefined,
        companyId: defaultCompanyId,
        consumerName: consumerName.trim(),
        consumerEmail: consumerEmail.trim(),
        consumerPhone: consumerPhone.trim(),
        consumerDocument: consumerDocument.trim() || undefined,
        reason: reason.trim(),
        additionalNotes: additionalNotes.trim() || undefined,
        consentAccepted: true,
      };

      const res = await fetch('/api/legal/withdrawal-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar la solicitud.');
      }

      setSuccessResult({
        id: data.withdrawalId,
        message: data.message,
        estimatedResponseDate: data.estimatedResponseDate,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setStatusResult(null);
    setLoading(true);

    try {
      if (!lookupId.trim()) {
        setErrorMessage('Ingrese el código de trámite (ej: wdrl_...).');
        setLoading(false);
        return;
      }
      if (!lookupVerification.trim()) {
        setErrorMessage('Ingrese su correo electrónico o documento para verificar su identidad.');
        setLoading(false);
        return;
      }

      const param = lookupVerification.includes('@')
        ? `email=${encodeURIComponent(lookupVerification.trim())}`
        : `document=${encodeURIComponent(lookupVerification.trim())}`;

      const res = await fetch(`/api/legal/withdrawal-status/${encodeURIComponent(lookupId.trim())}?${param}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo consultar el trámite.');
      }

      setStatusResult(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al consultar estado.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSuccessResult(null);
    setStatusResult(null);
    setErrorMessage('');
    setSaleId(defaultSaleId || '');
    setReason('');
    setAdditionalNotes('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Botón de Arrepentimiento</h2>
              <p className="text-xs text-slate-400">Defensa del Consumidor • Disp. 954/2025 y Disp. 3/2026</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('request');
              resetForm();
            }}
            className={`pb-3 px-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
              activeTab === 'request'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Iniciar Solicitud
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('status');
              resetForm();
            }}
            className={`pb-3 px-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
              activeTab === 'status'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Consultar Trámite
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {errorMessage && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'request' && !successResult && (
            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-blue-900 text-xs leading-relaxed">
                Tiene derecho a revocar la aceptación del bien o rescindir el servicio dentro de los <strong>10 días corridos</strong> desde la recepción del producto o contratación. No requiere registrarse previamente ni abonar costos adicionales.
              </div>

              {/* Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tipo de Desistimiento
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType('PURCHASE_WITHDRAWAL')}
                    className={`p-3 rounded-xl border text-left transition ${
                      type === 'PURCHASE_WITHDRAWAL'
                        ? 'border-orange-500 bg-orange-50/50 text-orange-950 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-black">Arrepentimiento de Compra</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Devolución de producto (Ley 24.240)</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('SERVICE_CANCELLATION')}
                    className={`p-3 rounded-xl border text-left transition ${
                      type === 'SERVICE_CANCELLATION'
                        ? 'border-orange-500 bg-orange-50/50 text-orange-950 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-black">Baja de Servicio</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Rescisión directa y sin trabas</div>
                  </button>
                </div>
              </div>

              {/* Sale / Order ID (Mandatory for purchase) */}
              {type === 'PURCHASE_WITHDRAWAL' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Código de Compra / ID de Pedido <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: sale_... o ID de orden"
                    value={saleId}
                    onChange={(e) => setSaleId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              )}

              {/* Consumer Contact Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nombre Completo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Su nombre y apellido"
                    value={consumerName}
                    onChange={(e) => setConsumerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    DNI / Documento
                  </label>
                  <input
                    type="text"
                    placeholder="Número de documento (opcional)"
                    value={consumerDocument}
                    onChange={(e) => setConsumerDocument(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Correo Electrónico <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="correo@ejemplo.com"
                    value={consumerEmail}
                    onChange={(e) => setConsumerEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Teléfono de Contacto <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="Ej: +54 9 11 ..."
                    value={consumerPhone}
                    onChange={(e) => setConsumerPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Motivo del Desistimiento <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  minLength={10}
                  placeholder="Describa brevemente el motivo de su solicitud (mínimo 10 caracteres)..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
                />
              </div>

              {/* Consent checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    required
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-[11px] text-slate-600 leading-snug">
                    Autorizo el tratamiento de mis datos de contacto para la tramitación de esta solicitud conforme a la <strong>Ley 25.326</strong> y normativas de Defensa del Consumidor.
                  </span>
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition disabled:opacity-50 flex items-center gap-2"
                >
                  {loading && <Clock className="w-3.5 h-3.5 animate-spin" />}
                  <span>Enviar Solicitud</span>
                </button>
              </div>
            </form>
          )}

          {/* Success Screen */}
          {activeTab === 'request' && successResult && (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center border border-emerald-200">
                <CheckCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Solicitud Registrada con Éxito</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {successResult.message}
                </p>
              </div>

              {/* Unique tracking code box */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl max-w-md mx-auto">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Código Único de Trámite
                </div>
                <div className="flex items-center justify-center gap-2 font-mono font-bold text-sm text-slate-900">
                  <span>{successResult.id}</span>
                  <button
                    onClick={() => handleCopyCode(successResult.id)}
                    className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition"
                    title="Copiar código"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="text-[10px] text-slate-500 mt-2">
                  Guarde este código para consultar el estado del trámite en cualquier momento.
                </div>
              </div>

              <div className="pt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setLookupId(successResult.id);
                    setLookupVerification(consumerEmail);
                    setActiveTab('status');
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition"
                >
                  Ver Estado Ahora
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-sm"
                >
                  Finalizar
                </button>
              </div>
            </div>
          )}

          {/* Status Check Tab */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              <form onSubmit={handleCheckStatus} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Código Único de Trámite
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="wdrl_..."
                      value={lookupId}
                      onChange={(e) => setLookupId(e.target.value)}
                      className="w-full px-3.5 py-2.5 pl-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Verificación Proporcional (Email o Documento)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="El correo o documento informado en la solicitud"
                    value={lookupVerification}
                    onChange={(e) => setLookupVerification(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">
                    Conforme a la Disposición 3/2026 para proteger la privacidad del consumidor sin trabas burocráticas.
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2"
                >
                  {loading && <Clock className="w-3.5 h-3.5 animate-spin" />}
                  <span>Consultar Estado</span>
                </button>
              </form>

              {/* Status Result Details */}
              {statusResult && (
                <div className="mt-5 p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-600">Estado del Trámite</span>
                    <span
                      className={`text-xs font-black px-2.5 py-1 rounded-full uppercase ${
                        statusResult.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : statusResult.status === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800'
                          : statusResult.status === 'PROCESSING'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {statusResult.status === 'APPROVED'
                        ? 'Aprobado'
                        : statusResult.status === 'REJECTED'
                        ? 'Rechazado'
                        : statusResult.status === 'PROCESSING'
                        ? 'En Proceso'
                        : 'Pendiente'}
                    </span>
                  </div>

                  <div className="text-xs space-y-1.5 text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Fecha de Solicitud:</span>
                      <span className="font-semibold">{new Date(statusResult.createdAt).toLocaleDateString()}</span>
                    </div>
                    {statusResult.estimatedResponseDate && statusResult.status === 'PENDING' && (
                      <div className="flex justify-between text-blue-700">
                        <span>Plazo Máximo de Respuesta:</span>
                        <span className="font-semibold">{new Date(statusResult.estimatedResponseDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    {statusResult.refundAmount && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Monto de Reembolso:</span>
                        <span>${Number(statusResult.refundAmount).toLocaleString('es-AR')}</span>
                      </div>
                    )}
                    {statusResult.exceptionApplied && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px]">
                        <strong>Excepción Legal:</strong> {statusResult.exceptionApplied}
                        {statusResult.exceptionJustification && (
                          <div className="mt-0.5">{statusResult.exceptionJustification}</div>
                        )}
                      </div>
                    )}
                    {statusResult.responseMessage && (
                      <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-[11px]">
                        <strong>Respuesta del Comercio:</strong> {statusResult.responseMessage}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-center text-[10px] text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          <span>Cumplimiento Ley 24.240, Ley 25.326 y Disposiciones 954/2025 y 3/2026</span>
        </div>
      </div>
    </div>
  );
}
