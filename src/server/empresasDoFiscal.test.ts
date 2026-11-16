import test from 'node:test';
import assert from 'node:assert/strict';
import { lerEmpresasDoFiscal } from './empresasDoFiscal';

const env = { MURADE_INTEGRATION_TOKEN: 'segredo', MURADE_FISCAL_URL: 'https://fiscal.test/' };

test('lê as empresas do Fiscal com o token e normaliza os dados', async () => {
  let url = '', auth = '';
  const buscar = (async (u: string, init: any) => {
    url = u; auth = init.headers.Authorization;
    return new Response(JSON.stringify({ sucesso: true, empresas: [{ cnpj: '12.345.678/0001-95', razaoSocial: ' NU 12 DRYWALL ', uf: 'go', cidade: 'Goiânia', regime: 'Simples Nacional', status: 'Ativa', escritorio: 'Dono@Murade.com' }] }));
  }) as any;
  const r = await lerEmpresasDoFiscal(env, buscar);
  assert.equal(url, 'https://fiscal.test/api/integracao/fiscal/empresas');
  assert.equal(auth, 'Bearer segredo');
  assert.equal(r[0].cnpj, '12345678000195');
  assert.equal(r[0].razaoSocial, 'NU 12 DRYWALL');
  assert.equal(r[0].uf, 'GO');
  assert.equal(r[0].escritorio, 'dono@murade.com');
});

test('sem token ou com recusa do Fiscal, falha sem criar nada', async () => {
  await assert.rejects(lerEmpresasDoFiscal({}, (async () => new Response('{}')) as any));
  await assert.rejects(lerEmpresasDoFiscal(env, (async () => new Response(JSON.stringify({ sucesso: false }), { status: 401 })) as any));
});
