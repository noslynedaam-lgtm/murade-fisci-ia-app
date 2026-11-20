import test from 'node:test';
import assert from 'node:assert/strict';

// Navegador de mentira: localStorage/sessionStorage em memória e um "servidor" em memória por escritório.
class Armazem { m = new Map<string, string>(); get length() { return this.m.size; } key(i: number) { return [...this.m.keys()][i] ?? null; } getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; } setItem(k: string, v: string) { this.m.set(k, String(v)); } removeItem(k: string) { this.m.delete(k); } clear() { this.m.clear(); } }
const local = new Armazem(); const sessao = new Armazem();
const eventos: string[] = [];
Object.assign(globalThis, { localStorage: local, sessionStorage: sessao, window: { dispatchEvent: (e: Event) => { eventos.push(e.type); return true; }, setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {} } });
const servidor = new Map<string, Map<string, unknown>>(); // `${tenant}|${colecao}` -> chave -> dados
const loja = (t: string, c: string) => { const k = `${t}|${c}`; if (!servidor.has(k)) servidor.set(k, new Map()); return servidor.get(k)!; };
let falharEnvio = false;
(globalThis as any).fetch = async (url: string, init?: { method?: string; body?: string }) => {
  const u = new URL(url, 'http://x');
  if (init?.method === 'POST') {
    if (falharEnvio) return { ok: false, status: 503, json: async () => ({}) };
    const b = JSON.parse(init.body!); const l = loja(b.tenantId, b.colecao);
    const recusados = [] as { chave: string; motivo: string }[];
    for (const g of b.gravar) { if (g.chave === 'recusado') { recusados.push({ chave: g.chave, motivo: 'x' }); continue; } l.set(g.chave, g.dados); }
    for (const k of b.apagar) l.delete(k);
    return { ok: true, status: 200, json: async () => ({ recusados }) };
  }
  const l = loja(u.searchParams.get('tenantId')!, u.searchParams.get('colecao')!);
  return { ok: true, status: 200, json: async () => ({ itens: [...l.entries()].map(([chave, dados]) => ({ chave, dados })) }) };
};
const { sincronizarEscritorioAgora } = await import('./espelhoEscritorio');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const lemb = (id: string, titulo = 'DAS') => ({ id, empresaId: 'e', empresa: 'Mural', cnpj: '1', titulo, dataVencimento: '2026-11-20', alertas: [], concluido: false, criadoEm: '2026-11-01T00:00:00Z' });
const agendaLocal = () => JSON.parse(local.getItem('murade_agenda_lembretes_locais_v1') || '[]').map((l: any) => `${l.id}:${l.titulo}`).sort();

test('primeira abertura: o que estava só no navegador sobe para o escritório; o que a colega já tinha desce', async () => {
  local.setItem('murade_agenda_lembretes_locais_v1', JSON.stringify([lemb('l1'), lemb('l2')]));
  local.setItem('fiscoia_guias_receita_11222333000181', JSON.stringify([{ id: 'g1', competencia: '10/2026' }]));
  loja(A, 'agenda_lembretes').set('l3', lemb('l3', 'FGTS'));
  sessao.setItem('fiscoia_escritorio_ativo_sessao', A);
  await sincronizarEscritorioAgora();
  assert.deepEqual([...loja(A, 'agenda_lembretes').keys()].sort(), ['l1', 'l2', 'l3']);
  assert.deepEqual(agendaLocal(), ['l1:DAS', 'l2:DAS', 'l3:FGTS']);
  assert.ok(loja(A, 'guias_receita').has('11222333000181'));
  assert.ok(eventos.includes('murade_lembretes_fiscais_atualizados'));
});

test('depois: mudança daqui sobe, mudança da colega desce, exclusão daqui apaga lá', async () => {
  local.setItem('murade_agenda_lembretes_locais_v1', JSON.stringify([lemb('l1', 'DAS pago'), lemb('l3', 'FGTS')])); // mudou l1, apagou l2
  loja(A, 'agenda_lembretes').set('l4', lemb('l4', 'DCTFWeb')); // colega criou l4
  await sincronizarEscritorioAgora();
  assert.deepEqual([...loja(A, 'agenda_lembretes').keys()].sort(), ['l1', 'l3', 'l4']);
  assert.deepEqual(agendaLocal(), ['l1:DAS pago', 'l3:FGTS', 'l4:DCTFWeb']);
});

test('sem servidor: nada se perde no aparelho e vai na próxima rodada', async () => {
  local.setItem('murade_agenda_lembretes_locais_v1', JSON.stringify([lemb('l1', 'DAS pago'), lemb('l3', 'FGTS'), lemb('l4', 'DCTFWeb'), lemb('l5', 'Novo')]));
  falharEnvio = true; await sincronizarEscritorioAgora();
  assert.ok(agendaLocal().includes('l5:Novo')); assert.ok(!loja(A, 'agenda_lembretes').has('l5'));
  falharEnvio = false; await sincronizarEscritorioAgora();
  assert.ok(loja(A, 'agenda_lembretes').has('l5'));
});

test('item recusado pelo servidor continua no aparelho (não some na rodada seguinte)', async () => {
  local.setItem('murade_agenda_lembretes_locais_v1', JSON.stringify([...JSON.parse(local.getItem('murade_agenda_lembretes_locais_v1')!), lemb('recusado')]));
  await sincronizarEscritorioAgora(); await sincronizarEscritorioAgora();
  assert.ok(agendaLocal().some((x: string) => x.startsWith('recusado:')));
});

test('trocar de escritório no mesmo navegador: nada de um escritório vai parar no outro', async () => {
  loja(B, 'agenda_lembretes').set('b1', lemb('b1', 'Do B'));
  sessao.setItem('fiscoia_escritorio_ativo_sessao', B);
  await sincronizarEscritorioAgora();
  assert.deepEqual([...loja(B, 'agenda_lembretes').keys()], ['b1'], 'o escritório B não recebeu lembretes do A');
  assert.deepEqual(agendaLocal(), ['b1:Do B']);
  assert.deepEqual([...loja(A, 'agenda_lembretes').keys()].sort(), ['l1', 'l3', 'l4', 'l5'], 'o A ficou intacto');
  sessao.setItem('fiscoia_escritorio_ativo_sessao', A);
  await sincronizarEscritorioAgora();
  assert.deepEqual([...loja(A, 'agenda_lembretes').keys()].sort(), ['l1', 'l3', 'l4', 'l5'], 'voltando ao A, nada do B subiu e nada do A foi apagado');
  assert.deepEqual(agendaLocal(), ['l1:DAS pago', 'l3:FGTS', 'l4:DCTFWeb', 'l5:Novo']);
});

test('dados ilegíveis no aparelho: não envia nem sobrescreve', async () => {
  local.setItem('fiscoia_compliance_empresas_status', '{quebrado');
  await sincronizarEscritorioAgora();
  assert.equal(local.getItem('fiscoia_compliance_empresas_status'), '{quebrado');
  assert.equal(loja(A, 'compliance_status').size, 0);
});
