// Tamanho da letra do sistema: cada pessoa escolhe (fica guardado neste aparelho). Sem escolha, o padrão é um pouco maior no computador.
export const NIVEIS_LETRA = [100, 106.25, 112.5, 118.75, 125, 137.5, 150] as const;
/** Padrão sem escolha: computador 118,75% (19 px), celular 106,25% (17 px). */
const PADRAO_COMPUTADOR = 118.75;
const PADRAO_CELULAR = 106.25;
const CHAVE = 'murade_tamanho_letra';

export function lerEscolhaLetra(): number | null {
  try {
    const v = Number(localStorage.getItem(CHAVE));
    return (NIVEIS_LETRA as readonly number[]).includes(v) ? v : null;
  } catch { return null; }
}

export function tamanhoLetraAtual(): number {
  const escolha = lerEscolhaLetra();
  if (escolha) return escolha;
  return typeof window !== 'undefined' && window.innerWidth >= 768 ? PADRAO_COMPUTADOR : PADRAO_CELULAR;
}

export function aplicarTamanhoLetra(percentual: number = tamanhoLetraAtual()): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.fontSize = `${percentual}%`;
}

export function mudarTamanhoLetra(passo: -1 | 1 | 0): number {
  const atual = tamanhoLetraAtual();
  const idx = Math.max(0, (NIVEIS_LETRA as readonly number[]).indexOf(atual));
  const novo = passo === 0 ? (typeof window !== 'undefined' && window.innerWidth >= 768 ? PADRAO_COMPUTADOR : PADRAO_CELULAR) : NIVEIS_LETRA[Math.min(NIVEIS_LETRA.length - 1, Math.max(0, idx + passo))];
  try { if (passo === 0) localStorage.removeItem(CHAVE); else localStorage.setItem(CHAVE, String(novo)); } catch { /* sem armazenamento: vale só nesta tela */ }
  aplicarTamanhoLetra(novo);
  return novo;
}
