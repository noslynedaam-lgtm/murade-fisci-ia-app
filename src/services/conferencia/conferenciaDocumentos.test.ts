import assert from 'node:assert/strict';
import test from 'node:test';
import { conferirDocumentos, type DocumentoConferencia } from './conferenciaDocumentos';

const CNPJ = '11497078000180';
function chave(numero: number, opts: { aamm?: string; cnpj?: string; serie?: string } = {}) {
  return `52${opts.aamm ?? '2610'}${opts.cnpj ?? CNPJ}55${opts.serie ?? '001'}${String(numero).padStart(9, '0')}1${'12345678'}0`;
}
const doc = (n: number, extra: Partial<DocumentoConferencia> = {}): DocumentoConferencia => ({
  chave: chave(n), direcao: 'SAIDA', emissao: '2026-10-05', valor: 100, status: 'AUTORIZADA', ...extra,
});

test('sem problemas não gera ocorrência e soma em centavos', () => {
  const r = conferirDocumentos({ cnpjEmpresa: CNPJ, documentos: [doc(1, { valor: 0.1 }), doc(2, { valor: 0.2 })] });
  assert.deepEqual(r.ocorrencias, []);
  assert.equal(r.resumo.valorTotal, 0.3);
  assert.equal(r.resumo.saidas, 2);
});

test('detecta lacuna de numeração em faixas', () => {
  const r = conferirDocumentos({ cnpjEmpresa: CNPJ, documentos: [doc(1), doc(2), doc(5), doc(9)] });
  const o = r.ocorrencias.find(x => x.codigo === 'LACUNA_NUMERACAO');
  assert.ok(o);
  assert.match(o.mensagem, /3–4, 6–8/);
});

test('séries diferentes não geram lacuna entre si', () => {
  const r = conferirDocumentos({ cnpjEmpresa: CNPJ, documentos: [
    doc(1), { ...doc(1), chave: chave(50, { serie: '002' }) },
  ] });
  assert.equal(r.ocorrencias.length, 0);
});

test('chave inválida, emitente e data divergentes', () => {
  const r = conferirDocumentos({ cnpjEmpresa: CNPJ, documentos: [
    { ...doc(1), chave: '123' },
    { ...doc(2), chave: chave(2, { cnpj: '22222222000122' }) },
    doc(3, { emissao: '2026-09-30' }),
  ] });
  const codigos = r.ocorrencias.map(o => o.codigo).sort();
  assert.deepEqual(codigos, ['CHAVE_INVALIDA', 'DATA_DIVERGE_CHAVE', 'EMITENTE_DIVERGE']);
});

test('compara com o Murade Fiscal: faltas, valor e cancelamento', () => {
  const r = conferirDocumentos({
    cnpjEmpresa: CNPJ,
    documentos: [doc(1), doc(2), doc(3)],
    fiscal: [
      { chave: chave(1), emissao: '2026-10-05', valor: 100, status: 'AUTORIZADA' },
      { chave: chave(2), emissao: '2026-10-05', valor: 99.5, status: 'AUTORIZADA' },
      { chave: chave(3), emissao: '2026-10-05', valor: 100, status: 'Cancelada' },
      { chave: chave(4), emissao: '2026-10-06', valor: 10, status: 'AUTORIZADA' },
    ],
  });
  const por = Object.fromEntries(r.ocorrencias.map(o => [o.codigo, o]));
  assert.deepEqual(por.FALTA_NO_FISCO_IA.chaves, [chave(4)]);
  assert.deepEqual(por.VALOR_DIVERGENTE.chaves, [chave(2)]);
  assert.deepEqual(por.STATUS_DIVERGENTE.chaves, [chave(3)]);
  assert.equal(r.resumo.comparadoComFiscal, true);
  assert.equal(r.ocorrencias[0].severidade, 'ERRO');
});

test('entradas não entram na checagem de numeração do emitente', () => {
  const r = conferirDocumentos({ cnpjEmpresa: CNPJ, documentos: [
    { ...doc(1), direcao: 'ENTRADA', chave: chave(1, { cnpj: '33333333000133' }) },
    { ...doc(10), direcao: 'ENTRADA', chave: chave(10, { cnpj: '33333333000133' }) },
  ] });
  assert.equal(r.ocorrencias.length, 0);
});
