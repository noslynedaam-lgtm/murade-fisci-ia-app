import test from 'node:test';
import assert from 'node:assert/strict';
import { ArmazemAcoesPendentes, confirmarAcao, conversar, type ChamarApi, type ContextoAgente, type ModeloIA } from './agenteMotor';
import { kitFiscoIA } from './agenteFiscoIA';

const T = '11111111-1111-4111-8111-111111111111';
const C = '22222222-2222-4222-8222-222222222222';
function montar(api: ChamarApi, falas: Array<{ texto?: string; chamadas?: Array<{ nome: string; args: any }> }>) {
  const feitas: Array<[string, string, any]> = [];
  let i = 0;
  const modelo: ModeloIA = async () => { const f = falas[i++] || { texto: 'fim' }; return { texto: f.texto || '', chamadas: f.chamadas || [], turnoModelo: { role: 'model', parts: [{ text: f.texto || '' }] } }; };
  const ctx: ContextoAgente = { sessaoHash: 's', login: 'u', hoje: '2026-11-20', chamarApi: async (m, c, b) => { feitas.push([m, c, b]); return api(m, c, b); }, registrar: () => {}, pendentes: new ArmazemAcoesPendentes(), kit: kitFiscoIA };
  return { ctx, modelo, feitas };
}
const REL = { status: 200, corpo: { relatorio: { empresa: { nome: 'Mural Ltda', cnpj: '11222333000181' }, geral: { titulo: 'Há pendências', frase: 'x' }, secoes: [], pendencias: [{ codigo: 'certidao-estadual', paraCliente: true, gravidade: 'alta', texto: 't', tarefa: 'Emitir' }] }, whatsapp: { numero: '5562999990000', texto: 'Olá!', link: 'https://wa.me/5562999990000?text=Ol%C3%A1!' } } };
const EMP = { status: 200, corpo: { empresas: [{ id: C, cnpj: '11.222.333/0001-81', legal_name: 'Mural Ltda', state: 'GO' }] } };
const DTE = { status: 200, corpo: { empresas: [{ id: C, cnpj: '11222333000181', nome: 'Mural Ltda', uf: 'GO' }], checklists: [], resumo: { empresasGo: 1 }, guia: [{ titulo: 'p', itens: ['i'], fonte: 'f' }], porQueSemLeituraAutomatica: ['sem API'] } };
const api: ChamarApi = async (m, c) => {
  if (m === 'POST') return { status: 200, corpo: { gravados: 1, apagados: 0, recusados: [] } };
  if (c.startsWith('/api/relatorio-cliente')) return REL;
  if (c.startsWith('/api/companies')) return EMP;
  if (c.startsWith('/api/dte-goias')) return DTE;
  return { status: 200, corpo: { itens: [] } };
};

test('relatório, WhatsApp, tarefas e DT-e: leitura só por GET, nunca consulta o Serpro; WhatsApp é só link wa.me', async () => {
  const { ctx, modelo, feitas } = montar(api, [
    { chamadas: [{ nome: 'ver_relatorio_cliente', args: { tenantId: T, companyId: C } }, { nome: 'preparar_whatsapp_relatorio', args: { tenantId: T, companyId: C } }, { nome: 'ver_tarefas_equipe', args: { tenantId: T } }, { nome: 'ver_dte_goias', args: { tenantId: T } }] },
    { texto: 'pronto' },
  ]);
  const r = await conversar(ctx, modelo, 'gera o relatório da Mural e manda pro cliente', []);
  assert.ok(feitas.every(([m]) => m === 'GET'));
  assert.ok(!feitas.some(([, c]) => c.startsWith('/api/serpro')), 'nenhuma consulta ao Serpro');
  assert.equal(r.whatsapp.length, 1);
  assert.ok(r.whatsapp[0].link.startsWith('https://wa.me/5562999990000?text='));
});

test('criar tarefa: cartão primeiro, grava só depois de confirmar, com chave fixa da pendência', async () => {
  const { ctx, modelo, feitas } = montar(api, [{ chamadas: [{ nome: 'criar_tarefa_equipe', args: { tenantId: T, companyId: C, titulo: 'Emitir a CND estadual', codigo: 'certidao-estadual', prazo: '2026-11-25' } }] }, { texto: 'confirme' }]);
  const r = await conversar(ctx, modelo, 'cria tarefa da certidão', []);
  assert.equal(r.acoes.length, 1);
  assert.ok(feitas.every(([m]) => m === 'GET'), 'nada gravado antes de confirmar');
  const conf = await confirmarAcao(ctx, r.acoes[0].id);
  assert.equal(conf.sucesso, true);
  const post = feitas.find(([m]) => m === 'POST')!;
  assert.equal(post[1], '/api/escritorio/dados/sincronizar');
  assert.equal(post[2].colecao, 'tarefas_equipe');
  assert.equal(post[2].gravar[0].chave, `rc-${C}-certidao-estadual`);
  assert.equal(post[2].gravar[0].dados.prazo, '2026-11-25');
});

test('marcar DT-e: valida campo e estado; grava o checklist só depois de confirmar', async () => {
  const ruim = montar(api, [{ chamadas: [{ nome: 'marcar_dte_goias', args: { tenantId: T, companyId: C, campo: 'senha', estado: 'tem' } }] }, { texto: 'x' }]);
  assert.equal((await conversar(ruim.ctx, ruim.modelo, 'marca', [])).acoes.length, 0);
  const { ctx, modelo, feitas } = montar(api, [{ chamadas: [{ nome: 'marcar_dte_goias', args: { tenantId: T, companyId: C, campo: 'procuracao', estado: 'tem' } }] }, { texto: 'confirme' }]);
  const r = await conversar(ctx, modelo, 'a Mural já deu a procuração do DT-e', []);
  assert.equal(r.acoes.length, 1);
  assert.ok(feitas.every(([m]) => m === 'GET'));
  await confirmarAcao(ctx, r.acoes[0].id);
  const post = feitas.find(([m]) => m === 'POST')!;
  assert.equal(post[2].colecao, 'dte_go');
  assert.equal(post[2].gravar[0].chave, C);
  assert.equal(post[2].gravar[0].dados.procuracao, 'tem');
  assert.equal(post[2].gravar[0].dados.uf, 'GO');
});
