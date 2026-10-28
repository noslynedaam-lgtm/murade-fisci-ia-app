import test from 'node:test';
import assert from 'node:assert/strict';
import { ControleCusto, CATALOGO_SERVICOS, avaliarProntidao, compararComFiscal, montarPedido, validarDadosDctfweb } from './integraContador';

const A = '11222333000181';
const B = '11444777000161';

test('pedido exige CNPJs válidos', () => {
  assert.throws(() => montarPedido(CATALOGO_SERVICOS.situacaoFiscal, '123', B));
  const p = montarPedido(CATALOGO_SERVICOS.situacaoFiscal, A, B);
  assert.equal(p.contribuinte.numero, B);
  assert.equal(p.contratante.numero, A);
});

test('trava de custo: desligada por padrão e limite diário', () => {
  assert.equal(new ControleCusto(2, false).verificar(B).pode, false);
  const c = new ControleCusto(2, true);
  assert.equal(c.verificar(B).pode, true);
  c.registrar(B); c.registrar(B);
  assert.equal(c.verificar(B).pode, false);
  assert.equal(c.verificar(A).pode, true);
});

test('prontidão lista o que falta', () => {
  const r = avaliarProntidao({});
  assert.equal(r.pronto, false);
  assert.equal(r.itens.every(i => !i.ok), true);
  const ok = avaliarProntidao({ SERPRO_PRODUCAO_CONSUMER_KEY: 'a', SERPRO_PRODUCAO_CONSUMER_SECRET: 'b', SERPRO_CONTRATANTE_CNPJ: A, SERPRO_CERT_PFX_BASE64: 'x', SERPRO_CERT_PFX_SENHA: 'y', SERPRO_CONSULTAS_HABILITADAS: 'true' });
  assert.equal(ok.pronto, true);
});

test('comparação aponta divergência', () => {
  assert.equal(compararComFiscal(null, { debitos: 1 }).status, 'sem_dado_oficial');
  assert.equal(compararComFiscal({ debitos: 2 }, { debitos: 1 }).status, 'divergente');
  assert.equal(compararComFiscal({ debitos: 1 }, { debitos: 1 }).status, 'conferido');
});

test('DCTFWeb: pedido igual ao exemplo oficial informado (versão 1.0 e dados categoria/anoPA/mesPA)', () => {
  const p = montarPedido(CATALOGO_SERVICOS.dctfwebGuia, A, B, { categoria: 'GERAL_MENSAL', anoPA: '2027', mesPA: '11' });
  assert.equal(p.pedidoDados.idSistema, 'DCTFWEB');
  assert.equal(p.pedidoDados.idServico, 'GERARGUIA31');
  assert.equal(p.pedidoDados.versaoSistema, '1.0');
  assert.equal(p.pedidoDados.dados, '{"categoria":"GERAL_MENSAL","anoPA":"2027","mesPA":"11"}');
  assert.equal(CATALOGO_SERVICOS.dctfwebRecibo.idServico, 'CONSRECIBO32');
  assert.equal(CATALOGO_SERVICOS.dctfwebDeclaracao.idServico, 'CONSDECCOMPLETA33');
});

test('DCTFWeb XML: CONSXMLDECLARACAO38 com recibo opcional, no formato do exemplo oficial', () => {
  const s = CATALOGO_SERVICOS.dctfwebXml;
  assert.equal(s.idServico, 'CONSXMLDECLARACAO38');
  assert.equal(s.operacao, 'Consultar');
  assert.ok(s.campos!.find((c) => c.nome === 'numeroReciboEntrega')!.opcional);
  const p = montarPedido(s, A, B, { categoria: 'PF_MENSAL', anoPA: '2022', mesPA: '06' });
  assert.equal(p.pedidoDados.dados, '{"categoria":"PF_MENSAL","anoPA":"2022","mesPA":"06"}');
});

test('DCTFWeb guia de declaração em andamento: GERARGUIAANDAMENTO313 no formato do exemplo oficial', () => {
  const s = CATALOGO_SERVICOS.dctfwebGuiaAndamento;
  const p = montarPedido(s, A, B, { categoria: 'GERAL_MENSAL', anoPA: '2025', mesPA: '01' });
  assert.equal(p.pedidoDados.idServico, 'GERARGUIAANDAMENTO313');
  assert.equal(p.pedidoDados.versaoSistema, '1.0');
  assert.equal(p.pedidoDados.dados, '{"categoria":"GERAL_MENSAL","anoPA":"2025","mesPA":"01"}');
});

test('DCTFWeb: validação do domínio de categorias e do período antes de gastar consulta', () => {
  assert.equal(validarDadosDctfweb({ categoria: 'GERAL_MENSAL', anoPA: '2026', mesPA: '09' }), null);
  assert.equal(validarDadosDctfweb({ categoria: '40', anoPA: '2026', mesPA: '09' }), null);
  assert.equal(validarDadosDctfweb({ categoria: 'GERAL_13o_SALARIO', anoPA: '2026' }), null);
  assert.equal(validarDadosDctfweb({ categoria: '51', anoPA: '2026' }), null);
  assert.match(validarDadosDctfweb({ categoria: 'MENSAL', anoPA: '2026', mesPA: '09' })!, /Categoria inválida/);
  assert.match(validarDadosDctfweb({ categoria: 'GERAL_MENSAL', anoPA: '2026' })!, /mês/);
  assert.match(validarDadosDctfweb({ categoria: 'GERAL_MENSAL', anoPA: '26', mesPA: '09' })!, /ano/);
  assert.match(validarDadosDctfweb({ categoria: 'GERAL_13o_SALARIO', anoPA: '2026', mesPA: '12' })!, /13º/);
});

test('procuração do e-CAC por serviço (tabela Serviços x Procurações do Serpro)', () => {
  assert.equal(CATALOGO_SERVICOS.situacaoFiscal.procuracao!.codigo, '00002');
  assert.equal(CATALOGO_SERVICOS.declaracoesSimples.procuracao!.codigo, '00146');
  for (const k of ['dctfwebRecibo', 'dctfwebDeclaracao', 'dctfwebXml', 'dctfwebGuia', 'dctfwebGuiaAndamento']) assert.equal(CATALOGO_SERVICOS[k].procuracao!.codigo, '00103');
});
