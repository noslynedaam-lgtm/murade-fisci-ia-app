import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarMicrofone, detectarNavegador, explicarErroMicrofone, lerTempoSilencio, definirTempoSilencio, SILENCIO_PADRAO_MS } from './microfoneChat';

// Microfone dos chats: o MESMO teste nos 5 sistemas Murad (o módulo é copiado igual em cada um).
// Um clique liga; contínuo com texto parcial; para sozinho no silêncio e envia; segundo clique para e envia;
// religa quando o navegador corta antes; ignora o eco da assistente; erros explicados.

type Item = { isFinal: boolean; 0: { transcript: string }; length: number };
class ReconhecedorFalso {
  static instancias: ReconhecedorFalso[] = [];
  lang = ''; continuous = false; interimResults = false; maxAlternatives = 1;
  onresult: ((e: { results: Item[] }) => void) | null = null;
  onerror: ((e: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  iniciado = false; abortado = false; resultados: Item[] = [];
  constructor() { ReconhecedorFalso.instancias.push(this); }
  start() { this.iniciado = true; }
  stop() { this.onend?.(); }
  abort() { this.abortado = true; }
  fala(texto: string, final: boolean) {
    const ult = this.resultados[this.resultados.length - 1];
    if (ult && !ult.isFinal) this.resultados.pop();
    this.resultados.push({ isFinal: final, 0: { transcript: texto }, length: 1 });
    this.onresult?.({ results: [...this.resultados] });
  }
}
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ultimo = () => ReconhecedorFalso.instancias[ReconhecedorFalso.instancias.length - 1];

function montar(extra: Record<string, unknown> = {}) {
  ReconhecedorFalso.instancias = [];
  const ev = { estados: [] as boolean[], parciais: [] as string[], enviados: [] as string[], erros: [] as string[], antes: 0 };
  const mic = criarMicrofone({
    construtor: ReconhecedorFalso as never,
    silencioMs: () => 60,
    esperaInicialMs: 200,
    aoMudarEstado: (o) => ev.estados.push(o),
    aoParcial: (t) => ev.parciais.push(t),
    aoEnviar: (t) => ev.enviados.push(t),
    aoErro: (m) => ev.erros.push(m),
    antesDeOuvir: () => { ev.antes += 1; },
    ...extra,
  });
  return { mic, ev };
}

test('um clique liga (contínuo, parcial, pt-BR) e para a voz da assistente antes de ouvir', () => {
  const { mic, ev } = montar();
  assert.equal(mic.ligar(), true);
  const r = ultimo();
  assert.equal(r.iniciado, true);
  assert.equal(r.continuous, true);
  assert.equal(r.interimResults, true);
  assert.equal(r.lang, 'pt-BR');
  assert.equal(ev.antes, 1, 'a assistente para de falar (sem eco)');
  assert.deepEqual(ev.estados, [true]);
  assert.equal(mic.ouvindo(), true);
  mic.destruir();
});

test('texto parcial aparece enquanto fala e o silêncio desliga e envia', async () => {
  const { mic, ev } = montar();
  mic.ligar();
  ultimo().fala('qual o prazo', false);
  ultimo().fala('qual o prazo do FGTS', true);
  assert.deepEqual(ev.parciais, ['qual o prazo', 'qual o prazo do FGTS']);
  await esperar(30);
  assert.equal(mic.ouvindo(), true, 'ainda dentro do tempo de silêncio');
  await esperar(60);
  assert.equal(mic.ouvindo(), false);
  assert.deepEqual(ev.enviados, ['qual o prazo do FGTS']);
  assert.deepEqual(ev.estados, [true, false]);
  assert.equal(ultimo().abortado, true, 'microfone solto');
});

test('clicar de novo enquanto ouve para na hora e envia o que já foi dito (inclusive o parcial)', () => {
  const { mic, ev } = montar();
  mic.alternar();
  ultimo().fala('emitir a guia', false);
  mic.alternar();
  assert.equal(mic.ouvindo(), false);
  assert.deepEqual(ev.enviados, ['emitir a guia']);
});

test('navegador cortou antes do silêncio: religa e junta o texto das duas partes', async () => {
  const { mic, ev } = montar({ silencioMs: () => 1000 });
  mic.ligar();
  const primeiro = ultimo();
  primeiro.fala('quero a folha', true);
  primeiro.onend?.();
  await esperar(150);
  assert.equal(ReconhecedorFalso.instancias.length, 2, 'religou sozinho');
  assert.equal(mic.ouvindo(), true);
  ultimo().fala('de novembro', true);
  assert.equal(ev.parciais[ev.parciais.length - 1], 'quero a folha de novembro');
  mic.alternar();
  assert.deepEqual(ev.enviados, ['quero a folha de novembro']);
});

test('sem fala nenhuma: desliga sozinho sem enviar e avisa', async () => {
  const { mic, ev } = montar();
  mic.ligar();
  ultimo().onerror?.({ error: 'no-speech' });
  assert.equal(mic.ouvindo(), true, 'no-speech não é erro fatal');
  await esperar(260);
  assert.equal(mic.ouvindo(), false);
  assert.deepEqual(ev.enviados, []);
  assert.match(ev.erros[0], /Não ouvi nada/);
});

test('eco: o que chega enquanto a assistente fala é ignorado', () => {
  let falando = true;
  const { mic, ev } = montar({ assistenteFalando: () => falando });
  mic.ligar();
  ultimo().fala('aqui é a agente falando', true);
  falando = false;
  ultimo().fala('minha pergunta', true);
  mic.alternar();
  assert.deepEqual(ev.enviados, ['minha pergunta']);
});

test('erros: microfone bloqueado explica como liberar; sem suporte orienta o navegador', () => {
  const { mic, ev } = montar();
  mic.ligar();
  ultimo().onerror?.({ error: 'not-allowed' });
  assert.equal(mic.ouvindo(), false);
  assert.match(ev.erros[0], /bloqueado/);
  assert.match(ev.erros[0], /Chrome/); assert.match(ev.erros[0], /Edge/); assert.match(ev.erros[0], /Samsung Internet/); assert.match(ev.erros[0], /iPhone/);
  const sem = montar({ construtor: null });
  assert.equal(sem.mic.ligar(), false);
  assert.match(sem.ev.erros[0], /não reconhece fala/);
  assert.match(explicarErroMicrofone('audio-capture'), /microfone/);
  assert.match(explicarErroMicrofone('not-allowed', 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36'), /^O microfone está bloqueado para este site \(sem permissão\)\. Para liberar: Samsung Internet:/);
});

test('navegador detectado e tempo de silêncio ajustável (padrão 2,5 s)', () => {
  assert.equal(detectarNavegador('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'), 'iphone');
  assert.equal(detectarNavegador('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0'), 'edge');
  assert.equal(detectarNavegador('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'), 'chrome');
  const g = globalThis as { localStorage?: unknown };
  const antes = g.localStorage;
  const loja = new Map<string, string>();
  g.localStorage = { getItem: (k: string) => loja.get(k) ?? null, setItem: (k: string, v: string) => { loja.set(k, v); } };
  try {
    assert.equal(lerTempoSilencio(), SILENCIO_PADRAO_MS);
    assert.equal(SILENCIO_PADRAO_MS, 2500);
    definirTempoSilencio(3000);
    assert.equal(lerTempoSilencio(), 3000);
  } finally { g.localStorage = antes; }
});
