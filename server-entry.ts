import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import salonRouter from './server/salon/routes';

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  // server.ts still owns the legacy application definition and its historical auto-start block.
  // Import it in test mode so this explicit bootstrap is the only process that calls listen().
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const { createUbikaApp } = await import('./server');
  process.env.NODE_ENV = previousNodeEnv;

  const app = createUbikaApp();

  // Salon is mounted after the core application's middleware/routes are initialized.
  // The public QR endpoint remains public; authenticated salon operations enforce RBAC in salonRouter.
  app.use('/api/salon', salonRouter);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[UBIKA Server] Servidor ejecutándose en http://0.0.0.0:${PORT}`);
  });
}

void startServer();
