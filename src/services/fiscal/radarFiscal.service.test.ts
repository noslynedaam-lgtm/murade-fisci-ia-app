import assert from 'node:assert/strict';
import test from 'node:test';
import { conferirSomaProdutos, mesclarRevisaoEstrutural } from './radarFiscal.service';

test('accepts item vProd sum equal to declared total, using cents', () => {
  assert.deepEqual(conferirSomaProdutos('100.00', ['20.10', '79.90']), []);
});

test('reports exact cent difference when item amounts do not match', () => {
  const [finding] = conferirSomaProdutos('100.00', ['20.10', '79.89']);
  assert.equal(finding.codigo, 'SOMA_ITENS_DIVERGENTE');
  assert.equal(finding.severidade, 'ERRO');
  assert.match(finding.mensagem, /itens R\$ 99,99; total R\$ 100,00; diferença R\$ -0,01/);
});

test('keeps missing product amounts pending rather than treating them as zero', () => {
  const [finding] = conferirSomaProdutos('100.00', ['20.00', '']);
  assert.equal(finding.codigo, 'SOMA_ITENS_INDISPONIVEL');
  assert.equal(finding.severidade, 'ATENCAO');
});

test('merges server findings idempotently without replacing locally classified note data', () => {
  const original = {
    chave: 'key', numero: '1', serie: '1', dataEmissao: '2026-01-01', clienteOuFornecedor: 'Cliente', cnpjParceiro: '',
    tipo: 'SAIDA', valorProdutos: 100, valorTotal: 100, ICMS_aliq: 0, ICMS_valor: 0, PIS_aliq: 0, PIS_valor: 0,
    COFINS_aliq: 0, COFINS_valor: 0, DAS_valor: 0, ufOrigem: 'GO', ufDestino: 'GO', regime: 'PRESUMIDO', status: 'PENDENTE',
    ICMS_cst: '', origemArquivo: 'local.xml', origemVerificada: false, situacaoProtocolo: 'SEM_PROTOCOLO', ocorrencias: [],
  } as const;
  const review = { findings: [{ code: 'SOMA_ITENS_DIVERGENTE', severity: 'ERRO', message: 'diferença de R$ 0,01' }] };
  const once = mesclarRevisaoEstrutural(original as any, review);
  const twice = mesclarRevisaoEstrutural(once, review);
  assert.equal(once.ocorrencias.length, 1);
  assert.equal(twice.ocorrencias.length, 1);
  assert.equal(once.valorTotal, 100);
  assert.equal(once.status, 'PENDENTE');
});

test('does not erase existing local findings when the server returns no additional findings', () => {
  const note = { chave: 'key', ocorrencias: [{ severidade: 'ERRO' as const, codigo: 'SOMA_ITENS_DIVERGENTE', mensagem: 'local' }] } as any;
  assert.equal(mesclarRevisaoEstrutural(note, { findings: [] }), note);
});
