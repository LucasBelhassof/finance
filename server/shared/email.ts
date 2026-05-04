import nodemailer from "nodemailer";

import { env } from "./env.js";
import { logger } from "./logger.js";

type TransactionalEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function hasSmtpConfig() {
  return Boolean(env.email.smtpHost && env.email.smtpPort && env.email.smtpFrom);
}

function createTransporter() {
  if (!hasSmtpConfig()) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.email.smtpHost!,
    port: env.email.smtpPort!,
    secure: env.email.smtpPort === 465,
    auth:
      env.email.smtpUser && env.email.smtpPassword
        ? {
            user: env.email.smtpUser,
            pass: env.email.smtpPassword,
          }
        : undefined,
  });
}

export async function sendTransactionalEmail(input: TransactionalEmailInput) {
  const transporter = createTransporter();

  if (!transporter) {
    logger.warn("Transactional email skipped because SMTP is not configured", {
      to: input.to,
      subject: input.subject,
    });
    return { sent: false };
  }

  await transporter.sendMail({
    from: env.email.smtpFrom!,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  return { sent: true };
}

export async function sendSignupConfirmationEmail(input: { to: string; name: string }) {
  return sendTransactionalEmail({
    to: input.to,
    subject: "Sua conta Finly foi criada",
    text: `Ola, ${input.name}. Sua conta Finly foi criada com sucesso.`,
  });
}

export async function sendPasswordResetEmail(input: { to: string; resetUrl: string }) {
  return sendTransactionalEmail({
    to: input.to,
    subject: "Recuperacao de senha do Finly",
    text: `Use este link para redefinir sua senha: ${input.resetUrl}\n\nSe voce nao pediu a redefinicao, ignore este email.`,
  });
}

export async function sendBillingPaymentFailedEmail(input: { to: string; name: string }) {
  return sendTransactionalEmail({
    to: input.to,
    subject: "Pagamento do Finly Premium nao confirmado",
    text: `Ola, ${input.name}. Nao conseguimos confirmar o pagamento do seu Finly Premium. Atualize a assinatura para manter os recursos premium.`,
  });
}

export async function sendBillingCanceledEmail(input: { to: string; name: string }) {
  return sendTransactionalEmail({
    to: input.to,
    subject: "Finly Premium cancelado",
    text: `Ola, ${input.name}. Sua assinatura Finly Premium foi cancelada e os recursos premium foram desativados.`,
  });
}
