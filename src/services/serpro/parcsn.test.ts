import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGO_SERVICOS, montarPedido, validarDadosParcsn } from './integraContador';
import { acharPdfBase64, lerDetalheParcsn, lerPagamentoParcsn, lerParcelasParaGerarParcsn, lerPedidosParcsn } from './resultadoSerpro';

test('catálogo PARCSN segue as páginas oficiais', () => {
  const [a, b, c] = [CATALOGO_SERVICOS.parcsnPedidos, CATALOGO_SERVICOS.parcsnDetalhe, CATALOGO_SERVICOS.parcsnPagamento];
  assert.deepEqual([a.idSistema, a.idServico, a.versaoSistema, a.operacao, a.dadosVazio], ['PARCSN', 'PEDIDOSPARC163', '1.0', 'Consultar', true]);
  assert.deepEqual([b.idServico, b.operacao], ['OBTERPARC164', 'Consultar']); assert.deepEqual([c.idServico, c.operacao], ['DETPAGTOPARC165', 'Consultar']);
  for (const s of [a, b, c]) assert.equal(s.procuracao?.codigo, '00076');
});

test('pedido: lista leva dados vazio e os números vão como número, como no exemplo do Serpro', () => {
  const cnpj = '11222333000181';
  assert.equal(montarPedido(CATALOGO_SERVICOS.parcsnPedidos, cnpj, cnpj, {}).pedidoDados.dados, '');
  assert.equal(montarPedido(CATALOGO_SERVICOS.parcsnDetalhe, cnpj, cnpj, { numeroParcelamento: '1' }).pedidoDados.dados, '{"numeroParcelamento":1}');
  assert.equal(montarPedido(CATALOGO_SERVICOS.parcsnPagamento, cnpj, cnpj, { numeroParcelamento: '1', anoMesParcela: '201612' }).pedidoDados.dados, '{"numeroParcelamento":1,"anoMesParcela":201612}');
});

test('validação antes de gastar consulta', () => {
  assert.equal(validarDadosParcsn('PEDIDOSPARC163', {}), null);
  assert.equal(validarDadosParcsn('OBTERPARC164', { numeroParcelamento: '12' }), null);
  assert.match(validarDadosParcsn('OBTERPARC164', {})!, /número do parcelamento/);
  assert.match(validarDadosParcsn('DETPAGTOPARC165', { numeroParcelamento: '1', anoMesParcela: '2026-09' })!, /AAAAMM/);
  assert.match(validarDadosParcsn('DETPAGTOPARC165', { numeroParcelamento: '1', anoMesParcela: '202613' })!, /AAAAMM/);
  assert.equal(validarDadosParcsn('DETPAGTOPARC165', { numeroParcelamento: '1', anoMesParcela: '202609' }), null);
});

test('lista, detalhe e pagamento são lidos da resposta em texto JSON', () => {
  const lista = lerPedidosParcsn({ dados: JSON.stringify({ parcelamentos: [{ numero: 7, dataDoPedido: 20240315, situacao: 'Em parcelamento', dataDaSituacao: 20240401 }] }) })!;
  assert.deepEqual(lista[0], { numero: '7', pedidoEm: '15/03/2024', situacao: 'Em parcelamento', situacaoEm: '01/04/2024' });
  assert.equal(lerPedidosParcsn({ dados: '{}' }), null);
  const det = lerDetalheParcsn({ dados: JSON.stringify({ numero: 7, dataDoPedido: 20240315, situacao: 'Em parcelamento', dataDaSituacao: 20240401,
    consolidacaoOriginal: { valorTotalConsolidado: 1000.5, quantidadeParcelas: 60, primeiraParcela: 20, parcelaBasica: 18.5, dataConsolidacao: 20240320101500, detalhesConsolidacao: [{ periodoApuracao: 202301, vencimento: 20230220, numeroProcesso: 'P1', saldoDevedorOriginal: 500, valorAtualizado: 600 }] },
    alteracoesDivida: [{}], demonstrativoPagamentos: [{ mesDaParcela: 202404, vencimentoDoDas: 20240430, dataDeArrecadacao: 20240429, valorPago: 18.5 }] }) })!;
  assert.equal(det.consolidacao?.quantidadeParcelas, 60); assert.equal(det.consolidacao?.em, '20/03/2024 10:15'); assert.equal(det.consolidacao?.debitos[0].periodo, '01/2023');
  assert.equal(det.alteracoesDivida, 1); assert.deepEqual(det.pagamentos[0], { mes: '04/2024', vencimentoDas: '30/04/2024', arrecadadoEm: '29/04/2024', valorPago: 18.5 });
  const pg = lerPagamentoParcsn({ dados: JSON.stringify({ numeroDas: '0702', dataVencimento: 20240430, paDasGerado: 202404, numeroParcelamento: '7', numeroParcela: '1', dataPagamento: 20240429, valorPagoArrecadacao: 18.5,
    pagamentoDebitos: [{ paDebito: 202301, processo: 'P1', discriminacoesDebito: [{ tributo: 'IRPJ', principal: 10, multa: 1, juros: 2, total: 13, enteFederadoDestino: 'União' }] }] }) })!;
  assert.equal(pg.numeroDas, '0702'); assert.equal(pg.pagoEm, '29/04/2024'); assert.equal(pg.debitos[0].itens[0].tributo, 'IRPJ');
  assert.equal(lerPagamentoParcsn({ dados: '{"x":1}' }), null);
});

test('parcelas para gerar e emissão do DAS (PDF)', () => {
  const cnpj = '11222333000181';
  assert.deepEqual([CATALOGO_SERVICOS.parcsnParcelas.idServico, CATALOGO_SERVICOS.parcsnParcelas.operacao, CATALOGO_SERVICOS.parcsnParcelas.dadosVazio], ['PARCELASPARAGERAR162', 'Consultar', true]);
  assert.deepEqual([CATALOGO_SERVICOS.parcsnDas.idServico, CATALOGO_SERVICOS.parcsnDas.operacao], ['GERARDAS161', 'Emitir']);
  assert.equal(montarPedido(CATALOGO_SERVICOS.parcsnDas, cnpj, cnpj, { parcelaParaEmitir: '202306' }).pedidoDados.dados, '{"parcelaParaEmitir":202306}');
  assert.equal(validarDadosParcsn('GERARDAS161', { parcelaParaEmitir: '202306' }), null);
  assert.match(validarDadosParcsn('GERARDAS161', { parcelaParaEmitir: '2023-06' })!, /AAAAMM/);
  assert.equal(validarDadosParcsn('PARCELASPARAGERAR162', {}), null);
  assert.deepEqual(lerParcelasParaGerarParcsn({ dados: JSON.stringify({ listaParcela: [{ parcela: 202306, valor: 150.25 }] }) }), [{ parcela: '06/2023', valor: 150.25 }]);
  assert.equal(lerParcelasParaGerarParcsn({ dados: '{}' }), null);
  const pdf = 'JVBERi0xLjQK' + 'A'.repeat(200);
  assert.equal(acharPdfBase64({ dados: JSON.stringify({ docArrecadacaoPdfB64: pdf }) }), pdf);
});

test('PARCSN especial: lista de pedidos (página oficial 17.3)', () => {
  const e = CATALOGO_SERVICOS.parcsnEspPedidos;
  assert.deepEqual([e.idSistema, e.idServico, e.versaoSistema, e.operacao, e.dadosVazio, e.procuracao?.codigo], ['PARCSN-ESP', 'PEDIDOSPARC173', '1.0', 'Consultar', true, '00125']);
  assert.equal(montarPedido(e, '11222333000181', '11222333000181', {}).pedidoDados.dados, '');
  assert.equal(validarDadosParcsn(e.idServico, {}), null);
});

test('PARCSN especial: detalhe e pagamento (páginas 17.4 e 17.5)', () => {
  const d = CATALOGO_SERVICOS.parcsnEspDetalhe, g = CATALOGO_SERVICOS.parcsnEspPagamento;
  assert.deepEqual([d.idSistema, d.idServico, d.operacao, d.procuracao?.codigo], ['PARCSN-ESP', 'OBTERPARC174', 'Consultar', '00125']);
  assert.deepEqual([g.idSistema, g.idServico, g.operacao], ['PARCSN-ESP', 'DETPAGTOPARC175', 'Consultar']);
  assert.equal(montarPedido(d, '11222333000181', '11222333000181', { numeroParcelamento: '9001' }).pedidoDados.dados, '{"numeroParcelamento":9001}');
  assert.equal(montarPedido(g, '11222333000181', '11222333000181', { numeroParcelamento: '9001', anoMesParcela: '201612' }).pedidoDados.dados, '{"numeroParcelamento":9001,"anoMesParcela":201612}');
  assert.match(validarDadosParcsn('DETPAGTOPARC175', { numeroParcelamento: '9001' })!, /AAAAMM/);
  assert.equal(validarDadosParcsn('OBTERPARC174', { numeroParcelamento: '9001' }), null);
});

test('PARCSN especial: parcelas disponíveis e emissão do DAS (páginas 17.2 e 17.1)', () => {
  const p = CATALOGO_SERVICOS.parcsnEspParcelas, e = CATALOGO_SERVICOS.parcsnEspDas;
  assert.deepEqual([p.idSistema, p.idServico, p.operacao, p.dadosVazio], ['PARCSN-ESP', 'PARCELASPARAGERAR172', 'Consultar', true]);
  assert.deepEqual([e.idSistema, e.idServico, e.operacao, e.procuracao?.codigo], ['PARCSN-ESP', 'GERARDAS171', 'Emitir', '00125']);
  assert.equal(montarPedido(p, '11222333000181', '11222333000181', {}).pedidoDados.dados, '');
  assert.equal(montarPedido(e, '11222333000181', '11222333000181', { parcelaParaEmitir: '202306' }).pedidoDados.dados, '{"parcelaParaEmitir":202306}');
  assert.equal(validarDadosParcsn('PARCELASPARAGERAR172', {}), null);
  assert.equal(validarDadosParcsn('GERARDAS171', { parcelaParaEmitir: '202306' }), null);
  assert.match(validarDadosParcsn('GERARDAS171', {})!, /AAAAMM/);
});

test('PARCMEI: 5 serviços das páginas oficiais 20.1 a 20.5, procuração 00134', () => {
  const c = CATALOGO_SERVICOS;
  assert.deepEqual([c.parcmeiPedidos, c.parcmeiDetalhe, c.parcmeiPagamento, c.parcmeiParcelas, c.parcmeiDas].map(x => x.idServico), ['PEDIDOSPARC203', 'OBTERPARC204', 'DETPAGTOPARC205', 'PARCELASPARAGERAR202', 'GERARDAS201']);
  assert.ok([c.parcmeiPedidos, c.parcmeiDetalhe, c.parcmeiPagamento, c.parcmeiParcelas, c.parcmeiDas].every(x => x.idSistema === 'PARCMEI' && x.procuracao?.codigo === '00134'));
  assert.equal(c.parcmeiDas.operacao, 'Emitir');
  assert.equal(montarPedido(c.parcmeiPedidos, '11222333000181', '11222333000181', {}).pedidoDados.dados, '');
  assert.equal(montarPedido(c.parcmeiPagamento, '11222333000181', '11222333000181', { numeroParcelamento: '1', anoMesParcela: '202107' }).pedidoDados.dados, '{"numeroParcelamento":1,"anoMesParcela":202107}');
  assert.equal(montarPedido(c.parcmeiDas, '11222333000181', '11222333000181', { parcelaParaEmitir: '202107' }).pedidoDados.dados, '{"parcelaParaEmitir":202107}');
  assert.match(validarDadosParcsn('DETPAGTOPARC205', { numeroParcelamento: '1' })!, /AAAAMM/);
  assert.equal(validarDadosParcsn('PEDIDOSPARC203', {}), null);
  assert.match(validarDadosParcsn('GERARDAS201', {})!, /AAAAMM/);
});

test('PERT-MEI: 5 serviços das páginas 22.1 a 22.5, procuração 00152, e detalhe com entrada e dívida', () => {
  const c = CATALOGO_SERVICOS;
  const l = [c.pertmeiPedidos, c.pertmeiDetalhe, c.pertmeiPagamento, c.pertmeiParcelas, c.pertmeiDas];
  assert.deepEqual(l.map(x => x.idServico), ['PEDIDOSPARC223', 'OBTERPARC224', 'DETPAGTOPARC225', 'PARCELASPARAGERAR222', 'GERARDAS221']);
  assert.ok(l.every(x => x.idSistema === 'PERTMEI' && x.procuracao?.codigo === '00152'));
  assert.equal(c.pertmeiDas.operacao, 'Emitir');
  assert.equal(validarDadosParcsn('GERARDAS221', { parcelaParaEmitir: '202306' }), null);
  assert.match(validarDadosParcsn('DETPAGTOPARC225', { numeroParcelamento: '9101' })!, /AAAAMM/);
  assert.equal(validarDadosParcsn('PEDIDOSPARC223', {}), null);
  const d = lerDetalheParcsn({ dados: JSON.stringify({ numero: 9001, situacao: 'Em parcelamento', consolidacaoOriginal: { valorTotalConsolidadoDaEntrada: 100, quantidadeParcelasDaEntrada: 2, parcelaBasicaDaEntrada: 50, valorTotalConsolidadoDaDivida: 900 }, consolidacoesRestanteDivida: [{}] }) });
  assert.deepEqual(d?.consolidacao?.entrada, { valorEntrada: 100, parcelasEntrada: 2, parcelaEntrada: 50, valorDivida: 900 });
  assert.equal(d?.restanteDivida, 1);
});

test('RELPSN: 5 serviços das páginas 19.1 a 19.5, procuração 00210, e detalhe com entrada', () => {
  const c = CATALOGO_SERVICOS;
  const l = [c.relpsnPedidos, c.relpsnDetalhe, c.relpsnPagamento, c.relpsnParcelas, c.relpsnDas];
  assert.deepEqual(l.map(x => x.idServico), ['PEDIDOSPARC193', 'OBTERPARC194', 'DETPAGTOPARC195', 'PARCELASPARAGERAR192', 'GERARDAS191']);
  assert.ok(l.every(x => x.idSistema === 'RELPSN' && x.procuracao?.codigo === '00210'));
  assert.equal(validarDadosParcsn('PEDIDOSPARC193', {}), null);
  assert.equal(validarDadosParcsn('PARCELASPARAGERAR192', {}), null);
  assert.equal(validarDadosParcsn('GERARDAS191', { parcelaParaEmitir: '202308' }), null);
  assert.match(validarDadosParcsn('DETPAGTOPARC195', { numeroParcelamento: '9131' })!, /AAAAMM/);
  assert.equal(montarPedido(c.relpsnDetalhe, '11222333000181', '11222333000181', { numeroParcelamento: '9131' }).pedidoDados.idServico, 'OBTERPARC194');
  const d = lerDetalheParcsn({ dados: JSON.stringify({ numero: 9131, situacao: 'Em parcelamento', consolidacaoOriginal: { valorTotalConsolidadoDaEntrada: 10, quantidadeParcelasDeEntrada: 1, parcelaDeEntrada: 10, valorConsolidadoDivida: 500 } }) });
  assert.deepEqual(d?.consolidacao?.entrada, { valorEntrada: 10, parcelasEntrada: 1, parcelaEntrada: 10, valorDivida: 500 });
});
