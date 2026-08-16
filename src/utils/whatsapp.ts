/**
 * UBIKA - WhatsApp Integration & Official Messaging Utilities
 * Compliant with Meta WhatsApp Web / Mobile deep link standards.
 */

import { Delivery } from '../types';

export function cleanPhoneNumber(phone: string): string {
  // Remove non-numeric characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, '');
  // If starts with +, remove + for wa.me
  return cleaned.startsWith('+') ? cleaned.substring(1) : cleaned;
}

export function generateWhatsAppMessage(delivery: Delivery, appBaseUrl: string): string {
  const customerUrl = `${appBaseUrl}#track/${delivery.sessionToken}`;
  const driverName = delivery.driverName || 'el repartidor asignado';
  
  return `Hola. Tu pedido está en camino (${delivery.description}).${delivery.amount ? `\nImporte a abonar: ${delivery.amount}` : ''}

Soy ${driverName}. Para facilitar la entrega necesitamos conocer tu ubicación exacta.

Compartila de forma temporal desde este enlace:
${customerUrl}

Tu ubicación solo se utilizará para esta entrega y dejará de estar disponible cuando finalice. No requiere instalar ninguna aplicación.`;
}

export function generateWhatsAppLink(delivery: Delivery, appBaseUrl: string): string {
  const cleanPhone = cleanPhoneNumber(delivery.recipientPhone);
  const message = generateWhatsAppMessage(delivery, appBaseUrl);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

export function generateSMSLink(delivery: Delivery, appBaseUrl: string): string {
  const cleanPhone = cleanPhoneNumber(delivery.recipientPhone);
  const message = `UBIKA: Tu repartidor necesita tu ubicación para la entrega de "${delivery.description}". Abrí este enlace seguro: ${appBaseUrl}#track/${delivery.sessionToken}`;
  return `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;
}
