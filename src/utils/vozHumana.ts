// Voz da Agente: a voz grátis do aparelho (a pt-BR mais natural) é a padrão; a premium (Gemini "Kore") só se ligada. Uma fala por vez; dá para interromper.
import { avisarMudancaAgente, falarRespostasLigado, registrarParador, usuarioDaVozAtual } from './agenteParar';
import { FRASE_EXEMPLO_VOZ, TOM_NATURAL, VELOCIDADE_NATURAL, dividirEmFrases, escolherVozNatural, idDaVoz, nivelDaVoz, ordenarVozesPtBr, prepararTextoParaFala } from './vozNaturalPtBr';
let audioAtual: HTMLAudioElement | null = null;
// Pedido de voz ao servidor em andamento: o "para" aborta, para não tocar nada depois.
let pedidoVoz: AbortController | null = null;
// Fala que esperava o primeiro toque na tela para sair (o navegador bloqueia a voz antes disso).
let falaPendente: string | null = null;
// Solta a espera do áudio atual (pause não dispara "ended": sem isto a fala cortada ficava presa para sempre).
let soltarAudio: (() => void) | null = null;
let sequencia = 0;
let falandoFlag = false;

// ---- Voz econômica (do navegador, grátis) é a padrão. A voz premium (Gemini) gasta a chave e só liga se pedirem. ----
const CHAVE_PREMIUM = 'murade_voz_premium_v1';
export const vozPremiumLigada = (): boolean => { try { return localStorage.getItem(CHAVE_PREMIUM) === '1'; } catch { return false; } };
const definirPremium = (ligada: boolean): void => { try { localStorage.setItem(CHAVE_PREMIUM, ligada ? '1' : '0'); } catch { /* ignora */ } };

// ---- Ajuste de volume e velocidade por comando de voz ("fala mais rápido", "aumenta a voz"). Fica salvo. ----
const CHAVE_AJUSTE = 'murade_voz_ajuste_v1';
let volumeVoz = 0.8;
let velocidadeVoz = VELOCIDADE_NATURAL; // 1,0: ritmo natural (antes 0,95 ou 1,1, que soavam arrastado ou corrido)
try {
  const salvo = JSON.parse(localStorage.getItem(CHAVE_AJUSTE) || 'null');
  if (salvo && Number.isFinite(salvo.v)) volumeVoz = Math.min(1, Math.max(0.2, salvo.v));
  if (salvo && Number.isFinite(salvo.r)) velocidadeVoz = Math.min(1.6, Math.max(0.7, salvo.r));
} catch { /* ignora */ }

function salvarAjuste(): void {
  try { localStorage.setItem(CHAVE_AJUSTE, JSON.stringify({ v: volumeVoz, r: velocidadeVoz })); } catch { /* ignora */ }
  if (audioAtual) { audioAtual.volume = volumeVoz; audioAtual.playbackRate = velocidadeVoz; }
}

/** Reconhece pedidos de volume/velocidade (texto já sem acento). Devolve a frase de confirmação, ou null. */
export function ajustarVoz(texto: string): string | null {
  const t = texto.trim();
  if (t.split(' ').length > 8) return null;
  // Reclamação de voz robótica ("essa voz está muito robótica", "quero uma voz mais natural"): passa para a voz mais natural
  // deste aparelho (grátis). Não oferece voz paga.
  if (/\bvoz\b/.test(t) && /\b(robotic[ao]s?|robo|robozinho|mecanic[ao]|artificial|menos robo\w*|mais (natural|humana|bonita|normal))\b/.test(t) && !/\bvoz (premium|humana|bonita|cara)\b.*\b(usa|use|liga|ative|ativa)\b/.test(t)) return usarVozMaisNatural();
  if (/\b(melhor voz|voz automatica|voz mais natural)\b/.test(t) && /\b(usa|use|usar|volta|volte|coloca|ponha|poe|escolhe|escolha|quero)\b/.test(t)) return usarVozMaisNatural();
  if (/\b(troca|troque|muda|mude|trocar|mudar|outra|quero)\b.*\bvoz\b/.test(t) && !/\bvoz (premium|humana|normal|economica)\b/.test(t)) return trocarVoz();
  if (/\bvoz (premium|humana|bonita|cara)\b/.test(t) && /\b(usa|use|usar|liga|ligue|ativa|ative|coloca|ponha|poe)\b/.test(t)) {
    definirPremium(true); return 'Ativei a voz premium. Ela é mais bonita, mas gasta mais da chave.';
  }
  if (/\bvoz (normal|economica|barata|simples|do navegador)\b/.test(t) && /\b(usa|use|usar|volta|volte|liga|ligue|ativa|ative|coloca|ponha|poe)\b/.test(t)) {
    definirPremium(false); return 'Voltei para a voz econômica, que não gasta a chave.';
  }
  const falaOuVoz = /\b(fala|fale|falar|voz|volume)\b/.test(t);
  if (/\b(aumenta|aumente|sobe|suba)\b.*\b(voz|volume)\b/.test(t) || (falaOuVoz && /\bmais alto\b/.test(t))) {
    if (volumeVoz >= 1) return 'A voz já está no máximo. Aumente o volume do aparelho, se precisar.';
    volumeVoz = Math.min(1, volumeVoz + 0.2); salvarAjuste(); return 'Pronto, aumentei a voz.';
  }
  if (/\b(diminui|diminua|abaixa|abaixe|baixa|baixe)\b.*\b(voz|volume)\b/.test(t) || (falaOuVoz && /\bmais baixo\b/.test(t))) {
    volumeVoz = Math.max(0.2, volumeVoz - 0.2); salvarAjuste(); return 'Pronto, diminuí a voz.';
  }
  if (/\b(acelera|acelere)\b/.test(t) || (falaOuVoz && /\bmais rapido\b/.test(t)) || /\bum pouco(zinho)? mais rapido\b/.test(t)) {
    velocidadeVoz = Math.min(1.6, velocidadeVoz + 0.15); salvarAjuste(); return 'Pronto, estou falando mais rápido.';
  }
  if (/\b(desacelera|desacelere)\b/.test(t) || (falaOuVoz && /\b(mais devagar|mais lento)\b/.test(t))) {
    velocidadeVoz = Math.max(0.7, velocidadeVoz - 0.15); salvarAjuste(); return 'Pronto, estou falando mais devagar.';
  }
  return null;
}

export const humanaFalando = (): boolean => falandoFlag || Boolean(typeof window !== 'undefined' && window.speechSynthesis?.speaking);

export function pararHumana(): void {
  const estava = falandoFlag || audioAtual !== null || pedidoVoz !== null || falaPendente !== null;
  sequencia += 1;
  falandoFlag = false;
  // Áudio tocando: pausa e descarta (não continua de onde estava).
  if (audioAtual) { try { audioAtual.pause(); audioAtual.onended = null; audioAtual.removeAttribute?.('src'); audioAtual.load?.(); } catch { /* ignora */ } audioAtual = null; }
  if (soltarAudio) { const s = soltarAudio; soltarAudio = null; s(); }
  // Pedido de voz em andamento e fila: aborta e esvazia.
  if (pedidoVoz) { try { pedidoVoz.abort(); } catch { /* ignora */ } pedidoVoz = null; }
  falaPendente = null;
  try { window.speechSynthesis?.cancel(); } catch { /* ignora */ }
  try { document.getElementById('murade-dica-voz')?.remove(); } catch { /* ignora */ }
  if (estava) avisarMudancaAgente();
}

// A central do "para" corta a voz junto com o resto.
registrarParador({
  id: 'voz',
  ativo: () => humanaFalando(),
  parar: () => { const falava = humanaFalando() || falaPendente !== null; pararHumana(); return falava ? {} : false; },
});

function dividirEmTrechos(texto: string): string[] {
  // O primeiro trecho é curto para a voz começar logo; os seguintes são gerados enquanto ela fala.
  const trechos: string[] = [];
  let atual = '';
  const frases: string[] = [];
  for (const frase of texto.split(/(?<=[.!?:;])\s+/)) {
    let resto = frase;
    while (resto.length > 140) {
      let corte = Math.max(resto.lastIndexOf(',', 140), resto.lastIndexOf(' ', 140));
      if (corte < 40) corte = 140;
      frases.push(resto.slice(0, corte + 1).trim());
      resto = resto.slice(corte + 1);
    }
    if (resto.trim()) frases.push(resto.trim());
  }
  for (const frase of frases) {
    const limite = trechos.length === 0 ? 100 : 600;
    if ((atual + ' ' + frase).length > limite && atual) { trechos.push(atual.trim()); atual = frase; }
    else atual = atual ? `${atual} ${frase}` : frase;
  }
  if (atual.trim()) trechos.push(atual.trim());
  return trechos;
}

/** Sinal sonoro curtinho: avisa na hora que ela ouviu, sem esperar a voz ficar pronta. */
export function bipRapido(): void {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    ganho.gain.value = 0.06 * volumeVoz;
    osc.connect(ganho); ganho.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => { try { void ctx.close(); } catch { /* ignora */ } };
  } catch { /* ignora */ }
}

/** Deixa pronta a frase mais usada ("Pois não?"), para a primeira resposta também ser rápida. */
export async function prepararVoz(): Promise<void> {
  if (!vozPremiumLigada()) return;
  try {
    const codigo = await codigoDaFrase('Pois não?');
    if (await lerDoCache(codigo)) return;
    await buscarAudio('Pois não?');
  } catch { /* ignora */ }
}


// ---- Memória de voz neste aparelho: cada frase falada fica salva e não gasta a chave de novo. ----
// Guarda só o áudio e um código da frase (nunca o texto). Fica salva mesmo fechando o sistema.
const BANCO = 'murade_voz_v1';
const TABELA = 'audios';
const MAX_AUDIOS = 400;
let bancoPromessa: Promise<IDBDatabase | null> | null = null;

function abrirBanco(): Promise<IDBDatabase | null> {
  if (bancoPromessa) return bancoPromessa;
  bancoPromessa = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const pedido = indexedDB.open(BANCO, 1);
      pedido.onupgradeneeded = () => { pedido.result.createObjectStore(TABELA, { keyPath: 'h' }); };
      pedido.onsuccess = () => resolve(pedido.result);
      pedido.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return bancoPromessa;
}

async function codigoDaFrase(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(`Kore|${texto}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function lerDoCache(h: string): Promise<string | null> {
  const banco = await abrirBanco();
  if (!banco) return null;
  return new Promise((resolve) => {
    try {
      const tx = banco.transaction(TABELA, 'readwrite');
      const loja = tx.objectStore(TABELA);
      const pedido = loja.get(h);
      pedido.onsuccess = () => {
        const item = pedido.result as { h: string; src: string; u: number } | undefined;
        if (item) { item.u = Date.now(); loja.put(item); resolve(item.src); } else resolve(null);
      };
      pedido.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function guardarNoCache(h: string, src: string): Promise<void> {
  const banco = await abrirBanco();
  if (!banco) return;
  try {
    const tx = banco.transaction(TABELA, 'readwrite');
    const loja = tx.objectStore(TABELA);
    loja.put({ h, src, u: Date.now() });
    const contagem = loja.count();
    contagem.onsuccess = () => {
      if (contagem.result <= MAX_AUDIOS) return;
      // Passou do limite: libera os menos usados (os mais antigos).
      const todos = loja.getAll();
      todos.onsuccess = () => {
        const lista = (todos.result as { h: string; u: number }[]).sort((a, b) => a.u - b.u);
        lista.slice(0, lista.length - MAX_AUDIOS).forEach((item) => loja.delete(item.h));
      };
    };
  } catch { /* ignora */ }
}

async function buscarAudio(trecho: string, sinal?: AbortSignal): Promise<string | null> {
  let codigo = '';
  try {
    codigo = await codigoDaFrase(trecho);
    const guardado = await lerDoCache(codigo);
    if (guardado) return guardado;
  } catch { /* segue para o servidor */ }
  try {
    if (sinal?.aborted) return null;
    const resp = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ text: trecho }), signal: sinal });
    if (!resp.ok) return null;
    const dados = await resp.json();
    if (!dados?.audio) return null;
    const src = `data:${dados.mimeType || 'audio/wav'};base64,${dados.audio}`;
    if (codigo) void guardarNoCache(codigo, src);
    return src;
  } catch { return null; }
}

// ---- Voz do aparelho (grátis): escolhe sozinha a pt-BR mais natural; a pessoa pode escolher outra em Configurações. ----
// A escolha fica guardada por usuário neste aparelho (cada aparelho tem as suas vozes). Vazio = automática.
const CHAVE_VOZ = 'murade_voz_assistente_v2';
const chaveVoz = (): string => `${CHAVE_VOZ}:${usuarioDaVozAtual()}`;
// A escolha antiga valia para o aparelho inteiro e podia prender uma voz robótica: sai, e todos voltam para a mais natural.
try { if (typeof localStorage !== 'undefined') localStorage.removeItem?.('murade_voz_escolhida_v1'); } catch { /* ignora */ }

const sintese = (): SpeechSynthesis | null => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);
function lerVozesDoAparelho(): SpeechSynthesisVoice[] {
  try { return sintese()?.getVoices() || []; } catch { return []; }
}

// As vozes do navegador chegam com atraso (evento voiceschanged): avisa a tela de Configurações e quem espera para falar.
const ouvintesVozes = new Set<() => void>();
function vozesMudaram(): void { ouvintesVozes.forEach((f) => { try { f(); } catch { /* ignora */ } }); }
(() => {
  const s = sintese();
  try { if (s && typeof s.addEventListener === 'function') s.addEventListener('voiceschanged', vozesMudaram); } catch { /* ignora */ }
})();
export function assinarVozes(f: () => void): () => void { ouvintesVozes.add(f); return () => { ouvintesVozes.delete(f); }; }

let jaEsperouVozes = false;
/** Espera as vozes do aparelho carregarem antes de escolher (no máximo `limiteMs`; o navegador nem sempre avisa). */
export function aguardarVozes(limiteMs = 2500): Promise<SpeechSynthesisVoice[]> {
  const temPortugues = () => lerVozesDoAparelho().some((v) => nivelDaVoz(v) >= 0);
  if (temPortugues() || (jaEsperouVozes && lerVozesDoAparelho().length)) return Promise.resolve(lerVozesDoAparelho());
  return new Promise((resolve) => {
    let feito = false;
    const fim = () => {
      if (feito) return;
      feito = true; jaEsperouVozes = true;
      window.clearInterval(relogio); window.clearTimeout(limite); ouvintesVozes.delete(aoMudar);
      resolve(lerVozesDoAparelho());
    };
    const aoMudar = () => { if (temPortugues()) fim(); };
    ouvintesVozes.add(aoMudar);
    const relogio = window.setInterval(aoMudar, 150);
    const limite = window.setTimeout(fim, limiteMs);
  });
}

/** Id da voz que a pessoa escolheu neste aparelho ('' = automática, a mais natural). */
export function vozEscolhidaPeloUsuario(): string {
  try { return localStorage.getItem(chaveVoz()) || ''; } catch { return ''; }
}
export function definirVozDaAssistente(id: string): void {
  try { localStorage.setItem(chaveVoz(), id || ''); } catch { /* ignora */ } // vazio = automática
  vozesMudaram();
}
/** Vozes em português deste aparelho, da mais natural para a menos (nunca de outro idioma). */
export const vozesDaAssistente = (): SpeechSynthesisVoice[] => ordenarVozesPtBr(lerVozesDoAparelho());
/** A voz que o sistema escolhe sozinho (a mais natural deste aparelho). */
export const vozAutomatica = (): SpeechSynthesisVoice | null => escolherVozNatural(lerVozesDoAparelho());
/** A voz que vai falar agora: a escolhida pela pessoa ou, sem escolha, a mais natural. */
export const vozDaAssistenteAgora = (): SpeechSynthesisVoice | null => escolherVozNatural(lerVozesDoAparelho(), vozEscolhidaPeloUsuario());

/** Para telas que montam a própria fala: mesma voz, velocidade, tom e volume da Agente. */
export function aplicarVozNatural(u: SpeechSynthesisUtterance): SpeechSynthesisUtterance {
  const voz = vozDaAssistenteAgora();
  u.lang = voz?.lang ? voz.lang.replace('_', '-') : 'pt-BR';
  if (voz) u.voice = voz;
  u.rate = velocidadeVoz;
  u.pitch = TOM_NATURAL;
  u.volume = volumeVoz;
  return u;
}
/** Texto pronto para a voz (sem markdown, emojis e links; valores, datas e siglas falados do jeito certo). */
export const textoParaFala = (texto: string): string => prepararTextoParaFala(texto);

/** "Troca a voz": passa para a próxima voz em português deste aparelho e guarda a escolha. */
export function trocarVoz(): string {
  try {
    const lista = vozesDaAssistente();
    if (lista.length < 2) return 'Este aparelho só tem uma voz em português disponível.';
    const atual = vozDaAssistenteAgora();
    const i = Math.max(0, lista.findIndex((v) => atual !== null && idDaVoz(v) === idDaVoz(atual)));
    const j = (i + 1) % lista.length;
    // Deu a volta: volta para a automática (a mais natural).
    definirVozDaAssistente(j === 0 ? '' : idDaVoz(lista[j]));
    return 'Pronto, esta é a nova voz. Gostou?';
  } catch { return 'Não consegui trocar a voz agora.'; }
}

/** "Essa voz está robótica": volta para a voz mais natural deste aparelho (grátis). */
export function usarVozMaisNatural(): string {
  definirVozDaAssistente('');
  const melhor = vozAutomatica();
  if (!melhor) return 'Este aparelho não tem voz em português instalada. Instale a voz Português do Brasil nas configurações de fala do aparelho.';
  if (nivelDaVoz(melhor) >= 3) return 'Pronto, passei para a voz mais natural deste aparelho.';
  return 'Pronto, passei para a melhor voz deste aparelho. Para uma voz ainda mais humana, e grátis: no computador, use o navegador Edge; no iPhone, baixe a voz Luciana melhorada em Ajustes, Acessibilidade, Conteúdo Falado.';
}

// ---- Voz do navegador: por frases curtas, com proteção contra falha silenciosa e bloqueio do navegador ----
const esperar = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

function falarTrecho(texto: string, voz: SpeechSynthesisVoice | null): Promise<boolean | 'interrompido'> {
  return new Promise((resolve) => {
    try {
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = voz?.lang ? voz.lang.replace('_', '-') : 'pt-BR';
      u.rate = velocidadeVoz;
      u.pitch = TOM_NATURAL;
      u.volume = volumeVoz;
      if (voz) u.voice = voz;
      let iniciou = false;
      // Voz de rede (Edge Natural, Google) leva mais tempo para começar a primeira frase.
      const espera = voz && voz.localService === false ? 5000 : 2500;
      const vigia = window.setTimeout(() => { if (!iniciou) { try { window.speechSynthesis.cancel(); } catch { /* ignora */ } resolve(false); } }, espera);
      u.onstart = () => { iniciou = true; window.clearTimeout(vigia); };
      u.onend = () => { window.clearTimeout(vigia); resolve(true); };
      // Cortada por outro código depois de já ter começado (ex.: um clique na tela): não é falha, é interrupção.
      u.onerror = (ev) => { window.clearTimeout(vigia); const motivo = String((ev as SpeechSynthesisErrorEvent)?.error || ''); resolve(iniciou && (motivo === 'interrupted' || motivo === 'canceled') ? 'interrompido' : false); };
      // Guarda a fala atual: sem isso o Chrome às vezes descarta a frase no meio.
      try { (window as unknown as { __muradeFalaAtual?: unknown }).__muradeFalaAtual = u; } catch { /* ignora */ }
      window.speechSynthesis.speak(u);
    } catch { resolve(false); }
  });
}

function mostrarDicaVoz(): void {
  try {
    if (document.getElementById('murade-dica-voz')) return;
    const d = document.createElement('div');
    d.id = 'murade-dica-voz';
    d.textContent = '🔊 Toque aqui para liberar a voz';
    d.style.cssText = 'position:fixed;right:12px;bottom:56px;z-index:2147483000;background:#0a2342;color:#fff;padding:9px 14px;border-radius:14px;font:600 13px sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.3);cursor:pointer';
    d.onclick = () => { d.remove(); liberarVoz(); };
    document.body.appendChild(d);
    window.setTimeout(() => d.remove(), 20000);
  } catch { /* ignora */ }
}

function liberarVoz(): void {
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis.speak(u); } catch { /* ignora */ }
  const pendente = falaPendente;
  falaPendente = null;
  document.getElementById('murade-dica-voz')?.remove();
  if (pendente) void falarNoNavegador(pendente, sequencia);
}

// O navegador só deixa falar depois de um toque na página; o primeiro toque libera a voz.
if (typeof window !== 'undefined') {
  const eventos = ['pointerdown', 'touchstart', 'keydown', 'click'];
  const aoToque = () => { liberarVoz(); eventos.forEach((e) => window.removeEventListener(e, aoToque, true)); };
  eventos.forEach((e) => window.addEventListener(e, aoToque, true));
}

async function falarNoNavegador(texto: string, minha: number, vozPedida?: string): Promise<void> {
  if (!sintese()) return;
  // As vozes chegam com atraso na primeira vez: espera carregar para escolher a mais natural (e nunca uma de outro idioma).
  await aguardarVozes();
  if (minha !== sequencia) return;
  const voz = escolherVozNatural(lerVozesDoAparelho(), vozPedida !== undefined ? vozPedida : vozEscolhidaPeloUsuario());
  // Depois de cancelar, o Chrome pode engolir a fala seguinte: espera um instante.
  await esperar(80);
  // Uma frase por vez: a pausa entre elas soa natural.
  const trechos = dividirEmFrases(texto);
  for (let i = 0; i < trechos.length; i += 1) {
    if (minha !== sequencia) return;
    let ok = await falarTrecho(trechos[i], voz);
    // Interrompida no meio por um clique ou outra fala alheia: segue para o próximo trecho, sem repetir a frase.
    if (ok === 'interrompido') { if (minha === sequencia) await esperar(120); continue; }
    if (!ok && minha === sequencia) { await esperar(200); ok = await falarTrecho(trechos[i], voz); if (ok === 'interrompido') continue; }
    if (!ok) {
      if (minha === sequencia) { falaPendente = trechos.slice(i).join(' '); mostrarDicaVoz(); }
      return;
    }
  }
}

/** Botão "Ouvir exemplo" das Configurações: fala uma frase com a voz escolhida ('' = automática). Não gasta nada. */
export async function ouvirExemploDaVoz(idVoz: string, aoTerminar?: () => void): Promise<void> {
  pararHumana();
  const minha = sequencia;
  falandoFlag = true;
  avisarMudancaAgente();
  try { await falarNoNavegador(prepararTextoParaFala(FRASE_EXEMPLO_VOZ), minha, idVoz); }
  finally {
    if (minha === sequencia) { falandoFlag = false; avisarMudancaAgente(); }
    aoTerminar?.();
  }
}

export async function falarHumana(texto: string, aoTerminar?: () => void): Promise<void> {
  pararHumana();
  const minha = sequencia;
  // Sem markdown, emojis e links; valores em reais, datas e siglas do jeito que se fala.
  const limpo = prepararTextoParaFala(texto);
  // "Falar as respostas" desligado (configuração da Agente): só o texto aparece.
  if (!limpo || !falarRespostasLigado()) { aoTerminar?.(); return; }
  falandoFlag = true;
  avisarMudancaAgente();
  const controle = typeof AbortController !== 'undefined' ? new AbortController() : null;
  pedidoVoz = controle;
  try {
    // Voz premium (Gemini) só em respostas curtas, para o custo ficar baixo. O resto usa a voz do navegador.
    const usarPremium = vozPremiumLigada() && limpo.length <= 260;
    if (!usarPremium) {
      await falarNoNavegador(limpo, minha);
      return;
    }
    const trechos = dividirEmTrechos(limpo);
    let proximo = buscarAudio(trechos[0], controle?.signal);
    for (let i = 0; i < trechos.length; i += 1) {
      const src = await proximo;
      if (minha !== sequencia) return;
      if (i + 1 < trechos.length) proximo = buscarAudio(trechos[i + 1], controle?.signal);
      if (!src) { await falarNoNavegador(trechos.slice(i).join(' '), minha); break; }
      await new Promise<void>((resolver) => {
        const resolve = () => { if (soltarAudio === resolve) soltarAudio = null; resolver(); };
        soltarAudio = resolve;
        const audio = new Audio(src);
        audio.volume = volumeVoz;
        audio.playbackRate = velocidadeVoz;
        audioAtual = audio;
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
      if (minha !== sequencia) return;
    }
  } finally {
    if (pedidoVoz === controle) pedidoVoz = null;
    if (minha === sequencia) { falandoFlag = false; audioAtual = null; avisarMudancaAgente(); aoTerminar?.(); }
  }
}

/** Respostas prontas para conversa de rotina ("obrigado", "ok", "tchau"): grátis e instantâneas, sem chamar a IA. */
export function respostaRapida(texto: string): string | null {
  const t = texto.trim();
  if (!t || t.split(' ').length > 5) return null;
  if (/^(muito )?(obrigad[oa]|valeu|brigad[oa]|obg)( (pela ajuda|viu|a voce|ok))?$/.test(t) || /^(ok|okay|certo|beleza|entendi|ta bom|tudo bem|combinado|perfeito|show) (muito )?(obrigad[oa]|valeu)$/.test(t)) return 'De nada! Estou à disposição.';
  if (/^(de nada|por nada|imagina)$/.test(t)) return 'Sempre à disposição.';
  if (/^(ok|okay|certo|beleza|entendi|ta bom|tudo bem|combinado|perfeito|show|ta certo)$/.test(t)) return 'Certo! Qualquer coisa é só chamar.';
  if (/^(tchau|ate logo|ate mais|ate amanha|encerrar|finalizar|pode encerrar)$/.test(t)) return 'Até logo! Estou aqui quando precisar.';
  if (/^(bom dia|boa tarde|boa noite|ola|oi|e ai)$/.test(t)) {
    const h = new Date().getHours();
    return `${h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'}! Em que posso ajudar?`;
  }
  return null;
}
