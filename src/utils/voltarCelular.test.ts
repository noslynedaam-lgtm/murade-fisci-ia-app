import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
} from './voltarCelular';

test('lê só estados do sistema; entrada de fora (link com #, roteador) é ignorada', () => {
  assert.equal(lerEstadoVoltar(null), null);
  assert.equal(lerEstadoVoltar({}), null);
  assert.equal(lerEstadoVoltar({ murade: true }), null);
  assert.equal(lerEstadoVoltar({ murade: 'sim', tela: 'x' }), null);
  assert.deepEqual(lerEstadoVoltar({ murade: true, tela: 'x', n: 3 }), { murade: true, tela: 'x', n: 3 });
  assert.deepEqual(lerEstadoVoltar({ murade: true, tela: 'i', n: 0, base: true }), { murade: true, tela: 'i', n: 0, base: true });
  assert.equal(lerEstadoVoltar({ murade: true, tela: 'x', n: -1 })?.n, 0);
});

test('criar estado preserva o que o roteador guardou na mesma entrada', () => {
  const e = criarEstadoVoltar('folha', 2, false, { usr: null, key: 'abc', idx: 0, murade: true, tela: 'velha', base: true, n: 9 });
  assert.deepEqual(e, { usr: null, key: 'abc', idx: 0, murade: true, tela: 'folha', n: 2 });
});

test('ao abrir: entrada nova vira a base (tela inicial); recarregar numa tela só atualiza a tela', () => {
  assert.deepEqual(estadoAoAbrir(null, 'inicio', 'inicio'), { murade: true, tela: 'inicio', n: 0, base: true });
  assert.deepEqual(estadoAoAbrir(null, 'guias', 'inicio'), { murade: true, tela: 'inicio', n: 0, base: true });
  assert.deepEqual(estadoAoAbrir({ murade: true, tela: 'guias', n: 4 }, 'inicio', 'inicio'), { murade: true, tela: 'inicio', n: 4 });
  assert.deepEqual(estadoAoAbrir({ murade: true, tela: 'inicio', n: 0, base: true }, 'x', 'inicio'), { murade: true, tela: 'inicio', n: 0, base: true });
});

test('empilhar: nunca duplica a mesma tela; base nunca é trocada; redirecionamento logo após o voltar substitui', () => {
  const t = (tela: string, n: number) => ({ murade: true, tela, n });
  assert.equal(decidirEmpilhar(t('a', 1), 'a'), 'nada');
  assert.equal(decidirEmpilhar(t('a', 1), 'b'), 'empilhar');
  assert.equal(decidirEmpilhar({ murade: true, tela: 'inicio', n: 0, base: true }, 'inicio'), 'empilhar');
  assert.equal(decidirEmpilhar({ murade: true, tela: 'inicio', n: 0, base: true }, 'b', { logoAposVoltar: true }), 'empilhar');
  assert.equal(decidirEmpilhar(null, 'b'), 'substituir');
  assert.equal(decidirEmpilhar(t('admin', 3), 'inicio', { logoAposVoltar: true }), 'substituir');
  assert.equal(decidirEmpilhar(t('a', 1), 'dr_beni', { telasSemHistorico: ['dr_beni'] }), 'nada');
  assert.equal(decidirEmpilhar(t('b', 2), 'a', { telaAnterior: 'a' }), 'voltar');
  assert.equal(decidirEmpilhar(t('b', 2), 'c', { telaAnterior: 'a' }), 'empilhar');
  assert.equal(decidirEmpilhar(t('b', 2), '', {}), 'nada');
});

test('voltar: fecha o que está por cima primeiro, depois volta de tela, e na inicial só avisa', () => {
  const base = { murade: true, tela: 'inicio', n: 0, base: true };
  assert.deepEqual(decidirVoltar({ estado: null, telaAtual: 'a', telaInicial: 'inicio', temPorCima: true }), { tipo: 'ignorar' });
  assert.deepEqual(decidirVoltar({ estado: { murade: true, tela: 'a', n: 1 }, telaAtual: 'b', telaInicial: 'inicio', temPorCima: true }), { tipo: 'fechar-por-cima' });
  assert.deepEqual(decidirVoltar({ estado: { murade: true, tela: 'a', n: 1 }, telaAtual: 'b', telaInicial: 'inicio', temPorCima: false }), { tipo: 'ir-para-tela', tela: 'a' });
  assert.deepEqual(decidirVoltar({ estado: base, telaAtual: 'inicio', telaInicial: 'inicio', temPorCima: false }), { tipo: 'avisar-sair' });
  assert.deepEqual(decidirVoltar({ estado: base, telaAtual: 'b', telaInicial: 'inicio', temPorCima: false }), { tipo: 'ir-para-inicial' });
  assert.deepEqual(decidirVoltar({ estado: base, telaAtual: 'inicio', telaInicial: 'inicio', temPorCima: true }), { tipo: 'fechar-por-cima' });
  assert.deepEqual(decidirVoltar({ estado: { murade: true, tela: 'a', n: 1 }, telaAtual: 'a', telaInicial: 'inicio', temPorCima: false }), { tipo: 'nada' });
});

test('janela da tela só é tentada uma vez (nunca prende a pessoa)', () => {
  const el = {};
  assert.equal(deveTentarFecharDialogo(null, null), false);
  assert.equal(deveTentarFecharDialogo(el, null), true);
  assert.equal(deveTentarFecharDialogo(el, el), false);
  assert.equal(deveTentarFecharDialogo({}, el), true);
});

test('pilha do que está aberto por cima: fecha o último; quem não fecha sai da lista mesmo assim', () => {
  const fechados: string[] = [];
  const tirarMenu = registrarPorCima(() => fechados.push('menu'));
  registrarPorCima(() => { throw new Error('quebrou'); });
  registrarPorCima(() => fechados.push('agente'));
  assert.equal(quantosPorCima(), 3);
  assert.equal(fecharUltimoPorCima(), true);
  assert.deepEqual(fechados, ['agente']);
  assert.equal(fecharUltimoPorCima(), true); // o que deu erro sai da lista sem travar
  tirarMenu(); // o menu fechou sozinho (clicou num item)
  assert.equal(quantosPorCima(), 0);
  assert.equal(fecharUltimoPorCima(), false);
  tirarMenu(); // tirar duas vezes não faz mal
  assert.equal(quantosPorCima(), 0);
});

// Simulação do histórico do navegador + o que o hook faz, para conferir o caminho completo sem celular.
function simular(telaInicial: string, telaAoAbrir = telaInicial) {
  const pilha: unknown[] = [null];
  let i = 0;
  let tela = telaAoAbrir;
  let saiu = false;
  let avisos = 0;
  const porCima: string[] = [];
  const sincronizar = () => {
    const acao = decidirEmpilhar(pilha[i], tela);
    const n = (lerEstadoVoltar(pilha[i])?.n ?? 0) + 1;
    if (acao === 'empilhar') { pilha.length = i + 1; pilha.push(criarEstadoVoltar(tela, n)); i++; }
    else if (acao === 'substituir') pilha[i] = criarEstadoVoltar(tela, n - 1);
  };
  pilha[0] = estadoAoAbrir(pilha[0], tela, telaInicial);
  sincronizar();
  return {
    abrirTela(t: string) { tela = t; sincronizar(); },
    abrirPorCima(nome: string) { porCima.push(nome); },
    voltar() {
      if (i === 0) { saiu = true; return; }
      i--;
      const d = decidirVoltar({ estado: pilha[i], telaAtual: tela, telaInicial, temPorCima: porCima.length > 0 });
      if (d.tipo === 'fechar-por-cima') { porCima.pop(); pilha.length = i + 1; pilha.push(criarEstadoVoltar(tela, i + 1)); i++; }
      else if (d.tipo === 'ir-para-tela') { tela = d.tela; sincronizar(); }
      else if (d.tipo === 'ir-para-inicial') { tela = telaInicial; sincronizar(); }
      else if (d.tipo === 'avisar-sair') avisos++;
    },
    passouOTempoDoAviso() { if (lerEstadoVoltar(pilha[i])?.base) { pilha.length = i + 1; pilha.push(criarEstadoVoltar(tela, 1)); i++; } },
    get tela() { return tela; }, get saiu() { return saiu; }, get avisos() { return avisos; }, get porCima() { return porCima.length; }, get entradas() { return pilha.length; },
  };
}

test('caminho completo: telas, menu aberto, aviso de sair e saída só no segundo voltar', () => {
  const s = simular('inicio');
  s.abrirTela('departamento');
  s.abrirTela('funcionarios');
  s.abrirTela('funcionarios'); // re-render: não empilha
  assert.equal(s.entradas, 4);
  s.abrirPorCima('menu');
  s.voltar();
  assert.equal(s.porCima, 0);
  assert.equal(s.tela, 'funcionarios'); // primeiro voltar só fechou o menu
  s.voltar();
  assert.equal(s.tela, 'departamento');
  s.voltar();
  assert.equal(s.tela, 'inicio');
  s.voltar();
  assert.equal(s.avisos, 1);
  assert.equal(s.saiu, false); // na inicial, o primeiro voltar não fecha o app
  s.voltar();
  assert.equal(s.saiu, true); // segundo voltar dentro do tempo sai
});

test('passado o tempo do aviso, o próximo voltar avisa de novo em vez de sair', () => {
  const s = simular('inicio');
  s.voltar();
  assert.equal(s.avisos, 1);
  s.passouOTempoDoAviso();
  s.voltar();
  assert.equal(s.avisos, 2);
  assert.equal(s.saiu, false);
});

test('abriu direto numa tela interna: o voltar leva para a tela inicial', () => {
  const s = simular('inicio', 'guias');
  s.voltar();
  assert.equal(s.tela, 'inicio');
  assert.equal(s.saiu, false);
  s.voltar();
  assert.equal(s.avisos, 1);
  assert.equal(s.saiu, false);
});

test('textos e tempo do aviso', () => {
  assert.equal(TEXTO_AVISO_SAIR, 'Aperte voltar de novo para sair');
  assert.equal(JANELA_SAIR_MS, 2000);
});
