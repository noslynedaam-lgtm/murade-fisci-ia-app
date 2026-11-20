// Robôs conferidores da carteira fiscal, do certificado A1 e da Agenda Fiscal. Só LEEM o que já está guardado: não consultam o Serpro
// nem nenhum órgão, não gastam crédito e não alteram nada. O dono do sistema vê só CONTAGENS por escritório (nunca empresa nem CNPJ).
// Quando há algo urgente, a rotina lança erro com o aviso, para aparecer como alerta na lista de robôs.
import type { Pool } from 'pg';
import { hojeBrasilia } from '../services/certidoes/certidoes';

const soma = <T>(l: T[], f: (x: T) => number) => l.reduce((s, x) => s + f(x), 0);
async function adminId(pool: Pool): Promise<string | null> {
  const adm = await pool.query(`SELECT id FROM fiscoia.users WHERE active = true AND is_admin = true ORDER BY id LIMIT 1`);
  return adm.rows[0] ? String(adm.rows[0].id) : null;
}

export interface LinhaCarteira { escritorio: string; pendentes: number; aConferir: number; novas: number; atrasadas: number }
export function mensagemCarteira(l: LinhaCarteira[]): { texto: string; alerta: boolean } {
  if (l.length === 0) return { texto: 'Tudo em ordem: nenhuma situação fiscal pendente, mensagem nova na Caixa Postal ou parcela atrasada nas consultas guardadas.', alerta: false };
  const resumo = `${soma(l, (x) => x.pendentes)} empresa(s) com situação fiscal pendente, ${soma(l, (x) => x.atrasadas)} parcela(s) de parcelamento em atraso, ${soma(l, (x) => x.novas)} Caixa(s) Postal(is) com mensagem nova e ${soma(l, (x) => x.aConferir)} situação(ões) a conferir no PDF`;
  const urgentes = l.filter((x) => x.pendentes > 0 || x.atrasadas > 0 || x.novas > 0);
  if (urgentes.length === 0) return { texto: `Atenção sem urgência: ${resumo}.`, alerta: false };
  const quem = urgentes.slice(0, 5).map((x) => `${x.escritorio} (${x.pendentes} pendente(s), ${x.atrasadas} parcela(s) atrasada(s), ${x.novas} com mensagem nova)`).join('; ');
  return { texto: `ATENÇÃO: ${resumo}. Escritórios: ${quem}${urgentes.length > 5 ? '; e outros' : ''}. Dados das últimas consultas guardadas; nenhuma consulta nova foi feita.`, alerta: true };
}
export async function conferirCarteiraFiscal(pool: Pool | null, hoje: string = hojeBrasilia()): Promise<string> {
  if (!pool) return 'Banco indisponível; nada conferido.';
  const adm = await adminId(pool);
  if (!adm) return 'Sem conta administradora; nada conferido.';
  let q;
  try { q = await pool.query('SELECT * FROM fiscoia.platform_carteira_alertas($1::uuid, $2::date)', [adm, hoje]); }
  catch { return 'Atualização 026 do banco ainda não aplicada; nada conferido.'; }
  const r = mensagemCarteira(q.rows.map((x): LinhaCarteira => ({ escritorio: String(x.tenant_name), pendentes: Number(x.sitfis_pendentes) || 0, aConferir: Number(x.sitfis_a_conferir) || 0, novas: Number(x.caixa_postal_novas) || 0, atrasadas: Number(x.parcelas_atrasadas) || 0 })));
  if (r.alerta) throw new Error(r.texto);
  return r.texto;
}

export interface LinhaCertificado { escritorio: string; vencidos: number; vence7: number; vence15: number; vence30: number; semValidade: number }
export function mensagemCertificados(l: LinhaCertificado[]): { texto: string; alerta: boolean } {
  if (l.length === 0) return { texto: 'Tudo em ordem: nenhum certificado A1 vencido ou vencendo nos próximos 30 dias.', alerta: false };
  const resumo = `${soma(l, (x) => x.vencidos)} certificado(s) A1 vencido(s), ${soma(l, (x) => x.vence7)} vencendo em até 7 dias, ${soma(l, (x) => x.vence15)} em até 15 e ${soma(l, (x) => x.vence30)} em até 30`;
  const sem = soma(l, (x) => x.semValidade);
  const extra = sem ? `; ${sem} sem validade registrada (abra a Carteira fiscal do escritório para o sistema ler a validade do arquivo)` : '';
  const urgentes = l.filter((x) => x.vencidos > 0 || x.vence7 > 0);
  if (urgentes.length === 0) return { texto: `Atenção sem urgência: ${resumo}${extra}.`, alerta: false };
  const quem = urgentes.slice(0, 5).map((x) => `${x.escritorio} (${x.vencidos} vencido(s), ${x.vence7} em até 7 dias)`).join('; ');
  return { texto: `ATENÇÃO: ${resumo}${extra}. Mais urgentes: ${quem}${urgentes.length > 5 ? '; e outros' : ''}.`, alerta: true };
}
export async function conferirCertificadosA1(pool: Pool | null, hoje: string = hojeBrasilia()): Promise<string> {
  if (!pool) return 'Banco indisponível; nada conferido.';
  const adm = await adminId(pool);
  if (!adm) return 'Sem conta administradora; nada conferido.';
  let q;
  try { q = await pool.query('SELECT * FROM fiscoia.platform_certificados_vencimento($1::uuid, $2::date)', [adm, hoje]); }
  catch { return 'Atualização 026 do banco ainda não aplicada; nada conferido.'; }
  const r = mensagemCertificados(q.rows.map((x): LinhaCertificado => ({ escritorio: String(x.tenant_name), vencidos: Number(x.vencidos) || 0, vence7: Number(x.vence_em_7) || 0, vence15: Number(x.vence_em_15) || 0, vence30: Number(x.vence_em_30) || 0, semValidade: Number(x.sem_validade) || 0 })));
  if (r.alerta) throw new Error(r.texto);
  return r.texto;
}

export interface LinhaAgenda { escritorio: string; vencidos: number; hoje: number }
export function mensagemAgenda(l: LinhaAgenda[]): { texto: string; alerta: boolean } {
  if (l.length === 0) return { texto: 'Tudo em ordem: nenhum lembrete da Agenda Fiscal vencido ou vencendo hoje.', alerta: false };
  const quem = l.slice(0, 5).map((x) => `${x.escritorio} (${x.vencidos} vencido(s), ${x.hoje} hoje)`).join('; ');
  return { texto: `ATENÇÃO: ${soma(l, (x) => x.vencidos)} lembrete(s) vencido(s) e ${soma(l, (x) => x.hoje)} vencendo hoje na Agenda Fiscal. Escritórios: ${quem}${l.length > 5 ? '; e outros' : ''}.`, alerta: true };
}
export async function conferirAgendaFiscal(pool: Pool | null, hoje: string = hojeBrasilia()): Promise<string> {
  if (!pool) return 'Banco indisponível; nada conferido.';
  const adm = await adminId(pool);
  if (!adm) return 'Sem conta administradora; nada conferido.';
  let q;
  try { q = await pool.query('SELECT * FROM fiscoia.platform_agenda_vencidos($1::uuid, $2::date)', [adm, hoje]); }
  catch { return 'Atualização 026 do banco ainda não aplicada; nada conferido.'; }
  const r = mensagemAgenda(q.rows.map((x): LinhaAgenda => ({ escritorio: String(x.tenant_name), vencidos: Number(x.vencidos) || 0, hoje: Number(x.vence_hoje) || 0 })));
  if (r.alerta) throw new Error(r.texto);
  return r.texto;
}
