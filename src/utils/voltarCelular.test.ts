import test from 'node:test';
import assert from 'node:assert/strict';
import { ControleVoltar, criarEstadoVoltar, lerEstadoVoltar, JANELA_REDIRECIONAMENTO_MS, type HistoricoNavegador } from './voltarCelular';

test('lê só estados do sistema; entrada de fora (link com #, roteador) é ignorada', () => {
  assert.equal(lerEstadoVoltar(null), null);
  assert.equal(lerEstadoVoltar({}), null);
  assert.equal(lerEstadoVoltar({ murade: true }), null);
  assert.equal(lerEstadoVoltar({ murade: 'sim', tela: 'x' }), null);
  assert.deepEqual(lerEstadoVoltar({ murade: true, tela: 'x', n: 3 }), { murade: true, tela: 'x', n: 3 });
  assert.deepEqual(lerEstadoVoltar({ murade: true, tela: 'x', n: 2, camada: true }), { murade: true, tela: 'x', n: 2, camada: true });
  assert.equal(lerEstadoVoltar({ murade: true, tela: 'x', n: -1 })?.n, 0);
});

test('criar estado preserva o que o roteador guardou na mesma entrada', () => {
  const e = criarEstadoVoltar('folha', 2, false, { usr: null, key: 'abc', idx: 0, murade: true, tela: 'velha', base: true, n: 9 });
  assert.deepEqual(e, { usr: null, key: 'abc', idx: 0, murade: true, tela: 'folha', n: 2 });
});

// ---------------------------------------------------------------------------------------------------------------
// Histórico de mentira que imita o Chrome do celular: a entrada que a página deixou para trás criando outra SEM
// toque da pessoa é PULADA pelo botão voltar. Na primeira entrada, o voltar sai do app.
// ---------------------------------------------------------------------------------------------------------------
function navegador() {
  type Entrada = { estado: unknown; tocou: boolean; pular: boolean };
  const pilha: Entrada[] = [{ estado: null, tocou: false, pular: false }];
  let i = 0;
  let relogio = 1_000;
  let saiu = false;
  const tarefas: Array<() => void> = [];
  let aoVoltar: (estado: unknown) => void = () => undefined;
  const h: HistoricoNavegador = {
    get state() { return pilha[i].estado; },
    pushState(estado) { if (!pilha[i].tocou) pilha[i].pular = true; pilha.length = i + 1; pilha.push({ estado, tocou: false, pular: false }); i += 1; },
    replaceState(estado) { pilha[i].estado = estado; },
    back() { if (i > 0) { i -= 1; pilha[i].tocou = false; aoVoltar(pilha[i].estado); } },
  };
  return {
    h,
    agora: () => relogio,
    depois: (f: () => void) => { tarefas.push(f); },
    ligarVoltar(f: (estado: unknown) => void) { aoVoltar = f; },
    /** Toque da pessoa na tela. */
    tocar() { pilha[i].tocou = true; },
    passar(ms: number) { relogio += ms; },
    rodarTarefas() { while (tarefas.length) tarefas.shift()!(); },
    /** Botão voltar do celular (pula as entradas marcadas, como o Chrome). */
    voltar() {
      let j = i - 1;
      while (j >= 0 && pilha[j].pular) j -= 1;
      if (j < 0) { saiu = true; return; }
      i = j; pilha[i].tocou = false; relogio += 50; aoVoltar(pilha[i].estado);
    },
    get saiu() { return saiu; }, get entradas() { return pilha.length; }, get posicao() { return i; },
  };
}

/** App de mentira: telas + coisas abertas por cima, ligado ao controle como o hook liga. */
function app(telaInicial = 'inicio', telaAoAbrir = telaInicial) {
  const nav = navegador();
  let tela = telaAoAbrir;
  const abertos = new Map<string, () => void>();
  const c = new ControleVoltar(nav.h, nav.agora, nav.depois);
  const irPara = (t: string) => { tela = t; c.telaMudou(t); };
  nav.ligarVoltar((e) => c.aoVoltar(e));
  c.ligar({ telaAtual: tela, telaInicial, irParaTela: irPara });
  const fecharSemVoltar = (nome: string) => { const tirar = abertos.get(nome); abertos.delete(nome); tirar?.(); };
  return {
    nav, c,
    /** A pessoa toca num botão do menu/tela que abre outra tela. */
    tocarETrocar(t: string) { nav.tocar(); c.toque(); nav.passar(300); irPara(t); nav.rodarTarefas(); },
    /** A tela muda sem toque (Agente por voz, redirecionamento, piloto). */
    trocarSozinha(t: string) { nav.passar(900); irPara(t); nav.rodarTarefas(); },
    /** Toque que abre o menu/janela. */
    tocarEAbrir(nome: string) {
      nav.tocar(); c.toque();
      const tirar = c.abrirCamada(() => { abertos.delete(nome); });
      abertos.set(nome, tirar);
    },
    abrirSozinho(nome: string) { const tirar = c.abrirCamada(() => { abertos.delete(nome); }); abertos.set(nome, tirar); },
    /** Toque no X da janela. */
    tocarEFechar(nome: string) { nav.tocar(); c.toque(); fecharSemVoltar(nome); nav.rodarTarefas(); },
    /** Toque num item do menu do celular: fecha o menu e abre a tela no mesmo toque. */
    tocarItemDoMenu(nome: string, t: string) { nav.tocar(); c.toque(); fecharSemVoltar(nome); tela = t; c.telaMudou(t); nav.rodarTarefas(); },
    /** A Agente (sem toque novo) fecha o painel dela e abre a tela pedida. */
    agenteFechaETroca(nome: string, t: string) { nav.passar(2500); fecharSemVoltar(nome); tela = t; c.telaMudou(t); nav.rodarTarefas(); },
    voltar() { nav.voltar(); nav.rodarTarefas(); nav.passar(JANELA_REDIRECIONAMENTO_MS + 100); },
    get tela() { return tela; }, get aberto() { return [...abertos.keys()]; },
  };
}

test('abrir o app não cria entrada nova (nada para o Chrome pular)', () => {
  const a = app();
  assert.equal(a.nav.entradas, 1);
  assert.deepEqual(lerEstadoVoltar(a.nav.h.state), { murade: true, tela: 'inicio', n: 0 });
  a.voltar();
  assert.equal(a.nav.saiu, true); // na tela inicial o voltar sai do app
});

test('telas abertas por toque: o voltar volta uma por uma até o Início e só então sai', () => {
  const a = app();
  a.tocarETrocar('funcionarios');
  a.tocarETrocar('rescisao');
  a.tocarETrocar('cad-sindicato');
  a.voltar(); assert.equal(a.tela, 'rescisao');
  a.voltar(); assert.equal(a.tela, 'funcionarios');
  a.voltar(); assert.equal(a.tela, 'inicio');
  assert.equal(a.nav.saiu, false);
  a.voltar(); assert.equal(a.nav.saiu, true);
});

test('menu do celular: o voltar fecha só o menu; item do menu reaproveita a entrada (sem voltar fantasma)', () => {
  const a = app();
  a.tocarETrocar('folha');
  a.tocarEAbrir('menu');
  a.voltar();
  assert.deepEqual(a.aberto, []);
  assert.equal(a.tela, 'folha'); // continuou na mesma tela
  a.tocarEAbrir('menu');
  a.tocarItemDoMenu('menu', 'ferias');
  assert.equal(a.tela, 'ferias');
  a.voltar(); assert.equal(a.tela, 'folha'); // não precisa apertar duas vezes
  a.voltar(); assert.equal(a.tela, 'inicio');
  a.voltar(); assert.equal(a.nav.saiu, true);
});

test('janela fechada pelo X: a entrada dela sai do histórico (o próximo voltar troca de tela de verdade)', () => {
  const a = app();
  a.tocarETrocar('empresa');
  a.tocarEAbrir('calculadora');
  a.tocarEFechar('calculadora');
  a.voltar();
  assert.equal(a.tela, 'inicio');
});

test('depois de fechar o menu com o voltar, as telas anteriores continuam (o Chrome não pula nenhuma)', () => {
  const a = app();
  a.tocarETrocar('empresa');
  a.tocarETrocar('cargos');
  a.tocarEAbrir('menu');
  a.voltar(); // fecha o menu
  a.voltar(); assert.equal(a.tela, 'empresa');
  a.voltar(); assert.equal(a.tela, 'inicio');
  assert.equal(a.nav.saiu, false);
});

test('tela aberta pela Agente (sem toque) também volta; o painel da Agente aberto por toque fecha primeiro', () => {
  const a = app();
  a.tocarETrocar('funcionarios');
  a.tocarEAbrir('agente');
  // A Agente fecha o próprio painel e abre a tela pedida (no mesmo instante: a entrada do painel é reaproveitada).
  a.agenteFechaETroca('agente', 'rescisao');
  assert.equal(a.tela, 'rescisao');
  a.voltar(); assert.equal(a.tela, 'funcionarios');
  a.voltar(); assert.equal(a.tela, 'inicio');
});

test('Agente com o painel aberto troca telas sozinha (voz, sem toque): o voltar volta para a tela onde a pessoa estava', () => {
  const a = app();
  a.tocarETrocar('folha');
  a.tocarEAbrir('agente'); // o toque que abre o painel guarda a entrada da folha
  a.trocarSozinha('rescisao');
  a.trocarSozinha('ferias');
  a.voltar();
  assert.equal(a.tela, 'folha');
  assert.deepEqual(a.aberto, []); // o painel fechou junto
  a.voltar(); assert.equal(a.tela, 'inicio');
  assert.equal(a.nav.saiu, false);
});

test('o "Voltar" da própria tela anda junto com o histórico (não cresce A → B → A)', () => {
  const a = app();
  a.tocarETrocar('empresa');
  a.tocarETrocar('cargos');
  const antes = a.nav.entradas;
  a.nav.tocar(); a.c.toque(); a.nav.passar(200);
  a.c.telaMudou('empresa'); // botão Voltar da tela
  assert.equal(a.nav.posicao, 1);
  assert.equal(a.nav.entradas, antes);
});

test('redirecionamento logo depois do voltar substitui (não cria laço)', () => {
  const a = app();
  a.tocarETrocar('admin');
  a.tocarETrocar('relatorios');
  a.nav.voltar(); // volta para admin...
  a.c.telaMudou('inicio'); // ...que redireciona na hora para o início (tela restrita)
  assert.equal(lerEstadoVoltar(a.nav.h.state)?.tela, 'inicio');
  assert.equal(a.nav.posicao, 1);
});

test('janela aberta sozinha (sem toque) não ganha entrada: o voltar fecha junto e volta a tela', () => {
  const a = app();
  a.tocarETrocar('folha');
  a.abrirSozinho('aviso');
  a.voltar();
  assert.deepEqual(a.aberto, []);
  assert.equal(a.tela, 'inicio');
});

test('abriu direto numa tela (link/atalho): a tela abre e o voltar sai do app sem travar', () => {
  const a = app('inicio', 'guias');
  assert.deepEqual(lerEstadoVoltar(a.nav.h.state), { murade: true, tela: 'guias', n: 0 });
  a.tocarETrocar('empresa');
  a.voltar(); assert.equal(a.tela, 'guias');
  a.voltar(); assert.equal(a.nav.saiu, true);
});

test('entrada criada por link com # é adotada pela próxima tela e telas de passagem não entram', () => {
  const nav = navegador();
  const c = new ControleVoltar(nav.h, nav.agora, nav.depois);
  c.ligar({ telaAtual: 'inicio', telaInicial: 'inicio', irParaTela: () => undefined, telasSemHistorico: ['dr_beni'] });
  nav.h.pushState(null); // link com #
  assert.equal(c.telaMudou('acessos'), 'substituiu');
  assert.equal(c.telaMudou('dr_beni'), 'nada');
  assert.equal(c.aoVoltar({ outro: 1 }), 'ignorado');
});

test('fechar uma janela nunca trava o voltar', () => {
  const nav = navegador();
  const c = new ControleVoltar(nav.h, nav.agora, nav.depois);
  let tela = 'a';
  c.ligar({ telaAtual: tela, telaInicial: 'a', irParaTela: (t) => { tela = t; } });
  nav.ligarVoltar((e) => c.aoVoltar(e));
  nav.tocar(); c.toque();
  c.abrirCamada(() => { throw new Error('quebrou'); });
  nav.voltar();
  assert.equal(c.quantasCamadas, 0);
  assert.equal(tela, 'a');
});
