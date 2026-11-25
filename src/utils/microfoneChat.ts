// Microfone dos chats (Agente IA e ajuda) — MESMO arquivo nos 5 sistemas Murad. Mudou aqui? Copie igual para os outros.
//
// Como funciona:
// 1. Um clique liga (não precisa segurar). A pessoa solta o mouse e fala.
// 2. Reconhecimento contínuo com texto parcial: o que está sendo dito aparece na caixa enquanto a pessoa fala.
// 3. Parou de falar por alguns segundos (padrão 2,5 s, ajustável em Configurações de voz): desliga e envia.
// 4. Clicar de novo enquanto ouve: para na hora e envia o que já foi dito.
// 5. O navegador cortou sozinho antes do silêncio: religa e continua juntando o texto.
// 6. Sem eco: antes de ouvir, a voz da assistente para; o que for captado enquanto ela fala é ignorado.
// 7. Erros (bloqueado, sem permissão, sem suporte): explica o motivo e como liberar no navegador da pessoa.
import { usuarioDaVozAtual } from './agenteParar';

// ---------------------------------------------------------------------------------------------
// Tempo de silêncio (por usuário neste aparelho)
// ---------------------------------------------------------------------------------------------
export const SILENCIO_PADRAO_MS = 2500;
export const OPCOES_SILENCIO_MS = [1500, 2000, 2500, 3000, 4000, 5000];
const CHAVE_SILENCIO = 'murade_mic_silencio_v1';
const chaveSilencio = (): string => `${CHAVE_SILENCIO}:${usuarioDaVozAtual()}`;
export function lerTempoSilencio(): number {
  try {
    const n = Number(localStorage.getItem(chaveSilencio()));
    return Number.isFinite(n) && n >= 1000 && n <= 8000 ? n : SILENCIO_PADRAO_MS;
  } catch { return SILENCIO_PADRAO_MS; }
}
export function definirTempoSilencio(ms: number): void {
  try { localStorage.setItem(chaveSilencio(), String(Math.min(8000, Math.max(1000, Math.round(ms))))); } catch { /* ignora */ }
}
export const rotuloSilencio = (ms: number): string => `${(ms / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s`;

// ---------------------------------------------------------------------------------------------
// Explicação dos erros, pelo navegador da pessoa
// ---------------------------------------------------------------------------------------------
export type NavegadorMic = 'iphone' | 'samsung' | 'edge' | 'chrome' | 'firefox' | 'outro';
export function detectarNavegador(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): NavegadorMic {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua))) return 'iphone';
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/Edg(e|A|iOS)?\//i.test(ua)) return 'edge';
  if (/Firefox|FxiOS/i.test(ua)) return 'firefox';
  if (/Chrome|CriOS|Chromium/i.test(ua)) return 'chrome';
  return 'outro';
}

const COMO_LIBERAR: Record<'chrome' | 'edge' | 'samsung' | 'iphone', string> = {
  chrome: 'Chrome: cadeado ao lado do endereço › Microfone › Permitir e recarregue (no Android, também Configurações › Apps › Chrome › Permissões › Microfone).',
  edge: 'Edge: cadeado ao lado do endereço › Permissões do site › Microfone › Permitir e recarregue.',
  samsung: 'Samsung Internet: cadeado ao lado do endereço › Permissões › Microfone › Permitir (ou Configurações › Aplicativos › Samsung Internet › Permissões).',
  iphone: 'iPhone: Ajustes › Safari › Microfone › Permitir, e ligue Ajustes › Geral › Teclado › Ativar Ditado.',
};

/** Motivo do erro e como liberar (primeiro no navegador da pessoa; depois, resumo para os outros). */
export function explicarErroMicrofone(codigo: string, ua?: string): string {
  const nav = detectarNavegador(ua);
  const principal = nav === 'chrome' || nav === 'edge' || nav === 'samsung' || nav === 'iphone' ? nav : null;
  // O navegador da pessoa vem primeiro; depois os outros (Chrome, Edge, Samsung Internet e iPhone).
  const ordem = (['chrome', 'edge', 'samsung', 'iphone'] as const).slice().sort((x, y) => (x === principal ? -1 : y === principal ? 1 : 0));
  const comoLiberar = `Para liberar: ${ordem.map((n) => COMO_LIBERAR[n]).join(' ')}`;
  switch (codigo) {
    case 'not-allowed':
    case 'service-not-allowed':
    case 'permissao':
      return `O microfone está bloqueado para este site (sem permissão). ${comoLiberar}`;
    case 'audio-capture':
      return 'Não encontrei microfone neste aparelho, ou ele está em uso por outro programa (reunião, gravador). Conecte ou libere o microfone e clique de novo.';
    case 'network':
      return 'O reconhecimento de fala precisa de internet e a conexão falhou. Confira a internet e clique no microfone de novo.';
    case 'language-not-supported':
      return 'Este navegador não reconhece fala em português do Brasil. Use Chrome, Edge ou Samsung Internet; no iPhone, o Safari com o Ditado ligado.';
    case 'inseguro':
      return 'O microfone só funciona em endereço seguro (https). Abra o sistema pelo endereço oficial, com https.';
    case 'sem-fala':
      return 'Não ouvi nada. Clique no microfone e fale perto do aparelho.';
    case 'sem-suporte':
    default:
      if (nav === 'firefox') return 'O Firefox não reconhece fala. Use Chrome, Edge ou Samsung Internet; no iPhone, o Safari com o Ditado ligado (Ajustes, Geral, Teclado, Ativar Ditado). Você também pode digitar a pergunta.';
      if (codigo !== 'sem-suporte') return `O microfone parou com um erro (${codigo}). Clique de novo. Se continuar: ${comoLiberar}`;
      return 'Este navegador não reconhece fala. Use Chrome, Edge ou Samsung Internet; no iPhone, o Safari atualizado com o Ditado ligado (Ajustes, Geral, Teclado, Ativar Ditado). Você também pode digitar a pergunta.';
  }
}

// ---------------------------------------------------------------------------------------------
// Controle do microfone
// ---------------------------------------------------------------------------------------------
type ResultadoFala = { isFinal: boolean; 0: { transcript: string }; length: number };
type EventoResultado = { resultIndex?: number; results: ArrayLike<ResultadoFala> };
interface Reconhecedor {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives?: number;
  onresult: ((e: EventoResultado) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart?: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type ConstrutorReconhecedor = new () => Reconhecedor;

export function construtorDoReconhecedor(): ConstrutorReconhecedor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: ConstrutorReconhecedor; webkitSpeechRecognition?: ConstrutorReconhecedor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}
export const microfoneSuportado = (): boolean => construtorDoReconhecedor() !== null;

// Avisa as outras escutas da tela (ex.: "chamada por voz") para pausarem enquanto o microfone do chat ouve: um microfone por vez.
export const EVENTO_MICROFONE_CHAT = 'murade-microfone-chat';
let microfonesAtivos = 0;
export const microfoneDoChatAtivo = (): boolean => microfonesAtivos > 0;
function avisarMicrofoneDoChat(delta: number): void {
  microfonesAtivos = Math.max(0, microfonesAtivos + delta);
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENTO_MICROFONE_CHAT, { detail: { ativo: microfonesAtivos > 0 } }));
    }
  } catch { /* ignora */ }
}

export interface OpcoesMicrofone {
  /** Liga/desliga: o botão fica vermelho pulsando com "Ouvindo… fale" enquanto true. */
  aoMudarEstado?: (ouvindo: boolean) => void;
  /** Texto reconhecido até agora (final + parcial), para mostrar na caixa enquanto a pessoa fala. */
  aoParcial?: (texto: string) => void;
  /** Pergunta completa: chamada ao parar (silêncio ou segundo clique) se algo foi dito. */
  aoEnviar: (texto: string) => void;
  /** Erro já explicado (motivo + como liberar). */
  aoErro?: (mensagem: string, codigo: string) => void;
  /** Antes de ouvir (ex.: parar a voz da assistente, para não captar a própria voz dela). */
  antesDeOuvir?: () => void;
  /** Enquanto true, o que chegar é ignorado (eco da assistente falando). */
  assistenteFalando?: () => boolean;
  /** Tempo de silêncio para enviar (ms). Padrão: o escolhido em Configurações de voz. */
  silencioMs?: () => number;
  /** Sem nenhuma fala por este tempo depois de ligar: desliga sem enviar. */
  esperaInicialMs?: number;
  lingua?: string;
  /** Para testes. */
  construtor?: ConstrutorReconhecedor | null;
}

export interface Microfone {
  /** Um clique: liga. Devolve false se não deu para ligar (o motivo vai em aoErro). */
  ligar(): boolean;
  /** Para na hora; com enviar=true envia o que já foi dito. */
  parar(enviar?: boolean): void;
  /** O clique do botão: liga se parado; se ouvindo, para e envia. */
  alternar(): void;
  ouvindo(): boolean;
  /** Ao fechar a tela: para sem enviar e solta o microfone. */
  destruir(): void;
}

const juntar = (...partes: string[]): string => partes.map((p) => p.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

export function criarMicrofone(op: OpcoesMicrofone): Microfone {
  let rec: Reconhecedor | null = null;
  let ligado = false;
  let anteriores = '';      // texto de sessões que o navegador já encerrou sozinho
  let sessaoFinal = '';
  let sessaoParcial = '';
  let timerSilencio: ReturnType<typeof setTimeout> | null = null;
  let timerReinicio: ReturnType<typeof setTimeout> | null = null;
  let reinicios = 0;
  let geracao = 0;

  const textoAtual = (): string => juntar(anteriores, sessaoFinal, sessaoParcial);
  const limparTimers = () => {
    if (timerSilencio) { clearTimeout(timerSilencio); timerSilencio = null; }
    if (timerReinicio) { clearTimeout(timerReinicio); timerReinicio = null; }
  };
  const armarSilencio = (ms: number, enviar: boolean) => {
    if (timerSilencio) clearTimeout(timerSilencio);
    timerSilencio = setTimeout(() => {
      timerSilencio = null;
      if (!ligado) return;
      if (!enviar && !textoAtual()) { parar(false); op.aoErro?.(explicarErroMicrofone('sem-fala'), 'sem-fala'); return; }
      parar(true);
    }, ms);
  };
  const silencio = () => { const ms = op.silencioMs ? op.silencioMs() : lerTempoSilencio(); return Number.isFinite(ms) && ms > 0 ? ms : SILENCIO_PADRAO_MS; };

  const soltar = () => {
    const r = rec; rec = null;
    if (!r) return;
    r.onresult = null; r.onerror = null; r.onend = null;
    try { r.abort(); } catch { /* ignora */ }
  };

  const falhar = (codigo: string) => {
    if (ligado) avisarMicrofoneDoChat(-1);
    ligado = false; geracao += 1; limparTimers(); soltar();
    op.aoMudarEstado?.(false);
    op.aoErro?.(explicarErroMicrofone(codigo), codigo);
  };

  const iniciarSessao = (Ctor: ConstrutorReconhecedor, tentativa = 0) => {
    const minha = geracao;
    let r: Reconhecedor;
    try { r = new Ctor(); } catch { falhar('sem-suporte'); return; }
    rec = r;
    r.lang = op.lingua || 'pt-BR';
    r.continuous = true;
    r.interimResults = true;
    try { r.maxAlternatives = 1; } catch { /* ignora */ }
    sessaoFinal = ''; sessaoParcial = '';
    let ignorarAte = 0; // resultados captados enquanto a assistente falava (eco) ficam de fora
    r.onresult = (e) => {
      if (minha !== geracao || !ligado) return;
      const lista = e.results;
      // Eco: a assistente está falando — não junta a voz dela na pergunta.
      if (op.assistenteFalando?.()) { ignorarAte = lista.length; return; }
      let fin = ''; let par = '';
      for (let i = ignorarAte; i < lista.length; i += 1) {
        const item = lista[i];
        const t = String(item?.[0]?.transcript || '');
        if (item?.isFinal) fin = juntar(fin, t); else par = juntar(par, t);
      }
      sessaoFinal = fin; sessaoParcial = par;
      const texto = textoAtual();
      op.aoParcial?.(texto);
      if (texto) armarSilencio(silencio(), true);
    };
    r.onerror = (ev) => {
      if (minha !== geracao) return;
      const codigo = String(ev?.error || '');
      // Sem fala ou cortado: o onend religa. Os demais erros param e explicam.
      if (codigo === 'no-speech' || codigo === 'aborted' || codigo === '') return;
      falhar(codigo);
    };
    r.onend = () => {
      if (minha !== geracao || !ligado) return;
      // O navegador encerrou antes do silêncio: guarda o que já ouviu e religa.
      anteriores = juntar(anteriores, sessaoFinal, sessaoParcial);
      sessaoFinal = ''; sessaoParcial = '';
      rec = null;
      reinicios += 1;
      if (reinicios > 40) { parar(true); return; }
      timerReinicio = setTimeout(() => { timerReinicio = null; if (ligado && minha === geracao) iniciarSessao(Ctor); }, 120);
    };
    try { r.start(); } catch (err) {
      const nome = String((err as { name?: string })?.name || '');
      if (nome === 'NotAllowedError' || nome === 'SecurityError') { falhar('not-allowed'); return; }
      // Outro microfone da tela (ex.: a chamada por voz) ainda estava saindo: tenta de novo num instante.
      r.onresult = null; r.onerror = null; r.onend = null; rec = null;
      if (tentativa < 3) timerReinicio = setTimeout(() => { timerReinicio = null; if (ligado && minha === geracao) iniciarSessao(Ctor, tentativa + 1); }, 250);
      else falhar(nome === 'InvalidStateError' ? 'audio-capture' : 'sem-suporte');
    }
  };

  function ligar(): boolean {
    if (ligado) return true;
    const Ctor = op.construtor !== undefined ? op.construtor : construtorDoReconhecedor();
    if (!Ctor) { op.aoErro?.(explicarErroMicrofone('sem-suporte'), 'sem-suporte'); return false; }
    if (typeof window !== 'undefined' && (window as { isSecureContext?: boolean }).isSecureContext === false) {
      op.aoErro?.(explicarErroMicrofone('inseguro'), 'inseguro'); return false;
    }
    // Sem eco: a assistente para de falar antes do microfone abrir (o clique também serve para interrompê-la).
    try { op.antesDeOuvir?.(); } catch { /* ignora */ }
    geracao += 1;
    ligado = true;
    avisarMicrofoneDoChat(1);
    anteriores = ''; sessaoFinal = ''; sessaoParcial = ''; reinicios = 0;
    op.aoMudarEstado?.(true);
    iniciarSessao(Ctor);
    if (ligado) armarSilencio(op.esperaInicialMs ?? 10000, false);
    return ligado;
  }

  function parar(enviar = true): void {
    if (!ligado) return;
    const texto = textoAtual();
    ligado = false; geracao += 1; limparTimers(); soltar();
    avisarMicrofoneDoChat(-1);
    anteriores = ''; sessaoFinal = ''; sessaoParcial = '';
    op.aoMudarEstado?.(false);
    if (enviar && texto) op.aoEnviar(texto);
  }

  return {
    ligar,
    parar,
    alternar: () => { if (ligado) parar(true); else ligar(); },
    ouvindo: () => ligado,
    destruir: () => parar(false),
  };
}
