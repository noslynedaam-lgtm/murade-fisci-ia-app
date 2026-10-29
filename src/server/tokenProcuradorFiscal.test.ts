import test from 'node:test';
import assert from 'node:assert/strict';
import { buscarTokenProcurador, SemTokenProcurador } from './tokenProcuradorFiscal';

const env = { MURADE_INTEGRATION_TOKEN: 'segredo', MURADE_FISCAL_URL: 'https://fiscal.test/' };
const resp = (status: number, corpo: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => corpo }) as unknown as Response;

test('pede o token ao Fiscal com a credencial de integração e devolve o token', async () => {
  let visto: any;
  const t = await buscarTokenProcurador('11111111000191', env, (async (u: string, init: any) => { visto = { u, init }; return resp(200, { sucesso: true, token: 'tok-1' }); }) as any);
  assert.equal(t, 'tok-1'); assert.equal(visto.u, 'https://fiscal.test/api/integracao/serpro/token-procurador');
  assert.equal(visto.init.headers.Authorization, 'Bearer segredo'); assert.equal(JSON.parse(visto.init.body).cnpj, '11111111000191');
});
test('recusa do Fiscal, falha de rede ou falta de credencial: erro claro, nada é consultado', async () => {
  await assert.rejects(buscarTokenProcurador('1', env, (async () => resp(409, { sucesso: false, motivo: 'O certificado digital e-CNPJ A1 do escritório ainda não foi cadastrado.' })) as any), (e: any) => e instanceof SemTokenProcurador && /e-CNPJ A1/.test(e.message) && /Nada foi consultado/.test(e.message));
  await assert.rejects(buscarTokenProcurador('1', env, (async () => { throw new Error('ECONNREFUSED'); }) as any), /Nada foi consultado/);
  await assert.rejects(buscarTokenProcurador('1', {}, (async () => resp(200, {})) as any), /MURADE_INTEGRATION_TOKEN/);
  await assert.rejects(buscarTokenProcurador('1', env, (async () => resp(200, { sucesso: true })) as any), SemTokenProcurador);
});
