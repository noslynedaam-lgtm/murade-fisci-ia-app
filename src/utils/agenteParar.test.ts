import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ehComandoParar, ehComandoContinuar, ehCancelarServico, fraseDepoisDeParar, FRASE_PAREI, FRASE_PAREI_SERVICO,
  registrarParador, pararTudo, continuarDeOndeParou, agenteAgindo, definirServicoRodando, lembretesSilenciados,
} from './agenteParar';

// "Para": a Agente tem que parar NA HORA. Detecção feita no navegador, sem IA.

test('comando de parar: palavra isolada, com e sem acento, maiúscula/minúscula e pontuação', () => {
  for (const t of ['para', 'Para.', 'PARA!', 'pare', 'parar', 'chega', 'silêncio', 'Silencio', 'cala', 'stop', 'Stop!', 'espera', 'pausa', 'Pausa…', 'para, para!']) {
    assert.equal(ehComandoParar(t), true, t);
  }
});

test('comando de parar no começo da frase', () => {
  for (const t of ['para de falar', 'Pare agora', 'para tudo', 'espera um pouco', 'chega de falar sobre isso', 'cala a boca', 'silêncio por favor', 'stop please', 'para por favor', 'Fiscal, para', 'ei, para', 'pausa aí', 'para com isso']) {
    assert.equal(ehComandoParar(t), true, t);
  }
});

test('NÃO é comando: "para" no meio da frase ou como preposição', () => {
  for (const t of ['não para de falar', 'ela não para', 'para que serve o DAS?', 'para quando é o vencimento', 'pare o robô de notas', 'pausa o robô de saídas', 'gera a guia para a empresa', 'quero parar a empresa', 'espera a nota chegar e lança', '', '   ']) {
    assert.equal(ehComandoParar(t), false, t);
  }
});

test('continuar e cancelar o serviço', () => {
  for (const t of ['continua', 'Continue', 'pode continuar', 'continua de onde parou', 'segue', 'retoma']) assert.equal(ehComandoContinuar(t), true, t);
  for (const t of ['continua a nota 123', 'para', 'continuar o cadastro da empresa x']) assert.equal(ehComandoContinuar(t), false, t);
  assert.equal(ehCancelarServico('cancela o serviço'), true);
  assert.equal(ehCancelarServico('Cancelar esse serviço, por favor'), true);
  assert.equal(ehCancelarServico('para'), false);
  assert.equal(ehComandoParar('cancela o serviço'), false, '"cancela o serviço" é outro comando (com cartão), não o "para"');
});

test('frase depois de parar: curta; avisa quando o serviço continua no servidor', () => {
  assert.equal(fraseDepoisDeParar(false), 'Ok, parei.');
  assert.equal(FRASE_PAREI, 'Ok, parei.');
  assert.match(fraseDepoisDeParar(true), /^Ok, parei\. O serviço continua por trás; se quiser cancelar, diga 'cancela o serviço'\.$/);
  assert.equal(fraseDepoisDeParar(true), FRASE_PAREI_SERVICO);
});

test('central: pararTudo corta todos, "continua" retoma só o que dá e o serviço do servidor não é cancelado', () => {
  const log: string[] = [];
  let falando = true; let piloto = true; let apresentacao = true;
  const s1 = registrarParador({ id: 't-voz', ativo: () => falando, parar: () => { log.push('voz'); const a = falando; falando = false; return a ? {} : false; } });
  const s2 = registrarParador({ id: 't-piloto', ativo: () => piloto, parar: () => { log.push('piloto'); piloto = false; return { retomavel: true }; }, continuar: () => { log.push('piloto-continua'); piloto = true; } });
  const s3 = registrarParador({ id: 't-apres', ativo: () => apresentacao, parar: () => { log.push('apres'); apresentacao = false; return { retomavel: true }; }, continuar: () => { log.push('apres-continua'); apresentacao = true; } });
  assert.equal(agenteAgindo(), true);
  const r = pararTudo('texto');
  assert.equal(r.parouAlgo, true);
  assert.deepEqual(log.sort(), ['apres', 'piloto', 'voz']);
  assert.equal(agenteAgindo(), false);
  assert.equal(r.frase, 'Ok, parei.');
  assert.equal(lembretesSilenciados(), true, 'lembretes repetidos ficam mudos depois do "para"');
  assert.equal(continuarDeOndeParou(), true);
  assert.ok(log.includes('piloto-continua') && log.includes('apres-continua'));
  assert.equal(continuarDeOndeParou(), false, 'nada mais para retomar');
  definirServicoRodando('t-servico', true);
  const r2 = pararTudo('voz');
  assert.equal(r2.servicoRodando, true);
  assert.equal(r2.frase, FRASE_PAREI_SERVICO);
  definirServicoRodando('t-servico', false);
  s1(); s2(); s3();
});

// ---------------------------------------------------------------- controlador de fala (voz premium + voz do navegador)
async function ambienteFalso() {
  const ev: string[] = [];
  const g = globalThis as any;
  const sinais: AbortSignal[] = [];
  class AudioFalso {
    src: string; volume = 1; playbackRate = 1; onended: (() => void) | null = null; onerror: (() => void) | null = null; pausado = false;
    constructor(src: string) { this.src = src; ev.push('audio-criado'); }
    play() { ev.push('play'); return Promise.resolve(); } // nunca termina sozinho: só o "para" interrompe
    pause() { this.pausado = true; ev.push('pause'); }
    removeAttribute() { ev.push('descartado'); } load() { /* ignora */ }
  }
  const sintese = { speaking: false, onvoiceschanged: null as unknown, getVoices: () => [{ name: 'Google português do Brasil', lang: 'pt-BR' }], cancel() { ev.push('cancel'); }, speak() { ev.push('speak'); } };
  g.window = Object.assign(g, { speechSynthesis: sintese, addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, dispatchEvent() { return true; } });
  g.Audio = AudioFalso;
  g.SpeechSynthesisUtterance = class { constructor(public text: string) {} };
  g.document = { getElementById: () => null, createElement: () => ({ style: {}, setAttribute() {}, append() {}, remove() {} }), body: { appendChild() {} } };
  const loja = new Map<string, string>([['murade_voz_premium_v1', '1']]);
  g.localStorage = { getItem: (k: string) => loja.get(k) ?? null, setItem: (k: string, v: string) => { loja.set(k, v); } };
  g.sessionStorage = { getItem: () => null, setItem() {} };
  g.CustomEvent = class { constructor(public type: string, public init?: unknown) {} };
  let pedidos = 0;
  g.fetch = (_url: string, init: { signal?: AbortSignal }) => {
    pedidos += 1;
    if (init?.signal) sinais.push(init.signal);
    // 1º trecho responde logo; os seguintes ficam pendurados até o abort (como um TTS lento).
    if (pedidos === 1) return Promise.resolve({ ok: true, json: async () => ({ audio: 'AAAA', mimeType: 'audio/wav' }) });
    return new Promise((_res, rej) => { init?.signal?.addEventListener('abort', () => { ev.push('tts-abortado'); rej(new Error('abort')); }); });
  };
  if (!g.crypto?.subtle) g.crypto = (await import('node:crypto')).webcrypto;
  return { ev, sinais, loja };
}

test('controlador de fala: "para" pausa e descarta o áudio, cancela a voz do navegador e aborta o TTS pendente', async () => {
  const { ev, sinais } = await ambienteFalso();
  const voz = await import(`./vozHumana?${Math.random()}`);
  const central = await import('./agenteParar');
  let terminou = 0;
  const texto = 'Primeira frase curta. ' + 'Segunda frase bem comprida, com bastante palavra para virar outro trecho de fala, e ainda mais texto. '.repeat(2);
  const fala = voz.falarHumana(texto.slice(0, 250), () => { terminou += 1; });
  for (let i = 0; i < 50 && !ev.includes('play'); i += 1) await new Promise((r) => setTimeout(r, 5));
  assert.ok(ev.includes('play'), 'o primeiro trecho começou a tocar');
  assert.equal(voz.humanaFalando(), true);
  assert.equal(central.agenteAgindo(), true, 'botão PARAR aparece enquanto ela fala');
  const r = central.pararTudo('voz');
  assert.equal(r.parouAlgo, true);
  assert.ok(ev.includes('pause'), 'áudio pausado');
  assert.ok(ev.includes('descartado'), 'áudio descartado (não retoma do meio)');
  assert.ok(ev.includes('cancel'), 'speechSynthesis cancelado');
  assert.ok(sinais.length >= 1 && sinais.every((s) => s.aborted), 'pedido de voz em andamento abortado');
  assert.equal(voz.humanaFalando(), false);
  assert.equal(central.agenteAgindo(), false);
  await fala;
  const tocados = ev.filter((e) => e === 'play').length;
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(ev.filter((e) => e === 'play').length, tocados, 'nenhum trecho da fila toca depois do "para"');
  assert.equal(terminou, 0, 'a fala cortada não dispara o "terminou" (não reabre nada sozinha)');
});

test('"Falar as respostas" desligado: não fala nada (só texto) e por usuário', async () => {
  const { ev } = await ambienteFalso();
  const voz = await import(`./vozHumana?${Math.random()}`);
  const central = await import('./agenteParar');
  central.definirUsuarioDaVoz('ana');
  central.definirFalarRespostas(false);
  assert.equal(central.falarRespostasLigado(), false);
  let terminou = false;
  await voz.falarHumana('Olá, tudo bem?', () => { terminou = true; });
  assert.equal(terminou, true);
  assert.ok(!ev.includes('play') && !ev.includes('speak'), 'nada foi falado');
  central.definirUsuarioDaVoz('bruno');
  assert.equal(central.falarRespostasLigado(), true, 'outro usuário no mesmo aparelho continua com a voz ligada');
  central.definirUsuarioDaVoz('ana');
  central.definirFalarRespostas(true);
  assert.equal(central.falarRespostasLigado(), true);
});
