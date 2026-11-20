import test from 'node:test';
import assert from 'node:assert/strict';
import { diferencas, lembretesQuePedemAtencao, validarItem } from './dadosEscritorio';

const LEMBRETE = { id: 'l1', empresaId: 'e1', empresa: 'Mural', cnpj: '11222333000181', titulo: 'DAS', dataVencimento: '2026-11-20', alertas: [3, 1], concluido: false, criadoEm: '2026-11-01T10:00:00Z' };

test('valida cada tipo de dado antes de gravar no servidor', () => {
  assert.equal(validarItem('agenda_lembretes', 'l1', LEMBRETE), null);
  assert.match(validarItem('agenda_lembretes', 'l2', LEMBRETE)!, /inválido/, 'id do lembrete precisa bater com a chave');
  assert.match(validarItem('agenda_lembretes', 'l1', { ...LEMBRETE, dataVencimento: '2026-02-31' })!, /Data/);
  assert.match(validarItem('agenda_lembretes', 'l 1', LEMBRETE)!, /Identificador/);
  assert.equal(validarItem('compliance_status', 'e1_11/2026', { empresaId: 'e1', cnpj: 'x', competencia: '11/2026', dadosMesEnviados: true, dctfwebEnviada: false, cndEmitida: false }), null);
  assert.match(validarItem('compliance_status', 'e1_11/2026', { empresaId: 'e1' })!, /conformidade/);
  assert.equal(validarItem('guias_receita', '11222333000181', [{ id: 'g1', competencia: '10/2026' }]), null);
  assert.match(validarItem('guias_receita', '112', [])!, /CNPJ/);
  assert.match(validarItem('guias_receita', '11222333000181', [{ id: 1 }])!, /guias/);
  assert.match(validarItem('guias_receita', '11222333000181', [{ id: 'g', competencia: 'x'.repeat(300_000) }])!, /grande/);
});

test('só envia o que mudou e apaga só o que saiu', () => {
  const base = { a: { v: 1 }, b: { v: 2 }, c: { v: 3 } };
  const local = { a: { v: 1 }, b: { v: 20 }, d: { v: 4 } };
  assert.deepEqual(diferencas(local, base), { gravar: [{ chave: 'b', dados: { v: 20 } }, { chave: 'd', dados: { v: 4 } }], apagar: ['c'] });
  assert.deepEqual(diferencas(base, base), { gravar: [], apagar: [] });
});

test('lembretes vencidos e de hoje, sem os concluídos', () => {
  const itens = [LEMBRETE, { ...LEMBRETE, id: 'l2', dataVencimento: '2026-11-10' }, { ...LEMBRETE, id: 'l3', dataVencimento: '2026-11-25' }, { ...LEMBRETE, id: 'l4', concluido: true, dataVencimento: '2026-11-01' }, null];
  assert.deepEqual(lembretesQuePedemAtencao(itens, '2026-11-20').map((l) => l.dias), [-10, 0]);
});
