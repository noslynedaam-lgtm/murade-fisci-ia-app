import type { Pool } from 'pg';
import { urlDoSistema } from './agentesEntreSistemas';
import { lerEmpresasDoFiscal } from './empresasDoFiscal';
import { normalizarCnpj, validarCnpj } from '../services/cnpj/cnpjValidation';

// Exclusão de empresa em cascata entre os sistemas Murade (lado do Fisco IA).
// - Excluir aqui = ARQUIVAR (nada é apagado: documentos e certificados ficam guardados) e avisar o hub do Fiscal,
//   que apaga nos outros sistemas e guarda a "lápide" do CNPJ.
// - O hub do Fiscal também chama o Fisco IA (DELETE /api/integracao/empresa/:cnpj) para arquivar aqui o que foi excluído lá.
// - Nunca bloqueia CNPJ: quem quiser, cadastra de novo manualmente.

/** Arquiva todo cadastro ATIVO deste CNPJ em todos os escritórios. Idempotente. Usa a função do banco (SECURITY DEFINER). */
export async function arquivarPorCnpj(pool: Pick<Pool, 'query'>, cnpj: string, origem: string): Promise<number> {
  const limpo = normalizarCnpj(cnpj);
  if (!validarCnpj(limpo)) throw new Error('CNPJ inválido.');
  const r = await pool.query('SELECT fiscoia.platform_archive_companies_by_cnpj($1::text, $2::text) AS n', [limpo, origem]);
  return Number(r.rows[0]?.n) || 0;
}

export function origemValida(bruta: unknown): string {
  const o = typeof bruta === 'string' ? bruta.trim().toLowerCase() : '';
  return /^[a-z0-9_-]{1,40}$/.test(o) ? o : 'integracao';
}

export interface ResultadoCascata { situacao: 'ok' | 'falhou' | 'nao_configurada'; mensagem: string }

/** Avisa o hub do Fiscal (best-effort, prazo curto). Nunca lança: a falha vira aviso para a tela. */
export async function avisarHubDoFiscal(cnpj: string, por: string, env: Record<string, string | undefined> = process.env, buscar: typeof fetch = fetch, prazoMs = 8000): Promise<ResultadoCascata> {
  const limpo = normalizarCnpj(cnpj);
  const token = env.MURADE_INTEGRATION_TOKEN?.trim();
  if (!token) return { situacao: 'nao_configurada', mensagem: 'A ligação com o Murad Fiscal não está configurada (token de integração). Apague a empresa também no Fiscal.' };
  if (!validarCnpj(limpo)) return { situacao: 'falhou', mensagem: 'CNPJ inválido; nada foi enviado ao Fiscal.' };
  try {
    const r = await buscar(`${urlDoSistema('fiscal', env)}/api/integracao/empresa/${limpo}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ origem: 'fiscoia', por: String(por || '').slice(0, 120) }),
      signal: AbortSignal.timeout(prazoMs),
    });
    const j: any = await r.json().catch(() => ({}));
    if (r.ok && j?.sucesso !== false) return { situacao: 'ok', mensagem: typeof j?.mensagem === 'string' && j.mensagem ? j.mensagem.slice(0, 300) : 'Cadastro apagado no Fiscal, DP e Contábil.' };
    return { situacao: 'falhou', mensagem: `O Murad Fiscal não confirmou a exclusão (HTTP ${r.status}). Apague também no Fiscal para completar.` };
  } catch {
    return { situacao: 'falhou', mensagem: 'Não foi possível falar com o Murad Fiscal agora (fora do ar ou demorou demais). Apague também no Fiscal para completar.' };
  }
}

export interface DivergenciasExclusao { arquivadoAquiAtivoNoFiscal: string[]; ativoAquiAusenteNoFiscal: string[] }

/**
 * Compara, só em leitura:
 *  - CNPJ arquivado aqui (sem cadastro ativo em nenhum escritório) que o Fiscal ainda lista como ativo;
 *  - CNPJ ativo aqui que o robô trouxe do Fiscal (origem murade-fiscal) e o Fiscal já não lista (excluído lá).
 * Empresa cadastrada à mão aqui e que nunca existiu no Fiscal não é divergência.
 */
export function compararExclusoes(arquivadosAqui: Set<string>, ativosAqui: Map<string, boolean>, ativosNoFiscal: Set<string>): DivergenciasExclusao {
  return {
    arquivadoAquiAtivoNoFiscal: [...arquivadosAqui].filter((c) => !ativosAqui.has(c) && ativosNoFiscal.has(c)).sort(),
    ativoAquiAusenteNoFiscal: [...ativosAqui].filter(([c, veioDoFiscal]) => veioDoFiscal && !ativosNoFiscal.has(c)).map(([c]) => c).sort(),
  };
}

export function mensagemDivergencias(d: DivergenciasExclusao): string {
  if (!d.arquivadoAquiAtivoNoFiscal.length && !d.ativoAquiAusenteNoFiscal.length) return 'Tudo em ordem: nenhuma empresa excluída em um sistema e ainda ativa em outro.';
  const partes: string[] = [];
  if (d.arquivadoAquiAtivoNoFiscal.length) partes.push(`${d.arquivadoAquiAtivoNoFiscal.length} CNPJ arquivado(s) aqui e ainda ativo(s) no Fiscal: ${d.arquivadoAquiAtivoNoFiscal.slice(0, 5).join(', ')}${d.arquivadoAquiAtivoNoFiscal.length > 5 ? ' e outros' : ''}`);
  if (d.ativoAquiAusenteNoFiscal.length) partes.push(`${d.ativoAquiAusenteNoFiscal.length} CNPJ ativo(s) aqui (trazido(s) do Fiscal) que o Fiscal não lista mais: ${d.ativoAquiAusenteNoFiscal.slice(0, 5).join(', ')}${d.ativoAquiAusenteNoFiscal.length > 5 ? ' e outros' : ''}`);
  return `ATENÇÃO: ${partes.join('; ')}. Nada foi alterado: confira e apague (ou recadastre) onde faltar.`;
}

/** Robô conferidor. Só lê. Lança erro com o aviso quando acha divergência, para aparecer como alerta em "robôs". */
export async function conferirExclusoes(pool: Pick<Pool, 'query'> | null, env: Record<string, string | undefined> = process.env, buscar: typeof fetch = fetch): Promise<string> {
  if (!pool) return 'Banco indisponível; nada conferido.';
  if (!env.MURADE_INTEGRATION_TOKEN?.trim()) return 'Ligação com o Fiscal não configurada; nada conferido.';
  let arquivados: Set<string>; let ativos: Map<string, boolean>;
  try {
    arquivados = new Set((await pool.query('SELECT cnpj FROM fiscoia.platform_archived_cnpjs()')).rows.map((x: any) => String(x.cnpj).trim()));
    ativos = new Map((await pool.query('SELECT cnpj, veio_do_fiscal FROM fiscoia.platform_active_cnpjs()')).rows.map((x: any) => [String(x.cnpj).trim(), x.veio_do_fiscal === true] as [string, boolean]));
  } catch { return 'Atualização 022 do banco ainda não aplicada; nada conferido.'; }
  const doFiscal = await lerEmpresasDoFiscal(env, buscar); // se o Fiscal não responder, o robô registra a falha
  const noFiscal = new Set(doFiscal.map((e) => e.cnpj).filter((c) => validarCnpj(c)));
  const texto = mensagemDivergencias(compararExclusoes(arquivados, ativos, noFiscal));
  if (texto.startsWith('ATENÇÃO')) throw new Error(texto);
  return texto;
}

/** Decide, entre as empresas de UM escritório, o que existe para este CNPJ: cadastro ativo, só arquivado (excluído) ou nada. */
export function situacaoDoCnpjNoEscritorio<T extends { cnpj: unknown; arquivada: unknown }>(linhas: T[], cnpj: string): { tipo: 'ativa'; linha: T } | { tipo: 'arquivada' } | { tipo: 'nenhuma' } {
  const mesmas = linhas.filter((x) => normalizarCnpj(String(x.cnpj)) === cnpj);
  const ativa = mesmas.find((x) => x.arquivada !== true);
  if (ativa) return { tipo: 'ativa', linha: ativa };
  return mesmas.length ? { tipo: 'arquivada' } : { tipo: 'nenhuma' };
}
