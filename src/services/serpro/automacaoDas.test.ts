import test from 'node:test';
import assert from 'node:assert/strict';
import { decidirDas, estadoDaAutorizacao, interpretarRespostaWhatsApp, vencimentoDas } from './automacaoDas';

const base = { cnpj: '11222333000181', competencia: '202610', regime: 'simples' as const, receitaBrutaCentavos: 0, notasSaidaNoMes: 0, notasEntradaNoMes: 0 };
const op = { transmitirZeradasAutomatico: true, prazoAutorizacaoHoras: 48 };

test('zerada de verdade transmite sozinha', () => assert.equal(decidirDas(base, op).acao, 'transmitir_zerada'));
test('com movimento nunca transmite sozinha', () => assert.equal(decidirDas({ ...base, receitaBrutaCentavos: 150000, notasSaidaNoMes: 2 }, op).acao, 'pedir_autorizacao'));
test('dado ausente não vira zero', () => assert.equal(decidirDas({ ...base, receitaBrutaCentavos: null }, op).acao, 'avisar_pendencia'));
test('sem receita mas com nota de entrada pede conferência', () => assert.equal(decidirDas({ ...base, notasEntradaNoMes: 1 }, op).acao, 'pedir_autorizacao'));
test('opção automática desligada pede autorização', () => assert.equal(decidirDas(base, { ...op, transmitirZeradasAutomatico: false }).acao, 'pedir_autorizacao'));
test('já transmitida e sem procuração', () => {
  assert.equal(decidirDas({ ...base, jaTransmitida: true }, op).acao, 'ignorar');
  assert.equal(decidirDas({ ...base, procuracaoOk: false }, op).acao, 'avisar_pendencia');
});
test('autorização expira e só resposta clara vale', () => {
  const c = new Date('2026-11-01T10:00:00Z');
  assert.equal(estadoDaAutorizacao(c, new Date('2026-11-04T10:00:00Z'), 48), 'expirada');
  assert.equal(estadoDaAutorizacao(c, new Date('2026-11-02T10:00:00Z'), 48), 'aguardando');
  assert.equal(interpretarRespostaWhatsApp(' Sim! '), 'sim');
  assert.equal(interpretarRespostaWhatsApp('Não'), 'nao');
  assert.equal(interpretarRespostaWhatsApp('talvez'), null);
});
test('vencimento: dia 20 do mês seguinte, ajustado para dia útil', () => {
  assert.equal(vencimentoDas('202610'), '2026-11-20'); // sexta
  assert.equal(vencimentoDas('202607'), '2026-08-20'); // quinta
  assert.equal(vencimentoDas('202611'), '2026-12-21'); // 20/12 é domingo
});
