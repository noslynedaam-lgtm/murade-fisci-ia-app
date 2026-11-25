import assert from 'node:assert/strict';
import { test } from 'node:test';

// Ambiente mínimo de navegador SEM vozes do aparelho (como muitos celulares: o navegador não deixa trocar a voz).
const guardado = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => { guardado.set(k, String(v)); }, removeItem: (k: string) => { guardado.delete(k); } };
(globalThis as any).window = globalThis;
if (typeof (globalThis as any).addEventListener !== 'function') (globalThis as any).addEventListener = () => {};

test('só voz humana: a voz robótica do aparelho foi retirada', async () => {
  const v = await import('./vozHumana');
  assert.equal(v.vozPremiumLigada(), true);
  v.definirVozHumana(false); // não desliga mais
  assert.equal(v.vozPremiumLigada(), true);
  assert.match(v.ajustarVoz('volta para a voz do celular', 14) || '', /só com a voz humana/);
  assert.equal(v.vozPremiumLigada(), true);
  assert.match(v.ajustarVoz('troca a voz', 14) || '', /só a voz humana/);
  assert.match(v.ajustarVoz('essa voz esta muito robotica', 14) || '', /Atualização do app disponível/);
  assert.match(v.ajustarVoz('muda para a voz humana', 14) || '', /voz humana/);
  assert.equal(v.vozPremiumLigada(), true);
  assert.equal(v.ajustarVoz('qual o vencimento do das', 14), null);
});
