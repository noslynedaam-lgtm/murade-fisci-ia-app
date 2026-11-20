/**
 * Dados do escritório que antes ficavam só no navegador (Agenda Fiscal, Relatório de Conformidade, Guias INSS/DCTFWeb) e agora
 * ficam no servidor, por escritório, para toda a equipe ver a mesma coisa. Peças puras: validação e comparação, sem rede.
 */
import { validarTarefa } from './tarefasEquipe';
import { validarChecklist } from '../dte/dteGoias';
import { validarConfigRelatorio } from '../relatorio/relatorioCliente';

export const COLECOES = ['agenda_lembretes', 'compliance_status', 'guias_receita', 'relatorio_cliente', 'tarefas_equipe', 'dte_go'] as const;
export type Colecao = typeof COLECOES[number];
export const ehColecao = (v: unknown): v is Colecao => typeof v === 'string' && (COLECOES as readonly string[]).includes(v);

export const CHAVE_VALIDA = /^[A-Za-z0-9_./:-]{1,120}$/;
export const LIMITE_ITEM_BYTES = 262_144;
export const LIMITE_ITENS_POR_ENVIO = 500;

function dataValida(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Confere um item antes de gravar. Devolve o motivo da recusa ou null se estiver certo. */
export function validarItem(colecao: Colecao, chave: unknown, dados: unknown): string | null {
  if (typeof chave !== 'string' || !CHAVE_VALIDA.test(chave)) return 'Identificador inválido.';
  let tamanho = 0;
  try { tamanho = new TextEncoder().encode(JSON.stringify(dados) ?? '').length; } catch { return 'Conteúdo inválido.'; }
  if (tamanho > LIMITE_ITEM_BYTES) return 'Registro grande demais.';
  if (colecao === 'agenda_lembretes') {
    if (!obj(dados) || dados.id !== chave) return 'Lembrete inválido.';
    if (typeof dados.titulo !== 'string' || !dados.titulo.trim() || dados.titulo.length > 100) return 'Título do lembrete inválido.';
    if (!dataValida(dados.dataVencimento)) return 'Data de vencimento inválida.';
    if (typeof dados.concluido !== 'boolean') return 'Lembrete sem a marca de concluído.';
    if (!Array.isArray(dados.alertas) || !dados.alertas.every((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 365)) return 'Avisos do lembrete inválidos.';
    if (typeof dados.empresa !== 'string' || typeof dados.cnpj !== 'string' || typeof dados.empresaId !== 'string') return 'Empresa do lembrete inválida.';
    return null;
  }
  if (colecao === 'compliance_status') {
    if (!obj(dados)) return 'Registro de conformidade inválido.';
    if (typeof dados.empresaId !== 'string' || typeof dados.cnpj !== 'string' || typeof dados.competencia !== 'string') return 'Registro de conformidade sem empresa ou competência.';
    if (typeof dados.dadosMesEnviados !== 'boolean' || typeof dados.dctfwebEnviada !== 'boolean' || typeof dados.cndEmitida !== 'boolean') return 'Registro de conformidade incompleto.';
    return null;
  }
  if (colecao === 'tarefas_equipe') return validarTarefa(chave, dados);
  if (colecao === 'dte_go') return validarChecklist(chave, dados);
  if (colecao === 'relatorio_cliente') return chave === 'config' ? validarConfigRelatorio(dados) : 'Configuração inválida.';
  // guias_receita: a chave é o CNPJ (14 caracteres) e o conteúdo é a lista de guias daquela empresa.
  if (!/^[A-Z0-9]{14}$/.test(chave)) return 'CNPJ inválido.';
  if (!Array.isArray(dados) || dados.length > 2000 || !dados.every((g) => obj(g) && typeof g.id === 'string' && typeof g.competencia === 'string')) return 'Lista de guias inválida.';
  return null;
}

/** O que mudou no navegador desde a última sincronização: itens novos/alterados para gravar e itens removidos para apagar. */
export function diferencas(local: Record<string, unknown>, base: Record<string, unknown>): { gravar: { chave: string; dados: unknown }[]; apagar: string[] } {
  const gravar: { chave: string; dados: unknown }[] = [];
  for (const [chave, dados] of Object.entries(local)) if (!(chave in base) || JSON.stringify(base[chave]) !== JSON.stringify(dados)) gravar.push({ chave, dados });
  const apagar = Object.keys(base).filter((k) => !(k in local));
  return { gravar, apagar };
}

/** Lembretes não concluídos já vencidos ou que vencem hoje (hoje em AAAA-MM-DD). */
export function lembretesQuePedemAtencao(itens: unknown[], hoje: string): { empresa: string; titulo: string; dataVencimento: string; dias: number }[] {
  const h = Date.parse(`${hoje}T00:00:00Z`);
  return itens.filter(obj).filter((l) => l.concluido !== true && dataValida(l.dataVencimento))
    .map((l) => ({ empresa: String(l.empresa ?? ''), titulo: String(l.titulo ?? ''), dataVencimento: String(l.dataVencimento), dias: Math.round((Date.parse(`${l.dataVencimento}T00:00:00Z`) - h) / 86_400_000) }))
    .filter((l) => l.dias <= 0).sort((a, b) => a.dias - b.dias);
}
