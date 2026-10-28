import test from 'node:test';
import assert from 'node:assert/strict';
import { janelaDoCiclo, cicloDe, montarExtrato, extratoParaCsv } from './consumoSerpro';

test('janela do ciclo: 21 do mês anterior a 20 do mês', () => {
  assert.deepEqual(janelaDoCiclo('2026-03'), { de: '2026-02-21', ate: '2026-03-20' });
  assert.deepEqual(janelaDoCiclo('2026-01'), { de: '2025-12-21', ate: '2026-01-20' });
  assert.throws(() => janelaDoCiclo('2026-13'));
});
test('cicloDe: dia 21 em diante cai no ciclo seguinte', () => {
  assert.equal(cicloDe(new Date('2026-10-20T15:00:00Z')), '2026-10');
  assert.equal(cicloDe(new Date('2026-10-21T15:00:00Z')), '2026-11');
  assert.equal(cicloDe(new Date('2026-12-25T15:00:00Z')), '2027-01');
});
test('extrato soma só o ciclo, separa gratuitas de cobradas e usa preço da operação', () => {
  const ex = montarExtrato([
    { id: 'a', cnpj: '1', nome: 'A', consultas: [
      { em: '2026-10-05T15:00:00Z', semana: 'x', cobrada: false, servico: 'declaracoesSimples' },
      { em: '2026-10-06T15:00:00Z', semana: 'x', cobrada: true, servico: 'declaracoesSimples' },
      { em: '2026-10-07T15:00:00Z', semana: 'x', cobrada: true, servico: 'emitir' },
      { em: '2026-08-07T15:00:00Z', semana: 'y', cobrada: true, servico: 'emitir' },
    ] },
    { id: 'b', cnpj: '2', nome: 'B', consultas: [] },
  ], '2026-10', ch => (ch === 'emitir' ? 'Emitir' : 'Consultar'));
  assert.equal(ex.linhas.length, 1);
  assert.equal(ex.totalConsultas, 3);
  assert.equal(ex.valorACobrar, 0.56);
  assert.equal(ex.custoAbsorvido, 0.24);
  assert.match(extratoParaCsv(ex), /0,56/);
});
