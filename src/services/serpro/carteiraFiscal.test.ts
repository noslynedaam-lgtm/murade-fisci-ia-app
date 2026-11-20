import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { classificarSituacaoFiscal, diasAte, faixaCertificado, mesAtualBrasilia, parcelasAtrasadas, resultadoParaGuardar, situacaoGeral, textoDoPdf, tipoDoServico } from './carteiraFiscal';
import { estimarLote, custoSerproMinimo } from './loteCarteira';
import { registrarConsulta } from './cotaSemanal';

/** Monta um PDF mínimo com o conteúdo de página comprimido (Flate), como os relatórios gerados por sistemas. */
function pdfCom(texto: string, comprimir = true): Buffer {
  const conteudo = Buffer.from(`BT /F1 10 Tf 50 700 Td (${texto.replace(/([()\\])/g, '\\$1')}) Tj ET`, 'latin1');
  const corpo = comprimir ? deflateSync(conteudo) : conteudo;
  return Buffer.concat([Buffer.from(`%PDF-1.4\n1 0 obj << /Length ${corpo.length}${comprimir ? ' /Filter /FlateDecode' : ''} >>\nstream\n`, 'latin1'), corpo, Buffer.from('\nendstream\nendobj\n%%EOF', 'latin1')]);
}
const COM_PENDENCIA = 'Diagnóstico Fiscal na Receita Federal e Procuradoria-Geral da Fazenda Nacional. Pendência - Débito (SIEF) COFINS 2026';
const SEM_PENDENCIA = 'Diagnóstico Fiscal na Receita Federal e Procuradoria-Geral da Fazenda Nacional. Não foram detectadas pendências/exigibilidades suspensas nos controles da Receita Federal e da Procuradoria-Geral da Fazenda Nacional.';

test('lê o texto de PDF comprimido e sem compressão', () => {
  assert.match(textoDoPdf(pdfCom(COM_PENDENCIA)), /Pendência - Débito \(SIEF\)/);
  assert.match(textoDoPdf(pdfCom(SEM_PENDENCIA, false)), /Não foram detectadas/);
});

test('classifica a situação fiscal só quando o texto não deixa dúvida', () => {
  assert.deepEqual(classificarSituacaoFiscal(textoDoPdf(pdfCom(COM_PENDENCIA))), { situacao: 'pendente', origem: 'lida_do_pdf' });
  assert.deepEqual(classificarSituacaoFiscal(textoDoPdf(pdfCom(SEM_PENDENCIA))), { situacao: 'regular', origem: 'lida_do_pdf' });
  // As duas coisas no mesmo relatório (um órgão sem pendência, outro com): vale a pendência.
  assert.equal(classificarSituacaoFiscal(`${SEM_PENDENCIA} ${COM_PENDENCIA}`).situacao, 'pendente');
  // Texto ilegível ou formato diferente: nunca chuta.
  assert.deepEqual(classificarSituacaoFiscal(''), { situacao: 'a_conferir', origem: 'sem_leitura' });
  assert.equal(classificarSituacaoFiscal('Relatório de Situação Fiscal do contribuinte emitido em 20/11/2026 às 10:00').situacao, 'a_conferir');
});

test('quais serviços são guardados e em qual grupo', () => {
  assert.deepEqual(tipoDoServico('situacaoFiscal'), { tipo: 'situacao_fiscal', modalidade: null });
  assert.deepEqual(tipoDoServico('caixaPostalNovas'), { tipo: 'caixa_postal_novas', modalidade: null });
  assert.deepEqual(tipoDoServico('parcmeiEspParcelas'), { tipo: 'parcelamento_parcelas', modalidade: 'PARCMEI-ESP' });
  assert.deepEqual(tipoDoServico('relpsnDetalhe'), { tipo: 'parcelamento_detalhe', modalidade: 'RELPSN' });
  assert.equal(tipoDoServico('parcsnDas'), null); // DAS (PDF de guia) não entra na carteira
  assert.equal(tipoDoServico('caixaPostalDetalhe'), null); // abrir mensagem (ciência) não é guardado aqui
  assert.equal(tipoDoServico('declaracoesSimples'), null);
  assert.equal(tipoDoServico('inexistente'), null);
});

test('o que se guarda de cada resposta; resposta fora do formato oficial não é guardada', () => {
  const pdf = pdfCom(COM_PENDENCIA).toString('base64').padEnd(0);
  const sit = resultadoParaGuardar('situacaoFiscal', {}, {}, { status: 200, dados: JSON.stringify({ pdf: pdf + 'A'.repeat(0) }) });
  // acharPdfBase64 exige um PDF com pelo menos ~100 caracteres em base64; o nosso tem.
  assert.ok(sit); assert.equal(sit!.situacao, 'pendente'); assert.ok(sit!.pdf && sit!.pdf.subarray(0, 4).toString() === '%PDF');
  assert.equal(resultadoParaGuardar('situacaoFiscal', {}, {}, { status: 200, dados: '{}' }), null, 'sem PDF não guarda');
  const novas = resultadoParaGuardar('caixaPostalNovas', {}, { dados: '{"codigo":0,"indicadorMensagensNovas":1}' }, undefined);
  assert.equal(novas?.novasMensagens, 1);
  assert.equal(resultadoParaGuardar('caixaPostalNovas', {}, { dados: '{"x":1}' }, undefined), null);
  const lista = resultadoParaGuardar('caixaPostalLista', { statusLeitura: '2', indicadorPagina: '0' }, { dados: JSON.stringify({ indicadorUltimaPagina: 'S', listaMensagens: [{ isn: 1, assuntoModelo: 'Aviso', indicadorLeitura: 0, dataEnvio: 20261101 }] }) }, undefined);
  assert.equal((lista?.resumo as any).naoLidas, 1); assert.equal((lista?.resumo as any).filtro, '2');
  const parc = resultadoParaGuardar('parcsnParcelas', {}, { dados: JSON.stringify({ listaParcela: [{ parcela: 202609, valor: 150.5 }, { parcela: 202611, valor: 150.5 }] }) }, undefined);
  assert.deepEqual((parc?.resumo as any).parcelas, [{ parcela: '09/2026', valor: 150.5 }, { parcela: '11/2026', valor: 150.5 }]);
  assert.equal(parc?.modalidade, 'PARCSN');
});

test('parcela atrasada: só mês ANTERIOR ao atual que ainda aparece para emitir', () => {
  const parcelas = [{ parcela: '09/2026', valor: 10 }, { parcela: '11/2026', valor: 10 }, { parcela: '12/2025', valor: null }, { parcela: 'lixo', valor: 1 }];
  assert.deepEqual(parcelasAtrasadas(parcelas, '202611').map((p) => p.parcela), ['09/2026', '12/2025']);
  assert.deepEqual(parcelasAtrasadas(null, '202611'), []);
  assert.match(mesAtualBrasilia(new Date('2026-12-01T01:00:00Z')), /^202611$/, 'usa o fuso de Brasília (ainda 30/11 lá)');
});

test('cor do painel', () => {
  assert.equal(situacaoGeral({ situacaoFiscal: 'regular', novasMensagens: 0, atrasadas: 0 }), 'regular');
  assert.equal(situacaoGeral({ situacaoFiscal: 'regular', novasMensagens: 0, atrasadas: 1 }), 'pendente');
  assert.equal(situacaoGeral({ situacaoFiscal: 'pendente', novasMensagens: null, atrasadas: 0 }), 'pendente');
  assert.equal(situacaoGeral({ situacaoFiscal: 'regular', novasMensagens: 2, atrasadas: 0 }), 'atencao');
  assert.equal(situacaoGeral({ situacaoFiscal: 'a_conferir', novasMensagens: null, atrasadas: 0 }), 'atencao');
  assert.equal(situacaoGeral({ situacaoFiscal: null, novasMensagens: null, atrasadas: 0 }), 'sem_consulta');
});

test('certificado A1: avisa vencido, 7, 15 e 30 dias', () => {
  assert.equal(diasAte('2026-11-20', '2026-11-27'), 7);
  assert.deepEqual(faixaCertificado('2026-11-20', '2026-11-19'), { faixa: 'vencido', dias: -1 });
  assert.deepEqual(faixaCertificado('2026-11-20', '2026-11-27'), { faixa: '7', dias: 7 });
  assert.deepEqual(faixaCertificado('2026-11-20', '2026-12-05'), { faixa: '15', dias: 15 });
  assert.deepEqual(faixaCertificado('2026-11-20', '2026-12-20'), { faixa: '30', dias: 30 });
  assert.equal(faixaCertificado('2026-11-20', '2026-12-21'), null);
  assert.equal(faixaCertificado('2026-11-20', null), null);
});

test('lote: estimativa mostra grátis da semana, cobradas, total e as não liberadas antes de qualquer consulta', () => {
  const agora = new Date('2026-11-18T15:00:00Z');
  const usada = registrarConsulta({ consultas: [] }, false, 'situacaoFiscal', agora);
  const est = estimarLote([
    { id: 'a', nome: 'A', cnpj: '1', cota: { consultas: [] }, liberada: true },
    { id: 'b', nome: 'B', cnpj: '2', cota: usada, liberada: true },
    { id: 'c', nome: 'C', cnpj: '3', cota: { consultas: [] }, liberada: false },
  ], ['situacaoFiscal', 'caixaPostalNovas'], agora);
  // A: 1ª grátis, 2ª cobrada. B: as duas cobradas. C: não liberada, não entra.
  assert.deepEqual(est.itens.map((i) => [i.companyId, i.servico, i.liberada, i.cobrada]), [
    ['a', 'situacaoFiscal', true, false], ['a', 'caixaPostalNovas', true, true],
    ['b', 'situacaoFiscal', true, true], ['b', 'caixaPostalNovas', true, true],
    ['c', 'situacaoFiscal', false, false], ['c', 'caixaPostalNovas', false, false],
  ]);
  assert.deepEqual({ ...est.totais, custoSerproMinimo: undefined }, { consultas: 4, gratis: 1, cobradas: 3, valorTotal: 3, naoLiberadas: 2, custoSerproMinimo: undefined });
  assert.equal(est.cotas.find((c) => c.companyId === 'b')?.gratisRestante, 0);
  assert.equal(custoSerproMinimo('situacaoFiscal'), 0.56);
});
