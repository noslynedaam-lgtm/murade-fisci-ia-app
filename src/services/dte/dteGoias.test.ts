import test from 'node:test';
import assert from 'node:assert/strict';
import { GUIA_DTE, LINKS_DTE, POR_QUE_SEM_LEITURA_AUTOMATICA, pendenciasDoChecklist, resumoDte, somarDias, validarChecklist } from './dteGoias';

const E = '11111111-1111-4111-8111-111111111111';
const ok = { empresaId: E, empresa: 'A', cnpj: '11222333000181', uf: 'GO', credenciada: 'tem', emailAvisos: 'nao_tem', procuracao: null, revisarEm: '2026-11-20', obs: null, atualizadoEm: '2026-11-20T10:00:00Z' };

test('guia: pontos oficiais que o contador precisa saber estão escritos e com fonte', () => {
  const texto = GUIA_DTE.flatMap((g) => g.itens).join(' ');
  assert.match(texto, /procuração eletrônica da Receita Federal \(e-CAC\) NÃO vale/);
  assert.match(texto, /UM e-mail de aviso/);
  assert.match(texto, /NÃO serve o e-CPF do contador, o e-CNPJ do escritório/);
  assert.match(texto, /NÃO precisa se credenciar/);
  assert.match(texto, /10 dias depois da postagem/);
  assert.ok(GUIA_DTE.every((g) => g.fonte && /^https:\/\/(goias\.gov\.br\/economia|dte\.sefaz\.go\.gov\.br|appasp\.economia\.go\.gov\.br)\//.test(g.link)), 'só fonte oficial');
  assert.ok(Object.values(LINKS_DTE).every((l) => l.startsWith('https://')));
  assert.match(POR_QUE_SEM_LEITURA_AUTOMATICA.join(' '), /ciência/);
});

test('checklist: validação, pendências e resumo do escritório', () => {
  assert.equal(validarChecklist(E, ok), null);
  assert.match(String(validarChecklist('x', ok)), /Empresa/);
  assert.match(String(validarChecklist(E, { ...ok, procuracao: 'talvez' })), /tem, não tem/);
  assert.match(String(validarChecklist(E, { ...ok, revisarEm: '2026-02-30' })), /lembrete/);
  assert.deepEqual(pendenciasDoChecklist(ok as any).map((p) => `${p.campo}:${p.situacao}`), ['emailAvisos:nao_tem', 'procuracao:sem_resposta']);
  const r = resumoDte([{ id: E }, { id: '22222222-2222-4222-8222-222222222222' }], [ok], '2026-11-20');
  assert.deepEqual(r, { empresasGo: 2, completas: 0, semResposta: 2, faltando: { credenciada: 0, emailAvisos: 1, procuracao: 0 }, revisaoVencida: 1 });
  assert.equal(resumoDte([{ id: E }], [{ ...ok, emailAvisos: 'tem', procuracao: 'nao_se_aplica', revisarEm: null }], '2026-11-20').completas, 1);
  assert.equal(somarDias('2026-11-20', 15), '2026-12-05');
});
