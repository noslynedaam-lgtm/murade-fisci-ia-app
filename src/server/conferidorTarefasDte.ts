// Robô conferidor das tarefas da equipe e do checklist do DT-e de Goiás. Só LÊ o que já está guardado (pela função protegida
// do banco): não entra no DT-e, não consulta órgão, não gasta nada e não altera nada. O dono vê só CONTAGENS por escritório.
// Quando há tarefa atrasada ou empresa de Goiás sem procuração/e-mail/credenciamento no DT-e, lança erro para virar alerta na lista de robôs.
import type { Pool } from 'pg';
import { hojeBrasilia } from '../services/certidoes/certidoes';

export interface LinhaTarefasDte { escritorio: string; abertas: number; atrasadas: number; semProcuracao: number; semEmail: number; naoCredenciada: number; revisao: number }
const soma = (l: LinhaTarefasDte[], f: (x: LinhaTarefasDte) => number) => l.reduce((s, x) => s + f(x), 0);

export function mensagemTarefasDte(l: LinhaTarefasDte[]): { texto: string; alerta: boolean } {
  if (l.length === 0) return { texto: 'Tudo em ordem: nenhuma tarefa da equipe em aberto e nada faltando no checklist do DT-e de Goiás.', alerta: false };
  const resumo = `${soma(l, (x) => x.abertas)} tarefa(s) em aberto (${soma(l, (x) => x.atrasadas)} atrasada(s)); DT-e Goiás: ${soma(l, (x) => x.semProcuracao)} empresa(s) sem procuração para o escritório, ${soma(l, (x) => x.semEmail)} sem o e-mail do escritório, ${soma(l, (x) => x.naoCredenciada)} não credenciada(s) e ${soma(l, (x) => x.revisao)} lembrete(s) de conferir a caixa vencido(s)`;
  const urgentes = l.filter((x) => x.atrasadas > 0 || x.semProcuracao > 0 || x.semEmail > 0 || x.naoCredenciada > 0 || x.revisao > 0);
  if (urgentes.length === 0) return { texto: `Sem urgência: ${resumo}.`, alerta: false };
  const quem = urgentes.slice(0, 5).map((x) => `${x.escritorio} (${x.atrasadas} tarefa(s) atrasada(s), ${x.semProcuracao + x.semEmail + x.naoCredenciada} item(ns) do DT-e faltando, ${x.revisao} lembrete(s))`).join('; ');
  return { texto: `ATENÇÃO: ${resumo}. Escritórios: ${quem}${urgentes.length > 5 ? '; e outros' : ''}. O sistema não entra no DT-e; a equipe confere a caixa pelo portal.`, alerta: true };
}

export async function conferirTarefasEDte(pool: Pool | null, hoje: string = hojeBrasilia()): Promise<string> {
  if (!pool) return 'Banco indisponível; nada conferido.';
  const adm = await pool.query(`SELECT id FROM fiscoia.users WHERE active = true AND is_admin = true ORDER BY id LIMIT 1`);
  if (!adm.rows[0]) return 'Sem conta administradora; nada conferido.';
  let q;
  try { q = await pool.query('SELECT * FROM fiscoia.platform_tarefas_dte($1::uuid, $2::date)', [String(adm.rows[0].id), hoje]); }
  catch { return 'Atualização 028 do banco ainda não aplicada; nada conferido.'; }
  const r = mensagemTarefasDte(q.rows.map((x): LinhaTarefasDte => ({ escritorio: String(x.tenant_name), abertas: Number(x.tarefas_abertas) || 0, atrasadas: Number(x.tarefas_atrasadas) || 0, semProcuracao: Number(x.dte_sem_procuracao) || 0, semEmail: Number(x.dte_sem_email) || 0, naoCredenciada: Number(x.dte_nao_credenciada) || 0, revisao: Number(x.dte_revisao_vencida) || 0 })));
  if (r.alerta) throw new Error(r.texto);
  return r.texto;
}
