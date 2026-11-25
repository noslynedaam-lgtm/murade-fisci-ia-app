import { useEffect, useRef } from 'react';
import { ControleVoltar, type HistoricoNavegador } from '../utils/voltarCelular';

// Botão VOLTAR do celular/navegador dentro do sistema (regras em utils/voltarCelular.ts).
// Liga na tela atual que o App já guarda; não troca o roteamento. O voltar só troca de tela ou fecha o que está por cima:
// nunca salva, transmite ou apaga nada.

interface OpcoesVoltarCelular {
  /** Tela/aba que o App mostra agora. */
  telaAtual: string;
  /** Tela inicial do sistema (na entrada em que o app abriu, o voltar sai do app). */
  telaInicial: string;
  /** Abre a tela pedida pelo voltar, do mesmo jeito que o menu abre. */
  irParaTela: (tela: string) => void;
  /** Desligado antes do login, por exemplo. */
  ativo?: boolean;
  /** Telas de passagem que redirecionam na hora (não entram no histórico). */
  telasSemHistorico?: readonly string[];
}

/** Janela de confirmação/diálogo modal aberta fora do controle do App (ex.: "confirmar exclusão"): fecha como o Esc (cancelar). */
function fecharDialogoSolto(): boolean {
  if (typeof document === 'undefined') return false;
  const lista = document.querySelectorAll('[aria-modal="true"],[role="alertdialog"]');
  for (let i = lista.length - 1; i >= 0; i--) {
    const el = lista[i];
    if (el.getClientRects().length === 0 || el.closest('[data-piloto-ui]')) continue;
    try { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true })); } catch { /* ignora */ }
    return true;
  }
  return false;
}

const historicoReal: HistoricoNavegador = {
  get state() { return window.history.state; },
  pushState: (e) => window.history.pushState(e, ''),
  replaceState: (e) => window.history.replaceState(e, ''),
  back: () => window.history.back(),
};

let controle: ControleVoltar | null = null;
function controleDaPagina(): ControleVoltar | null {
  if (typeof window === 'undefined' || !window.history) return null;
  if (!controle) controle = new ControleVoltar(historicoReal, () => Date.now(), (f) => { window.setTimeout(f, 0); }, fecharDialogoSolto);
  return controle;
}

export function useVoltarCelular({ telaAtual, telaInicial, irParaTela, ativo = true, telasSemHistorico }: OpcoesVoltarCelular): void {
  const irRef = useRef(irParaTela);
  irRef.current = irParaTela;

  // Liga o voltar: marca a entrada atual do histórico e escuta o botão voltar e os toques (o Chrome só respeita entradas criadas por toque).
  useEffect(() => {
    const c = controleDaPagina();
    if (!ativo || !c) return;
    try { c.ligar({ telaAtual, telaInicial, irParaTela: (t) => irRef.current(t), telasSemHistorico }); } catch { return; }
    const aoVoltar = (ev: PopStateEvent) => { try { c.aoVoltar(ev.state); } catch { /* o voltar nunca trava */ } };
    const aoTocar = (e: Event) => { if (e.isTrusted) c.toque(); };
    window.addEventListener('popstate', aoVoltar);
    window.addEventListener('pointerdown', aoTocar, true);
    window.addEventListener('keydown', aoTocar, true);
    window.addEventListener('click', aoTocar, true);
    return () => {
      window.removeEventListener('popstate', aoVoltar);
      window.removeEventListener('pointerdown', aoTocar, true);
      window.removeEventListener('keydown', aoTocar, true);
      window.removeEventListener('click', aoTocar, true);
      c.desligar();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  useEffect(() => { controleDaPagina()?.atualizar({ telaInicial, telasSemHistorico }); }, [telaInicial, telasSemHistorico]);

  // Cada troca de tela entra no histórico (uma vez só por troca; re-render não empilha).
  useEffect(() => {
    const c = controleDaPagina();
    if (!ativo || !c?.ligado) return;
    try { c.telaMudou(telaAtual); } catch { /* ignora */ }
  }, [telaAtual, ativo]);
}

/**
 * Algo aberto por cima da tela (menu do celular, janela, painel da Agente) ou uma parte interna da tela (ficha aberta,
 * aba): o voltar fecha isso primeiro. Aberto por um toque, ganha a própria entrada no histórico.
 */
export function useFecharNoVoltar(aberto: boolean, fechar: () => void): void {
  const fecharRef = useRef(fechar);
  fecharRef.current = fechar;
  useEffect(() => {
    const c = controleDaPagina();
    if (!aberto || !c) return;
    return c.abrirCamada(() => fecharRef.current());
  }, [aberto]);
}
