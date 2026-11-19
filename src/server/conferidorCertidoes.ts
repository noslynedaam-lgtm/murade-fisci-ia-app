// Robô conferidor do vencimento das certidões guardadas. Só LÊ o que já foi guardado: não consulta nenhum órgão, não gasta crédito do Serpro
// e não altera nada. Avisa 30, 15 e 7 dias antes e quando venceu. O dono do sistema vê só CONTAGENS por escritório (nunca empresa nem número).
import type { Pool } from 'pg';
import { hojeBrasilia } from '../services/certidoes/certidoes';

export interface LinhaVencimento { escritorio: string; vencidas: number; vence7: number; vence15: number; vence30: number }

export function mensagemVencimentos(linhas: LinhaVencimento[]): { texto: string; alerta: boolean } {
  const urgentes = linhas.filter((l) => l.vencidas > 0 || l.vence7 > 0);
  if (linhas.length === 0) return { texto: 'Tudo em ordem: nenhuma certidão guardada vencida ou vencendo nos próximos 30 dias.', alerta: false };
  const soma = (f: (l: LinhaVencimento) => number) => linhas.reduce((s, l) => s + f(l), 0);
  const resumo = `${soma((l) => l.vencidas)} vencida(s), ${soma((l) => l.vence7)} vencendo em até 7 dias, ${soma((l) => l.vence15)} em até 15 e ${soma((l) => l.vence30)} em até 30`;
  if (urgentes.length === 0) return { texto: `Atenção sem urgência: ${resumo}.`, alerta: false };
  const quem = urgentes.slice(0, 5).map((l) => `${l.escritorio} (${l.vencidas} vencida(s), ${l.vence7} em até 7 dias)`).join('; ');
  return { texto: `ATENÇÃO: ${resumo}. Mais urgentes: ${quem}${urgentes.length > 5 ? '; e outros' : ''}.`, alerta: true };
}

/** Roda a conferência. Lança erro com o aviso quando há certidão vencida ou vencendo em até 7 dias, para aparecer em "robôs" como alerta. */
export async function conferirVencimentoCertidoes(pool: Pool | null, hoje: string = hojeBrasilia()): Promise<string> {
  if (!pool) return 'Banco indisponível; nada conferido.';
  const adm = await pool.query(`SELECT id FROM fiscoia.users WHERE active = true AND is_admin = true ORDER BY id LIMIT 1`);
  if (!adm.rows[0]) return 'Sem conta administradora; nada conferido.';
  let q;
  try { q = await pool.query('SELECT * FROM fiscoia.platform_certidoes_vencimento($1::uuid, $2::date)', [adm.rows[0].id, hoje]); }
  catch { return 'Atualização 022 do banco ainda não aplicada; nada conferido.'; }
  const r = mensagemVencimentos(q.rows.map((x): LinhaVencimento => ({ escritorio: String(x.tenant_name), vencidas: Number(x.vencidas) || 0, vence7: Number(x.vence_em_7) || 0, vence15: Number(x.vence_em_15) || 0, vence30: Number(x.vence_em_30) || 0 })));
  if (r.alerta) throw new Error(r.texto);
  return r.texto;
}
