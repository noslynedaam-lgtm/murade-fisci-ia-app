const CHAVE_MONITOR_PAUSADO = 'fiscoia_monitor_carteira_pausado';
export const EVENTO_MONITOR_PENDENCIAS_ATUALIZADO = 'fiscoia_monitor_pausado';

/** O padrão é ativo; falha de storage não deve derrubar a interface. */
export function monitorPendenciasAtivo(): boolean {
  try {
    return localStorage.getItem(CHAVE_MONITOR_PAUSADO) !== 'true';
  } catch {
    return true;
  }
}

/** Persiste a preferência e avisa as telas abertas no mesmo contexto. */
export function definirMonitorPendenciasAtivo(ativo: boolean): boolean {
  try {
    localStorage.setItem(CHAVE_MONITOR_PAUSADO, String(!ativo));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_MONITOR_PENDENCIAS_ATUALIZADO));
    return true;
  } catch {
    return false;
  }
}
