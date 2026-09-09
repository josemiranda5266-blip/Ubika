import assert from 'node:assert/strict';
import { getTrustProxyHops } from '../server/ops/runtime-config';

const cases: Array<[string | undefined, number]> = [
  [undefined, 0],
  ['', 0],
  ['0', 0],
  ['1', 1],
  ['3', 3],
  ['-1', 0],
  ['1.5', 0],
  ['abc', 0],
  ['1e3', 0],
];

for (const [value, expected] of cases) {
  assert.equal(
    getTrustProxyHops({ TRUST_PROXY_HOPS: value }),
    expected,
    `TRUST_PROXY_HOPS=${String(value)} debe resolver a ${expected}`,
  );
}

console.log('✓ runtime_config.test.ts passed');
