import 'dotenv/config';
import { Sale } from './types';

export const ArcaFiscalService = {
  async authorizeSaleInvoice(sale: Sale, customerDocument: string, customerName: string, voucherType: 'FACTURA_A' | 'FACTURA_B' | 'FACTURA_C' | 'TICKET'): Promise<{
    success: boolean;
    cae?: string;
    caeExpiration?: string;
    invoiceNumber?: number;
    pointOfSale?: number;
    status: 'APPROVED' | 'SIMULATED' | 'REJECTED';
    error?: string;
    response?: any;
  }> {
    void sale;
    void customerDocument;
    void customerName;
    void voucherType;

    const cuit = process.env.ARCA_CUIT?.trim();
    const configuredPointOfSale = process.env.ARCA_POINT_OF_SALE?.trim();
    const pointOfSale = configuredPointOfSale ? Number.parseInt(configuredPointOfSale, 10) : undefined;

    // STRICT ARCA RULE: Without a real WSFE SOAP production integration,
    // we NEVER return APPROVED and NEVER generate or present a CAE.
    return {
      success: false,
      status: 'SIMULATED',
      cae: undefined,
      caeExpiration: undefined,
      invoiceNumber: undefined,
      pointOfSale,
      response: {
        error: 'ARCA_WSFE_NOT_CONFIGURED',
        message: 'No real WSFE connection established with ARCA. Fiscal authorization simulation mode active.',
        FeCabResp: {
          Resultado: 'R',
          ...(cuit ? { Cuit: cuit } : {}),
          ...(pointOfSale !== undefined && Number.isFinite(pointOfSale) ? { PtoVta: pointOfSale } : {}),
        },
      },
    };
  },
};
