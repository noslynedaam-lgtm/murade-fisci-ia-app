// "PARA": a Agente para NA HORA, sem esperar o servidor nem a IA.
// Igual em todos os sistemas Murade (Fiscal, DP, Contábil, Fisco IA, Agente IA). Duas partes:
//  1) Detecção do comando (funções puras, testadas): "para", "pare", "chega", "silêncio", "cala", "stop", "espera", "pausa"...
//     isolada ou no começo da frase. "não para de falar" NÃO é comando; "para que serve o DAS?" também não.
//  2) Central de parada: cada coisa que fala ou age na tela (voz, piloto, apresentação, demonstração da Escola) se registra aqui.
//     pararTudo() corta tudo de uma vez; "continua" retoma o que dá para retomar (piloto, apresentação, demonstração).
//     O serviço completo que roda no SERVIDOR não é cancelado por "para" — só a fala e a animação.

// ------------------------------------------------------------------ detecção (pura)
export const normalizarFala = (t: string): string => String(t || '')
  .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Começando a frase, sempre é para parar ("chega de falar", "silêncio", "cala a boca", "stop"). */
const SEMPRE_PARAR = new Set(['chega', 'silencio', 'cala', 'cale', 'calese', 'stop', 'shh', 'xiu']);
/** Só valem sozinhas ou com complemento curto de parar ("para", "para de falar", "espera um pouco"):
 *  "para que serve o DAS?", "pare o robô de notas" e "pausa o robô" seguem para a Agente normalmente. */
const PARAR_SE_SOZINHA = new Set(['para', 'pare', 'parar', 'parem', 'espera', 'espere', 'esperar', 'pausa', 'pausar', 'pause', 'calma']);
/** Complementos que não mudam o sentido de "parar". */
const COMPLEMENTOS = new Set([
  ...SEMPRE_PARAR, ...PARAR_SE_SOZINHA,
  'ja', 'agora', 'ai', 'ae', 'la', 'por', 'favor', 'pf', 'pfv', 'porfavor', 'um', 'pouco', 'pouquinho', 'minuto', 'minutinho',
  'momento', 'segundo', 'instante', 'tudo', 'de', 'falar', 'fala', 'ler', 'com', 'isso', 'a', 'voz', 'boca', 'mesmo', 'logo',
  'ok', 'oi', 'ei', 'menina', 'moca', 'querida', 'e',
]);
/** Chamada antes do comando ("Fiscal, para", "ei, para"). */
const VOCATIVOS = new Set(['ei', 'ey', 'oi', 'o', 'ow', 'ok', 'agente', 'murade', 'murad', 'fiscal', 'fisco', 'contabil', 'dp', 'ia', 'assistente']);

function semVocativo(palavras: string[], nomesExtras: string[] = []): string[] {
  const extras = new Set(nomesExtras.map(normalizarFala).filter(Boolean));
  let i = 0;
  while (i < palavras.length - 1 && i < 3 && (VOCATIVOS.has(palavras[i]) || extras.has(palavras[i]))) i += 1;
  return palavras.slice(i);
}

/** "para", "Pare!", "chega de falar", "Fiscal, silêncio", "espera um pouco" → true. "não para", "para que serve" → false. */
export function ehComandoParar(texto: string, nomesExtras: string[] = []): boolean {
  const p = semVocativo(normalizarFala(texto).split(' ').filter(Boolean), nomesExtras);
  if (!p.length) return false;
  const primeira = p[0];
  if (SEMPRE_PARAR.has(primeira)) return true;
  if (!PARAR_SE_SOZINHA.has(primeira)) return false;
  return p.length <= 8 && p.slice(1).every((w) => COMPLEMENTOS.has(w));
}

/** "continua", "pode continuar", "segue", "retoma de onde parou" (só vale quando algo foi parado pelo "para"). */
export function ehComandoContinuar(texto: string, nomesExtras: string[] = []): boolean {
  const t = semVocativo(normalizarFala(texto).split(' ').filter(Boolean), nomesExtras).join(' ');
  return /^(pode )?(continua|continue|continuar|segue|siga|prossegue|prossiga|retoma|retome|volta a falar|volte a falar)( de onde (voce )?parou| a falar| por favor| ai| agora)?$/.test(t);
}

/** "cancela o serviço" — este sim cancela o serviço do servidor (com cartão de confirmação). */
export const ehCancelarServico = (texto: string): boolean => /\bcancel\w*\b.{0,20}\bservicos?\b/.test(normalizarFala(texto));

export const FRASE_PAREI = 'Ok, parei.';
export const FRASE_PAREI_SERVICO = "Ok, parei. O serviço continua por trás; se quiser cancelar, diga 'cancela o serviço'.";
export const fraseDepoisDeParar = (servicoRodando: boolean): string => (servicoRodando ? FRASE_PAREI_SERVICO : FRASE_PAREI);

// ------------------------------------------------------------------ central de parada
/** O que uma parte parou: `retomavel` = "continua" retoma de onde parou; `servicoContinua` = o serviço segue no servidor. */
export type ResultadoParada = false | { retomavel?: boolean; servicoContinua?: boolean };
export interface Parador {
  id: string;
  /** Está falando ou agindo agora (mostra o botão PARAR). */
  ativo: () => boolean;
  /** Para na hora. Devolve false se não havia nada para parar. Nunca salva nada. */
  parar: () => ResultadoParada;
  /** Retoma de onde parou (só se `parar` disse que era retomável). */
  continuar?: () => void;
}
export interface ResultadoPararTudo { parouAlgo: boolean; servicoRodando: boolean; retomaveis: string[]; frase: string }

export const EVENTO_AGENTE_PAROU = 'murade-agente-parou';
export const EVENTO_AGENTE_MUDOU = 'murade-agente-mudou';

const paradores = new Map<string, Parador>();
const ouvintes = new Set<() => void>();
let paraRetomar: string[] = [];
let servicoAvisos = new Set<string>();

export function registrarParador(p: Parador): () => void {
  paradores.set(p.id, p);
  avisarMudancaAgente();
  return () => { if (paradores.get(p.id) === p) paradores.delete(p.id); paraRetomar = paraRetomar.filter((id) => id !== p.id); avisarMudancaAgente(); };
}
/** Avisa o botão PARAR que algo começou ou terminou de falar/agir. */
export function avisarMudancaAgente(): void {
  ouvintes.forEach((f) => { try { f(); } catch { /* ignora */ } });
}
export function assinarAgente(f: () => void): () => void { ouvintes.add(f); return () => { ouvintes.delete(f); }; }

/** Alguém (o piloto do serviço completo) avisa que há serviço rodando no servidor, para a frase de "parei" explicar. */
export function definirServicoRodando(id: string, rodando: boolean): void { if (rodando) servicoAvisos.add(id); else servicoAvisos.delete(id); }
export const servicoRodandoAgora = (): boolean => servicoAvisos.size > 0;

export function agenteAgindo(): boolean {
  for (const p of paradores.values()) { try { if (p.ativo()) return true; } catch { /* ignora */ } }
  return false;
}
export const temParaRetomar = (): boolean => paraRetomar.length > 0;

/** Corta TUDO na hora: voz, fila de falas, pedido de voz em andamento, piloto, apresentação, demonstração, lembretes da sessão. */
export function pararTudo(origem: 'voz' | 'texto' | 'botao' | 'tecla' = 'botao'): ResultadoPararTudo {
  let parouAlgo = false;
  let servico = servicoRodandoAgora();
  const retomaveis: string[] = [];
  for (const p of Array.from(paradores.values())) {
    let r: ResultadoParada = false;
    try { r = p.parar(); } catch { r = false; }
    if (!r) continue;
    parouAlgo = true;
    if (r.retomavel && p.continuar) retomaveis.push(p.id);
    if (r.servicoContinua) servico = true;
  }
  // Novo "para" sem nada retomável não apaga o que já estava esperando o "continua".
  if (retomaveis.length) paraRetomar = retomaveis;
  silenciarLembretes();
  const res: ResultadoPararTudo = { parouAlgo, servicoRodando: servico, retomaveis, frase: fraseDepoisDeParar(servico) };
  if (typeof window !== 'undefined') {
    try { window.dispatchEvent(new CustomEvent(EVENTO_AGENTE_PAROU, { detail: { ...res, origem } })); } catch { /* ignora */ }
  }
  avisarMudancaAgente();
  return res;
}

/** "continua": retoma o que o "para" deixou pausado. Devolve false se não havia nada (aí o pedido segue o caminho normal). */
export function continuarDeOndeParou(): boolean {
  const ids = paraRetomar;
  paraRetomar = [];
  let algum = false;
  for (const id of ids) {
    const p = paradores.get(id);
    if (p?.continuar) { try { p.continuar(); algum = true; } catch { /* ignora */ } }
  }
  avisarMudancaAgente();
  return algum;
}

/** Esquece o que estava esperando o "continua" (ex.: a pessoa fechou a apresentação). */
export function esquecerRetomada(id?: string): void { paraRetomar = id ? paraRetomar.filter((x) => x !== id) : []; }

// ------------------------------------------------------------------ lembretes repetidos ("estou esperando o OK")
const CHAVE_LEMBRETES = 'murade_lembretes_silenciados_v1';
let lembretesMudos = false;
export function silenciarLembretes(): void {
  lembretesMudos = true;
  try { sessionStorage.setItem(CHAVE_LEMBRETES, '1'); } catch { /* ignora */ }
}
/** Depois de um "para", os lembretes falados repetidos ficam mudos até fechar o sistema (o cartão continua na tela). */
export function lembretesSilenciados(): boolean {
  if (lembretesMudos) return true;
  try { return sessionStorage.getItem(CHAVE_LEMBRETES) === '1'; } catch { return false; }
}

// ------------------------------------------------------------------ "Falar as respostas" (por usuário)
const CHAVE_FALAR = 'murade_falar_respostas_v1';
let usuarioDaVoz = '';
const resumo = (s: string): string => { let h = 5381; for (let i = 0; i < s.length; i += 1) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); };
/** O acesso informa quem entrou (a preferência fica guardada por usuário neste aparelho; só um código, nunca o login). */
export function definirUsuarioDaVoz(usuario: unknown): void {
  let id = '';
  if (typeof usuario === 'string') id = usuario;
  else if (usuario && typeof usuario === 'object') { const u = usuario as Record<string, unknown>; id = String(u.id ?? u.userId ?? u.login ?? u.email ?? u.usuario ?? ''); }
  usuarioDaVoz = id ? resumo(id.trim().toLowerCase()) : '';
  avisarMudancaAgente();
}
/** Código (resumo) de quem entrou, para guardar preferências de voz por usuário neste aparelho. */
export const usuarioDaVozAtual = (): string => usuarioDaVoz || 'aparelho';
const chaveFalar = (): string => `${CHAVE_FALAR}:${usuarioDaVoz || 'aparelho'}`;
export function falarRespostasLigado(): boolean {
  try { return localStorage.getItem(chaveFalar()) !== '0'; } catch { return true; }
}
export function definirFalarRespostas(ligado: boolean): void {
  try { localStorage.setItem(chaveFalar(), ligado ? '1' : '0'); } catch { /* ignora */ }
  if (!ligado) { try { paradores.get('voz')?.parar(); } catch { /* ignora */ } }
  avisarMudancaAgente();
}

// ------------------------------------------------------------------ tecla Esc
// Esc com a Agente falando/agindo = PARAR (e só isso: o segundo Esc volta a fazer o que fazia antes, como fechar a janela).
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !agenteAgindo()) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.();
    pararTudo('tecla');
  }, true);
}
