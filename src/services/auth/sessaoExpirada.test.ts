import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ErroSessaoExpirada, classificarFalhaLista, decidirAcaoSessao, deveRechecarSessao,
  statusIndicaSessaoExpirada, INTERVALO_RECHECAGEM_MS, ESCONDIDA_MINIMO_MS,
} from './sessaoExpirada';

test('401 é sessão expirada; 403 e 500 não', () => {
  assert.equal(statusIndicaSessaoExpirada(401), true);
  assert.equal(statusIndicaSessaoExpirada(403), false);
  assert.equal(statusIndicaSessaoExpirada(500), false);
});

test('decidirAcaoSessao: válida, expirada e indisponível', () => {
  assert.equal(decidirAcaoSessao({ autenticado: true }), 'sessao_valida');
  assert.equal(decidirAcaoSessao({ autenticado: false }), 'sessao_expirada');
  assert.equal(decidirAcaoSessao({ autenticado: false, mensagem: 'sem conexão' }), 'indisponivel');
});

test('falha de lista: 401 vira sessao_expirada, demais viram erro (nunca lista vazia)', () => {
  assert.equal(classificarFalhaLista(new ErroSessaoExpirada()), 'sessao_expirada');
  assert.equal(classificarFalhaLista(new Error('x')), 'erro');
  assert.equal(classificarFalhaLista('texto'), 'erro');
});

test('rechecagem: não roda com aba escondida; foco respeita tempo escondida; intervalo respeita período', () => {
  const base = { agora: 1_000_000, ultimaChecagem: 1_000_000 - 5000, abaVisivel: true };
  assert.equal(deveRechecarSessao({ ...base, abaVisivel: false, motivo: 'foco' }), false);
  assert.equal(deveRechecarSessao({ ...base, motivo: 'foco', escondidaDesde: base.agora - ESCONDIDA_MINIMO_MS }), true);
  assert.equal(deveRechecarSessao({ ...base, motivo: 'foco', escondidaDesde: base.agora - 2000 }), false);
  assert.equal(deveRechecarSessao({ ...base, motivo: 'intervalo' }), false);
  assert.equal(deveRechecarSessao({ ...base, motivo: 'intervalo', ultimaChecagem: base.agora - INTERVALO_RECHECAGEM_MS }), true);
});
