import test from 'node:test';
import assert from 'node:assert/strict';
import { conferirVencimentoCertidoes, mensagemVencimentos } from './conferidorCertidoes';

test('sem certidão vencendo: tudo em ordem, sem alerta', () => {
  const r = mensagemVencimentos([]);
  assert.equal(r.alerta, false); assert.match(r.texto, /^Tudo em ordem/);
});
test('vencida ou vencendo em até 7 dias gera alerta; 15 e 30 dias só informam', () => {
  assert.equal(mensagemVencimentos([{ escritorio: 'A', vencidas: 1, vence7: 0, vence15: 0, vence30: 0 }]).alerta, true);
  assert.equal(mensagemVencimentos([{ escritorio: 'A', vencidas: 0, vence7: 2, vence15: 0, vence30: 0 }]).alerta, true);
  const so30 = mensagemVencimentos([{ escritorio: 'A', vencidas: 0, vence7: 0, vence15: 1, vence30: 3 }]);
  assert.equal(so30.alerta, false); assert.match(so30.texto, /1 em até 15 e 3 em até 30/);
});
test('o aviso só traz contagens e nome do escritório, nunca empresa nem número de certidão', () => {
  const r = mensagemVencimentos([{ escritorio: 'Escritório X', vencidas: 2, vence7: 1, vence15: 0, vence30: 0 }]);
  assert.match(r.texto, /Escritório X \(2 vencida\(s\), 1 em até 7 dias\)/);
});
test('robô: lê pela função do banco, lança erro quando há urgência e nunca chama órgão', async () => {
  const chamadas: string[] = [];
  const pool: any = { query: async (sql: string) => { chamadas.push(sql); return sql.includes('platform_certidoes_vencimento') ? { rows: [{ tenant_name: 'A', vencidas: 1, vence_em_7: 0, vence_em_15: 0, vence_em_30: 0 }] } : { rows: [{ id: 'u1' }] }; } };
  await assert.rejects(conferirVencimentoCertidoes(pool, '2026-11-19'), /ATENÇÃO/);
  assert.ok(chamadas.every((s) => /^SELECT/i.test(s.trim())), 'só leitura');
  const vazio: any = { query: async (sql: string) => (sql.includes('platform_') ? { rows: [] } : { rows: [{ id: 'u1' }] }) };
  assert.match(await conferirVencimentoCertidoes(vazio, '2026-11-19'), /^Tudo em ordem/);
  assert.match(await conferirVencimentoCertidoes(null), /Banco indisponível/);
  const semMigracao: any = { query: async (sql: string) => { if (sql.includes('platform_')) throw new Error('42883'); return { rows: [{ id: 'u1' }] }; } };
  assert.match(await conferirVencimentoCertidoes(semMigracao, '2026-11-19'), /022/);
});
