import 'dotenv/config';

export interface SentEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  createdAt: number;
}

class EmailServiceClass {
  private sentEmails: SentEmail[] = [];

  constructor() {}

  /**
   * Send an employee invitation email.
   */
  async sendEmployeeInvitation(to: string, inviteUrl: string, role: string, companyName: string): Promise<boolean> {
    const subject = `Invitación para unirse a UBIKA (${companyName})`;
    const text = `Hola,\n\nHas sido invitado a unirte a UBIKA en la empresa ${companyName} con el rol de ${role}.\n\nPara aceptar la invitación y configurar tu contraseña, haz clic en el siguiente enlace:\n${inviteUrl}\n\nEste enlace es válido por 7 días y es de uso único.\n\nSi no solicitaste esta invitación, puedes ignorar este correo.\n\nAtentamente,\nEl equipo de UBIKA`;
    const html = `<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2>Invitación a UBIKA</h2>
      <p>Has sido invitado a unirte a <strong>${companyName}</strong> con el rol de <strong>${role}</strong>.</p>
      <p>Para aceptar la invitación y establecer tu contraseña de acceso de forma segura, haz clic en el siguiente botón:</p>
      <p style="margin: 25px 0;">
        <a href="${inviteUrl}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Aceptar Invitación y Configurar Contraseña</a>
      </p>
      <p style="font-size: 12px; color: #666;">Este enlace expirará en 7 días y solo puede usarse una vez.</p>
      <p style="font-size: 12px; color: #666;">Si no solicitaste esto, puedes ignorar este mensaje.</p>
    </div>`;

    return await this.dispatch(to, subject, text, html);
  }

  /**
   * Send a password reset email.
   */
  async sendPasswordReset(to: string, resetUrl: string): Promise<boolean> {
    const subject = `Recuperación de contraseña en UBIKA`;
    const text = `Hola,\n\nHas solicitado restablecer tu contraseña en UBIKA.\n\nHaz clic en el siguiente enlace para restablecer tu contraseña:\n${resetUrl}\n\nEste enlace expirará en 24 horas y es de uso único.\n\nSi no solicitaste este cambio, ignora este correo y tu cuenta permanecerá segura.\n\nAtentamente,\nEl equipo de UBIKA`;
    const html = `<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2>Recuperación de Contraseña</h2>
      <p>Has solicitado restablecer tu contraseña en UBIKA.</p>
      <p>Para continuar, haz clic en el siguiente botón:</p>
      <p style="margin: 25px 0;">
        <a href="${resetUrl}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Restablecer Contraseña</a>
      </p>
      <p style="font-size: 12px; color: #666;">Este enlace es válido por 24 horas y de uso único.</p>
      <p style="font-size: 12px; color: #666;">Si no solicitaste esto, ignora este mensaje.</p>
    </div>`;

    return await this.dispatch(to, subject, text, html);
  }

  /**
   * Send withdrawal request confirmation to consumer.
   */
  async sendWithdrawalConfirmation(req: { id: string; consumerEmail: string; consumerName: string; type: string }): Promise<boolean> {
    const subject = `UBIKA - Comprobante de solicitud de desistimiento (${req.id})`;
    const text = `Estimado/a ${req.consumerName},\n\nHemos recibido su solicitud de desistimiento con código único de trámite: ${req.id}.\nTipo: ${req.type === 'PURCHASE_WITHDRAWAL' ? 'Arrepentimiento de compra' : 'Baja de servicio'}.\n\nConforme a la normativa aplicable (Ley 24.240 y Disposición 954/2025), su solicitud será procesada en un plazo máximo de 5 días hábiles.\n\nPuede consultar el estado de su trámite en cualquier momento ingresando su código de trámite y su correo en la plataforma.\n\nAtentamente,\nEquipo UBIKA`;
    const html = `<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2>Solicitud de Desistimiento Recibida</h2>
      <p>Estimado/a <strong>${req.consumerName}</strong>,</p>
      <p>Se ha registrado su solicitud de arrepentimiento/desistimiento con el siguiente código único de trámite:</p>
      <p style="font-size: 18px; font-weight: bold; background: #f3f4f6; padding: 12px; border-radius: 8px; font-family: monospace;">${req.id}</p>
      <p><strong>Tipo:</strong> ${req.type === 'PURCHASE_WITHDRAWAL' ? 'Arrepentimiento de compra' : 'Baja de servicio'}</p>
      <p>Conforme a la normativa de Defensa del Consumidor, recibirá una respuesta formal en un plazo máximo de 5 días hábiles.</p>
    </div>`;
    return await this.dispatch(req.consumerEmail, subject, text, html);
  }

  /**
   * Notify merchant about a new consumer withdrawal request.
   */
  async notifyMerchantWithdrawal(req: { id: string; companyId: string; consumerName: string; type: string; reason: string }): Promise<boolean> {
    const subject = `[AVISO UBIKA] Nueva solicitud de desistimiento ${req.id}`;
    const text = `Se ha recibido una nueva solicitud de desistimiento para la empresa ${req.companyId}.\nCódigo: ${req.id}\nConsumidor: ${req.consumerName}\nMotivo: ${req.reason}\n\nPor favor ingrese al panel de administración para revisarla.`;
    return await this.dispatch(`admin@${req.companyId}.ubika.local`, subject, text);
  }

  /**
   * Send resolution notification to consumer.
   */
  async sendWithdrawalResolution(req: { id: string; consumerEmail: string; consumerName: string; status: string; responseMessage?: string }): Promise<boolean> {
    const subject = `UBIKA - Resolución de solicitud de desistimiento (${req.id})`;
    const text = `Estimado/a ${req.consumerName},\n\nSu solicitud con código ${req.id} ha sido resuelta con estado: ${req.status}.\n${req.responseMessage ? `Detalles: ${req.responseMessage}\n` : ''}\nAtentamente,\nEquipo UBIKA`;
    return await this.dispatch(req.consumerEmail, subject, text);
  }

  private async dispatch(to: string, subject: string, text: string, html?: string): Promise<boolean> {
    const provider = (process.env.EMAIL_PROVIDER || 'console').toLowerCase();
    const from = process.env.EMAIL_FROM || 'no-reply@ubika.app';

    // In test environment or console provider, log/store in memory without printing secrets/tokens to stdout
    if (process.env.NODE_ENV === 'test' || provider === 'console' || provider === 'mock') {
      this.sentEmails.push({
        to,
        subject,
        text,
        html,
        createdAt: Date.now(),
      });
      if (process.env.NODE_ENV !== 'test') {
        console.log(`[EmailService] [${provider.toUpperCase()}] To: ${to} | Subject: ${subject}`);
      }
      return true;
    }

    if (provider === 'sendgrid') {
      const apiKey = process.env.SENDGRID_API_KEY;
      if (!apiKey) {
        console.error('[EmailService Error] SENDGRID_API_KEY not configured');
        return false;
      }
      try {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: from },
            subject,
            content: [
              { type: 'text/plain', value: text },
              { type: 'text/html', value: html || text },
            ],
          }),
        });
        return response.ok;
      } catch (err) {
        console.error('[EmailService SendGrid Error]:', err);
        return false;
      }
    }

    // Fallback console / memory capture
    this.sentEmails.push({ to, subject, text, html, createdAt: Date.now() });
    return true;
  }

  /**
   * Get sent emails for testing or audit
   */
  getSentEmails(): SentEmail[] {
    return this.sentEmails;
  }

  clearSentEmails(): void {
    this.sentEmails = [];
  }
}

export const EmailService = new EmailServiceClass();
