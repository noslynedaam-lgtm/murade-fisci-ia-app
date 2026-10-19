import assert from 'node:assert/strict';
import test from 'node:test';
import { revisarNfeDistribuida } from './nfeDistributionReview';
import { chaveNfeTemDigitoValido } from '../services/fiscal/chaveNfe.service';

const cnpj = '11497078000180';
const key = '52261011497078000180550010000027651750396125';

function xmlNfe(options: { item?: string; totalProdutos?: string; keyInProtocol?: string; cStat?: string } = {}) {
  const item = options.item ?? '100.00';
  const totalProdutos = options.totalProdutos ?? '100.00';
  const protocolKey = options.keyInProtocol ?? key;
  const cStat = options.cStat ?? '100';
  return `<nfeProc><NFe><infNFe Id="NFe${key}"><ide><mod>55</mod><serie>1</serie><nNF>2765</nNF><dhEmi>2026-10-14T10:00:00-03:00</dhEmi></ide><emit><CNPJ>${cnpj}</CNPJ></emit><det nItem="1"><prod><vProd>${item}</vProd></prod></det><total><ICMSTot><vProd>${totalProdutos}</vProd><vNF>100.00</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><tpAmb>1</tpAmb><chNFe>${protocolKey}</chNFe><cStat>${cStat}</cStat><nProt>152260000000001</nProt></infProt></protNFe></nfeProc>`;
}

test('accepts matching key identity, item product sum and authorization protocol', () => {
  const result = revisarNfeDistribuida(xmlNfe(), cnpj);
  assert.equal(result.status, 'SEM_ALERTA_ESTRUTURAL');
  assert.deepEqual(result.findings, []);
});

test('marks item and total mismatch for review without changing the source document', () => {
  const result = revisarNfeDistribuida(xmlNfe({ item: '99.99' }), cnpj);
  assert.equal(result.status, 'REVISAR');
  const finding = result.findings.find((item) => item.code === 'SOMA_ITENS_DIVERGENTE');
  assert.ok(finding);
  assert.equal(finding.encontrado, '99.99');
  assert.equal(finding.esperado, '100.00');
  assert.equal(finding.diferenca, '-0.01');
});

test('keeps documents pending when authorization is not confirmed', () => {
  const result = revisarNfeDistribuida(xmlNfe({ cStat: '101' }), cnpj);
  assert.equal(result.status, 'PENDENTE');
  assert.ok(result.findings.some((finding) => finding.code === 'AUTORIZACAO_NAO_CONFIRMADA'));
});

test('detects a disagreement between invoice key and protocol key', () => {
  const otherKey = `${key.slice(0, 43)}${key[43] === '0' ? '1' : '0'}`;
  const result = revisarNfeDistribuida(xmlNfe({ keyInProtocol: otherKey }), cnpj);
  assert.ok(result.findings.some((finding) => finding.code === 'CHAVE_PROTOCOLO_DIVERGENTE'));
});

test('accepts an alphanumeric CNPJ and matching NF-e access key from NT 2026.004', () => {
  const companyCnpj = '00000000E08G12';
  const payload = `522607${companyCnpj}55001000000001112345678`;
  let weight = 2;
  let sum = 0;
  for (let index = payload.length - 1; index >= 0; index -= 1) {
    sum += (payload.charCodeAt(index) - 48) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  const accessKey = `${payload}${remainder < 2 ? 0 : 11 - remainder}`;
  assert.equal(payload.length, 43);
  assert.equal(chaveNfeTemDigitoValido(accessKey), true);

  const xml = `<nfeProc><NFe><infNFe Id="NFe${accessKey}"><ide><mod>55</mod><serie>1</serie><nNF>1</nNF><dhEmi>2026-07-01T10:00:00-03:00</dhEmi></ide><emit><CNPJ>${companyCnpj}</CNPJ></emit><det nItem="1"><prod><vProd>100.00</vProd></prod></det><total><ICMSTot><vProd>100.00</vProd><vNF>100.00</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><tpAmb>1</tpAmb><chNFe>${accessKey}</chNFe><cStat>100</cStat><nProt>152260000000001</nProt></infProt></protNFe></nfeProc>`;
  const result = revisarNfeDistribuida(xml, companyCnpj);
  assert.equal(result.status, 'SEM_ALERTA_ESTRUTURAL');
  assert.deepEqual(result.findings, []);
});
