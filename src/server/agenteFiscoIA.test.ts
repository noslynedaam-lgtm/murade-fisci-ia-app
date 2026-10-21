import test from 'node:test';
import assert from 'node:assert/strict';
import { ArmazemAcoesPendentes, conversar, type ChamarApi, type ContextoAgente, type ModeloIA } from './agenteMotor';
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
  assert.ok(locais.every((f) => f.tipo === 'leitura'));
});
