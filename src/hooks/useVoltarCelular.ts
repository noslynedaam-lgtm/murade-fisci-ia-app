import { useEffect, useRef } from 'react';
import {
  JANELA_REDIRECIONAMENTO_MS,
  JANELA_SAIR_MS,
  TEXTO_AVISO_SAIR,
  criarEstadoVoltar,
  decidirEmpilhar,
  decidirVoltar,
  deveTentarFecharDialogo,
  estadoAoAbrir,
  fecharUltimoPorCima,
  lerEstadoVoltar,
  quantosPorCima,
  registrarPorCima,
} from '../utils/voltarCelular';

// Botão VOLTAR do celular/navegador dentro do sistema (regras e decisão em utils/voltarCelular.ts).
// Liga na tela atual que o App já guarda; não troca o roteamento. O voltar só troca de tela ou fecha o que está por cima:
// nunca salva, transmite ou apaga nada.

interface OpcoesVoltarCelular {
  /** Tela/aba que o App mostra agora. */
  telaAtual: string;
  /** Tela inicial do sistema (onde o voltar avisa "aperte de novo para sair"). */
  telaInicial: string;
  /** Abre a tela pedida pelo voltar, do mesmo jeito que o menu abre. */
  irParaTela: (tela: string) => void;
  /** Desligado antes do login, por exemplo. */
  ativo?: boolean;
  /** Telas de passagem que redirecionam na hora (não entram no histórico). */
  telasSemHistorico?: readonly string[];
}

/** Janela de confirmação/diálogo modal aberta fora do controle do App (ex.: "confirmar exclusão"). */
function dialogoModalNaTela(): Element | null {
  const lista = document.querySelectorAll('[aria-modal="true"],[role="alertdialog"]');
  for (let i = lista.length - 1; i >= 0; i--) if (lista[i].getClientRects().length > 0) return lista[i];
  return null;
}

/** Fecha a janela como a tecla Esc faz (Esc = cancelar; nunca confirma nada). */
function apertarEsc(el: Element) {
  try { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true })); } catch { /* ignora */ }
}

// Tela de cada entrada do histórico criada nesta abertura da página (posição → tela). Serve só para reconhecer o
// "Voltar" da própria tela; se não souber (ex.: depois de recarregar), simplesmente empilha.
const telasPorPosicao = new Map<number, string>();
let ultimaPosicao = 0; // posição da última entrada do sistema em que a pessoa esteve

function empilharTela(tela: string) {
  const h = window.history;
  const n = (lerEstadoVoltar(h.state)?.n ?? ultimaPosicao) + 1;
  for (const k of [...telasPorPosicao.keys()]) if (k >= n) telasPorPosicao.delete(k);
  h.pushState(criarEstadoVoltar(tela, n), '');
  telasPorPosicao.set(n, tela);
  ultimaPosicao = n;
}

function lembrarEntradaAtual() {
  const lido = lerEstadoVoltar(window.history.state);
  if (!lido) return;
  ultimaPosicao = lido.n;
  if (!lido.base) telasPorPosicao.set(lido.n, lido.tela);
}

function criarAvisoSair(): HTMLDivElement {
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.textContent = TEXTO_AVISO_SAIR;
  el.style.cssText = 'position:fixed;left:50%;bottom:calc(72px + env(safe-area-inset-bottom, 0px));transform:translateX(-50%);z-index:2147483000;background:rgba(15,23,42,.92);color:#fff;padding:10px 18px;border-radius:999px;font:600 14px/1.3 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3);pointer-events:none;max-width:90vw;text-align:center';
  document.body.appendChild(el);
  return el;
}

export function useVoltarCelular({ telaAtual, telaInicial, irParaTela, ativo = true, telasSemHistorico }: OpcoesVoltarCelular): void {
  const atualRef = useRef({ telaAtual, telaInicial, irParaTela, telasSemHistorico });
  atualRef.current = { telaAtual, telaInicial, irParaTela, telasSemHistorico };
  const ultimoVoltarRef = useRef(0);

  // Liga o voltar: marca a entrada atual do histórico e escuta o botão voltar.
  useEffect(() => {
    if (!ativo || typeof window === 'undefined') return;
    const h = window.history;
    try { h.replaceState(estadoAoAbrir(h.state, atualRef.current.telaAtual, atualRef.current.telaInicial), ''); } catch { return; }
    lembrarEntradaAtual();

    let aviso: HTMLDivElement | null = null;
    let timerAviso = 0;
    let ultimoDialogo: Element | null = null;

    const esconderAviso = () => {
      if (timerAviso) window.clearTimeout(timerAviso);
      timerAviso = 0;
      aviso?.remove();
      aviso = null;
    };
    // Na entrada base (a de sair), põe a tela atual por cima de novo: assim o próximo voltar volta a avisar em vez de sair.
    const empilharSeNaBase = () => {
      if (!lerEstadoVoltar(h.state)?.base) return;
      const tela = atualRef.current.telaAtual;
      if (atualRef.current.telasSemHistorico?.includes(tela)) return;
      try { empilharTela(tela); } catch { /* ignora */ }
    };
    const aoInteragir = (e: Event) => {
      if (!e.isTrusted) return;
      ultimoVoltarRef.current = 0; // a pessoa mexeu: a próxima troca de tela é dela, não redirecionamento da tela
      esconderAviso();
      empilharSeNaBase();
    };

    const aoVoltar = (ev: PopStateEvent) => {
      const o = atualRef.current;
      lembrarEntradaAtual();
      let dialogo: Element | null = null;
      let temPorCima = quantosPorCima() > 0;
      if (!temPorCima) {
        dialogo = dialogoModalNaTela();
        temPorCima = deveTentarFecharDialogo(dialogo, ultimoDialogo);
        if (!dialogo) ultimoDialogo = null;
      }
      const d = decidirVoltar({ estado: ev.state, telaAtual: o.telaAtual, telaInicial: o.telaInicial, temPorCima });
      if (d.tipo !== 'avisar-sair') esconderAviso();
      switch (d.tipo) {
        case 'fechar-por-cima':
          if (!fecharUltimoPorCima() && dialogo) { ultimoDialogo = dialogo; apertarEsc(dialogo); }
          // Continua na mesma tela: repõe a entrada que o voltar consumiu.
          try { empilharTela(o.telaAtual); } catch { /* ignora */ }
          return;
        case 'ir-para-tela':
          ultimoVoltarRef.current = Date.now();
          o.irParaTela(d.tela);
          return;
        case 'ir-para-inicial':
          ultimoVoltarRef.current = Date.now();
          o.irParaTela(o.telaInicial);
          return;
        case 'avisar-sair':
          esconderAviso();
          aviso = criarAvisoSair();
          // Sem novo voltar no tempo do aviso: o próximo voltar avisa de novo (não sai).
          timerAviso = window.setTimeout(() => {
            esconderAviso();
            const nav = navigator as Navigator & { userActivation?: { hasBeenActive: boolean } };
            if (nav.userActivation?.hasBeenActive !== false) empilharSeNaBase();
          }, JANELA_SAIR_MS);
          return;
        default:
          return; // 'ignorar' (entrada de fora do sistema) e 'nada'
      }
    };

    window.addEventListener('popstate', aoVoltar);
    window.addEventListener('pointerdown', aoInteragir, true);
    window.addEventListener('keydown', aoInteragir, true);
    return () => {
      window.removeEventListener('popstate', aoVoltar);
      window.removeEventListener('pointerdown', aoInteragir, true);
      window.removeEventListener('keydown', aoInteragir, true);
      esconderAviso();
    };
  }, [ativo]);

  // Cada troca de tela entra no histórico (uma vez só por troca; re-render não empilha).
  useEffect(() => {
    if (!ativo || typeof window === 'undefined') return;
    const h = window.history;
    const lido = lerEstadoVoltar(h.state);
    const acao = decidirEmpilhar(h.state, telaAtual, {
      logoAposVoltar: Date.now() - ultimoVoltarRef.current < JANELA_REDIRECIONAMENTO_MS,
      telasSemHistorico: atualRef.current.telasSemHistorico,
      telaAnterior: lido && !lido.base && lido.n >= 2 ? telasPorPosicao.get(lido.n - 1) ?? null : null,
    });
    try {
      if (acao === 'empilhar') empilharTela(telaAtual);
      else if (acao === 'voltar') h.back(); // usou o "Voltar" da própria tela: o histórico do navegador volta junto
      else if (acao === 'substituir') {
        const n = lido?.n ?? ultimaPosicao + 1; // entrada criada por link com #: fica logo acima da última do sistema
        h.replaceState(criarEstadoVoltar(telaAtual, n, false, h.state), '');
        telasPorPosicao.set(n, telaAtual);
        ultimaPosicao = n;
      }
    } catch { /* ignora */ }
  }, [telaAtual, ativo]);
}

/** Algo aberto por cima da tela (menu do celular, janela, painel da Agente, cartão): o voltar fecha isso primeiro. */
export function useFecharNoVoltar(aberto: boolean, fechar: () => void): void {
  const fecharRef = useRef(fechar);
  fecharRef.current = fechar;
  useEffect(() => {
    if (!aberto) return;
    return registrarPorCima(() => fecharRef.current());
  }, [aberto]);
}
