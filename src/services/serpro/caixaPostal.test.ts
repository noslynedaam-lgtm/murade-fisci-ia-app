import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGO_SERVICOS, montarPedido, validarDadosCaixaPostal } from './integraContador';
import { assuntoCaixaPostal, corpoCaixaPostal, lerDetalheCaixaPostal, lerIndicadorNovasCaixaPostal, lerListaCaixaPostal } from './resultadoSerpro';

test('catálogo da Caixa Postal segue as páginas oficiais', () => {
  const l = CATALOGO_SERVICOS.caixaPostalLista, d = CATALOGO_SERVICOS.caixaPostalDetalhe, n = CATALOGO_SERVICOS.caixaPostalNovas;
  assert.deepEqual([l.idSistema, l.idServico, l.versaoSistema, l.operacao], ['CAIXAPOSTAL', 'MSGCONTRIBUINTE61', '1.0', 'Consultar']);
  assert.deepEqual([d.idServico, d.operacao, d.daCiencia], ['MSGDETALHAMENTO62', 'Consultar', true]);
  assert.deepEqual([n.idServico, n.operacao, n.dadosVazio], ['INNOVAMSG63', 'Monitorar', true]);
  for (const s of [l, d, n]) assert.equal(s.procuracao?.codigo, '00006');
});

test('pedido: lista leva os dados em texto JSON e a de novas leva dados vazio', () => {
  const cnpj = '11222333000181';
  assert.equal(montarPedido(CATALOGO_SERVICOS.caixaPostalLista, cnpj, cnpj, { statusLeitura: '0', indicadorPagina: '0' }).pedidoDados.dados, '{"statusLeitura":"0","indicadorPagina":"0"}');
  assert.equal(montarPedido(CATALOGO_SERVICOS.caixaPostalNovas, cnpj, cnpj, {}).pedidoDados.dados, '');
  assert.equal(montarPedido(CATALOGO_SERVICOS.caixaPostalDetalhe, cnpj, cnpj, { isn: '0000082838' }).pedidoDados.dados, '{"isn":"0000082838"}');
});

test('validação dos dados antes de gastar consulta', () => {
  assert.equal(validarDadosCaixaPostal('MSGCONTRIBUINTE61', { statusLeitura: '2', indicadorPagina: '0' }), null);
  assert.match(validarDadosCaixaPostal('MSGCONTRIBUINTE61', { statusLeitura: '3', indicadorPagina: '0' })!, /0 \(todas\)/);
  assert.match(validarDadosCaixaPostal('MSGCONTRIBUINTE61', { statusLeitura: '0', indicadorPagina: '1' })!, /ponteiro/);
  assert.match(validarDadosCaixaPostal('MSGCONTRIBUINTE61', { statusLeitura: '0', indicadorPagina: '0', ponteiroPagina: '5' })!, /não leva ponteiro/);
  assert.equal(validarDadosCaixaPostal('MSGCONTRIBUINTE61', { statusLeitura: '0', indicadorPagina: '1', ponteiroPagina: '123' }), null);
  assert.equal(validarDadosCaixaPostal('MSGDETALHAMENTO62', { isn: '0000082838' }), null);
  assert.match(validarDadosCaixaPostal('MSGDETALHAMENTO62', { isn: 'abc' })!, /ISN/);
  assert.equal(validarDadosCaixaPostal('INNOVAMSG63', {}), null);
});

test('substituições do assunto e do corpo seguem o exemplo oficial', () => {
  assert.equal(assuntoCaixaPostal('[IRPF] Declaração do exercício ++VARIAVEL++ processada', '2023'), '[IRPF] Declaração do exercício 2023 processada');
  assert.equal(corpoCaixaPostal('A Declaração do exercício ++1++ foi processada e encontra-se disponível em ++2++', ['2010', 'http://receita.fazenda']), 'A Declaração do exercício 2010 foi processada e encontra-se disponível em http://receita.fazenda');
  assert.equal(corpoCaixaPostal('Valor ++3++', ['a']), 'Valor ++3++');
});

test('lista: lê a resposta em texto JSON, com página seguinte', () => {
  const dados = { codigo: 0, indicadorUltimaPagina: 'N', quantidadeMensagens: 1, ponteiroProximaPagina: 12345, listaMensagens: [{ isn: 82838, numeroControle: '2026/000000000000001', dataEnvio: 20261020, horaEnvio: 93015, assuntoModelo: 'Aviso ++VARIAVEL++', valorParametroAssunto: 'X', indicadorLeitura: 0, relevancia: 2, descricaoOrigem: 'RFB', dataValidade: 20270101 }] };
  const r = lerListaCaixaPostal({ status: 200, dados: JSON.stringify(dados) })!;
  assert.equal(r.ultimaPagina, false); assert.equal(r.proximaPagina, '12345');
  assert.deepEqual([r.mensagens[0].isn, r.mensagens[0].enviadaEm, r.mensagens[0].assunto, r.mensagens[0].lida, r.mensagens[0].relevante, r.mensagens[0].validade], ['82838', '20/10/2026 09:30', 'Aviso X', false, true, '01/01/2027']);
  assert.equal(lerListaCaixaPostal({ dados: 'lixo' }), null);
  assert.equal(lerListaCaixaPostal({ dados: JSON.stringify({ codigo: 0 }) }), null);
});

test('detalhe e indicador de novas', () => {
  const det = lerDetalheCaixaPostal({ dados: JSON.stringify({ codigo: 0, conteudo: [{ isn: 1, assuntoModelo: 'Oi', corpoModelo: 'Prazo ++1++', variaveis: ['30 dias'], dataCiencia: 20261028 }] }) })!;
  assert.equal(det.corpo, 'Prazo 30 dias'); assert.equal(det.cienciaEm, '28/10/2026');
  assert.equal(lerDetalheCaixaPostal({ dados: JSON.stringify({ conteudo: [] }) }), null);
  assert.equal(lerIndicadorNovasCaixaPostal({ dados: '{"codigo":0,"indicadorMensagensNovas":2}' }), 2);
  assert.equal(lerIndicadorNovasCaixaPostal({ dados: '{"indicadorMensagensNovas":9}' }), null);
});
