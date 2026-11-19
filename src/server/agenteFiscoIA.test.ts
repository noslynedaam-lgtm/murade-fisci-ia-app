import test from 'node:test';
import assert from 'node:assert/strict';
import { ArmazemAcoesPendentes, confirmarAcao, conversar, type ChamarApi, type ContextoAgente, type ModeloIA } from './agenteMotor';
import { kitFiscoIA } from './agenteFiscoIA';

const T = '11111111-1111-4111-8111-111111111111';
const C = '22222222-2222-4222-8222-222222222222';
function montar(api: ChamarApi, falas: Array<{ texto?: string; chamadas?: Array<{ nome: string; args: any }> }>) {
  const chamadasApi: Array<[string, string]> = [];
  let i = 0;
  const modelo: ModeloIA = async () => { const f = falas[i++] || { texto: 'fim' }; return { texto: f.texto || '', chamadas: f.chamadas || [], turnoModelo: { role: 'model', parts: [{ text: f.texto || '' }] } }; };
  const ctx: ContextoAgente = { sessaoHash: 's', login: 'u', hoje: '2026-10-21', chamarApi: async (m, c, b) => { chamadasApi.push([m, c]); return api(m, c, b); }, registrar: () => {}, pendentes: new ArmazemAcoesPendentes(), kit: kitFiscoIA };
  return { ctx, modelo, chamadasApi };
}

test('conferência usa a rota existente e rejeita data ou id inválidos sem chamar o servidor', async () => {
  const api: ChamarApi = async () => ({ status: 200, corpo: { sucesso: true, divergencias: [] } });
  const { ctx, modelo, chamadasApi } = montar(api, [
    { chamadas: [{ nome: 'conferir_periodo', args: { tenantId: T, companyId: C, desde: '2026-09-01', ate: '2026-09-30' } }, { nome: 'conferir_periodo', args: { tenantId: 'x', companyId: C, desde: '2026-09-01', ate: '2026-09-30' } }, { nome: 'conferir_periodo', args: { tenantId: T, companyId: C, desde: 'ontem', ate: '2026-09-30' } }] },
    { texto: 'ok' },
  ]);
  await conversar(ctx, modelo, 'confira setembro', []);
  assert.equal(chamadasApi.length, 1);
  assert.match(chamadasApi[0][1], new RegExp(`^/api/companies/${C}/conferencia\\?tenantId=${T}&desde=2026-09-01&ate=2026-09-30$`));
});
test('o Fisco IA não tem nenhuma ferramenta que altere notas, certificado ou cadastro', () => {
  const locais = kitFiscoIA.ferramentas.filter((f) => !['perguntar_a_outro_sistema', 'pedir_a_outro_sistema', 'ver_pedidos_entre_sistemas', 'responder_pedido_de_outro_sistema'].includes(f.declaracao.name));
  assert.ok(locais.length > 0);
  // As únicas ações permitidas: liberar as consultas ao Serpro (só a conta administradora consegue), consultar a CND federal (paga, só depois de o dono confirmar o custo no cartão) e redefinir o código de segurança de
  // quem perdeu o celular (dono, ou responsável sobre a própria equipe). As duas só valem depois de o dono confirmar no cartão.
  const acoes = locais.filter((f) => f.tipo !== 'leitura').map((f) => f.declaracao.name);
  assert.deepEqual(acoes, ['liberar_consulta_serpro', 'consultar_certidao', 'redefinir_codigo_usuario']);
});

const E = '33333333-3333-4333-8333-333333333333';
const LISTA = { status: 200, corpo: { empresas: [{ empresaId: E, nome: 'Mural Ltda', cnpj: '11.222.333/0001-81', escritorio: 'Escritório Cliente', liberada: false, pediuEm: '2026-11-06T12:00:00Z', liberadaEm: null }] } };

test('liberar consulta do Serpro: só propõe o cartão; nada é liberado antes de o dono confirmar', async () => {
  const api: ChamarApi = async () => LISTA;
  const { ctx, modelo, chamadasApi } = montar(api, [{ chamadas: [{ nome: 'liberar_consulta_serpro', args: { empresaId: E, liberar: true } }] }, { texto: 'confira o cartão' }]);
  const r = await conversar(ctx, modelo, 'libera o Serpro da Mural', []);
  assert.equal(r.acoes.length, 1);
  assert.match(r.acoes[0].titulo, /Liberar consulta ao Serpro: Mural Ltda/);
  assert.ok(chamadasApi.every(([m]) => m === 'GET'), 'antes de confirmar só pode ter leitura');
});

test('liberar consulta do Serpro: ao confirmar, faz uma única chamada para a empresa certa', async () => {
  const feitas: Array<[string, string, unknown]> = [];
  const api: ChamarApi = async (m, c, b) => { feitas.push([m, c, b]); return m === 'GET' ? LISTA : { status: 200, corpo: { ok: true } }; };
  const { ctx, modelo } = montar(api, [{ chamadas: [{ nome: 'liberar_consulta_serpro', args: { empresaId: E, liberar: true } }] }, { texto: 'ok' }]);
  const r = await conversar(ctx, modelo, 'libera o Serpro da Mural', []);
  const conf = await confirmarAcao(ctx, r.acoes[0].id);
  assert.equal(conf.sucesso, true);
  const posts = feitas.filter(([m]) => m === 'POST');
  assert.equal(posts.length, 1);
  assert.equal(posts[0][1], `/api/serpro/liberacoes/${E}`);
  assert.deepEqual(posts[0][2], { liberada: true });
});

test('liberar consulta do Serpro: id inválido ou empresa fora da lista não gera cartão', async () => {
  const api: ChamarApi = async () => LISTA;
  const { ctx, modelo } = montar(api, [{ chamadas: [{ nome: 'liberar_consulta_serpro', args: { empresaId: 'todas', liberar: true } }, { nome: 'liberar_consulta_serpro', args: { empresaId: '44444444-4444-4444-8444-444444444444', liberar: true } }, { nome: 'liberar_consulta_serpro', args: { empresaId: E } }] }, { texto: 'não deu' }]);
  const r = await conversar(ctx, modelo, 'libera tudo', []);
  assert.equal(r.acoes.length, 0);
});

test('liberar consulta do Serpro: quem não é o dono recebe o motivo e nenhum cartão', async () => {
  const api: ChamarApi = async () => ({ status: 403, corpo: { mensagem: 'Somente a conta administradora vê a liberação das consultas.' } });
  const { ctx, modelo } = montar(api, [{ chamadas: [{ nome: 'liberar_consulta_serpro', args: { empresaId: E, liberar: true } }] }, { texto: 'sem permissão' }]);
  const r = await conversar(ctx, modelo, 'libera', []);
  assert.equal(r.acoes.length, 0);
});

const EMP = { status: 200, corpo: { empresas: [{ id: C, cnpj: '11.222.333/0001-81', legal_name: 'Mural Ltda' }] } };

test('consultar certidão federal: só propõe o cartão com aviso de consulta paga; nada é consultado antes de confirmar', async () => {
  const api: ChamarApi = async () => EMP;
  const { ctx, modelo, chamadasApi } = montar(api, [{ chamadas: [{ nome: 'consultar_certidao', args: { tenantId: T, companyId: C, tipo: 'federal' } }] }, { texto: 'confirme no cartão' }]);
  const r = await conversar(ctx, modelo, 'consulta a CND da Mural', []);
  assert.equal(r.acoes.length, 1);
  assert.match(r.acoes[0].titulo, /Consultar CND Federal.*Mural Ltda/);
  assert.match(r.acoes[0].descricao.join(' '), /paga pelo Serpro/);
  assert.ok(chamadasApi.every(([m]) => m === 'GET'));
});

test('consultar certidão federal: ao confirmar, faz uma única consulta com confirmação de custo', async () => {
  const feitas: Array<[string, string, any]> = [];
  const api: ChamarApi = async (m, c, b) => { feitas.push([m, c, b]); return m === 'GET' ? EMP : { status: 200, corpo: { situacao: 'emitida', mensagem: 'Certidão emitida.', certidao: { situacao: 'emitida', numero: 'AB12', emissao: '2026-11-19', validade: '2027-05-18' } } }; };
  const { ctx, modelo } = montar(api, [{ chamadas: [{ nome: 'consultar_certidao', args: { tenantId: T, companyId: C, tipo: 'federal' } }] }, { texto: 'ok' }]);
  const r = await conversar(ctx, modelo, 'consulta', []);
  const conf = await confirmarAcao(ctx, r.acoes[0].id);
  assert.equal(conf.sucesso, true);
  assert.match(conf.mensagem, /válida até 2027-05-18/);
  const posts = feitas.filter(([m]) => m === 'POST');
  assert.equal(posts.length, 1);
  assert.deepEqual(posts[0][2], { tenantId: T, companyId: C, tipo: 'federal', confirmarCusto: true });
});

test('consultar certidão: tipos sem consulta automática não geram cartão e apontam o portal; tipo inválido também não', async () => {
  const api: ChamarApi = async () => EMP;
  const { ctx, modelo, chamadasApi } = montar(api, [{ chamadas: [{ nome: 'consultar_certidao', args: { tenantId: T, companyId: C, tipo: 'fgts' } }, { nome: 'consultar_certidao', args: { tenantId: T, companyId: C, tipo: 'tudo' } }] }, { texto: 'use o portal' }]);
  const r = await conversar(ctx, modelo, 'consulta o fgts', []);
  assert.equal(r.acoes.length, 0);
  assert.equal(chamadasApi.length, 0);
});

test('ver certidões vencendo: só lê e entrega empresa, validade e situação', async () => {
  const api: ChamarApi = async () => ({ status: 200, corpo: { hoje: '2026-11-19', certidoes: [{ empresa: 'Mural Ltda', rotuloTipo: 'CRF - Regularidade do FGTS', validade: '2026-11-25', situacaoTexto: 'vence em 6 dia(s)', numero: '9' }] } });
  const { ctx, modelo, chamadasApi } = montar(api, [{ chamadas: [{ nome: 'ver_certidoes_vencendo', args: { tenantId: T } }] }, { texto: 'resumo' }]);
  await conversar(ctx, modelo, 'o que vence de certidão?', []);
  assert.deepEqual(chamadasApi, [['GET', `/api/certidoes/vencendo?tenantId=${T}`]]);
});
