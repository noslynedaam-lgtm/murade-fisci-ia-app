import test from 'node:test';
import assert from 'node:assert/strict';
import { lerEmpresasDoFiscal, escritorioAlvo } from './empresasDoFiscal';

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

const D = { login: 'dono@murade.com', donoSistema: true }, C = { login: 'contadora@x.com', donoSistema: false }, O = { login: 'outro@y.com', donoSistema: false };
test('a empresa vai para o escritório cliente, nunca para o dono do sistema que só enxerga tudo', () => {
  assert.deepEqual(escritorioAlvo({ escritorio: D.login, escritorioDonoSistema: true, escritorios: [D, C] }), { login: C.login });
  assert.deepEqual(escritorioAlvo({ escritorio: C.login, escritorioDonoSistema: false, escritorios: [C] }), { login: C.login });
});
test('empresa só do dono fica com o dono; em dois clientes ou sem escritório, não se cria nada', () => {
  assert.deepEqual(escritorioAlvo({ escritorio: D.login, escritorioDonoSistema: true, escritorios: [D] }), { login: D.login });
  assert.deepEqual(escritorioAlvo({ escritorio: D.login, escritorioDonoSistema: true, escritorios: [D, C, O] }), { motivo: 'ambigua' });
  assert.deepEqual(escritorioAlvo({ escritorio: '', escritorioDonoSistema: false, escritorios: [] }), { motivo: 'sem_escritorio' });
});
test('Fiscal antigo (sem a lista de escritórios): só confia quando o escritório informado é cliente', () => {
  assert.deepEqual(escritorioAlvo({ escritorio: D.login, escritorioDonoSistema: true, escritorios: null }), { motivo: 'ambigua' });
  assert.deepEqual(escritorioAlvo({ escritorio: C.login, escritorioDonoSistema: false, escritorios: null }), { login: C.login });
});
test('lê a lista de escritórios de cada empresa enviada pelo Fiscal', async () => {
  const buscar = (async () => new Response(JSON.stringify({ sucesso: true, empresas: [{ cnpj: '12345678000195', razaoSocial: 'A', escritorio: 'Dono@Murade.com', escritorioDonoSistema: true, escritorios: [{ login: 'Dono@Murade.com', donoSistema: true }, { login: 'Contadora@X.com', donoSistema: false }] }] }))) as any;
  const r = await lerEmpresasDoFiscal(env, buscar);
  assert.deepEqual(r[0].escritorios, [D, C]); assert.equal(r[0].escritorioDonoSistema, true);
});
