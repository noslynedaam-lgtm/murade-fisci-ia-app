/**
 * Tarefas da equipe do escritório (lista simples, guardada no servidor por escritório, na coleção "tarefas_equipe").
 * Criadas à mão, a partir de uma pendência do relatório do cliente, do checklist do DT-e de Goiás ou pela Agente (com confirmação).
 * Peças puras: validação, chave sem duplicar e contagens. Sem rede e sem banco.
 */
export const ORIGENS_TAREFA = ['manual', 'relatorio_cliente', 'dte_go', 'agente'] as const;
export type OrigemTarefa = typeof ORIGENS_TAREFA[number];

export interface TarefaEquipe {
  id: string;
  titulo: string;
  empresaId: string;
  empresa: string;
  cnpj: string;
  origem: OrigemTarefa;
  prazo: string | null;
  concluida: boolean;
  criadaEm: string;
  concluidaEm?: string | null;
  obs?: string | null;
}

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function dataValida(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** Motivo da recusa, ou null se a tarefa estiver certa. */
export function validarTarefa(chave: string, dados: unknown): string | null {
  if (!obj(dados) || dados.id !== chave) return 'Tarefa inválida.';
  if (typeof dados.titulo !== 'string' || dados.titulo.trim().length < 3 || dados.titulo.length > 200) return 'Escreva a tarefa (de 3 a 200 letras).';
  if (typeof dados.empresaId !== 'string' || typeof dados.empresa !== 'string' || typeof dados.cnpj !== 'string') return 'Empresa da tarefa inválida.';
  if (dados.empresa.length > 200 || dados.cnpj.length > 20 || dados.empresaId.length > 60) return 'Empresa da tarefa inválida.';
  if (!(ORIGENS_TAREFA as readonly string[]).includes(String(dados.origem))) return 'Origem da tarefa inválida.';
  if (dados.prazo !== null && !dataValida(dados.prazo)) return 'Prazo inválido.';
  if (typeof dados.concluida !== 'boolean') return 'Tarefa sem a marca de concluída.';
  if (typeof dados.criadaEm !== 'string' || !Number.isFinite(Date.parse(dados.criadaEm))) return 'Data de criação inválida.';
  if (dados.obs !== undefined && dados.obs !== null && (typeof dados.obs !== 'string' || dados.obs.length > 1000)) return 'Observação inválida.';
  return null;
}

/**
 * Chave da tarefa. Tarefa que nasce de uma pendência (relatório ou DT-e) tem chave fixa por empresa e pendência,
 * para clicar duas vezes não criar duas tarefas iguais. Tarefa manual ganha chave única.
 */
export function chaveTarefa(origem: OrigemTarefa, empresaId: string, codigo: string | null, aleatorio: string): string {
  const limpa = (s: string) => s.replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 60);
  if ((origem === 'relatorio_cliente' || origem === 'dte_go') && codigo) return `${origem === 'dte_go' ? 'dte' : 'rc'}-${limpa(empresaId)}-${limpa(codigo)}`.slice(0, 120);
  return `t-${limpa(aleatorio)}`.slice(0, 120);
}

export function novaTarefa(p: { origem: OrigemTarefa; titulo: string; empresaId?: string; empresa?: string; cnpj?: string; prazo?: string | null; codigo?: string | null; agora?: Date; aleatorio?: string }): TarefaEquipe {
  const agora = p.agora ?? new Date();
  const aleatorio = p.aleatorio ?? `${agora.getTime().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return {
    id: chaveTarefa(p.origem, p.empresaId ?? '', p.codigo ?? null, aleatorio),
    titulo: p.titulo.trim().slice(0, 200), empresaId: p.empresaId ?? '', empresa: p.empresa ?? '', cnpj: p.cnpj ?? '',
    origem: p.origem, prazo: p.prazo && dataValida(p.prazo) ? p.prazo : null, concluida: false, criadaEm: agora.toISOString(), concluidaEm: null, obs: null,
  };
}

/** Abertas, atrasadas (prazo antes de hoje) e para hoje. hoje = AAAA-MM-DD. */
export function contarTarefas(lista: unknown[], hoje: string): { abertas: number; atrasadas: number; hoje: number; concluidas: number } {
  const t = lista.filter(obj);
  const abertas = t.filter((x) => x.concluida !== true);
  return {
    abertas: abertas.length,
    atrasadas: abertas.filter((x) => dataValida(x.prazo) && (x.prazo as string) < hoje).length,
    hoje: abertas.filter((x) => x.prazo === hoje).length,
    concluidas: t.length - abertas.length,
  };
}
