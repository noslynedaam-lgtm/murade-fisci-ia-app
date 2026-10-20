import test from 'node:test';
import assert from 'node:assert/strict';
import { ControleCusto, CATALOGO_SERVICOS, avaliarProntidao, compararComFiscal, montarPedido } from './integraContador';

const A = '11222333000181';
const B = '11444777000161';

test('pedido exige CNPJs válidos', () => {
  assert.throws(() => montarPedido(CATALOGO_SERVICOS.situacaoFiscal, '123', B));
  const p = montarPedido(CATALOGO_SERVICOS.situacaoFiscal, A, B);
  assert.equal(p.contribuinte.numero, B);
  assert.equal(p.contratante.numero, A);
});

test('trava de custo: desligada por padrão e limite diário', () => {
  assert.equal(new ControleCusto(2, false).verificar(B).pode, false);
  const c = new ControleCusto(2, true);
  assert.equal(c.verificar(B).pode, true);
  c.registrar(B); c.registrar(B);
  assert.equal(c.verificar(B).pode, false);
  assert.equal(c.verificar(A).pode, true);
});

test('prontidão lista o que falta', () => {
  const r = avaliarProntidao({});
  assert.equal(r.pronto, false);
  assert.equal(r.itens.every(i => !i.ok), true);
  const ok = avaliarProntidao({ SERPRO_PRODUCAO_CONSUMER_KEY: 'a', SERPRO_PRODUCAO_CONSUMER_SECRET: 'b', SERPRO_CONTRATANTE_CNPJ: A, SERPRO_CERT_PFX_BASE64: 'x', SERPRO_CERT_PFX_SENHA: 'y', SERPRO_CONSULTAS_HABILITADAS: 'true' });
  assert.equal(ok.pronto, true);
});

test('comparação aponta divergência', () => {
  assert.equal(compararComFiscal(null, { debitos: 1 }).status, 'sem_dado_oficial');
  assert.equal(compararComFiscal({ debitos: 2 }, { debitos: 1 }).status, 'divergente');
  assert.equal(compararComFiscal({ debitos: 1 }, { debitos: 1 }).status, 'conferido');
});
