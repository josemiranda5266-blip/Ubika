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

  async sendEmployeeInvitation(to: string, inviteUrl: string, role: string, companyName: string): Promise<boolean> {
    const subject = `Invitación para unirse a UBIKA (${companyName})`;
    const text = `Hola,\n\nHas sido invitado a unirte a UBIKA en la empresa ${companyName} con el rol de ${role}.\n\nPara aceptar la invitación y configurar tu contraseña, haz clic en el siguiente enlace:\n${inviteUrl}\n\nEste enlace es válido por 7 días y es de uso único.\n\nSi no solicitaste esta invitación, puedes ignorar este correo.\n\nAtentamente,\nEl equipo de UBIKA`;
    const html = `<div style="font-family:Arial,sans-serif;padding:20px;color:#333"><h2>Invitación a UBIKA</h2><p>Has sido invitado a unirte a <strong>${companyName}</strong> con el rol de <strong>${role}</strong>.</p><p>Para aceptar la invitación y establecer tu contraseña de acceso de forma segura, utiliza el siguiente enlace:</p><p><a href="${inviteUrl}">Aceptar invitación y configurar contraseña</a></p><p style="font-size:12px;color:#666">Este enlace expirará en 7 días y solo puede usarse una vez.</p></div>`;
    return this.dispatch(to, subject, text, html);
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<boolean> {
    const subject = 'Recuperación de contraseña en UBIKA';
    const text = `Hola,\n\nHas solicitado restablecer tu contraseña en UBIKA.\n\nUtiliza este enlace:\n${resetUrl}\n\nEste enlace expirará en 24 horas y es de uso único.\n\nAtentamente,\nEl equipo de UBIKA`;
    const html = `<div style="font-family:Arial,sans-serif;padding:20px;color:#333"><h2>Recuperación de contraseña</h2><p>Has solicitado restablecer tu contraseña en UBIKA.</p><p><a href="${resetUrl}">Restablecer contraseña</a></p><p style="font-size:12px;color:#666">Este enlace es válido por 24 horas y de uso único.</p></div>`;
    return this.dispatch(to, subject, text, html);
  }

  private async dispatch(to: string, subject: string, text: string, html?: string): Promise<boolean> {
    const provider = (process.env.EMAIL_PROVIDER || (process.env.NODE_ENV === 'test' ? 'mock' : 'sendgrid')).toLowerCase();
    const from = process.env.EMAIL_FROM || 'no-reply@ubika.app';

    if (process.env.NODE_ENV === 'test' || provider === 'mock') {
      this.sentEmails.push({ to, subject, text, html, createdAt: Date.now() });
      return true;
    }

    if (provider === 'console') {
      // Console delivery is explicitly development-only.
      if (process.env.NODE_ENV === 'production') {
        console.error('[EmailService] Console email provider is disabled in production.');
        return false;
      }
      this.sentEmails.push({ to, subject, text, html, createdAt: Date.now() });
      console.log(`[EmailService] [CONSOLE] To: ${to} | Subject: ${subject}`);
      return true;
    }

    if (provider === 'sendgrid') {
      const apiKey = process.env.SENDGRID_API_KEY?.trim();
      if (!apiKey) {
        console.error('[EmailService] SENDGRID_API_KEY is not configured.');
        return false;
      }
      try {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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
        if (!response.ok) {
          const body = await response.text().catch(() => '');
          console.error(`[EmailService] SendGrid rejected email (${response.status}): ${body.slice(0, 300)}`);
        }
        return response.ok;
      } catch (err) {
        console.error('[EmailService] SendGrid request failed:', err instanceof Error ? err.message : 'unknown error');
        return false;
      }
    }

    if (provider === 'smtp') {
      // SMTP is intentionally not silently simulated. Add a real SMTP transport
      // before enabling this provider in production.
      console.error('[EmailService] SMTP provider is not implemented.');
      return false;
    }

    console.error(`[EmailService] Unsupported provider: ${provider}`);
    return false;
  }

  getSentEmails(): SentEmail[] {
    return this.sentEmails;
  }

  clearSentEmails(): void {
    this.sentEmails = [];
  }
}

export const EmailService = new EmailServiceClass();
