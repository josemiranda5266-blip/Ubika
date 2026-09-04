import { spawnSync } from 'node:child_process';

const checks = [
  { name: 'Typecheck', command: 'bun', args: ['run', 'lint'] },
  { name: 'Tests', command: 'bun', args: ['run', 'test'] },
  { name: 'Production build', command: 'bun', args: ['run', 'build'] },
];

console.log('\nUBIKA — VERIFICACIÓN DE RELEASE\n');

for (const check of checks) {
  console.log(`▶ ${check.name}`);
  const result = spawnSync(check.command, check.args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env },
  });

  if (result.error) {
    console.error(`\n✖ ${check.name}: no se pudo ejecutar.`);
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\n✖ ${check.name}: FALLÓ.`);
    console.error('\nUBIKA NO ESTÁ LISTA PARA PUBLICAR.\n');
    process.exit(result.status ?? 1);
  }

  console.log(`✔ ${check.name}: OK\n`);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✔ TYPECHECK: OK');
console.log('✔ TESTS: OK');
console.log('✔ BUILD: OK');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 UBIKA ESTÁ LISTA PARA PUBLICAR.\n');
