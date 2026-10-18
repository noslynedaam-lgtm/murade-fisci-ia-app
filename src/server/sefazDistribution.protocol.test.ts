import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import test from 'node:test';
import { lerRespostaSefaz, metadadosEvento, validarSequenciaDistribuicao } from './sefazDistribution.routes';

function montarSoap(cStat: number, ultNSU: string, maxNSU: string, docZips = '') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
 <soap:Body><nfeDistDFeInteresseResponse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
  <nfeDistDFeInteresseResult><retDistDFeInt xmlns="http://www.portalfiscal.inf.br/nfe">
   <cStat>${cStat}</cStat><xMotivo>Resposta de protocolo</xMotivo><dhResp>2026-10-18T10:00:00-03:00</dhResp>
   <ultNSU>${ultNSU}</ultNSU><maxNSU>${maxNSU}</maxNSU><loteDistDFeInt>${docZips}</loteDistDFeInt>
  </retDistDFeInt></nfeDistDFeInteresseResult>
 </nfeDistDFeInteresseResponse></soap:Body>
</soap:Envelope>`;
}

function docZip(nsu: string, xml: string, schema = 'procNFe_v4.00.xsd') {
  return `<docZip NSU="${nsu}" schema="${schema}">${gzipSync(Buffer.from(xml, 'utf8')).toString('base64')}</docZip>`;
}

const xmlNfe = '<procNFe><NFe><infNFe Id="NFe35261012345678000195550010000000011000000010"><ide><mod>55</mod></ide></infNFe></NFe></procNFe>';

test('extracts event key only when its check digit is valid', () => {
  const key = '52261011497078000180550010000027651750396125';
  const event = (chave: string) => `<procEventoNFe><evento><infEvento><chNFe>${chave}</chNFe><tpEvento>110111</tpEvento><dhEvento>2026-10-15T12:00:00-03:00</dhEvento><nSeqEvento>1</nSeqEvento><detEvento><descEvento>Cancelamento</descEvento></detEvento></infEvento></evento><retEvento><infEvento><cStat>135</cStat><xMotivo>Evento registrado e vinculado</xMotivo><nProt>152260000000001</nProt></infEvento></retEvento></procEventoNFe>`;
  assert.equal(metadadosEvento(event(key)).chave, key);
  const invalidKey = `${key.slice(0, 43)}${key[43] === '0' ? '1' : '0'}`;
  assert.equal(metadadosEvento(event(invalidKey)).chave, null);
});

test('interpreta cStat 138 e descompacta docZip sem alterar seu conteúdo', () => {
  const parsed = lerRespostaSefaz(montarSoap(138, '000000000000003', '000000000000004', docZip('000000000000002', xmlNfe)));
  assert.equal(parsed.cStat, 138);
  assert.equal(parsed.ultNsu, '3');
  assert.equal(parsed.maxNsu, '4');
  assert.equal(parsed.documentos.length, 1);
  assert.equal(parsed.documentos[0].nsu, '2');
  assert.equal(parsed.documentos[0].schema, 'procNFe_v4.00.xsd');
  assert.equal(parsed.documentos[0].documentXml, xmlNfe);
  assert.doesNotThrow(() => validarSequenciaDistribuicao(parsed, '1'));
});

test('aceita resposta sem documentos cStat 137 apenas quando ultNSU alcança maxNSU', () => {
  const parsed = lerRespostaSefaz(montarSoap(137, '000000000000003', '000000000000003'));
  assert.equal(parsed.documentos.length, 0);
  assert.doesNotThrow(() => validarSequenciaDistribuicao(parsed, '2'));
  assert.throws(() => validarSequenciaDistribuicao(parsed, '4'), /anterior à posição/);
});

test('recusa cStat 138 sem docZip e NSU repetido/fora da sequência', () => {
  const empty = lerRespostaSefaz(montarSoap(138, '3', '3'));
  assert.throws(() => validarSequenciaDistribuicao(empty, '1'), /sem docZip/);

  const repeated = lerRespostaSefaz(montarSoap(138, '3', '3', docZip('2', xmlNfe) + docZip('2', xmlNfe)));
  assert.throws(() => validarSequenciaDistribuicao(repeated, '1'), /fora da sequência/);

  const future = lerRespostaSefaz(montarSoap(138, '2', '2', docZip('3', xmlNfe)));
  assert.throws(() => validarSequenciaDistribuicao(future, '1'), /fora da sequência/);
});

test('recusa SOAP sem retorno fiscal, DTD e conteúdo gzip inválido', () => {
  assert.throws(() => lerRespostaSefaz('<soap:Envelope><soap:Body><soap:Fault>oops</soap:Fault></soap:Body></soap:Envelope>'), /falha SOAP/);
  assert.throws(() => lerRespostaSefaz('<!DOCTYPE x [<!ENTITY y "z">]><x/>'), /DTD/);
  assert.throws(() => lerRespostaSefaz(montarSoap(138, '1', '1', '<docZip NSU="1" schema="procNFe_v4.00.xsd">bm90LWd6aXA=</docZip>')));
});
