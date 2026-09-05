export type WithdrawalRequestType = 'PURCHASE_WITHDRAWAL' | 'SERVICE_CANCELLATION';
export type WithdrawalRequestStatus = 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED';
export type WithdrawalException = 'PERISHABLE_PRODUCT' | 'DIGITAL_SERVICE_CONSUMED' | 'CUSTOM_MADE' | 'USED_OR_CONSUMED' | 'RESALE_OR_PRODUCTION';

export interface WithdrawalRequest {
  id: string; // Código único: "wdrl_" + crypto.randomUUID()
  companyId: string;
  customerId?: string; // Opcional: puede ser cliente registrado o invitado
  guestEmail?: string;
  guestPhone?: string;
  
  // Identificación de la operación
  saleId?: string;
  subscriptionId?: string;
  orderNumber?: number;
  
  // Tipo de desistimiento
  type: WithdrawalRequestType;
  
  // Estado del trámite
  status: WithdrawalRequestStatus;
  
  // Información del consumidor
  consumerName: string;
  consumerDocument?: string;
  consumerEmail: string;
  consumerPhone: string;
  
  // Motivo y detalles
  reason: string;
  additionalNotes?: string;
  
  // Trazabilidad
  createdAt: number;
  updatedAt: number;
  processedAt?: number;
  processedBy?: string;
  
  // Excepciones aplicadas
  exceptionApplied?: WithdrawalException | null;
  exceptionJustification?: string;
  
  // Respuesta al consumidor
  responseMessage?: string;
  refundAmount?: number;
  refundMethod?: 'ORIGINAL_PAYMENT' | 'STORE_CREDIT' | 'BANK_TRANSFER';
  
  // Metadata legal
  ipAddress: string;
  userAgent: string;
  consentAccepted: boolean;
  consentAcceptedAt: number;
  legalResponseDueAt?: number;
}

