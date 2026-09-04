import './setup_env';
import { PaymentProviderService } from '../server/commerce/payments';

const originalNodeEnv = process.env.NODE_ENV;
const originalAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

async function main() {
  process.env.NODE_ENV = 'production';
  delete process.env.MERCADO_PAGO_ACCESS_TOKEN;

  const result = await PaymentProviderService.createPayment({
    companyId: 'test-company',
    saleId: 'test-sale',
    amount: 100,
    paymentMethod: 'test',
  });

  if (result.success) {
    throw new Error('Payment must fail closed when Mercado Pago is not configured in production');
  }

  if (result.providerResponse?.error !== 'Payment provider is not configured') {
    throw new Error('Unexpected payment configuration error');
  }

  process.env.NODE_ENV = 'test';
  const testResult = await PaymentProviderService.createPayment({
    companyId: 'test-company',
    saleId: 'test-sale',
    amount: 100,
    paymentMethod: 'test',
  });

  if (!testResult.success) {
    throw new Error('Test environment payment mock should remain available');
  }

  console.log('Payment production safety test passed');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalAccessToken === undefined) delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
    else process.env.MERCADO_PAGO_ACCESS_TOKEN = originalAccessToken;
  });
