import test from 'node:test';
import assert from 'node:assert/strict';
import { mesclar } from './espelhoEscritorio';

test('primeira abertura no aparelho: envia só o que o servidor não tem, vale o do servidor e nunca apaga', () => {
  const local = { a: { v: 'aparelho' }, b: { v: 'só aqui' } };
  const remoto = { a: { v: 'servidor' }, c: { v: 'da colega' } };
  const m = mesclar(local, remoto, null);
  assert.deepEqual(m.gravar, [{ chave: 'b', dados: { v: 'só aqui' } }]);
  assert.deepEqual(m.apagar, []);
  assert.deepEqual(m.resultado, { a: { v: 'servidor' }, b: { v: 'só aqui' }, c: { v: 'da colega' } });
});

test('depois: leva o que mudou aqui, traz o que a colega mudou e apaga lá só o que foi apagado aqui', () => {
  const base = { a: { v: 1 }, b: { v: 1 }, c: { v: 1 } };
  const local = { a: { v: 2 }, b: { v: 1 } }; // mudou "a", apagou "c"
  const remoto = { a: { v: 1 }, b: { v: 9 }, c: { v: 1 }, d: { v: 'nova da colega' } }; // colega mudou "b" e criou "d"
  const m = mesclar(local, remoto, base);
  assert.deepEqual(m.gravar, [{ chave: 'a', dados: { v: 2 } }]);
  assert.deepEqual(m.apagar, ['c']);
  assert.deepEqual(m.resultado, { a: { v: 2 }, b: { v: 9 }, d: { v: 'nova da colega' } });
});

test('item que a colega apagou some daqui; item apagado aqui que já não existe lá não gera pedido', () => {
  const base = { a: { v: 1 }, b: { v: 1 } };
  const m = mesclar({ a: { v: 1 } }, { a: { v: 1 } }, base);
  assert.deepEqual(m.apagar, []);
  assert.deepEqual(m.resultado, { a: { v: 1 } });
  const m2 = mesclar({ a: { v: 1 }, b: { v: 1 } }, { a: { v: 1 } }, base);
  assert.deepEqual(m2.resultado, { a: { v: 1 } }, 'apagado pela colega e não mexido aqui: some');
});
