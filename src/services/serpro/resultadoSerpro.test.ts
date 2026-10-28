import test from 'node:test';
import assert from 'node:assert/strict';
import { lerDeclaracoes, declaracoesParaCsv, lerProtocoloSitfis, acharPdfBase64 } from './resultadoSerpro';

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

test('SITFIS: lê protocolo e espera', () => {
  const r = lerProtocoloSitfis({ dados: JSON.stringify({ protocoloRelatorio: 'abc', tempoEspera: 4000 }) })!;
  assert.equal(r.protocolo, 'abc'); assert.equal(r.esperaMs, 4000);
  assert.equal(lerProtocoloSitfis({ dados: '' }), null);
});
test('acha PDF em base64 dentro de dados', () => {
  const pdf = 'JVBERi0xLjQK' + 'A'.repeat(200);
  assert.equal(acharPdfBase64({ dados: JSON.stringify({ pdf }) }), pdf);
  assert.equal(acharPdfBase64({ dados: '{"x":"texto"}' }), null);
});

import { lerXmlDeclaracao, lerReciboTransmissao } from './resultadoSerpro';
import { CATALOGO_SERVICOS } from './integraContador';
test('lê o XML da declaração e o recibo da transmissão', () => {
  const xml = '<ProcDctf><ConteudoDeclaracao id="id_1"/></ProcDctf>';
  const bruto = { dados: JSON.stringify({ XMLStringBase64: Buffer.from(xml).toString('base64') }) };
  assert.equal(lerXmlDeclaracao(bruto), xml);
  assert.equal(lerXmlDeclaracao({ dados: JSON.stringify({ XMLStringBase64: Buffer.from('<outro/>').toString('base64') }) }), null);
  assert.equal(lerReciboTransmissao({ dados: '{"NumeroRecibo":24781}' }), '24781');
  assert.equal(lerReciboTransmissao({ dados: '{}' }), null);
});
test('transmissão DCTFWeb só roda pelo fluxo seguro e é do tipo Declarar', () => {
  assert.equal(CATALOGO_SERVICOS.dctfwebTransmitir.soFluxoSeguro, true);
  assert.equal(CATALOGO_SERVICOS.dctfwebTransmitir.operacao, 'Declarar');
});
