// Robô conferidor da trava do Serpro: confere, sem consultar nada, se alguma empresa usou o Serpro sem estar liberada
// e avisa quantas estão esperando liberação. Só lê o que já foi registrado; nunca libera, trava nem consulta.
import type { Pool } from 'pg';

export interface LinhaAuditoria { escritorio: string; empresa: string; liberada: boolean; pediuEm: string | null; consultasRecentes: number }
export interface ResumoLiberacoes { empresasComUso: number; usoSemLiberacao: LinhaAuditoria[]; aguardandoLiberacao: number }

export function resumirAuditoria(linhas: LinhaAuditoria[]): ResumoLiberacoes {
  return {
    empresasComUso: linhas.filter(l => l.consultasRecentes > 0).length,
    usoSemLiberacao: linhas.filter(l => l.consultasRecentes > 0 && !l.liberada),
    aguardandoLiberacao: linhas.filter(l => !l.liberada && l.pediuEm !== null).length,
  };
}

export function mensagemDoResumo(r: ResumoLiberacoes, dias: number): string {
  if (r.usoSemLiberacao.length === 0) return `Tudo em ordem: nenhuma empresa usou o Serpro sem liberação nos últimos ${dias} dias. ${r.aguardandoLiberacao} aguardando liberação.`;
  const quem = r.usoSemLiberacao.slice(0, 5).map(l => `${l.empresa} (${l.escritorio}, ${l.consultasRecentes} consulta(s))`).join('; ');
  return `ATENÇÃO: ${r.usoSemLiberacao.length} empresa(s) usaram o Serpro sem estar liberadas nos últimos ${dias} dias: ${quem}${r.usoSemLiberacao.length > 5 ? '; e outras' : ''}.`;
}

/** Roda a conferência. Lança erro com o aviso quando acha uso sem liberação, para aparecer em "robôs" como alerta. */
export async function conferirLiberacoesSerpro(pool: Pool | null, dias = 7): Promise<string> {
  if (!pool) return 'Banco indisponível; nada conferido.';
  const adm = await pool.query(`SELECT id FROM fiscoia.users WHERE active = true AND is_admin = true ORDER BY id LIMIT 1`);
  if (!adm.rows[0]) return 'Sem conta administradora; nada conferido.';
  let q;
  try { q = await pool.query('SELECT * FROM fiscoia.platform_serpro_gate_audit($1::uuid, $2::int)', [adm.rows[0].id, dias]); }
  catch { return 'Atualização 017 do banco ainda não aplicada; nada conferido (a trava continua valendo: sem liberação, ninguém consulta).'; }
  const resumo = resumirAuditoria(q.rows.map((x): LinhaAuditoria => ({ escritorio: String(x.tenant_name), empresa: String(x.legal_name), liberada: x.released === true, pediuEm: x.requested_at ? new Date(x.requested_at).toISOString() : null, consultasRecentes: Number(x.consultas_recentes) || 0 })));
  const texto = mensagemDoResumo(resumo, dias);
  if (resumo.usoSemLiberacao.length > 0) throw new Error(texto);
  return texto;
}
