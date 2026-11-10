// Sends email through the SMTP account in the function secrets.
import nodemailer from 'npm:nodemailer@6';

export const isMailConfigured = () =>
  Boolean(Deno.env.get('SMTP_HOST') && Deno.env.get('SMTP_USER') && Deno.env.get('SMTP_PASS'));

export interface Mail {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: { filename: string; content: string; contentType: string }[];
}

export async function sendMail(mail: Mail): Promise<void> {
  const port = Number(Deno.env.get('SMTP_PORT') ?? 587);
  const user = Deno.env.get('SMTP_USER')!;
  const transport = nodemailer.createTransport({
    host: Deno.env.get('SMTP_HOST')!,
    port,
    secure: port === 465,
    auth: { user, pass: Deno.env.get('SMTP_PASS')! },
  });
  await transport.sendMail({ from: `Your Kitchen Co. <${Deno.env.get('SMTP_FROM') ?? user}>`, ...mail });
}
