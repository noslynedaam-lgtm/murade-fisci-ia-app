import test from 'node:test';
import assert from 'node:assert/strict';
import { ArmazemAcoesPendentes, confirmarAcao, conversar, type ChamarApi, type ContextoAgente, type ModeloIA } from './agenteMotor';
import { kitFiscoIA } from './agenteFiscoIA';

const T = '11111111-1111-4111-8111-111111111111';
const C = '22222222-2222-4222-8222-222222222222';
function montar(api: ChamarApi, falas: Array<{ texto?: string; chamadas?: Array<{ nome: string; args: any }> }>) {
  const feitas: Array<[string, string, unknown]> = [];
  let i = 0;
  const modelo: ModeloIA = async () => { const f = falas[i++] || { texto: 'fim' }; return { texto: f.texto || '', chamadas: f.chamadas || [], turnoModelo: { role: 'model', parts: [{ text: f.texto || '' }] } }; };
  const ctx: ContextoAgente = { sessaoHash: 's', login: 'u', hoje: '2026-11-20', chamarApi: async (m, c, b) => { feitas.push([m, c, b]); return api(m, c, b); }, registrar: () => {}, pendentes: new ArmazemAcoesPendentes(), kit: kitFiscoIA };
  return { ctx, modelo, feitas };
}
const EMP = { status: 200, corpo: { empresas: [{ id: C, cnpj: '11.222.333/0001-81', legal_name: 'Mural Ltda' }] } };
const PRONT = { status: 200, corpo: { servicos: [{ chave: 'situacaoFiscal', descricao: 'Situação fiscal / pendências do contribuinte' }] } };
const cota = (cobrada: boolean, liberada = true) => ({ status: 200, corpo: { proximaConsultaCobrada: cobrada, liberada } });
const apiCom = (c: { status: number; corpo: any }, consulta?: { status: number; corpo: any }): ChamarApi => async (m, caminho) => {
  if (m === 'POST') return consulta ?? { status: 200, corpo: { consultado: true, cobradaAparte: false, guardado: true } };
  if (caminho.startsWith('/api/companies')) return EMP;
  if (caminho.startsWith('/api/serpro/consultas/')) return c;
  return PRONT;
};

test('ferramentas de leitura da carteira só fazem GET nas rotas do que já está guardado (sem custo)', async () => {
  const { ctx, modelo, feitas } = montar(async () => ({ status: 200, corpo: { empresas: [], resultados: [], itens: [], certificados: [] } }), [
    { chamadas: [
      { nome: 'ver_carteira_fiscal', args: { tenantId: T } },
      { nome: 'ver_situacao_fiscal_guardada', args: { tenantId: T, companyId: C } },
      { nome: 'ver_caixa_postal_guardada', args: { tenantId: T, companyId: C } },
      { nome: 'ver_parcelamentos_guardados', args: { tenantId: T, companyId: C } },
    ] },
    { chamadas: [
      { nome: 'ver_certificados_vencendo', args: { tenantId: T } },
      { nome: 'ver_agenda_fiscal', args: { tenantId: T } },
    ] },
    { texto: 'ok' },
  ]);
  await conversar(ctx, modelo, 'como está a carteira?', []);
  assert.deepEqual(feitas.map(([m, c]) => `${m} ${c}`), [
    `GET /api/carteira-fiscal?tenantId=${T}`,
    `GET /api/carteira-fiscal/empresa?tenantId=${T}&companyId=${C}&grupo=situacao`,
    `GET /api/carteira-fiscal/empresa?tenantId=${T}&companyId=${C}&grupo=caixa`,
    `GET /api/carteira-fiscal/empresa?tenantId=${T}&companyId=${C}&grupo=parcelamentos`,
    `GET /api/certificados/vencendo?tenantId=${T}`,
    `GET /api/escritorio/dados?tenantId=${T}&colecao=agenda_lembretes`,
  ]);
  assert.ok(!feitas.some(([, c]) => c.startsWith('/api/serpro/consulta')), 'nenhuma consulta paga');
});

test('pedir consulta: cartão mostra que é grátis da semana; nada é consultado antes de confirmar', async () => {
  const { ctx, modelo, feitas } = montar(apiCom(cota(false)), [{ chamadas: [{ nome: 'pedir_consulta_receita', args: { tenantId: T, companyId: C, servico: 'situacaoFiscal' } }] }, { texto: 'confira' }]);
  const r = await conversar(ctx, modelo, 'consulta a situação fiscal da Mural', []);
  assert.equal(r.acoes.length, 1);
  assert.match(r.acoes[0].descricao.join(' '), /Sem custo: entra na consulta grátis/);
  assert.ok(feitas.every(([m]) => m === 'GET'));
  const conf = await confirmarAcao(ctx, r.acoes[0].id);
  assert.equal(conf.sucesso, true); assert.match(String(conf.mensagem), /guardado na carteira/);
  const posts = feitas.filter(([m]) => m === 'POST');
  assert.equal(posts.length, 1);
  assert.deepEqual(posts[0][2], { tenantId: T, companyId: C, servico: 'situacaoFiscal', dados: {}, confirmarCusto: false });
});

test('pedir consulta: cartão mostra o CUSTO quando a grátis já foi usada e só então manda confirmarCusto', async () => {
  const { ctx, modelo, feitas } = montar(apiCom(cota(true)), [{ chamadas: [{ nome: 'pedir_consulta_receita', args: { tenantId: T, companyId: C, servico: 'caixaPostalLista' } }] }, { texto: 'confira' }]);
  const r = await conversar(ctx, modelo, 'lista a caixa postal', []);
  assert.match(r.acoes[0].descricao.join(' '), /CUSTO: R\$ 1,00/);
  assert.match(String(r.acoes[0].aviso), /será cobrada/);
  await confirmarAcao(ctx, r.acoes[0].id);
  const post = feitas.find(([m]) => m === 'POST')!;
  assert.deepEqual(post[2], { tenantId: T, companyId: C, servico: 'caixaPostalLista', dados: { statusLeitura: '2', indicadorPagina: '0' }, confirmarCusto: true });
});

test('pedir consulta: se a grátis acabou entre o cartão e o clique, o servidor para (402) e a Agente avisa sem cobrar', async () => {
  const { ctx, modelo } = montar(apiCom(cota(false), { status: 402, corpo: { exigeConfirmacao: true } }), [{ chamadas: [{ nome: 'pedir_consulta_receita', args: { tenantId: T, companyId: C, servico: 'caixaPostalNovas' } }] }, { texto: 'ok' }]);
  const r = await conversar(ctx, modelo, 'tem mensagem nova?', []);
  const conf = await confirmarAcao(ctx, r.acoes[0].id);
  assert.equal(conf.sucesso, false); assert.match(String(conf.mensagem), /Nada foi consultado nem cobrado/);
});

test('pedir consulta: empresa não liberada, serviço fora da lista (ex.: abrir mensagem = ciência) ou ids inválidos não geram cartão', async () => {
  const { ctx, modelo, feitas } = montar(apiCom(cota(false, false)), [{ chamadas: [
    { nome: 'pedir_consulta_receita', args: { tenantId: T, companyId: C, servico: 'situacaoFiscal' } },
    { nome: 'pedir_consulta_receita', args: { tenantId: T, companyId: C, servico: 'caixaPostalDetalhe' } },
    { nome: 'pedir_consulta_receita', args: { tenantId: T, companyId: C, servico: 'dctfwebTransmitir' } },
    { nome: 'pedir_consulta_receita', args: { tenantId: 'x', companyId: C, servico: 'situacaoFiscal' } },
  ] }, { texto: 'não deu' }]);
  const r = await conversar(ctx, modelo, 'consulta', []);
  assert.equal(r.acoes.length, 0);
  assert.ok(feitas.every(([m]) => m === 'GET'));
});
