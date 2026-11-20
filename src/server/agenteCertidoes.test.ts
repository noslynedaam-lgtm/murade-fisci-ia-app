// Agente IA e certidões: "busca as certidões da empresa X" e "quais certidões vencem". Só leitura, sem custo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { kitFiscoIA } from './agenteFiscoIA';

const T = '11111111-1111-4111-8111-111111111111';
const C = '22222222-2222-4222-8222-222222222222';
const est = (tipo: string, cor: string, texto: string, validade: string | null = null) => ({ tipo, cor, texto, validade });
const PAINEL = {
  hoje: '2026-11-20', contagem: { verde: 1, amarelo: 1, vermelho: 1, cinza: 2 }, totalABuscar: 3,
  linhas: [{ empresa: { id: C, nome: 'Mural Ltda', cnpj: '11.222.333/0001-81' }, pior: 'vermelho', aBuscar: ['estadual', 'municipal', 'fgts'],
    certidoes: { federal: est('federal', 'verde', 'em dia', '2027-03-01'), estadual: est('estadual', 'cinza', 'ainda não buscada'), municipal: est('municipal', 'cinza', 'ainda não buscada'), fgts: est('fgts', 'vermelho', 'vencida há 2 dia(s)', '2026-11-18'), trabalhista: est('trabalhista', 'amarelo', 'vence em 10 dia(s)', '2026-11-30') } }],
  proximosVencimentos: [{ empresa: 'Mural Ltda', companyId: C, tipo: 'fgts', texto: 'vencida há 2 dia(s)', validade: '2026-11-18', cor: 'vermelho' }],
  portais: { [C]: { estadual: 'https://www.sefaz.go.gov.br/Certidao/Emissao/', municipal: 'https://www.goiania.go.gov.br/sistemas/sccer/asp/sccer00300f0.asp', fgts: 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf', trabalhista: 'https://www.tst.jus.br/certidao' } },
};
const ferramenta = (nome: string) => kitFiscoIA.ferramentas.find((f) => f.declaracao.name === nome)!;
function ctx(feitas: Array<[string, string]>) {
  return { chamarApi: async (m: string, c: string) => { feitas.push([m, c]); return { status: 200, corpo: PAINEL }; } } as any;
}

test('busca as certidões da empresa X: só GET no painel, devolve o que buscar com o portal e o passo a passo', async () => {
  const feitas: Array<[string, string]> = [];
  const f = ferramenta('buscar_certidoes_empresa');
  assert.equal(f.tipo, 'leitura');
  const r: any = await (f as any).executar(ctx(feitas), { tenantId: T, companyId: C });
  assert.deepEqual(feitas, [['GET', `/api/certidoes/painel?tenantId=${T}&companyId=${C}`]]);
  assert.equal(r.paraBuscar.length, 3);
  assert.match(r.paraBuscar[0].portal, /sefaz\.go\.gov\.br/);
  assert.match(r.comoBuscar, /Buscar agora/);
  assert.equal(r.federal, undefined, 'federal em dia: não oferece consulta paga');
  const inval: any = await (f as any).executar(ctx([]), { tenantId: 'x', companyId: C });
  assert.ok(inval.erro);
});

test('quais certidões vencem / painel: só leitura, com cores, filtro de pendentes e próximos vencimentos', async () => {
  const feitas: Array<[string, string]> = [];
  const r: any = await (ferramenta('ver_painel_certidoes') as any).executar(ctx(feitas), { tenantId: T, so: 'pendentes' });
  assert.deepEqual(feitas.map((x) => x[0]), ['GET']);
  assert.equal(r.empresas.length, 1);
  assert.equal(r.empresas[0].certidoes.find((c: any) => /FGTS/.test(c.certidao)).cor, 'vermelho');
  assert.equal(r.proximosVencimentos[0].validade, '2026-11-18');
  assert.match(r.observacao, /GUARDADAS/);
});

test('instrução da Agente explica o fluxo semiautomático e mantém a federal paga só com confirmação', () => {
  assert.match(kitFiscoIA.instrucao, /buscar_certidoes_empresa/);
  assert.match(kitFiscoIA.instrucao, /SEMIAUTOMÁTICAS/);
  assert.match(kitFiscoIA.instrucao, /federal é a única com consulta automática/);
});
