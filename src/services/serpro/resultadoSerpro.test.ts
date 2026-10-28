import test from 'node:test';
import assert from 'node:assert/strict';
import { lerDeclaracoes, declaracoesParaCsv } from './resultadoSerpro';

const bruto = { dados: JSON.stringify([{ anoCalendario: 2026, periodos: [
  { periodoApuracao: 202606, operacoes: [{ tipoOperacao: 'Original', indiceDeclaracao: { numeroDeclaracao: '15267243202606001', dataHoraTransmissao: '20260720161919', malha: '', indiceDas: null } }] },
] }]) };

test('lê declarações do PGDAS-D', () => {
  const l = lerDeclaracoes(bruto)!;
  assert.equal(l.length, 1);
  assert.equal(l[0].periodo, '06/2026');
  assert.equal(l[0].transmitidoEm, '20/07/2026 16:19');
  assert.equal(l[0].das, '—');
});
test('formato desconhecido devolve null', () => {
  assert.equal(lerDeclaracoes({ dados: '{"x":1}' }), null);
  assert.equal(lerDeclaracoes({ dados: 'nao-json' }), null);
});
test('CSV tem BOM e ponto e vírgula', () => {
  const csv = declaracoesParaCsv(lerDeclaracoes(bruto)!);
  assert.ok(csv.startsWith('﻿"Período";'));
  assert.ok(csv.includes('"15267243202606001"'));
});
