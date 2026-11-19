// Testes com dados SIMULADOS: nenhuma chamada ao Serpro nem a órgão público.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ADAPTADORES, TIPOS_CERTIDAO, certidoesQueRequeremAtencao, dataIsoValida, faixaDeVencimento, hojeBrasilia, textoDaFaixa, validarRegistroManual, type CertidaoGuardada } from './certidoes';
import { consultarCndFederal, interpretarRespostaCnd, lerConfigCnd, montarPedidoCnd, type ChamadaHttp } from './consultaCndFederal';

const CNPJ = '11222333000181';
const CFG = { baseUrl: 'https://gw.serpro.gov.br/api-cnd', tokenUrl: 'https://gw.serpro.gov.br/oauth2/jwt-token', consumerKey: 'k', consumerSecret: 's' };

test('só a federal tem consulta automática; os demais tipos são manuais e não inventam portal', () => {
  assert.deepEqual(TIPOS_CERTIDAO.filter((t) => ADAPTADORES[t].modo === 'automatica_paga'), ['federal']);
  assert.equal(ADAPTADORES.federal.fontesOficiais.length, 2);
  for (const t of TIPOS_CERTIDAO) assert.ok(!/alterdata/i.test(JSON.stringify(ADAPTADORES[t])));
});

test('vencimento: vencida, 7, 15, 30 dias e em dia; no próprio dia da validade ainda vale', () => {
  const h = '2026-11-19';
  assert.equal(faixaDeVencimento('2026-11-18', h).faixa, 'vencida');
  assert.deepEqual(faixaDeVencimento('2026-11-19', h), { faixa: 'vence_em_7', dias: 0 });
  assert.equal(faixaDeVencimento('2026-11-26', h).faixa, 'vence_em_7');
  assert.equal(faixaDeVencimento('2026-11-27', h).faixa, 'vence_em_15');
  assert.equal(faixaDeVencimento('2026-12-04', h).faixa, 'vence_em_15');
  assert.equal(faixaDeVencimento('2026-12-05', h).faixa, 'vence_em_30');
  assert.equal(faixaDeVencimento('2026-12-19', h).faixa, 'vence_em_30');
  assert.equal(faixaDeVencimento('2026-12-20', h).faixa, 'em_dia');
  assert.equal(faixaDeVencimento('2026-02-30', h).faixa, 'sem_validade');
  assert.equal(faixaDeVencimento(null, h).faixa, 'sem_validade');
  assert.equal(textoDaFaixa('vencida', -3), 'vencida há 3 dia(s)');
});

test('hoje no horário de Brasília (e não UTC)', () => {
  assert.equal(hojeBrasilia(new Date('2026-11-20T01:30:00Z')), '2026-11-19');
});

test('só a certidão mais recente de cada empresa + tipo alerta; a antiga vencida some quando há uma nova', () => {
  const base = { companyId: 'c1', empresa: 'A', uf: null, municipio: null, numero: '1', emissao: '2026-01-01', situacao: 'emitida' as const };
  const lista: CertidaoGuardada[] = [
    { ...base, id: 'velha', tipo: 'federal', validade: '2026-05-01', criadaEm: '2026-01-02T00:00:00Z' },
    { ...base, id: 'nova', tipo: 'federal', validade: '2027-05-01', criadaEm: '2026-10-02T00:00:00Z' },
    { ...base, id: 'fgts', tipo: 'fgts', validade: '2026-11-25', criadaEm: '2026-11-01T00:00:00Z' },
    { ...base, id: 'erro', tipo: 'trabalhista', validade: '2026-01-01', situacao: 'erro', criadaEm: '2026-11-01T00:00:00Z' },
    { ...base, id: 'est-go', tipo: 'estadual', uf: 'GO', validade: '2026-11-10', criadaEm: '2026-11-01T00:00:00Z' },
    { ...base, id: 'est-sp', tipo: 'estadual', uf: 'SP', validade: '2027-01-10', criadaEm: '2026-11-01T00:00:00Z' },
  ];
  const r = certidoesQueRequeremAtencao(lista, '2026-11-19');
  assert.deepEqual(r.map((x) => [x.id, x.faixa]), [['est-go', 'vencida'], ['fgts', 'vence_em_7']]);
});

test('registro manual: valida datas, tipo e número; não aceita validade antes da emissão', () => {
  const ok = validarRegistroManual({ tipo: 'fgts', numero: ' 2026111900001 ', emissao: '2026-11-19', validade: '2026-12-18', resultadoOrgao: 'Regular' });
  assert.ok(ok.ok && ok.valor.numero === '2026111900001' && ok.valor.uf === null);
  assert.equal(validarRegistroManual({ tipo: 'xx', numero: '1', emissao: '2026-11-19', validade: '2026-12-18' }).ok, false);
  assert.equal(validarRegistroManual({ tipo: 'fgts', numero: '', emissao: '2026-11-19', validade: '2026-12-18' }).ok, false);
  assert.equal(validarRegistroManual({ tipo: 'fgts', numero: '1', emissao: '2026-11-19', validade: '2026-11-18' }).ok, false);
  assert.equal(validarRegistroManual({ tipo: 'fgts', numero: '1', emissao: '2026-02-30', validade: '2026-12-18' }).ok, false);
  assert.equal(validarRegistroManual({ tipo: 'estadual', uf: 'Goiás', numero: '1', emissao: '2026-11-19', validade: '2026-12-18' }).ok, false);
  assert.equal(dataIsoValida('2026-13-01'), false);
});

test('configuração da consulta federal: só endereços https do Serpro; sem variáveis não configura', () => {
  assert.equal(lerConfigCnd({}), null);
  const env = { SERPRO_CND_BASE_URL: 'https://gw.serpro.gov.br/api-cnd/', SERPRO_CND_TOKEN_URL: 'https://gw.serpro.gov.br/oauth2/jwt-token', SERPRO_CND_CONSUMER_KEY: 'k', SERPRO_CND_CONSUMER_SECRET: 's' };
  assert.equal(lerConfigCnd(env)?.baseUrl, 'https://gw.serpro.gov.br/api-cnd');
  assert.equal(lerConfigCnd({ ...env, SERPRO_CND_BASE_URL: 'http://gw.serpro.gov.br/x' }), null);
  assert.equal(lerConfigCnd({ ...env, SERPRO_CND_TOKEN_URL: 'https://evil.example.com/oauth2' }), null);
  assert.equal(lerConfigCnd({ ...env, SERPRO_CND_TOKEN_URL: 'https://serpro.gov.br.evil.com/o' }), null);
  assert.equal(lerConfigCnd({ ...env, SERPRO_CND_CONSUMER_SECRET: '' }), null);
});

test('pedido conforme o manual: pessoa jurídica, código 9201, PDF solicitado, chave só quando há', () => {
  assert.deepEqual(montarPedidoCnd(CNPJ), { TipoContribuinte: 1, ContribuinteConsulta: CNPJ, CodigoIdentificacao: 9201, GerarCertidaoPdf: true });
  assert.equal((montarPedidoCnd(CNPJ, 'abc') as any).Chave, 'abc');
});

const pdf = Buffer.from('%PDF-1.4 simulado').toString('base64');
const emitida = (status = 2) => JSON.stringify({ Status: status, Mensagem: 'Certidão emitida', Certidao: { TipoContribuinte: 1, ContribuinteCertidao: CNPJ, CodigoControle: 'ABCD.1234', TipoCertidao: 2, DataEmissao: '2026-11-19T10:00:00', DataValidade: '2027-05-18', DocumentoPdf: pdf } });

test('resposta emitida: validade e número EXATAMENTE como o órgão informou, sem calcular 180 dias', () => {
  const r = interpretarRespostaCnd(200, emitida());
  assert.equal(r.situacao, 'emitida'); assert.equal(r.numero, 'ABCD.1234'); assert.equal(r.emissao, '2026-11-19'); assert.equal(r.validade, '2027-05-18');
  assert.equal(r.codigoTipoCertidao, '2'); assert.equal(r.pdfBase64, pdf); assert.equal(r.cobrada, true);
});
test('certidão sem validade na resposta nunca vira "emitida"', () => {
  const r = interpretarRespostaCnd(200, JSON.stringify({ Status: 2, Mensagem: 'ok', Certidao: { CodigoControle: 'X' } }));
  assert.equal(r.situacao, 'erro'); assert.equal(r.validade, null);
});
test('status do manual: não emitida, indisponível (não cobrada), em processamento, erros HTTP', () => {
  assert.equal(interpretarRespostaCnd(200, JSON.stringify({ Status: 3, Mensagem: 'Não emitida' })).situacao, 'nao_emitida');
  assert.equal(interpretarRespostaCnd(200, JSON.stringify({ Status: 4, Mensagem: 'Situação cadastral impeditiva' })).situacao, 'nao_emitida');
  const ind = interpretarRespostaCnd(202, JSON.stringify({ Status: 6, Mensagem: 'Base indisponível' }));
  assert.equal(ind.situacao, 'indisponivel'); assert.equal(ind.cobrada, false);
  const proc = interpretarRespostaCnd(201, JSON.stringify({ Status: 7, Mensagem: 'Em processamento', Chave: 'K1' }));
  assert.equal(proc.situacao, 'em_processamento'); assert.equal(proc.chave, 'K1'); assert.equal(proc.cobrada, true);
  const e401 = interpretarRespostaCnd(401, 'Unauthorized'); assert.equal(e401.situacao, 'erro'); assert.equal(e401.cobrada, false); assert.match(e401.mensagem, /chave inválida|limite/);
  assert.match(interpretarRespostaCnd(403, '').mensagem, /IP/);
  assert.equal(interpretarRespostaCnd(200, '<html>').situacao, 'erro');
});

function http(respostas: Array<{ status: number; texto: string }>, vistos: any[] = []): ChamadaHttp {
  let i = 0;
  return async (req) => { vistos.push(req); const r = respostas[Math.min(i, respostas.length - 1)]; i += 1; return r; };
}
const tokenOk = { status: 200, texto: JSON.stringify({ access_token: 'tok' }) };

test('consulta federal: autentica, pede o PDF e devolve a certidão emitida', async () => {
  const vistos: any[] = [];
  const r = await consultarCndFederal({ cnpj: CNPJ, config: CFG, http: http([tokenOk, { status: 200, texto: emitida() }], vistos), esperar: async () => undefined });
  assert.equal(r.situacao, 'emitida'); assert.equal(vistos.length, 2);
  assert.equal(vistos[0].cabecalhos.Authorization, `Basic ${Buffer.from('k:s').toString('base64')}`);
  assert.equal(vistos[1].url, 'https://gw.serpro.gov.br/api-cnd/v1/ConsultaCnd/certidao');
  assert.equal(vistos[1].cabecalhos.Authorization, 'Bearer tok');
  assert.equal(JSON.parse(vistos[1].corpo).ContribuinteConsulta, CNPJ);
});
test('status 7: repete com a chave recebida, espera 500 ms ou mais e cobra uma vez só', async () => {
  const vistos: any[] = []; const esperas: number[] = [];
  const r = await consultarCndFederal({ cnpj: CNPJ, config: CFG, http: http([tokenOk, { status: 201, texto: JSON.stringify({ Status: 7, Mensagem: 'proc', Chave: 'K9' }) }, { status: 200, texto: emitida(2) }], vistos), esperar: async (ms) => { esperas.push(ms); } });
  assert.equal(r.situacao, 'emitida'); assert.equal(r.cobrada, true);
  assert.equal(JSON.parse(vistos[2].corpo).Chave, 'K9'); assert.ok(esperas.every((e) => e >= 500) && esperas.length === 1);
});
test('status 7 que não termina: devolve em processamento com a chave (reaproveitada na próxima consulta)', async () => {
  const r = await consultarCndFederal({ cnpj: CNPJ, config: CFG, maxTentativas: 3, http: http([tokenOk, { status: 201, texto: JSON.stringify({ Status: 7, Chave: 'K2' }) }]), esperar: async () => undefined });
  assert.equal(r.situacao, 'em_processamento'); assert.equal(r.chave, 'K2');
});
test('chave anterior é reaproveitada e não gera nova cobrança', async () => {
  const vistos: any[] = [];
  const r = await consultarCndFederal({ cnpj: CNPJ, config: CFG, chaveAnterior: 'K1', http: http([tokenOk, { status: 200, texto: emitida() }], vistos), esperar: async () => undefined });
  assert.equal(JSON.parse(vistos[1].corpo).Chave, 'K1'); assert.equal(r.cobrada, false);
});
test('autenticação recusada: nada cobrado e nenhuma consulta feita', async () => {
  const vistos: any[] = [];
  const r = await consultarCndFederal({ cnpj: CNPJ, config: CFG, http: http([{ status: 401, texto: '' }], vistos) });
  assert.equal(r.situacao, 'erro'); assert.equal(r.cobrada, false); assert.equal(vistos.length, 1);
});
test('falha de rede ao autenticar: erro sem cobrança', async () => {
  const r = await consultarCndFederal({ cnpj: CNPJ, config: CFG, http: async () => { throw new Error('rede'); } });
  assert.equal(r.situacao, 'erro'); assert.equal(r.cobrada, false);
});
