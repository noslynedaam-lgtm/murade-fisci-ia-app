// Envio de e-mail dos sistemas Murade (recuperação de senha). Funciona com Resend (RESEND_API_KEY) ou SMTP (SMTP_HOST/USER/PASS).
// Sem nenhuma das duas configurações, o recurso informa que não está configurado; nunca finge que enviou.
export function emailConfigurado(): boolean {
  const de = process.env.EMAIL_FROM?.trim();
  return Boolean(de && (process.env.RESEND_API_KEY?.trim() || (process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASS)));
}

export async function enviarEmail(para: string, assunto: string, texto: string): Promise<void> {
  const de = process.env.EMAIL_FROM!.trim();
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">${texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</div>`;
  if (process.env.RESEND_API_KEY?.trim()) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: de, to: [para], subject: assunto, text: texto, html }), signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`Resend recusou o envio (${r.status}).`);
    return;
  }
  const nodemailer = await import('nodemailer');
  const porta = Number(process.env.SMTP_PORT || 465);
  const transporte = nodemailer.createTransport({ host: process.env.SMTP_HOST!.trim(), port: porta, secure: porta === 465, auth: { user: process.env.SMTP_USER!.trim(), pass: process.env.SMTP_PASS! } });
  await transporte.sendMail({ from: de, to: para, subject: assunto, text: texto, html });
}
