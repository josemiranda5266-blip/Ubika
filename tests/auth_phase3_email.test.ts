import './setup_env';
import 'dotenv/config';
import { db, hashToken } from '../server/db';
import { EmailService } from '../server/email';
import crypto from 'crypto';

async function runPhase3EmailTests() {
  console.log('====================================================');
  console.log('📧 INICIANDO TESTS DE EMAIL Y SEGURIDAD - FASE 3');
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

  // Clear sent emails
  EmailService.clearSentEmails();

  // 1. Test EmailService receives invitation correctly
  const testEmail = `employee_phase3_${Date.now()}@ubika.test`;
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const inviteUrl = `https://ubika.app/accept-invite?token=${rawToken}`;

  const invitation = {
    id: `inv_phase3_${Date.now()}`,
    email: testEmail,
    tokenHash,
    companyId: 'comp_ubika_piloto',
    role: 'DRIVER' as const,
    expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
    used: false,
    createdAt: Date.now(),
  };

  db.createInvitation(invitation);

  await EmailService.sendEmployeeInvitation(testEmail, inviteUrl, 'DRIVER', 'Sede Central');

  const sentEmails = EmailService.getSentEmails();
  const inviteEmail = sentEmails.find(e => e.to === testEmail && e.subject.includes('Invitación'));
  assert(!!inviteEmail, 'EmailService recibió el correo de invitación del empleado');
  assert(!!inviteEmail && inviteEmail.text.includes(inviteUrl), 'El correo de invitación incluye el enlace correcto');

  // 2. Test EmailService receives password reset correctly
  const resetRawToken = crypto.randomBytes(32).toString('hex');
  const resetHash = hashToken(resetRawToken);
  const resetUrl = `https://ubika.app/reset-password?token=${resetRawToken}`;

  const passwordReset = {
    id: `pr_phase3_${Date.now()}`,
    email: testEmail,
    tokenHash: resetHash,
    expiresAt: Date.now() + 24 * 3600 * 1000,
    used: false,
    createdAt: Date.now(),
  };

  db.createPasswordReset(passwordReset);

  await EmailService.sendPasswordReset(testEmail, resetUrl);

  const resetEmail = EmailService.getSentEmails().find(e => e.to === testEmail && e.subject.includes('Recuperación'));
  assert(!!resetEmail, 'EmailService recibió el correo de recuperación de contraseña');
  assert(!!resetEmail && resetEmail.text.includes(resetUrl), 'El correo de recuperación incluye el enlace correcto');

  // 3. Test rawToken security: Never stored in plaintext DB
  const rawState = db.getRawState();
  const storedInv = (rawState.invitations || []).find(i => i.tokenHash === tokenHash);
  assert(!!storedInv && !(storedInv as any).token && !(storedInv as any).rawToken, 'La base de datos almacena únicamente el hash (tokenHash), nunca el rawToken en texto plano');

  const storedPr = (rawState.password_resets || []).find(p => p.tokenHash === resetHash);
  assert(!!storedPr && !(storedPr as any).token && !(storedPr as any).rawToken, 'La base de datos de recuperación almacena únicamente el hash (tokenHash), nunca el rawToken');

  // 4. Test Invalidation of previous active tokens when new one is created
  const newRawToken = crypto.randomBytes(32).toString('hex');
  const newTokenHash = hashToken(newRawToken);
  const newInvitation = {
    id: `inv_phase3_new_${Date.now()}`,
    email: testEmail,
    tokenHash: newTokenHash,
    companyId: 'comp_ubika_piloto',
    role: 'DRIVER' as const,
    expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
    used: false,
    createdAt: Date.now(),
  };

  db.createInvitation(newInvitation);

  const previousInv = db.getInvitationByHash(tokenHash);
  assert(!!previousInv && previousInv.used === true, 'Crear una nueva invitación invalida automáticamente la invitación anterior activa del mismo correo');

  console.log('====================================================');
  console.log(`📊 RESULTADOS TESTS FASE 3: ${passed} PASADOS | ${failed} FALLADOS`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3EmailTests().catch((err) => {
  console.error('Error ejecutando tests de Fase 3:', err);
  process.exit(1);
});
