import test from 'node:test';
import assert from 'node:assert/strict';
import { mensagemABuscar, prepararBuscaCertidoes } from './roboPreparadorCertidoes';

test('mensagem: tudo em ordem, ou contagens por escritório (nunca empresa nem CNPJ), sem alerta', () => {
  assert.match(mensagemABuscar([]).texto, /^Tudo em ordem/);
  assert.match(mensagemABuscar([{ escritorio: 'A', empresas: 3, faltando: 0, vencidas: 0, aRenovar: 0 }]).texto, /^Tudo em ordem/);
  const r = mensagemABuscar([{ escritorio: 'Escritório X', empresas: 3, faltando: 5, vencidas: 1, aRenovar: 2 }]);
  assert.equal(r.alerta, false);
  assert.match(r.texto, /5 faltando, 1 vencida\(s\) e 2 para renovar/);
  assert.match(r.texto, /Escritório X/);
  assert.match(r.texto, /Buscar agora/);
});

test('robô: só leitura pela função do banco; sem banco, sem admin ou sem a migração 027 não quebra', async () => {
  const sqls: string[] = [];
  const pool: any = { query: async (sql: string) => { sqls.push(sql); return sql.includes('platform_certidoes_a_buscar') ? { rows: [{ tenant_name: 'A', empresas: 2, faltando: 8, vencidas: 0, a_renovar: 0 }] } : { rows: [{ id: 'u1' }] }; } };
  assert.match(await prepararBuscaCertidoes(pool, '2026-11-20'), /8 faltando/);
  assert.ok(sqls.every((s) => /^SELECT/i.test(s.trim())), 'só leitura');
  assert.match(await prepararBuscaCertidoes(null), /Banco indisponível/);
  const semAdm: any = { query: async () => ({ rows: [] }) };
  assert.match(await prepararBuscaCertidoes(semAdm), /Sem conta administradora/);
  const semMig: any = { query: async (sql: string) => { if (sql.includes('platform_')) throw new Error('42883'); return { rows: [{ id: 'u1' }] }; } };
  assert.match(await prepararBuscaCertidoes(semMig), /027/);
});
