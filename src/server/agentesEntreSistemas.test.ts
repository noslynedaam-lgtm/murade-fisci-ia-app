import test from 'node:test';
import assert from 'node:assert/strict';
import { ArmazemPedidosMemoria, CentralDePedidos, tokenValido, type Transporte } from './agentesEntreSistemas';

const env = { MURADE_INTEGRATION_TOKEN: 'segredo', MURADE_FISCAL_URL: 'https://fiscal.test', MURADE_DP_URL: 'https://dp.test' };

function par() {
  // DP e Fiscal ligados por um transporte em memória.
  const dp: any = {}; const fiscal: any = {};
  let fiscalNoAr = true;
  const rota: Transporte = async (url, init) => {
    if (init.headers.authorization !== 'Bearer segredo') return { status: 401, json: { ok: false } };
    const alvo = url.startsWith('https://fiscal.test') ? fiscal : dp;
    if (alvo === fiscal && !fiscalNoAr) throw new Error('fetch failed');
    const r = await alvo.central.receber(JSON.parse(init.body));
    return { status: r.status, json: r.corpo };
  };
  dp.central = new CentralDePedidos('dp', new ArmazemPedidosMemoria(), { robos: async () => ({ ok: 1 }) }, rota, env);
  fiscal.central = new CentralDePedidos('fiscal', new ArmazemPedidosMemoria(), { robos: async () => ({ robos: ['saida'] }) }, rota, env);
  return { dp: dp.central as CentralDePedidos, fiscal: fiscal.central as CentralDePedidos, derrubarFiscal: () => { fiscalNoAr = false; }, subirFiscal: () => { fiscalNoAr = true; } };
}

test('pergunta lê dados reais do outro sistema', async () => {
  const { dp } = par();
  const r = await dp.perguntar('fiscal', 'robos', null);
  assert.deepEqual(r, { ok: true, dados: { robos: ['saida'] } });
});
test('consulta desconhecida e sistema próprio são recusados', async () => {
  const { dp } = par();
  assert.equal((await dp.perguntar('fiscal', 'apagar_tudo', null)).ok, false);
  assert.equal((await dp.perguntar('dp', 'robos', null)).ok, false);
});
test('pedido chega na caixa do destino e a resposta volta', async () => {
  const { dp, fiscal } = par();
  const p = await dp.pedir('fiscal', 'Mandar notas de entrada de abril', '12345678000190');
  assert.equal(p.estado, 'enviado');
  const caixa = await fiscal.caixaDeEntrada();
  assert.equal(caixa.length, 1);
  assert.equal(caixa[0].estado, 'recebido');
  const r = await fiscal.responder(p.id, 'concluido', 'Notas enviadas');
  assert.equal(r.avisado, true);
  const enviados = await dp.enviados();
  assert.equal(enviados[0].estado, 'concluido');
  assert.equal(enviados[0].resposta, 'Notas enviadas');
  assert.equal((await fiscal.caixaDeEntrada()).length, 0);
});
test('destino fora do ar: pedido fica guardado e é reenviado sem duplicar', async () => {
  const { dp, fiscal, derrubarFiscal, subirFiscal } = par();
  derrubarFiscal();
  const p = await dp.pedir('fiscal', 'Emitir DAS de abril', null);
  assert.equal(p.estado, 'a_enviar');
  assert.equal((await fiscal.caixaDeEntrada()).length, 0);
  subirFiscal();
  assert.equal(await dp.reenviarPendentes(), 1);
  assert.equal((await fiscal.caixaDeEntrada()).length, 1);
  assert.equal(await dp.reenviarPendentes(), 0);
  // repetição do mesmo idPedido não duplica
  await fiscal.receber({ de: 'dp', tipo: 'pedido', idPedido: p.id, texto: 'Emitir DAS de abril' });
  assert.equal((await fiscal.caixaDeEntrada()).length, 1);
});
test('falha definitiva após 10 tentativas', async () => {
  const { dp, derrubarFiscal } = par();
  derrubarFiscal();
  const p = await dp.pedir('fiscal', 'Pedido que nunca chega', null);
  for (let i = 0; i < 12; i++) await dp.reenviarPendentes();
  const [r] = await dp.enviados();
  assert.equal(r.id, p.id); assert.equal(r.estado, 'falhou'); assert.equal(r.tentativas, 10);
});
test('pedido encerrado não pode ser respondido de novo; resposta forjada é rejeitada', async () => {
  const { dp, fiscal } = par();
  const p = await dp.pedir('fiscal', 'Algo simples aqui', null);
  await fiscal.responder(p.id, 'recusado', 'Não dá');
  await assert.rejects(() => fiscal.responder(p.id, 'concluido', 'ok'), /encerrado/);
  const forjada = await dp.receber({ de: 'contabil', tipo: 'resposta', idPedido: p.id, estado: 'concluido', resposta: 'falso' });
  assert.equal(forjada.status, 404);
});
test('entradas inválidas e token', async () => {
  const { dp } = par();
  assert.equal((await dp.receber({ de: 'dp', tipo: 'pedido' })).status, 400);
  assert.equal((await dp.receber({ de: 'fiscal', tipo: 'pedido', idPedido: 'x', texto: 'a' })).status, 400);
  assert.equal(tokenValido('Bearer segredo', 'segredo'), true);
  assert.equal(tokenValido('Bearer errado!', 'segredo'), false);
  assert.equal(tokenValido(undefined, 'segredo'), false);
  assert.equal(tokenValido('Bearer x', undefined), false);
  await assert.rejects(() => dp.pedir('dp', 'para mim mesmo', null), /próprio/);
});
