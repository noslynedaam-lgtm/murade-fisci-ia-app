import assert from 'node:assert/strict';
import test from 'node:test';
import { conferirSomaProdutos } from './radarFiscal.service';

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
