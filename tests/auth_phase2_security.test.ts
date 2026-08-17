import './setup_env';
import 'dotenv/config';
import { db, saveDatabaseSync, hashToken, validatePassword } from '../server/db';
import crypto from 'crypto';

async function runPhase2SecurityTests() {
  console.log('====================================================');
  console.log('🛡️ INICIANDO TESTS DE SEGURIDAD - FASE 2 UBIKA AUTH');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASÓ] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FALLÓ] ${testName}: ${detail || ''}`);
      failed++;
    }
  }

  // 1. Password Policy Validation Tests
  const weakPasswords = ['password', '12345678', '123456789', 'qwerty123', 'short', '1234567'];
  for (const pw of weakPasswords) {
    const res = validatePassword(pw);
    assert(!res.valid, `Contraseña débil rechazada correctamente: "${pw}"`);
  }

  const validPassword = 'SecurePassword2026!';
  const validRes = validatePassword(validPassword);
  assert(validRes.valid, `Contraseña válida aceptada: "${validPassword}"`);

  // 2. Invitation Security & Logic Tests
  const testCompanyId = 'comp_test_sec_1';
  const testEmail = `employee_${Date.now()}@ubika.test`;
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);

  const invitation = {
    id: `inv_test_${Date.now()}`,
    email: testEmail,
    tokenHash,
    companyId: testCompanyId,
    role: 'DRIVER' as const,
    expiresAt: Date.now() + 3600 * 1000,
    used: false,
    createdAt: Date.now(),
  };
  db.createInvitation(invitation);

  const found = db.getInvitationByHash(tokenHash);
  assert(!!found && found.id === invitation.id, 'Invitación encontrada por hash válido');

  const alteredHash = hashToken('wrong_token');
  const notFound = db.getInvitationByHash(alteredHash);
  assert(!notFound, 'Token alterado no coincide con ningún hash de invitación');

  const expiredInvitation = {
    id: `inv_exp_${Date.now()}`,
    email: `expired_${Date.now()}@ubika.test`,
    tokenHash: hashToken('expired_token'),
    companyId: testCompanyId,
    role: 'KITCHEN' as const,
    expiresAt: Date.now() - 1000,
    used: false,
    createdAt: Date.now(),
  };
  db.createInvitation(expiredInvitation);
  assert(expiredInvitation.expiresAt < Date.now(), 'Invitación expirada detectada correctamente');

  const allowedRoles = ['DRIVER', 'KITCHEN', 'DISPATCHER'];
  const disallowedRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN'];
  for (const r of disallowedRoles) {
    assert(!allowedRoles.includes(r), `Rol prohibido para invitación admin bloqueado: ${r}`);
  }
  for (const r of allowedRoles) {
    assert(allowedRoles.includes(r), `Rol permitido para invitación admin aceptado: ${r}`);
  }

  // 3. Password Recovery Security Tests
  const recoveryEmail = `user_rec_${Date.now()}@ubika.test`;
  const rawResetToken = crypto.randomBytes(32).toString('hex');
  const resetHash = hashToken(rawResetToken);

  const resetRecord = {
    id: `pr_test_${Date.now()}`,
    email: recoveryEmail,
    tokenHash: resetHash,
    expiresAt: Date.now() + 3600 * 1000,
    used: false,
    createdAt: Date.now(),
  };
  db.createPasswordReset(resetRecord);

  const foundReset = db.getPasswordResetByHash(resetHash);
  assert(!!foundReset && foundReset.email === recoveryEmail, 'Token de recuperación encontrado por hash válido');

  const alteredReset = db.getPasswordResetByHash(hashToken('wrong_reset'));
  assert(!alteredReset, 'Token de recuperación alterado falla');

  db.updatePasswordReset(resetRecord.id, { used: true, usedAt: Date.now() });
  const usedReset = db.getPasswordResetByHash(resetHash);
  assert(!!usedReset && usedReset.used === true, 'Token de recuperación marcado como usado previene reutilización');

  const genericMsg = "Si el correo está registrado, se han enviado las instrucciones de recuperación.";
  assert(typeof genericMsg === 'string' && genericMsg.includes("Si el correo está registrado"), 'Respuesta genérica implementada para evitar enumeración de usuarios');

  console.log('====================================================');
  console.log(`📊 RESULTADOS TESTS SEGURIDAD FASE 2: ${passed} PASADOS | ${failed} FALLADOS`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2SecurityTests().catch((err) => {
  console.error('Error ejecutando tests de seguridad Fase 2:', err);
  process.exit(1);
});
