import test from 'node:test';
import assert from 'node:assert/strict';
import { conferirTarefasEDte, mensagemTarefasDte } from './conferidorTarefasDte';

const L = { escritorio: 'Escritório X', abertas: 2, atrasadas: 0, semProcuracao: 0, semEmail: 0, naoCredenciada: 0, revisao: 0 };
test('tarefas e DT-e: só tarefa em aberto informa; atraso ou item faltando vira alerta', () => {
  assert.equal(mensagemTarefasDte([]).alerta, false);
  assert.equal(mensagemTarefasDte([L]).alerta, false);
  for (const m of [{ atrasadas: 1 }, { semProcuracao: 1 }, { semEmail: 1 }, { naoCredenciada: 1 }, { revisao: 1 }]) {
    const r = mensagemTarefasDte([{ ...L, ...m }]);
    assert.equal(r.alerta, true); assert.match(r.texto, /Escritório X/); assert.match(r.texto, /não entra no DT-e/);
  }
});
test('robô: só lê pela função do banco, alerta no urgente e tolera banco sem a atualização 028', async () => {
  const sqls: string[] = [];
  const pool: any = { query: async (sql: string) => { sqls.push(sql); return sql.includes('platform_tarefas_dte') ? { rows: [{ tenant_name: 'A', tarefas_abertas: 1, tarefas_atrasadas: 1, dte_sem_procuracao: 0, dte_sem_email: 0, dte_nao_credenciada: 0, dte_revisao_vencida: 0 }] } : { rows: [{ id: 'u1' }] }; } };
  await assert.rejects(conferirTarefasEDte(pool, '2026-11-20'), /ATENÇÃO/);
  assert.ok(sqls.every((s) => /^SELECT/i.test(s.trim())));
  const vazio: any = { query: async (sql: string) => (sql.includes('platform_') ? { rows: [] } : { rows: [{ id: 'u1' }] }) };
  assert.match(await conferirTarefasEDte(vazio, '2026-11-20'), /^Tudo em ordem/);
  const sem: any = { query: async (sql: string) => { if (sql.includes('platform_')) throw new Error('42883'); return { rows: [{ id: 'u1' }] }; } };
  assert.match(await conferirTarefasEDte(sem, '2026-11-20'), /028/);
  assert.match(await conferirTarefasEDte(null), /Banco indisponível/);
});
