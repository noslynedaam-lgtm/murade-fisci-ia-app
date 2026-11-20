// Painel verde/amarelo/vermelho das certidões e regra de horário do robô preparador. Dados SIMULADOS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DIAS_AVISO, certidaoVigente, devePrepararAgora, estadoDaCertidao, horaBrasilia, montarPainel, type CertidaoParaPainel } from './painelCertidoes';

const H = '2026-11-20';
const c = (o: Partial<CertidaoParaPainel>): CertidaoParaPainel => ({ id: 'x', companyId: 'e1', tipo: 'trabalhista', situacao: 'emitida', resultado: 'negativa', numero: '1', emissao: '2026-11-01', validade: '2027-05-01', criadaEm: '2026-11-01T00:00:00Z', ...o });

test('cores: cinza não buscada, verde em dia, amarelo vencendo/sem validade/PCEN, vermelho vencida/positiva/não emitida', () => {
  assert.equal(estadoDaCertidao('trabalhista', undefined, H).cor, 'cinza');
  assert.equal(estadoDaCertidao('trabalhista', undefined, H).buscar, true);
  assert.equal(estadoDaCertidao('trabalhista', c({}), H).cor, 'verde');
  assert.equal(estadoDaCertidao('trabalhista', c({ validade: '2026-12-05' }), H).cor, 'amarelo', '15 dias antes já fica amarela');
  assert.equal(estadoDaCertidao('trabalhista', c({ validade: '2026-12-06' }), H).cor, 'verde');
  assert.equal(estadoDaCertidao('fgts', c({ tipo: 'fgts', validade: '2026-11-27' }), H).cor, 'amarelo', 'CRF: 7 dias');
  assert.equal(estadoDaCertidao('fgts', c({ tipo: 'fgts', validade: '2026-11-28' }), H).cor, 'verde');
  assert.equal(DIAS_AVISO.fgts, 7);
  assert.equal(estadoDaCertidao('trabalhista', c({ validade: '2026-11-20' }), H).texto, 'vence hoje');
  assert.equal(estadoDaCertidao('trabalhista', c({ validade: '2026-11-19' }), H).cor, 'vermelho');
  assert.equal(estadoDaCertidao('trabalhista', c({ resultado: 'positiva' }), H).cor, 'vermelho');
  assert.equal(estadoDaCertidao('trabalhista', c({ resultado: 'positiva_efeito_negativa' }), H).cor, 'amarelo');
  assert.equal(estadoDaCertidao('trabalhista', c({ validade: null }), H).cor, 'amarelo');
  assert.equal(estadoDaCertidao('federal', c({ tipo: 'federal', situacao: 'nao_emitida', validade: null }), H).cor, 'vermelho');
  assert.equal(estadoDaCertidao('federal', c({ tipo: 'federal', situacao: 'erro', validade: null }), H).cor, 'cinza');
});

test('vale a mais recente utilizável: uma consulta com erro depois não apaga a certidão válida', () => {
  const lista = [c({ id: 'boa', criadaEm: '2026-11-01T00:00:00Z' }), c({ id: 'erro', situacao: 'erro', criadaEm: '2026-11-10T00:00:00Z' }), c({ id: 'velha', criadaEm: '2026-01-01T00:00:00Z', validade: '2026-06-01' })];
  assert.equal(certidaoVigente(lista, 'e1', 'trabalhista')?.id, 'boa');
  assert.equal(certidaoVigente([c({ id: 'erro', situacao: 'erro' })], 'e1', 'trabalhista')?.id, 'erro');
  assert.equal(certidaoVigente(lista, 'e2', 'trabalhista'), undefined);
});

test('painel: pior cor primeiro, fila "para buscar" só com as semiautomáticas e próximos vencimentos em ordem', () => {
  const empresas = [{ id: 'e1', nome: 'Alfa', cnpj: '1', uf: 'GO', municipio: 'Goiânia' }, { id: 'e2', nome: 'Beta', cnpj: '2', uf: 'GO', municipio: 'Goiânia' }];
  const todas = (['federal', 'estadual', 'municipal', 'fgts', 'trabalhista'] as const).map((t) => c({ id: `a-${t}`, companyId: 'e1', tipo: t, validade: '2027-01-30' }));
  const p = montarPainel(empresas, [...todas, c({ id: 'b-fgts', companyId: 'e2', tipo: 'fgts', validade: '2026-11-22' })], H);
  assert.equal(p.linhas[0].empresa.nome, 'Beta');
  assert.deepEqual(p.linhas[0].aBuscar, ['estadual', 'municipal', 'fgts', 'trabalhista']);
  assert.ok(!p.linhas[0].aBuscar.includes('federal' as never), 'a federal (paga) nunca entra na fila automática');
  assert.equal(p.linhas[1].pior, 'verde'); assert.deepEqual(p.linhas[1].aBuscar, []);
  assert.equal(p.proximosVencimentos[0].tipo, 'fgts'); assert.equal(p.proximosVencimentos[0].dias, 2);
  assert.equal(p.contagem.verde, 5); assert.equal(p.contagem.cinza, 4); assert.equal(p.contagem.amarelo, 1);
  assert.equal(p.totalABuscar, 4);
});

test('robô preparador: só entre 1h e 5h de Brasília e uma vez por dia', () => {
  assert.equal(horaBrasilia(new Date('2026-11-20T05:30:00Z')), 2);
  assert.equal(devePrepararAgora(new Date('2026-11-20T05:30:00Z'), null, H), true);
  assert.equal(devePrepararAgora(new Date('2026-11-20T05:30:00Z'), H, H), false, 'já rodou hoje');
  assert.equal(devePrepararAgora(new Date('2026-11-20T15:00:00Z'), null, H), false, 'meio-dia: não');
  assert.equal(devePrepararAgora(new Date('2026-11-20T08:00:00Z'), null, H), false, '5h em ponto: já passou da janela');
});
