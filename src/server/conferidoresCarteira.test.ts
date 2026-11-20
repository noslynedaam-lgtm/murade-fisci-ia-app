import test from 'node:test';
import assert from 'node:assert/strict';
import { conferirAgendaFiscal, conferirCarteiraFiscal, conferirCertificadosA1, mensagemAgenda, mensagemCarteira, mensagemCertificados } from './conferidoresCarteira';

test('carteira: sem nada guardado pendente fica em ordem; pendência, atraso ou mensagem nova viram alerta', () => {
  assert.equal(mensagemCarteira([]).alerta, false);
  assert.equal(mensagemCarteira([{ escritorio: 'A', pendentes: 0, aConferir: 2, novas: 0, atrasadas: 0 }]).alerta, false);
  for (const l of [{ pendentes: 1, novas: 0, atrasadas: 0 }, { pendentes: 0, novas: 1, atrasadas: 0 }, { pendentes: 0, novas: 0, atrasadas: 3 }]) {
    const r = mensagemCarteira([{ escritorio: 'Escritório X', aConferir: 0, ...l }]);
    assert.equal(r.alerta, true); assert.match(r.texto, /Escritório X/); assert.match(r.texto, /nenhuma consulta nova foi feita/);
  }
});
test('certificados: vencido ou em até 7 dias é alerta; 15/30 dias e sem validade só informam', () => {
  assert.equal(mensagemCertificados([]).alerta, false);
  assert.equal(mensagemCertificados([{ escritorio: 'A', vencidos: 0, vence7: 0, vence15: 1, vence30: 2, semValidade: 1 }]).alerta, false);
  assert.match(mensagemCertificados([{ escritorio: 'A', vencidos: 0, vence7: 0, vence15: 1, vence30: 2, semValidade: 1 }]).texto, /1 sem validade registrada/);
  assert.equal(mensagemCertificados([{ escritorio: 'A', vencidos: 1, vence7: 0, vence15: 0, vence30: 0, semValidade: 0 }]).alerta, true);
});
test('agenda: lembrete vencido ou de hoje é alerta', () => {
  assert.equal(mensagemAgenda([]).alerta, false);
  assert.match(mensagemAgenda([{ escritorio: 'A', vencidos: 2, hoje: 1 }]).texto, /2 lembrete\(s\) vencido\(s\) e 1 vencendo hoje/);
});
test('robôs: só leem pelas funções do banco (nunca consultam órgão), lançam erro no urgente e toleram banco sem a atualização 026', async () => {
  for (const [rodar, funcao, linha] of [
    [conferirCarteiraFiscal, 'platform_carteira_alertas', { tenant_name: 'A', sitfis_pendentes: 1, sitfis_a_conferir: 0, caixa_postal_novas: 0, parcelas_atrasadas: 0 }],
    [conferirCertificadosA1, 'platform_certificados_vencimento', { tenant_name: 'A', vencidos: 1, vence_em_7: 0, vence_em_15: 0, vence_em_30: 0, sem_validade: 0 }],
    [conferirAgendaFiscal, 'platform_agenda_vencidos', { tenant_name: 'A', vencidos: 1, vence_hoje: 0 }],
  ] as const) {
    const sqls: string[] = [];
    const pool: any = { query: async (sql: string) => { sqls.push(sql); return sql.includes(funcao) ? { rows: [linha] } : { rows: [{ id: 'u1' }] }; } };
    await assert.rejects(rodar(pool, '2026-11-20'), /ATENÇÃO/);
    assert.ok(sqls.every((s) => /^SELECT/i.test(s.trim())), 'só leitura');
    const vazio: any = { query: async (sql: string) => (sql.includes('platform_') ? { rows: [] } : { rows: [{ id: 'u1' }] }) };
    assert.match(await rodar(vazio, '2026-11-20'), /^Tudo em ordem/);
    const semMigracao: any = { query: async (sql: string) => { if (sql.includes('platform_')) throw new Error('42883'); return { rows: [{ id: 'u1' }] }; } };
    assert.match(await rodar(semMigracao, '2026-11-20'), /026/);
    assert.match(await rodar(null), /Banco indisponível/);
  }
});
