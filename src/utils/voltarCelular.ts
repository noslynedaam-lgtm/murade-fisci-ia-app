// Botão VOLTAR do celular (gesto/botão do Android, voltar do navegador) dentro do sistema Murade.
// Pedido do dono (20/11 e 24/11/2026): o voltar volta para a TELA ANTERIOR do sistema, como no aplicativo do cliente;
// o que estiver aberto por cima (menu do celular, janela, Agente IA) fecha primeiro; na tela inicial o voltar sai do app.
//
// Por que mudou (24/11/2026): o Chrome do celular PULA, no botão voltar, as entradas do histórico que a página criou
// sem um toque da pessoa. A versão anterior criava entradas sozinha (a "base" ao abrir e a entrada reposta depois de
// fechar o menu com o voltar), e o Chrome pulava justamente a tela anterior: o voltar fechava o app ou caía no Início.
// Regras desta versão:
//  - nunca cria entrada dentro do evento do voltar (o voltar só lê o histórico e troca a tela);
//  - ao abrir, só marca a entrada atual (não cria outra);
//  - janela/menu aberto por um toque ganha a própria entrada (o voltar fecha só ele); fechado pelo X, a entrada é
//    reaproveitada pela próxima tela ou retirada com history.back();
//  - troca de tela empilha uma entrada; redirecionamento logo depois de um voltar substitui (não cria laço).
// Este arquivo não usa React nem o DOM (o hook useVoltarCelular liga isto ao navegador) para poder ser testado.

/** Estado que o sistema guarda em cada entrada do histórico do navegador. */
export interface EstadoVoltar {
  murade: true;
  tela: string;
  /** Posição da entrada no histórico do sistema (0 = a entrada em que o app abriu). */
  n: number;
  /** Entrada de algo aberto por cima da tela (menu, janela, Agente). */
  camada?: true;
}

/** Troca de tela logo depois de um voltar é redirecionamento da própria tela: substitui, não empilha. */
export const JANELA_REDIRECIONAMENTO_MS = 600;
/** Toque que ainda vale para abrir a entrada de uma janela (o Chrome considera o toque recente por alguns segundos). */
export const JANELA_TOQUE_MS = 4000;

const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Lê o estado do histórico; devolve null quando a entrada não é do sistema (ex.: criada por link com #). */
export function lerEstadoVoltar(estado: unknown): EstadoVoltar | null {
  if (!ehObjeto(estado) || estado.murade !== true || typeof estado.tela !== 'string' || !estado.tela) return null;
  const n = typeof estado.n === 'number' && Number.isInteger(estado.n) && estado.n >= 0 ? estado.n : 0;
  return estado.camada === true ? { murade: true, tela: estado.tela, n, camada: true } : { murade: true, tela: estado.tela, n };
}

/** Monta o estado de uma entrada. Com "existente", preserva o que outra parte do app guardou nela (ex.: roteador). */
export function criarEstadoVoltar(tela: string, n: number, camada = false, existente?: unknown): Record<string, unknown> {
  const resto: Record<string, unknown> = {};
  if (ehObjeto(existente)) {
    for (const [k, v] of Object.entries(existente)) if (!['murade', 'tela', 'n', 'camada', 'base'].includes(k)) resto[k] = v;
  }
  return camada ? { ...resto, murade: true, tela, n, camada: true } : { ...resto, murade: true, tela, n };
}

/** O que o controle precisa do navegador (window.history no app; um histórico de mentira nos testes). */
export interface HistoricoNavegador {
  readonly state: unknown;
  pushState(estado: unknown): void;
  replaceState(estado: unknown): void;
  back(): void;
}

interface Camada { id: number; fechar: () => void; n: number | null; fechadaPeloVoltar: boolean }

export interface OpcoesControle {
  telaAtual: string;
  telaInicial: string;
  irParaTela: (tela: string) => void;
  telasSemHistorico?: readonly string[];
}

/**
 * Controle do botão voltar. Um por página (o hook usa a instância única). O voltar nunca salva, transmite nem apaga:
 * só troca de tela ou fecha o que está por cima.
 */
export class ControleVoltar {
  private camadas: Camada[] = [];
  private proximoId = 1;
  private opcoes: OpcoesControle | null = null;
  private ignorarVoltas = 0;
  private ultimoVoltarMs = -Infinity;
  private ultimoToqueMs = -Infinity;
  private toqueUsadoMs = -Infinity;
  private remocaoPendente: number | null = null;
  private telasPorPosicao = new Map<number, string>();
  private ultimaPosicao = 0;

  constructor(
    private readonly h: HistoricoNavegador,
    private readonly agora: () => number = () => Date.now(),
    private readonly depois: (f: () => void) => void = (f) => { setTimeout(f, 0); },
    /** Fecha janelas da tela que não se registraram (ex.: confirmação com aria-modal). */
    private readonly fecharDialogoSolto: () => boolean = () => false,
  ) {}

  get ligado(): boolean { return this.opcoes !== null; }
  get quantasCamadas(): number { return this.camadas.length; }

  /** Liga depois do login: só marca a entrada atual (não cria entrada nova). */
  ligar(o: OpcoesControle): void {
    this.opcoes = { ...o };
    const lido = lerEstadoVoltar(this.h.state);
    const n = lido?.n ?? 0;
    this.h.replaceState(criarEstadoVoltar(o.telaAtual, n, false, this.h.state));
    this.ultimaPosicao = n;
    this.telasPorPosicao.set(n, o.telaAtual);
  }
  desligar(): void { this.opcoes = null; }
  atualizar(o: Partial<OpcoesControle>): void { if (this.opcoes) this.opcoes = { ...this.opcoes, ...o }; }

  /** Toque/tecla de verdade da pessoa (o navegador só deixa a entrada valer no voltar se veio de um toque). */
  toque(): void { this.ultimoToqueMs = this.agora(); }
  private toqueDisponivel(): boolean {
    return this.ultimoToqueMs > this.toqueUsadoMs && this.agora() - this.ultimoToqueMs <= JANELA_TOQUE_MS;
  }

  private gravar(acao: 'push' | 'replace', tela: string, n: number, camada = false): void {
    const estado = criarEstadoVoltar(tela, n, camada, acao === 'replace' ? this.h.state : undefined);
    if (acao === 'push') {
      for (const k of [...this.telasPorPosicao.keys()]) if (k >= n) this.telasPorPosicao.delete(k);
      this.h.pushState(estado);
      this.toqueUsadoMs = this.ultimoToqueMs;
    } else this.h.replaceState(estado);
    if (!camada) this.telasPorPosicao.set(n, tela);
    this.ultimaPosicao = n;
  }

  /** A tela/aba mudou (menu, botão, Agente ou o próprio voltar). */
  telaMudou(tela: string): 'nada' | 'empilhou' | 'substituiu' | 'voltou' {
    const o = this.opcoes;
    if (!o || !tela) return 'nada';
    o.telaAtual = tela;
    if (o.telasSemHistorico?.includes(tela)) return 'nada';
    const lido = lerEstadoVoltar(this.h.state);
    // Janela fechada pelo toque que também trocou de tela (ex.: item do menu do celular): a entrada dela vira a da tela nova.
    if (lido && this.remocaoPendente !== null && lido.n === this.remocaoPendente && lido.camada) {
      this.remocaoPendente = null;
      this.gravar('replace', tela, lido.n);
      return 'substituiu';
    }
    if (!lido) { this.gravar('replace', tela, this.ultimaPosicao + 1); return 'substituiu'; } // entrada de link com #
    if (lido.tela === tela) return 'nada'; // re-render ou chegada pelo voltar
    if (this.agora() - this.ultimoVoltarMs < JANELA_REDIRECIONAMENTO_MS) { this.gravar('replace', tela, lido.n, !!lido.camada); return 'substituiu'; }
    // Usou o "Voltar" da própria tela para a tela de baixo: o histórico do navegador volta junto (não cresce A → B → A).
    if (!lido.camada && lido.n >= 1 && this.telasPorPosicao.get(lido.n - 1) === tela) { this.h.back(); return 'voltou'; }
    this.gravar('push', tela, lido.n + 1);
    return 'empilhou';
  }

  /** Algo abriu por cima (menu, janela, Agente). Aberto por toque ganha entrada própria. Devolve a função de fechar o registro. */
  abrirCamada(fechar: () => void): () => void {
    const c: Camada = { id: this.proximoId++, fechar, n: null, fechadaPeloVoltar: false };
    this.camadas.push(c);
    const o = this.opcoes;
    if (o && this.toqueDisponivel()) {
      const lido = lerEstadoVoltar(this.h.state);
      // Só quando a entrada atual é a da tela que está aberta (senão a camada fica sem entrada: o voltar fecha junto).
      if (lido && lido.tela === o.telaAtual) { c.n = lido.n + 1; this.gravar('push', o.telaAtual, c.n, true); }
    }
    return () => this.tirarCamada(c);
  }

  private tirarCamada(c: Camada): void {
    const i = this.camadas.indexOf(c);
    if (i >= 0) this.camadas.splice(i, 1);
    if (c.fechadaPeloVoltar || c.n === null) return;
    const lido = lerEstadoVoltar(this.h.state);
    if (!lido || !lido.camada || lido.n !== c.n) return; // a pessoa já foi para outra tela com a janela aberta: deixa
    // Fechou pelo X/fora: a entrada da janela sai do histórico, a menos que uma tela nova a reaproveite agora mesmo.
    this.remocaoPendente = c.n;
    const n = c.n;
    this.depois(() => {
      if (this.remocaoPendente !== n) return;
      this.remocaoPendente = null;
      const atual = lerEstadoVoltar(this.h.state);
      if (!atual || !atual.camada || atual.n !== n) return;
      this.ignorarVoltas += 1;
      this.h.back();
    });
  }

  /** O navegador já foi para a entrada "estado" (evento popstate). Nunca cria entrada aqui. */
  aoVoltar(estado: unknown): 'ignorado' | 'fechou' | 'trocou' | 'nada' {
    if (this.ignorarVoltas > 0) { this.ignorarVoltas -= 1; return 'ignorado'; }
    const o = this.opcoes;
    const lido = lerEstadoVoltar(estado);
    if (!o || !lido) return 'ignorado'; // entrada de fora do sistema (link com #): o app trata como já tratava
    this.ultimoVoltarMs = this.agora();
    this.toqueUsadoMs = this.ultimoToqueMs; // o toque anterior não vale para entradas criadas depois do voltar
    this.remocaoPendente = null;
    this.ultimaPosicao = lido.n;
    let fechou = false;
    for (let i = this.camadas.length - 1; i >= 0; i -= 1) {
      const c = this.camadas[i];
      // Fecha o que tinha entrada acima da entrada de agora e o que foi aberto sem entrada (fecha junto com a tela).
      if (c.n === null || c.n > lido.n) {
        c.fechadaPeloVoltar = true;
        this.camadas.splice(i, 1);
        try { c.fechar(); } catch { /* fechar nunca pode travar o voltar */ }
        if (c.n !== null) fechou = true;
      }
    }
    if (!fechou) { try { if (this.fecharDialogoSolto()) fechou = lido.tela === o.telaAtual; } catch { /* idem */ } }
    if (lido.tela !== o.telaAtual) { o.irParaTela(lido.tela); return 'trocou'; }
    return fechou ? 'fechou' : 'nada';
  }
}
