import 'dotenv/config';

export interface SentEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  createdAt: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function assertEmail(value: string): void {
  if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error('Dirección de correo inválida');
  }
}

class EmailServiceClass {
  private sentEmails: SentEmail[] = [];

  /** Send an employee invitation email. */
  async sendEmployeeInvitation(to: string, inviteUrl: string, role: string, companyName: string): Promise<boolean> {
    assertEmail(to);
    const safeRole = escapeHtml(role);
    const safeCompanyName = escapeHtml(companyName);
    const subject = `Invitación para unirse a UBIKA (${companyName})`;
    const text = `Hola,\n\nHas sido invitado a unirte a UBIKA en la empresa ${companyName} con el rol de ${role}.\n\nPara aceptar la invitación y configurar tu contraseña, haz clic en el siguiente enlace:\n${inviteUrl}\n\nEste enlace es válido por 7 días y es de uso único.\n\nSi no solicitaste esta invitación, puedes ignorar este correo.\n\nAtentamente,\nEl equipo de UBIKA`;
    const html = `<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2>Invitación a UBIKA</h2>
      <p>Has sido invitado a unirte a <strong>${safeCompanyName}</strong> con el rol de <strong>${safeRole}</strong>.</p>
      <p>Para aceptar la invitación y establecer tu contraseña de acceso de forma segura, utiliza el botón siguiente:</p>
      <p style="margin: 25px 0;"><a href="${escapeHtml(inviteUrl)}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Aceptar Invitación y Configurar Contraseña</a></p>
      <p style="font-size: 12px; color: #666;">Este enlace expirará en 7 días y solo puede usarse una vez.</p>
      <p style="font-size: 12px; color: #666;">Si no solicitaste esto, puedes ignorar este mensaje.</p>
    </div>`;
    return this.dispatch(to, subject, text, html);
  }

  /** Send a password reset email. */
  async sendPasswordReset(to: string, resetUrl: string): Promise<boolean> {
    assertEmail(to);
    const subject = `Recuperación de contraseña en UBIKA`;
    const text = `Hola,\n\nHas solicitado restablecer tu contraseña en UBIKA.\n\nHaz clic en el siguiente enlace para restablecer tu contraseña:\n${resetUrl}\n\nEste enlace expirará en 24 horas y es de uso único.\n\nSi no solicitaste este cambio, ignora este correo y tu cuenta permanecerá segura.\n\nAtentamente,\nEl equipo de UBIKA`;
    const html = `<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2>Recuperación de Contraseña</h2>
      <p>Has solicitado restablecer tu contraseña en UBIKA.</p>
      <p>Para continuar, utiliza el botón siguiente:</p>
      <p style="margin: 25px 0;"><a href="${escapeHtml(resetUrl)}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Restablecer Contraseña</a></p>
      <p style="font-size: 12px; color: #666;">Este enlace es válido por 24 horas y de uso único.</p>
      <p style="font-size: 12px; color: #666;">Si no solicitaste esto, ignora este mensaje.</p>
    </div>`;
    return this.dispatch(to, subject, text, html);
  }

  async sendWithdrawalConfirmation(req: { id: string; consumerEmail: string; consumerName: string; type: string }): Promise<boolean> {
    assertEmail(req.consumerEmail);
    const safeName = escapeHtml(req.consumerName);
    const safeId = escapeHtml(req.id);
    const subject = `UBIKA - Comprobante de solicitud de desistimiento (${req.id})`;
    const typeLabel = req.type === 'PURCHASE_WITHDRAWAL' ? 'Arrepentimiento de compra' : 'Baja de servicio';
    const text = `Estimado/a ${req.consumerName},\n\nHemos recibido su solicitud de desistimiento con código único de trámite: ${req.id}.\nTipo: ${typeLabel}.\n\nConforme a la normativa aplicable (Ley 24.240 y Disposición 954/2025), su solicitud será procesada en un plazo máximo de 5 días hábiles.\n\nPuede consultar el estado de su trámite en cualquier momento ingresando su código de trámite y su correo en la plataforma.\n\nAtentamente,\nEquipo UBIKA`;
    const html = `<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;"><h2>Solicitud de Desistimiento Recibida</h2><p>Estimado/a <strong>${safeName}</strong>,</p><p>Se ha registrado su solicitud con el siguiente código:</p><p style="font-size: 18px; font-weight: bold; background: #f3f4f6; padding: 12px; border-radius: 8px; font-family: monospace;">${safeId}</p><p><strong>Tipo:</strong> ${escapeHtml(typeLabel)}</p><p>Recibirá una respuesta formal en el plazo informado.</p></div>`;
    return this.dispatch(req.consumerEmail, subject, text, html);
  }

  async notifyMerchantWithdrawal(req: { id: string; companyId: string; consumerName: string; type: string; reason: string }): Promise<boolean> {
    const subject = `[AVISO UBIKA] Nueva solicitud de desistimiento ${req.id}`;
    const text = `Se ha recibido una nueva solicitud de desistimiento para la empresa ${req.companyId}.\nCódigo: ${req.id}\nConsumidor: ${req.consumerName}\nMotivo: ${req.reason}\n\nPor favor ingrese al panel de administración para revisarla.`;
    return this.dispatch(`admin@${req.companyId}.ubika.local`, subject, text);
  }

  async sendWithdrawalResolution(req: { id: string; consumerEmail: string; consumerName: string; status: string; responseMessage?: string }): Promise<boolean> {
    assertEmail(req.consumerEmail);
    const subject = `UBIKA - Resolución de solicitud de desistimiento (${req.id})`;
    const text = `Estimado/a ${req.consumerName},\n\nSu solicitud con código ${req.id} ha sido resuelta con estado: ${req.status}.\n${req.responseMessage ? `Detalles: ${req.responseMessage}\n` : ''}\nAtentamente,\nEquipo UBIKA`;
    return this.dispatch(req.consumerEmail, subject, text);
  }

  private async dispatch(to: string, subject: string, text: string, html?: string): Promise<boolean> {
    assertEmail(to);
    const provider = (process.env.EMAIL_PROVIDER || 'console').toLowerCase();
    const from = process.env.EMAIL_FROM || 'no-reply@ubika.app';

    if (process.env.NODE_ENV === 'test' || provider === 'console' || provider === 'mock') {
      this.sentEmails.push({ to, subject, text, html, createdAt: Date.now() });
      if (process.env.NODE_ENV !== 'test') {
        console.log(`[EmailService] [${provider.toUpperCase()}] Email enviado a destinatario configurado | Subject: ${subject}`);
      }
      return true;
    }

    if (provider === 'sendgrid') {
      const apiKey = process.env.SENDGRID_API_KEY;
      if (!apiKey) {
        console.error('[EmailService Error] SENDGRID_API_KEY no configurada');
        return false;
      }
      try {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: from },
            subject,
            content: [{ type: 'text/plain', value: text }, { type: 'text/html', value: html || text }],
          }),
        });
        if (!response.ok) {
          console.error(`[EmailService Error] SendGrid respondió HTTP ${response.status}`);
        }
        return response.ok;
      } catch (err) {
        console.error('[EmailService SendGrid Error]:', err instanceof Error ? err.message : 'unknown error');
        return false;
      }
    }

    console.error(`[EmailService Error] EMAIL_PROVIDER no soportado: ${provider}`);
    return false;
  }

  getSentEmails(): SentEmail[] { return this.sentEmails; }
  clearSentEmails(): void { this.sentEmails = []; }
}

export const EmailService = new EmailServiceClass();