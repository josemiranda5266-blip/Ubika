import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { Server } from 'node:http';
import test from 'node:test';
import { installGracefulShutdown } from '../server/ops/graceful-shutdown.js';

class FakeServer extends EventEmitter {
  close(callback: (error?: Error) => void): this {
    callback();
    return this;
  }
}

test('graceful shutdown closes the server and exits zero', () => {
  const server = new FakeServer() as unknown as Server;
  const exits: number[] = [];
  const logs: string[] = [];
  const cleanup = installGracefulShutdown(server, {
    signals: ['SIGINT'],
    gracePeriodMs: 1000,
    exit: (code) => exits.push(code),
    log: (message) => logs.push(message),
  });

  process.emit('SIGINT');
  cleanup();

  assert.deepEqual(exits, [0]);
  assert.ok(logs.some((message) => message.includes('starting graceful shutdown')));
  assert.ok(logs.some((message) => message.includes('closed cleanly')));
});

test('graceful shutdown is idempotent for repeated signals', () => {
  const server = new FakeServer() as unknown as Server;
  const exits: number[] = [];
  const cleanup = installGracefulShutdown(server, {
    signals: ['SIGINT'],
    gracePeriodMs: 1000,
    exit: (code) => exits.push(code),
    log: () => undefined,
  });

  process.emit('SIGINT');
  process.emit('SIGINT');
  cleanup();

  assert.deepEqual(exits, [0]);
});
