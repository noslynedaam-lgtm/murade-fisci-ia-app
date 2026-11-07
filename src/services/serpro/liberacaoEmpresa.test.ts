import assert from 'node:assert/strict';
import test from 'node:test';
import { decidirLiberacaoEmpresa } from './liberacaoEmpresa';

test('liberação: o dono pela própria tela não passa pela trava', () => {
  assert.deepEqual(decidirLiberacaoEmpresa({ exigirLiberacao: false, liberada: false }), { ok: true });
  assert.deepEqual(decidirLiberacaoEmpresa({ exigirLiberacao: false, liberada: null }), { ok: true });
});

test('liberação: cliente e pontes começam travados', () => {
  const d = decidirLiberacaoEmpresa({ exigirLiberacao: true, liberada: false });
  assert.equal(d.ok, false);
  if (d.ok === false) { assert.equal(d.http, 403); assert.equal(d.bloqueadaPorLiberacao, true); assert.match(d.mensagem, /Nada foi consultado nem cobrado/); }
});

test('liberação: empresa liberada pelo dono consulta', () => {
  assert.deepEqual(decidirLiberacaoEmpresa({ exigirLiberacao: true, liberada: true }), { ok: true });
});

test('liberação: sem conseguir conferir, trava (nunca gasta por engano)', () => {
  const d = decidirLiberacaoEmpresa({ exigirLiberacao: true, liberada: null });
  assert.equal(d.ok, false);
  if (d.ok === false) { assert.equal(d.http, 503); assert.equal(d.bloqueadaPorLiberacao, false); }
});
