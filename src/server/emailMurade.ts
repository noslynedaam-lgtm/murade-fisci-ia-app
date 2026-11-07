// Envio de e-mail dos sistemas Murade (recuperação de senha, resumos, avisos). Funciona com Resend (RESEND_API_KEY) ou SMTP (SMTP_HOST/USER/PASS).
// Sem nenhuma das duas configurações, o recurso informa que não está configurado; nunca finge que enviou.
//
// Trava de segurança: este é o ÚNICO ponto por onde sai e-mail, então é aqui que se limita e se registra.
//  - Limite por dia (fuso de Brasília) para o sistema inteiro: se algum robô entrar em repetição, o envio para sozinho e o motivo vai para o log.
//    Padrão 300 por dia; o dono muda com EMAIL_LIMITE_DIARIO no Render.
//  - Cada envio deixa uma linha no log (destinatário mascarado e assunto), para dar para conferir de manhã o que saiu durante a noite.
export function emailConfigurado(): boolean {
  const de = process.env.EMAIL_FROM?.trim();
  return Boolean(de && (process.env.RESEND_API_KEY?.trim() || (process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASS)));
}

export const LIMITE_EMAIL_DIARIO_PADRAO = 300;

export function limiteDiarioEmail(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(String(env.EMAIL_LIMITE_DIARIO ?? '').trim());
  return Number.isInteger(n) && n > 0 ? n : LIMITE_EMAIL_DIARIO_PADRAO;
}

export interface ContadorEmail { dia: string; tentativas: number }
const diaDeBrasilia = (agora: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);

/** Conta uma tentativa de envio no dia de hoje. Recusa quando o limite do dia já foi atingido (a tentativa recusada não é contada). */
export function reservarEnvioEmail(contador: ContadorEmail, agora: Date, limite: number): { ok: true; numero: number } | { ok: false } {
  const dia = diaDeBrasilia(agora);
  if (contador.dia !== dia) { contador.dia = dia; contador.tentativas = 0; }
  if (contador.tentativas >= limite) return { ok: false };
  contador.tentativas += 1;
  return { ok: true, numero: contador.tentativas };
}

/** Mostra só o começo do e-mail e o domínio, para o log não guardar o endereço inteiro. */
export function mascararEmail(email: string): string {
  const [usuario = '', dominio = ''] = String(email).trim().split('@');
  return dominio ? `${usuario.slice(0, 2)}***@${dominio}` : '***';
}

const contadorDoDia: ContadorEmail = { dia: '', tentativas: 0 };

export async function enviarEmail(para: string, assunto: string, texto: string): Promise<void> {
  const limite = limiteDiarioEmail();
  const reserva = reservarEnvioEmail(contadorDoDia, new Date(), limite);
  if (reserva.ok === false) {
    console.error(`[e-mail] BLOQUEADO: limite de ${limite} e-mails por dia atingido neste sistema. Nada foi enviado para ${mascararEmail(para)} (${assunto.slice(0, 80)}). Veja se algum robô está repetindo envio; para aumentar o limite use EMAIL_LIMITE_DIARIO no Render.`);
    throw new Error(`Limite diário de e-mails deste sistema atingido (${limite}). Nada foi enviado.`);
  }
  console.log(`[e-mail] envio ${reserva.numero}/${limite} do dia para ${mascararEmail(para)}: ${assunto.slice(0, 80)}`);
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
