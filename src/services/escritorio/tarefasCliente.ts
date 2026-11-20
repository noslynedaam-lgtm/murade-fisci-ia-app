/** Leitura e gravação (na tela) das coleções do escritório que ficam só no servidor: tarefas da equipe, DT-e e configuração do relatório. */
import type { TarefaEquipe } from './tarefasEquipe';

export async function lerColecao<T>(tenantId: string, colecao: 'tarefas_equipe' | 'dte_go' | 'relatorio_cliente'): Promise<{ chave: string; dados: T }[]> {
  const r = await fetch(`/api/escritorio/dados?tenantId=${encodeURIComponent(tenantId)}&colecao=${colecao}`, { credentials: 'same-origin', cache: 'no-store' });
  const d = await r.json().catch(() => ({})) as { itens?: { chave: string; dados: T }[]; mensagem?: string };
  if (!r.ok) throw new Error(d.mensagem || 'Não foi possível ler os dados do escritório.');
  return d.itens ?? [];
}

/** Grava (ou apaga) itens. Lança erro com a mensagem do servidor se algo for recusado. */
export async function gravarColecao(tenantId: string, colecao: 'tarefas_equipe' | 'dte_go' | 'relatorio_cliente' | 'agenda_lembretes', gravar: { chave: string; dados: unknown }[], apagar: string[] = []): Promise<void> {
  const r = await fetch('/api/escritorio/dados/sincronizar', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, colecao, gravar, apagar }) });
  const d = await r.json().catch(() => ({})) as { recusados?: { motivo: string }[]; mensagem?: string };
  if (!r.ok) throw new Error(d.mensagem || 'Não foi possível salvar.');
  if (d.recusados?.length) throw new Error(d.recusados[0].motivo);
  window.dispatchEvent(new CustomEvent('fiscoia_tarefas_atualizadas'));
}

export const EVENTO_TAREFAS = 'fiscoia_tarefas_atualizadas';
export async function lerTarefas(tenantId: string): Promise<TarefaEquipe[]> {
  return (await lerColecao<TarefaEquipe>(tenantId, 'tarefas_equipe')).map((i) => i.dados).filter((t) => t && typeof t.titulo === 'string');
}
