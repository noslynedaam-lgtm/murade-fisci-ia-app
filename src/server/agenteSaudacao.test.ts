import test from 'node:test';
import assert from 'node:assert/strict';
import { diaDeHoje, extrairNomeDaResposta, fraseDeSaudacao, normalizarNomeTratamento, saudacaoDoHorario } from './agenteSaudacao';

// Horário de Brasília (UTC-3): 08:00 BRT = 11:00Z.
const em = (hh: number, mm = 0) => new Date(Date.UTC(2026, 10, 9, hh + 3, mm));

test('bom dia, boa tarde e boa noite pelo horário de Brasília', () => {
  assert.equal(saudacaoDoHorario(em(5, 0)), 'Bom dia');
  assert.equal(saudacaoDoHorario(em(11, 59)), 'Bom dia');
  assert.equal(saudacaoDoHorario(em(12, 0)), 'Boa tarde');
  assert.equal(saudacaoDoHorario(em(17, 59)), 'Boa tarde');
  assert.equal(saudacaoDoHorario(em(18, 0)), 'Boa noite');
  assert.equal(saudacaoDoHorario(em(23, 30)), 'Boa noite');
  assert.equal(saudacaoDoHorario(em(0, 10)), 'Boa noite');
  assert.equal(saudacaoDoHorario(em(4, 59)), 'Boa noite');
});

test('o dia vale em Brasília, não em UTC', () => {
  assert.equal(diaDeHoje(new Date(Date.UTC(2026, 10, 9, 2, 30))), '2026-11-08');
  assert.equal(diaDeHoje(new Date(Date.UTC(2026, 10, 9, 3, 0))), '2026-11-09');
});

test('extrai o nome do jeito que a pessoa fala', () => {
  const casos: Array<[string, string]> = [
    ['Aldair', 'Aldair'], ['herbert', 'Herbert'], ['Vessiano.', 'Vessiano'], ['meu nome é Herbert', 'Herbert'],
    ['Meu nome e aldair', 'Aldair'], ['pode me chamar de Beny', 'Beny'], ['sou o Vessiano', 'Vessiano'], ['Bom dia, eu sou a Maria José', 'Maria José'],
    ['me chamo João da Silva', 'João da Silva'], ['oi, aqui é o Carlos', 'Carlos'], ['Ana-Clara', 'Ana-Clara'], ["D'Ávila", "D'Ávila"],
  ];
  for (const [entrada, esperado] of casos) assert.equal(extrairNomeDaResposta(entrada), esperado, entrada);
});

test('o que não é nome não é gravado', () => {
  for (const m of ['sim', 'não', 'quero ver a folha de outubro da padaria', 'pode', 'bom dia', '', '12345', 'a b c d e', 'tchau', 'obrigado']) {
    assert.equal(extrairNomeDaResposta(m), '', m);
  }
  assert.equal(normalizarNomeTratamento('x'), '');
  assert.equal(normalizarNomeTratamento('<script>'), '');
});

test('frase de saudação com e sem nome', () => {
  assert.equal(fraseDeSaudacao('Herbert', em(8)), 'Bom dia, Herbert!');
  assert.equal(fraseDeSaudacao(null, em(15)), 'Boa tarde!');
  assert.equal(fraseDeSaudacao('Aldair', em(21)), 'Boa noite, Aldair!');
});
