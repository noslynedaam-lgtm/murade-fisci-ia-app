// Voz humana (Gemini "Kore") com reserva na voz do navegador. Uma fala por vez; dá para interromper.
let audioAtual: HTMLAudioElement | null = null;
let sequencia = 0;
let falandoFlag = false;

// ---- Voz econômica (do navegador, grátis) é a padrão. A voz premium (Gemini) gasta a chave e só liga se pedirem. ----
const CHAVE_PREMIUM = 'murade_voz_premium_v1';
export const vozPremiumLigada = (): boolean => { try { return localStorage.getItem(CHAVE_PREMIUM) === '1'; } catch { return false; } };
const definirPremium = (ligada: boolean): void => { try { localStorage.setItem(CHAVE_PREMIUM, ligada ? '1' : '0'); } catch { /* ignora */ } };

// ---- Ajuste de volume e velocidade por comando de voz ("fala mais rápido", "aumenta a voz"). Fica salvo. ----
const CHAVE_AJUSTE = 'murade_voz_ajuste_v1';
let volumeVoz = 0.8;
let velocidadeVoz = 1;
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
  sequencia += 1;
  falandoFlag = false;
  if (audioAtual) { try { audioAtual.pause(); } catch { /* ignora */ } audioAtual = null; }
  try { window.speechSynthesis?.cancel(); } catch { /* ignora */ }
}

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

async function buscarAudio(trecho: string): Promise<string | null> {
  let codigo = '';
  try {
    codigo = await codigoDaFrase(trecho);
    const guardado = await lerDoCache(codigo);
    if (guardado) return guardado;
  } catch { /* segue para o servidor */ }
  try {
    const resp = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ text: trecho }) });
    if (!resp.ok) return null;
    const dados = await resp.json();
    if (!dados?.audio) return null;
    const src = `data:${dados.mimeType || 'audio/wav'};base64,${dados.audio}`;
    if (codigo) void guardarNoCache(codigo, src);
    return src;
  } catch { return null; }
}

function escolherVozDoNavegador(): SpeechSynthesisVoice | undefined {
  const vozes = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('pt'));
  const brasil = vozes.filter((v) => /br/i.test(v.lang));
  const lista = brasil.length ? brasil : vozes;
  const masculina = /daniel|antonio|ant[oô]nio|felipe|ricardo|male|jorge|diego|donato|humberto|thiago/i;
  const feminina = /maria|francisca|luciana|camila|vit[oó]ria|thalita|leticia|let[ií]cia|female/i;
  // Ordem: voz "Natural/Online" (Edge, a mais humana) > voz de rede do Google > voz feminina local > qualquer uma.
  return lista.find((v) => /natural|online/i.test(v.name) && !masculina.test(v.name))
    || lista.find((v) => /google/i.test(v.name))
    || lista.find((v) => feminina.test(v.name))
    || lista.find((v) => !masculina.test(v.name))
    || lista[0];
}

function falarNoNavegador(texto: string): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();
    const falar = () => {
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'pt-BR';
      u.rate = 1.0 * velocidadeVoz;
      u.pitch = 1.0;
      u.volume = volumeVoz;
      const voz = escolherVozDoNavegador();
      if (voz) u.voice = voz;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    };
    // As vozes às vezes demoram a carregar na primeira vez.
    if (window.speechSynthesis.getVoices().length) falar();
    else { let feito = false; const ir = () => { if (!feito) { feito = true; falar(); } }; window.speechSynthesis.onvoiceschanged = ir; window.setTimeout(ir, 600); }
  });
}

export async function falarHumana(texto: string, aoTerminar?: () => void): Promise<void> {
  pararHumana();
  const minha = sequencia;
  const limpo = texto.trim();
  if (!limpo) { aoTerminar?.(); return; }
  falandoFlag = true;
  try {
    // Voz premium (Gemini) só em respostas curtas, para o custo ficar baixo. O resto usa a voz do navegador.
    const usarPremium = vozPremiumLigada() && limpo.length <= 260;
    if (!usarPremium) {
      await falarNoNavegador(limpo);
      return;
    }
    const trechos = dividirEmTrechos(limpo);
    let proximo = buscarAudio(trechos[0]);
    for (let i = 0; i < trechos.length; i += 1) {
      const src = await proximo;
      if (minha !== sequencia) return;
      if (i + 1 < trechos.length) proximo = buscarAudio(trechos[i + 1]);
      if (!src) { await falarNoNavegador(trechos.slice(i).join(' ')); break; }
      await new Promise<void>((resolve) => {
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
    if (minha === sequencia) { falandoFlag = false; audioAtual = null; aoTerminar?.(); }
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
