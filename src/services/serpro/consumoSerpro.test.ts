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

test('extrato separa por escritório para o boleto de cada um', () => {
  const c = (esc?: { id: string; nome: string }, cobrada = true) => ({ em: '2026-10-05T15:00:00Z', semana: 'x', cobrada, servico: 'a', ...(esc ? { escritorio: esc } : {}) });
  const ex = montarExtrato([
    { id: '1', cnpj: '1', nome: 'A', consultas: [c({ id: 'e1', nome: 'Contadora' }), c({ id: 'e1', nome: 'Contadora' }, false), c({ id: 'e2', nome: 'Outro' })] },
    { id: '2', cnpj: '2', nome: 'B', consultas: [c({ id: 'e1', nome: 'Contadora' })] },
  ], '2026-10', () => 'Consultar');
  const e1 = ex.porEscritorio.find((x) => x.escritorioId === 'e1')!;
  assert.equal(e1.empresas, 2); assert.equal(e1.cobradas, 2); assert.equal(e1.gratuitas, 1); assert.equal(e1.valorCobrado, 0.48);
  assert.equal(ex.porEscritorio.length, 2);
});

test('extrato traz cada consulta do ciclo, com situação e valor, e o CSV leva o detalhe', async () => {
  const { montarExtrato, extratoParaCsv } = await import('./consumoSerpro');
  const ex = montarExtrato([{ id: 'e1', cnpj: '11222333000181', nome: 'ACME', consultas: [
    { em: '2026-10-25T15:00:00.000Z', semana: '2026-10-19', cobrada: false, servico: 'situacaoFiscal', escritorio: { id: 'o1', nome: 'ana@x.com' } },
    { em: '2026-10-26T15:00:00.000Z', semana: '2026-10-26', cobrada: true, servico: 'dctfwebGuia', escritorio: { id: 'o1', nome: 'ana@x.com' } },
  ] }], '2026-11', (k) => (k === 'dctfwebGuia' ? 'Emitir' : 'Consultar'));
  assert.equal(ex.eventos.length, 2);
  assert.deepEqual([ex.eventos[0].servico, ex.eventos[0].cobrada, ex.eventos[0].valor], ['dctfwebGuia', true, 0.32]);
  assert.equal(ex.eventos[1].valor, 0);
  const csv = extratoParaCsv(ex);
  assert.match(csv, /DETALHE/); assert.match(csv, /COBRADA;0,32/); assert.match(csv, /grátis;0,00/);
});
test('uso vindo do Fiscal: a operação gravada no registro define o preço (Declarar R$ 0,40)', () => {
  const ex = montarExtrato([
    { id: 'a', cnpj: '1', nome: 'A', consultas: [
      { em: '2026-10-05T15:00:00Z', semana: 'x', cobrada: true, servico: 'PGDASD.TRANSDECLARACAO11', operacao: 'Declarar', escritorio: { id: 'esc1', nome: 'Escritório 1' } },
      { em: '2026-10-06T15:00:00Z', semana: 'x', cobrada: true, servico: 'PGDASD.CONSULTIMADECREC14', operacao: 'Consultar', escritorio: { id: 'esc1', nome: 'Escritório 1' } },
    ] },
  ], '2026-10', () => 'Consultar');
  assert.equal(ex.valorACobrar, 0.64);
  assert.equal(ex.porEscritorio[0].escritorio, 'Escritório 1');
});
