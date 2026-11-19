import test from 'node:test';
import assert from 'node:assert/strict';
import { arquivarPorCnpj, avisarHubDoFiscal, compararExclusoes, conferirExclusoes, mensagemDivergencias, origemValida } from './exclusaoEmpresa';

const CNPJ = '10368859000101';
const env = { MURADE_INTEGRATION_TOKEN: 'segredo', MURADE_FISCAL_URL: 'https://fiscal.test/' };

test('arquivar por CNPJ: normaliza, chama a função do banco e devolve a quantidade; CNPJ inválido nem toca o banco', async () => {
  const chamadas: Array<[string, unknown[]]> = [];
  const pool = { query: async (sql: string, p: unknown[]) => { chamadas.push([sql, p]); return { rows: [{ n: 2 }] }; } } as never;
  assert.equal(await arquivarPorCnpj(pool, '10.368.859/0001-01', 'fiscal'), 2);
  assert.match(chamadas[0][0], /platform_archive_companies_by_cnpj/);
  assert.deepEqual(chamadas[0][1], [CNPJ, 'fiscal']);
  await assert.rejects(arquivarPorCnpj(pool, '11111111111111', 'fiscal'), /CNPJ inválido/);
  assert.equal(chamadas.length, 1);
});

test('origem do pedido: só aceita nome simples; o resto vira "integracao"', () => {
  assert.equal(origemValida('Fiscal'), 'fiscal');
  assert.equal(origemValida('x; DROP TABLE'), 'integracao');
  assert.equal(origemValida(undefined), 'integracao');
});

test('hub do Fiscal: DELETE com Bearer e corpo {origem, por}; ok quando o Fiscal confirma', async () => {
  let url = '', init: any;
  const buscar = (async (u: string, i: any) => { url = u; init = i; return new Response(JSON.stringify({ sucesso: true })); }) as any;
  const r = await avisarHubDoFiscal(CNPJ, 'dono@x.com', env, buscar);
  assert.equal(r.situacao, 'ok');
  assert.equal(url, `https://fiscal.test/api/integracao/empresa/${CNPJ}`);
  assert.equal(init.method, 'DELETE');
  assert.equal(init.headers.Authorization, 'Bearer segredo');
  assert.deepEqual(JSON.parse(init.body), { origem: 'fiscoia', por: 'dono@x.com' });
});

test('hub do Fiscal: recusa, queda, sem token ou CNPJ inválido viram aviso claro e nunca lançam erro', async () => {
  assert.equal((await avisarHubDoFiscal(CNPJ, 'u', env, (async () => new Response('{}', { status: 500 })) as any)).situacao, 'falhou');
  assert.equal((await avisarHubDoFiscal(CNPJ, 'u', env, (async () => new Response(JSON.stringify({ sucesso: false }))) as any)).situacao, 'falhou');
  const caiu = await avisarHubDoFiscal(CNPJ, 'u', env, (async () => { throw new Error('rede'); }) as any);
  assert.equal(caiu.situacao, 'falhou'); assert.match(caiu.mensagem, /Apague também no Fiscal/);
  assert.equal((await avisarHubDoFiscal(CNPJ, 'u', {}, (async () => new Response('{}')) as any)).situacao, 'nao_configurada');
  let chamou = false;
  assert.equal((await avisarHubDoFiscal('123', 'u', env, (async () => { chamou = true; return new Response('{}'); }) as any)).situacao, 'falhou');
  assert.equal(chamou, false);
});

test('comparação: arquivado aqui e ativo no Fiscal; ativo aqui vindo do Fiscal e sumido de lá; cadastro manual não conta', () => {
  const d = compararExclusoes(new Set(['A', 'B', 'D']), new Map([['C', true], ['E', false], ['F', true], ['D', false]]), new Set(['A', 'F', 'D']));
  assert.deepEqual(d.arquivadoAquiAtivoNoFiscal, ['A']); // D está ativo aqui de novo (recadastrado), então não é divergência; B não está no Fiscal
  assert.deepEqual(d.ativoAquiAusenteNoFiscal, ['C']);   // E é manual (não veio do Fiscal); F está no Fiscal
  assert.match(mensagemDivergencias(d), /^ATENÇÃO/);
  assert.match(mensagemDivergencias({ arquivadoAquiAtivoNoFiscal: [], ativoAquiAusenteNoFiscal: [] }), /^Tudo em ordem/);
});

test('conferidor: sem banco ou sem token não inventa resultado; divergência vira alerta; tudo certo passa', async () => {
  assert.match(await conferirExclusoes(null, env), /nada conferido/);
  assert.match(await conferirExclusoes({ query: async () => ({ rows: [] }) } as never, {}), /nada conferido/);
  const pool = (arq: string[], ativos: Array<[string, boolean]>) => ({ query: async (sql: string) => ({ rows: sql.includes('archived') ? arq.map((cnpj) => ({ cnpj })) : ativos.map(([cnpj, v]) => ({ cnpj, veio_do_fiscal: v })) }) }) as never;
  const fiscal = (...cnpjs: string[]) => (async () => new Response(JSON.stringify({ sucesso: true, empresas: cnpjs.map((cnpj) => ({ cnpj, razaoSocial: 'X' })) }))) as any;
  await assert.rejects(conferirExclusoes(pool([CNPJ], []), env, fiscal(CNPJ)), /ATENÇÃO.*10368859000101/);
  assert.match(await conferirExclusoes(pool([CNPJ], []), env, fiscal()), /^Tudo em ordem/);
  assert.match(await conferirExclusoes({ query: async () => { throw new Error('42883'); } } as never, env, fiscal()), /022/);
});

import { situacaoDoCnpjNoEscritorio } from './exclusaoEmpresa';
test('CNPJ arquivado não vira cadastro novo; se houver ativo, vale o ativo; sem nada, é "nenhuma"', () => {
  const arq = { id: '1', cnpj: CNPJ, arquivada: true }, ativa = { id: '2', cnpj: CNPJ, arquivada: false }, outra = { id: '3', cnpj: '11222333000181', arquivada: false };
  assert.deepEqual(situacaoDoCnpjNoEscritorio([arq, outra], CNPJ), { tipo: 'arquivada' });
  assert.deepEqual(situacaoDoCnpjNoEscritorio([arq, ativa], CNPJ), { tipo: 'ativa', linha: ativa });
  assert.deepEqual(situacaoDoCnpjNoEscritorio([outra], CNPJ), { tipo: 'nenhuma' });
  assert.deepEqual(situacaoDoCnpjNoEscritorio([{ ...arq, cnpj: '10.368.859/0001-01' }], CNPJ), { tipo: 'arquivada' });
});
