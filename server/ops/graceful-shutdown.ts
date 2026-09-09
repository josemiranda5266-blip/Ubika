import type { Server } from 'node:http';

export interface ShutdownOptions {
  signals?: NodeJS.Signals[];
  gracePeriodMs?: number;
  exit?: (code: number) => void;
  log?: (message: string) => void;
}

/**
 * Installs idempotent SIGTERM/SIGINT handlers for an HTTP server.
 * The caller remains responsible for actually starting the server.
 */
export function installGracefulShutdown(
  server: Server,
  options: ShutdownOptions = {},
): () => void {
  const signals = options.signals ?? ['SIGTERM', 'SIGINT'];
  const gracePeriodMs = Number.isFinite(options.gracePeriodMs) && (options.gracePeriodMs ?? 0) >= 0
    ? Math.floor(options.gracePeriodMs as number)
    : 10_000;
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const log = options.log ?? console.log;

  let shuttingDown = false;
  let timer: NodeJS.Timeout | undefined;

  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`[UBIKA] ${signal} received; starting graceful shutdown.`);

    timer = setTimeout(() => {
      log('[UBIKA] Graceful shutdown timed out; forcing exit.');
      exit(1);
    }, gracePeriodMs);
    timer.unref?.();

    server.close((error) => {
      if (timer) clearTimeout(timer);
      if (error) {
        log(`[UBIKA] HTTP server close failed: ${error.message}`);
        exit(1);
        return;
      }
      log('[UBIKA] HTTP server closed cleanly.');
      exit(0);
    });
  };

  for (const signal of signals) {
    process.once(signal, shutdown);
  }

  return () => {
    for (const signal of signals) {
      process.removeListener(signal, shutdown);
    }
    if (timer) clearTimeout(timer);
  };
}
