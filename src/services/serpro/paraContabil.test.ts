// Fisco IA → Contábil: o resultado guardado de uma consulta feita por clique vira os itens do contrato (versão 1) que o Contábil transforma
// em pré-lançamento. Valores conferidos à mão; nada é inventado quando a resposta não vem no formato oficial.
import test from 'node:test';
import assert from 'node:assert/strict';
import { competenciaDeMesBr, enviarItensAoContabil, isoDeDataBr, itensParaContabil, resumoEnvioContabil } from './paraContabil';
import { resultadoParaGuardar, tipoDoServico } from './carteiraFiscal';

const gateway = (dados: unknown) => ({ dados: JSON.stringify(dados) });

test('guia do DAS do MEI: principal no último dia do período e multa + juros na data da guia', () => {
  assert.deepEqual(tipoDoServico('pgmeiDasPdf'), { tipo: 'guia_das_mei', modalidade: 'PGMEI' });
  assert.deepEqual(tipoDoServico('pgmeiDividaAtiva'), { tipo: 'divida_ativa_mei', modalidade: 'PGMEI' });
  const bruto = gateway([{ cnpjCompleto: '11497078000180', detalhamento: { periodoApuracao: '202609', numeroDocumento: '07202636999', dataVencimento: '20261120', valores: { principal: 81.6, multa: 1.63, juros: 2.49, total: 85.72 }, codigoDeBarras: ['8580'] } }]);
  const g = resultadoParaGuardar('pgmeiDasPdf', { periodoApuracao: '202609' }, bruto, null)!;
  assert.equal(g.tipo, 'guia_das_mei'); assert.equal((g.resumo as any).das[0].periodo, '09/2026');
  const itens = itensParaContabil(g.tipo, g.modalidade, g.resumo);
  assert.deepEqual(itens.map((i) => [i.tributo, i.competencia, i.valorCentavos, i.versaoOrigem]), [
    ['FIA_DEBITO', '2026-09', 8160, 'data:2026-09-30:8160'],
    ['FIA_MULTA_JUROS', '2026-11', 412, 'data:2026-11-20:412'], // 1,63 + 2,49 = 4,12
  ]);
  assert.ok(itens.every((i) => i.situacao === 'confirmado' && i.referencia.startsWith('FIA:DAS-MEI:2026-09')));
  // guia em dia (sem multa e juros): só o principal
  assert.equal(itensParaContabil('guia_das_mei', 'PGMEI', { das: [{ periodo: '10/2026', vencimento: '20/11/2026', principal: 81.6, multa: 0, juros: 0 }] }).length, 1);
  // resposta fora do formato: nada guardado, nada enviado
  assert.equal(resultadoParaGuardar('pgmeiDasPdf', {}, { dados: 'quebrado' }, null), null);
});

test('dívida ativa do MEI e parcelamento (consolidação e parcelas pagas)', () => {
  const da = resultadoParaGuardar('pgmeiDividaAtiva', { anoCalendario: '2023' }, gateway([{ periodoApuracao: '202301', tributo: 'INSS', valor: 75, enteFederado: 'União', situacaoDebito: 'Inscrito' }, { periodoApuracao: '202301', tributo: 'ISS', valor: 5, enteFederado: 'Goiânia', situacaoDebito: 'Inscrito' }]), null)!;
  const i1 = itensParaContabil(da.tipo, da.modalidade, da.resumo);
  assert.deepEqual(i1.map((i) => [i.tributo, i.competencia, i.referencia, i.valorCentavos]), [['FIA_DIVIDA_ATIVA', '2023-01', 'FIA:DA:MEI:2023-01:INSS', 7500], ['FIA_DIVIDA_ATIVA', '2023-01', 'FIA:DA:MEI:2023-01:ISS', 500]]);
  const det = resultadoParaGuardar('parcsnDetalhe', { numeroParcelamento: '123' }, gateway({ numero: 123, dataDoPedido: 20260810, situacao: 'Em parcelamento', consolidacaoOriginal: { valorTotalConsolidado: 12000, quantidadeParcelas: 60, dataConsolidacao: '20260814103000', detalhesConsolidacao: [] }, demonstrativoPagamentos: [{ mesDaParcela: 202609, vencimentoDoDas: 20260930, dataDeArrecadacao: 20260929, valorPago: 203.5 }, { mesDaParcela: 202610, vencimentoDoDas: 20261030, dataDeArrecadacao: 20261030, valorPago: 204.12 }] }), null)!;
  assert.equal(det.tipo, 'parcelamento_detalhe');
  const i2 = itensParaContabil(det.tipo, det.modalidade, det.resumo);
  assert.deepEqual(i2.map((i) => [i.tributo, i.competencia, i.valorCentavos, i.versaoOrigem]), [
    ['FIA_PARC_CONSOLIDACAO', '2026-08', 1_200_000, 'data:2026-08-14:1200000'],
    ['FIA_PARC_PARCELA_PAGA', '2026-09', 20_350, 'data:2026-09-29:20350'],
    ['FIA_PARC_PARCELA_PAGA', '2026-10', 20_412, 'data:2026-10-30:20412'],
  ]);
  assert.equal(i2[1].referencia, 'FIA:PARC:PARCSN:123:pago:2026-09');
  assert.equal(isoDeDataBr('31/02/2026'), null); assert.equal(isoDeDataBr('14/08/2026 10:30'), '2026-08-14'); assert.equal(competenciaDeMesBr('13/2026'), null);
  assert.deepEqual(itensParaContabil('situacao_fiscal', null, { tamanhoPdf: 1 }), []);
});

test('envio ao Contábil: contrato, empresa fora do Contábil, erro e sem itens', async () => {
  const itens = itensParaContabil('guia_das_mei', 'PGMEI', { das: [{ periodo: '09/2026', vencimento: '20/11/2026', principal: 81.6, multa: 1.63, juros: 2.49 }] });
  let corpo: any = null; let url = ''; let auth = '';
  const ok = await enviarItensAoContabil('11497078000180', itens, { url: 'https://contabil.exemplo/', token: 'T' }, (async (u: string, init: any) => { url = u; corpo = JSON.parse(init.body); auth = init.headers.Authorization; return new Response(JSON.stringify({ sucesso: true, rascunhosContabeis: { criados: 2 } }), { status: 200 }); }) as any);
  assert.equal(ok.situacao, 'enviado'); assert.match(ok.mensagem, /2 pré-lançamento/);
  assert.equal(url, 'https://contabil.exemplo/api/integracao/fiscoia/apuracoes'); assert.equal(auth, 'Bearer T');
  assert.equal(corpo.versaoContrato, 1); assert.equal(corpo.cnpj, '11497078000180'); assert.equal(corpo.apuracoes.length, 2);
  const fora = await enviarItensAoContabil('11497078000180', itens, { url: 'https://c', token: 'T' }, (async () => new Response('{"sucesso":false}', { status: 403 })) as any);
  assert.equal(fora.situacao, 'sem_contabil');
  const erro = await enviarItensAoContabil('11497078000180', itens, { url: 'https://c', token: 'T' }, (async () => { throw new Error('rede'); }) as any);
  assert.equal(erro.situacao, 'erro');
  assert.equal((await enviarItensAoContabil('11497078000180', itens, { url: 'https://c', token: undefined })).situacao, 'erro');
  assert.equal((await enviarItensAoContabil('11497078000180', [], { url: 'https://c', token: 'T' })).situacao, 'sem_itens');
  assert.equal(resumoEnvioContabil({ enviados: 1, erros: 1, semContabil: 0, pendentes: 0 }).alerta, true);
  assert.equal(resumoEnvioContabil({ enviados: 0, erros: 0, semContabil: 0, pendentes: 0 }).alerta, false);
});
