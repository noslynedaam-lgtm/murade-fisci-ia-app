import assert from 'node:assert/strict';
import test from 'node:test';
import { conferirLiberacoesSerpro, mensagemDoResumo, resumirAuditoria, type LinhaAuditoria } from './conferidorLiberacoesSerpro';

const l = (o: Partial<LinhaAuditoria>): LinhaAuditoria => ({ escritorio: 'Esc A', empresa: 'Empresa X', liberada: false, pediuEm: null, consultasRecentes: 0, ...o });

test('conferidor: uso sem liberação é achado; empresa liberada com uso não é problema', () => {
  const r = resumirAuditoria([l({ empresa: 'A', consultasRecentes: 2 }), l({ empresa: 'B', liberada: true, consultasRecentes: 5 }), l({ empresa: 'C', pediuEm: '2026-11-06T10:00:00Z' })]);
  assert.equal(r.empresasComUso, 2);
  assert.deepEqual(r.usoSemLiberacao.map(x => x.empresa), ['A']);
  assert.equal(r.aguardandoLiberacao, 1);
});

test('conferidor: mensagem diz tudo em ordem ou aponta quem usou sem liberar', () => {
  assert.match(mensagemDoResumo(resumirAuditoria([l({ liberada: true, consultasRecentes: 1 })]), 7), /Tudo em ordem/);
  assert.match(mensagemDoResumo(resumirAuditoria([l({ empresa: 'Mural', consultasRecentes: 3 })]), 7), /ATENÇÃO.*Mural.*3 consulta/);
});

test('conferidor: sem banco não inventa resultado', async () => {
  assert.match(await conferirLiberacoesSerpro(null), /nada conferido/);
});

test('conferidor: acha uso sem liberação e lança alerta; tudo liberado passa', async () => {
  const montar = (linhas: any[]) => ({ query: async (sql: string) => (sql.includes('FROM fiscoia.users') ? { rows: [{ id: 'adm' }] } : { rows: linhas }) }) as never;
  await assert.rejects(conferirLiberacoesSerpro(montar([{ tenant_name: 'Esc A', legal_name: 'Mural', released: false, requested_at: null, consultas_recentes: 2 }])), /ATENÇÃO/);
  assert.match(await conferirLiberacoesSerpro(montar([{ tenant_name: 'Esc A', legal_name: 'Mural', released: true, requested_at: null, consultas_recentes: 2 }])), /Tudo em ordem/);
});
