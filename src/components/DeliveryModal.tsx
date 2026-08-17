import React, { useState } from 'react';
import { Share2, MessageCircle, Copy, Check, QrCode, PhoneCall, ExternalLink, X, Shield, ArrowRight } from 'lucide-react';
import { Delivery } from '../types';
import { generateWhatsAppLink, generateWhatsAppMessage, generateSMSLink } from '../utils/whatsapp';

interface DeliveryModalProps {
  delivery: Delivery | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenCustomerView?: (token: string) => void;
}

export const DeliveryModal: React.FC<DeliveryModalProps> = ({
  delivery,
  isOpen,
  onClose,
  onOpenCustomerView,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!isOpen || !delivery) return null;

  const appBaseUrl = window.location.origin + window.location.pathname;
  const customerLink = `${appBaseUrl}#track/${delivery.sessionToken}`;
  const whatsappUrl = generateWhatsAppLink(delivery, appBaseUrl);
  const fullMessage = generateWhatsAppMessage(delivery, appBaseUrl);
  const smsUrl = generateSMSLink(delivery, appBaseUrl);

  const copyToClipboard = async (text: string, type: 'link' | 'message') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      } else {
        setCopiedMessage(true);
        setTimeout(() => setCopiedMessage(false), 2500);
      }
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `UBIKA — Entrega #${delivery.orderNumber}`,
          text: fullMessage,
          url: customerLink,
        });
      } catch {
        // User cancelled share
      }
    } else {
      copyToClipboard(customerLink, 'link');
    }
  };

  // QR Code URL using standard Google Chart / QR API for zero dependencies
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(customerLink)}&margin=10`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white border border-slate-100 rounded-[32px] shadow-2xl p-6 overflow-y-auto max-h-[92vh] text-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-orange-50 text-orange-500 border border-orange-100 shadow-sm">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">Solicitar Ubicación al Cliente</h3>
                <span className="px-2.5 py-0.5 text-[11px] font-black bg-orange-50 text-orange-600 rounded-full border border-orange-200">
                  #{delivery.orderNumber}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Enviar enlace temporal por WhatsApp o mensaje</p>
            </div>
          </div>
          <button
            id="delivery-modal-close"
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Recipient Details Card */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 font-bold uppercase tracking-tight text-[10px]">Destinatario:</span>
            <span className="font-extrabold text-slate-900">
              {delivery.recipientName || 'Sin nombre'} ({delivery.recipientPhone})
            </span>
          </div>
          <div className="flex justify-between items-start">
            <span className="text-slate-400 font-bold uppercase tracking-tight text-[10px]">Pedido:</span>
            <span className="font-bold text-slate-800 text-right max-w-[65%]">
              {delivery.description}
            </span>
          </div>
          {delivery.amount && (
            <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
              <span className="text-slate-400 font-bold uppercase tracking-tight text-[10px]">Cobro:</span>
              <span className="font-black text-orange-600 text-sm">{delivery.amount}</span>
            </div>
          )}
        </div>

        {/* Primary Action: Official WhatsApp Button */}
        <div className="mt-4 space-y-3">
          <a
            id="delivery-modal-btn-whatsapp"
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-center gap-3 py-4 px-5 bg-green-500 hover:bg-green-600 text-white font-black rounded-2xl shadow-lg shadow-green-100 transition-all active:scale-[0.98] text-sm"
          >
            <MessageCircle className="w-5 h-5 fill-white" />
            <span>Enviar Mensaje por WhatsApp</span>
            <ExternalLink className="w-4 h-4 opacity-80" />
          </a>

          {/* Quick simulation button to open client web view in preview */}
          {onOpenCustomerView && (
            <button
              id="delivery-modal-btn-simulate-client"
              type="button"
              onClick={() => {
                onOpenCustomerView(delivery.sessionToken);
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-orange-50 hover:bg-orange-100 text-orange-700 font-black rounded-2xl text-xs border border-orange-200 transition-all"
            >
              <span>Visualizar Vista del Cliente (Seguimiento)</span>
              <ArrowRight className="w-4 h-4 text-orange-600" />
            </button>
          )}
        </div>

        {/* Secondary Sharing Options */}
        <div className="mt-5 pt-4 border-t border-slate-100 space-y-2.5">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
            Otras opciones de envío
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              id="delivery-modal-btn-copy-link"
              type="button"
              onClick={() => copyToClipboard(customerLink, 'link')}
              className="flex items-center justify-center gap-2 py-3 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl text-xs font-bold border border-slate-200 transition-colors"
            >
              {copiedLink ? <Check className="w-4 h-4 text-green-600 stroke-[3]" /> : <Copy className="w-4 h-4 text-slate-400" />}
              <span>{copiedLink ? '¡Copiado!' : 'Copiar Enlace'}</span>
            </button>

            <button
              id="delivery-modal-btn-share-native"
              type="button"
              onClick={handleNativeShare}
              className="flex items-center justify-center gap-2 py-3 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl text-xs font-bold border border-slate-200 transition-colors"
            >
              <Share2 className="w-4 h-4 text-orange-500" />
              <span>Compartir App...</span>
            </button>

            <a
              id="delivery-modal-btn-sms"
              href={smsUrl}
              className="flex items-center justify-center gap-2 py-3 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl text-xs font-bold border border-slate-200 transition-colors"
            >
              <PhoneCall className="w-4 h-4 text-blue-500" />
              <span>Enviar por SMS</span>
            </a>

            <button
              id="delivery-modal-btn-toggle-qr"
              type="button"
              onClick={() => setShowQr(!showQr)}
              className="flex items-center justify-center gap-2 py-3 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl text-xs font-bold border border-slate-200 transition-colors"
            >
              <QrCode className="w-4 h-4 text-slate-600" />
              <span>{showQr ? 'Ocultar QR' : 'Escanear QR'}</span>
            </button>
          </div>
        </div>

        {/* QR Code Section */}
        {showQr && (
          <div className="mt-4 p-5 rounded-[24px] bg-slate-50 border border-slate-200 text-slate-900 flex flex-col items-center justify-center space-y-2 shadow-inner animate-fadeIn">
            <p className="text-xs font-extrabold text-slate-800">Escaneá con la cámara de tu celular:</p>
            <img src={qrApiUrl} alt="QR de Entrega UBIKA" className="w-44 h-44 rounded-2xl shadow-md border-2 border-white" />
            <p className="text-[10px] text-slate-400 font-semibold">Abre directamente la página de ubicación</p>
          </div>
        )}

        {/* WhatsApp Message Preview */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-slate-500">Texto del mensaje a enviar:</span>
            <button
              id="delivery-modal-btn-copy-msg"
              type="button"
              onClick={() => copyToClipboard(fullMessage, 'message')}
              className="text-[11px] text-orange-600 font-bold hover:underline flex items-center gap-1"
            >
              {copiedMessage ? <Check className="w-3.5 h-3.5 text-green-600 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedMessage ? 'Copiado' : 'Copiar texto'}
            </button>
          </div>
          <p className="text-[11px] text-slate-700 font-mono whitespace-pre-line leading-relaxed bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            {fullMessage}
          </p>
        </div>

        {/* Privacy badge */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-semibold">
          <Shield className="w-4 h-4 text-green-500" />
          <span>El cliente no necesita descargar ninguna aplicación</span>
        </div>
      </div>
    </div>
  );
};
