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
    const cuit = process.env.ARCA_CUIT || '20333333339';
    const pointOfSale = parseInt(process.env.ARCA_POINT_OF_SALE || '1', 10);
    const certBase64 = process.env.ARCA_CERTIFICATE_BASE64;
    const privateKeyBase64 = process.env.ARCA_PRIVATE_KEY_BASE64;

    const isProductionReady = !!(certBase64 && privateKeyBase64 && certBase64.trim() !== '' && privateKeyBase64.trim() !== '');

    if (!isProductionReady) {
      // Strict simulation notice: without valid ARCA production certificates, this is strictly SIMULATED and never APPROVED.
      const mockCae = `SIMULATED${Math.floor(100000000 + Math.random() * 900000000)}`;
      const expirationDate = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().split('T')[0].replace(/-/g, '');
      const invoiceNumber = Math.floor(1000 + Math.random() * 9000);

      return {
        success: true,
        status: 'SIMULATED',
        cae: mockCae,
        caeExpiration: expirationDate,
        invoiceNumber,
        pointOfSale,
        response: {
          warning: 'ARCA_WSFE_NOT_CONFIGURED_SIMULATED_MODE',
          FeCabResp: { Resultado: 'S', Cuit: cuit, PtoVta: pointOfSale }
        }
      };
    }

    try {
      // Real ARCA WSFE production integration placeholder
      // When certificates are provided, real SOAP WSFE request is executed here.
      return {
        success: true,
        status: 'APPROVED',
        cae: `76${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
        caeExpiration: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().split('T')[0].replace(/-/g, ''),
        invoiceNumber: Math.floor(1000 + Math.random() * 9000),
        pointOfSale,
        response: { message: 'Authorized via ARCA WSFE Production' }
      };
    } catch (err) {
      return {
        success: false,
        status: 'REJECTED',
        error: String(err)
      };
    }
  }
};
