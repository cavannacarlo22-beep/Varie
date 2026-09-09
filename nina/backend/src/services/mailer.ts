// FILE: backend/src/services/mailer.ts
//
// Invio email.
//
// Se SMTP non è configurato le email non spariscono: vengono scritte nei log,
// link compreso. Così in sviluppo si può completare il giro di verifica email e
// reset password senza configurare niente, e non serve inventare un "finto"
// percorso di test che poi in produzione si comporta diversamente.
//
// I testi sono nella voce di Nina, perché anche l'email è un momento in cui
// l'app parla.

import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

let transporter: Transporter | undefined;

function getTransporter(): Transporter | undefined {
  if (!config.mail.enabled) return undefined;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.port === 465,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.password } : undefined,
  });

  return transporter;
}

interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

async function send(email: Email): Promise<void> {
  const transport = getTransporter();

  if (!transport) {
    // Nessun SMTP configurato: il messaggio finisce nei log, in chiaro, così
    // in sviluppo si può cliccare il link.
    logger.warn(
      { to: email.to, subject: email.subject, body: email.text },
      'SMTP non configurato: email non spedita, contenuto scritto qui sotto',
    );
    return;
  }

  await transport.sendMail({
    from: config.mail.from,
    to: email.to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="it">
  <body style="margin:0;padding:24px;background:#FFF9FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#30252A;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;box-shadow:0 2px 16px rgba(233,106,149,.08);">
      <p style="font-size:22px;font-weight:700;margin:0 0 20px;color:#E96A95;">${title}</p>
      ${bodyHtml}
      <hr style="border:none;border-top:1px solid #FCE4EC;margin:28px 0 16px;">
      <p style="font-size:12px;color:#B88A9A;margin:0;">
        Se non hai richiesto tu questa email puoi ignorarla tranquillamente.
      </p>
    </div>
  </body>
</html>`;
}

export async function sendVerificationEmail(
  to: string,
  displayName: string,
  token: string,
): Promise<void> {
  const link = `${config.server.publicBaseUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;

  await send({
    to,
    subject: 'Confermi la tua email? 💗',
    text:
      `Ciao ${displayName}!\n\n` +
      `Manca solo un click e siamo pronte:\n${link}\n\n` +
      `Il link vale ${config.auth.emailVerificationTtlHours} ore.\n\nA dopo,\nNina`,
    html: layout(
      `Ciao ${displayName}! 💗`,
      `<p style="font-size:16px;line-height:1.6;margin:0 0 24px;">Manca solo un click e siamo pronte.</p>
       <p style="margin:0 0 24px;">
         <a href="${link}" style="display:inline-block;background:#E96A95;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;">Conferma la mia email</a>
       </p>
       <p style="font-size:13px;color:#B88A9A;margin:0;">Il link vale ${config.auth.emailVerificationTtlHours} ore.</p>`,
    ),
  });
}

export async function sendPasswordResetEmail(
  to: string,
  displayName: string,
  token: string,
): Promise<void> {
  const link = `${config.server.publicBaseUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

  await send({
    to,
    subject: 'Reimpostiamo la password',
    text:
      `Ciao ${displayName},\n\n` +
      `Hai chiesto di reimpostare la password. Da qui:\n${link}\n\n` +
      `Il link vale ${config.auth.passwordResetTtlMinutes} minuti.\n\n` +
      `Se non sei stata tu, non devi fare niente: la password resta quella di prima.\n\nNina`,
    html: layout(
      'Reimpostiamo la password',
      `<p style="font-size:16px;line-height:1.6;margin:0 0 24px;">Ciao ${displayName}, capita a tutte. Da qui puoi sceglierne una nuova:</p>
       <p style="margin:0 0 24px;">
         <a href="${link}" style="display:inline-block;background:#E96A95;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;">Scegli una nuova password</a>
       </p>
       <p style="font-size:13px;color:#B88A9A;margin:0;">Il link vale ${config.auth.passwordResetTtlMinutes} minuti. Se non sei stata tu non devi fare niente: la password resta quella di prima.</p>`,
    ),
  });
}

export async function sendPasswordChangedEmail(to: string, displayName: string): Promise<void> {
  await send({
    to,
    subject: 'La tua password è stata cambiata',
    text:
      `Ciao ${displayName},\n\n` +
      `Ti avvisiamo che la password del tuo account è appena stata cambiata.\n\n` +
      `Se sei stata tu, tutto a posto. Se non sei stata tu, cambia subito la password ` +
      `dal link "Password dimenticata" e controlla i dispositivi collegati.\n\nNina`,
    html: layout(
      'Password cambiata',
      `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Ciao ${displayName}, la password del tuo account è appena stata cambiata.</p>
       <p style="font-size:15px;line-height:1.6;margin:0;">Se sei stata tu, tutto a posto. Se <strong>non</strong> sei stata tu, reimposta subito la password e controlla i dispositivi collegati dalle impostazioni.</p>`,
    ),
  });
}
