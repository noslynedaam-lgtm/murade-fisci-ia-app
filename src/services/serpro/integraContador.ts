/**
 * Integra Contador (SERPRO) — peças puras e testáveis, sem rede.
 * ATENÇÃO: formato do pedido segue a documentação pública do Integra Contador, mas
 * ainda NÃO foi validado contra o SERPRO real (depende das chaves do contrato).
 * Cada consulta é cobrada pelo SERPRO, então tudo aqui passa por trava de custo.
 */
import { normalizarCnpj, validarCnpj } from '../cnpj/cnpjValidation';

export interface ServicoIntegra {
  chave: string;
  descricao: string;
  idSistema: string;
  idServico: string;
  versaoSistema: string;
  /** Endpoint do gateway: Consultar, Apoiar, Emitir, Declarar */
  operacao: 'Consultar' | 'Emitir' | 'Apoiar' | 'Declarar' | 'Monitorar';
  /** Campos que o serviço exige dentro de "dados" (o formulário pede ao usuário). */
  campos?: { nome: string; rotulo: string; exemplo: string; opcional?: boolean }[];
  /** Procuração eletrônica no e-CAC que a empresa precisa dar ao escritório (tabela "Serviços x Procurações" do Serpro). */
  procuracao?: { codigo: string; nome: string; observacao?: string };
  /** Serviço que muda dados na Receita: só roda pelo fluxo seguro (conferência, confirmação e assinatura), nunca pela consulta genérica. */
  soFluxoSeguro?: boolean;
  /** Executar o serviço tem efeito legal (ex.: abrir mensagem da Caixa Postal conta como ciência da intimação): exige confirmação expressa e nunca roda por robô. */
  daCiencia?: boolean;
  /** O Serpro manda o campo "dados" vazio (""), não "{}" (ex.: INNOVAMSG63). */
  dadosVazio?: boolean;
  /** Campos que o Serpro espera como número no JSON de "dados" (o exemplo oficial usa 1, não "1"). */
  camposNumericos?: string[];
}

/** Catálogo editável: ajuste os códigos conforme o contrato assim que as chaves chegarem. */
export const CATALOGO_SERVICOS: Record<string, ServicoIntegra> = {
  situacaoFiscal: { chave: 'situacaoFiscal', descricao: 'Situação fiscal / pendências do contribuinte', idSistema: 'SITFIS', idServico: 'SOLICITARPROTOCOLO91', versaoSistema: '2.0', operacao: 'Apoiar', procuracao: { codigo: '00002', nome: 'Situação Fiscal do Contribuinte' } },
  declaracoesSimples: { chave: 'declaracoesSimples', descricao: 'Simples Nacional: declarações do ano (PGDAS-D)', idSistema: 'PGDASD', idServico: 'CONSDECLARACAO13', versaoSistema: '1.0', operacao: 'Consultar', campos: [{ nome: 'anoCalendario', rotulo: 'Ano-calendário', exemplo: '2026' }], procuracao: { codigo: '00146', nome: 'PGDAS-D - a partir de 01/2018' } },
  guiasPagas: { chave: 'guiasPagas', descricao: 'Simples Nacional: extrato de um DAS (informe o número do DAS)', idSistema: 'PGDASD', idServico: 'CONSEXTRATO16', versaoSistema: '1.0', operacao: 'Consultar', campos: [{ nome: 'numeroDas', rotulo: 'Número do DAS', exemplo: '07202636999999999' }], procuracao: { codigo: '00146', nome: 'PGDAS-D - a partir de 01/2018' } },
  // DCTFWeb (Integra Contador). Exemplo de requisição do GERARGUIA31 informado do catálogo oficial: versaoSistema "1.0" e dados {categoria, anoPA, mesPA}.
  // Pendente de confirmar no primeiro teste real: versão e endpoint de CONSRECIBO32/CONSDECCOMPLETA33 e o endpoint (Emitir) de GERARGUIA31.
  dctfwebRecibo: { chave: 'dctfwebRecibo', descricao: 'DCTFWeb: consultar recibo de entrega (mês ou 13º)', idSistema: 'DCTFWEB', idServico: 'CONSRECIBO32', versaoSistema: '1.0', operacao: 'Consultar', campos: [{ nome: 'categoria', rotulo: 'Categoria (ex.: GERAL_MENSAL ou GERAL_13o_SALARIO)', exemplo: 'GERAL_MENSAL' }, { nome: 'anoPA', rotulo: 'Ano da apuração', exemplo: '2026' }, { nome: 'mesPA', rotulo: 'Mês da apuração (não use no 13º)', exemplo: '09', opcional: true }], procuracao: { codigo: '00103', nome: 'Acessar o sistema DCTFWeb' } },
  dctfwebDeclaracao: { chave: 'dctfwebDeclaracao', descricao: 'DCTFWeb: consultar a declaração completa', idSistema: 'DCTFWEB', idServico: 'CONSDECCOMPLETA33', versaoSistema: '1.0', operacao: 'Consultar', campos: [{ nome: 'categoria', rotulo: 'Categoria (ex.: GERAL_MENSAL ou GERAL_13o_SALARIO)', exemplo: 'GERAL_MENSAL' }, { nome: 'anoPA', rotulo: 'Ano da apuração', exemplo: '2026' }, { nome: 'mesPA', rotulo: 'Mês da apuração (não use no 13º)', exemplo: '09', opcional: true }], procuracao: { codigo: '00103', nome: 'Acessar o sistema DCTFWeb' } },
  // CONSXMLDECLARACAO38: exemplo oficial informado (versão 1.0). numeroReciboEntrega é opcional: sem ele, vem a declaração mais recente. Resposta: dados = {"XMLStringBase64": "..."}.
  dctfwebXml: { chave: 'dctfwebXml', descricao: 'DCTFWeb: consultar o XML da declaração (valores por tributo)', idSistema: 'DCTFWEB', idServico: 'CONSXMLDECLARACAO38', versaoSistema: '1.0', operacao: 'Consultar', campos: [{ nome: 'categoria', rotulo: 'Categoria (ex.: GERAL_MENSAL ou GERAL_13o_SALARIO)', exemplo: 'GERAL_MENSAL' }, { nome: 'anoPA', rotulo: 'Ano da apuração', exemplo: '2026' }, { nome: 'mesPA', rotulo: 'Mês da apuração (não use no 13º)', exemplo: '09', opcional: true }, { nome: 'numeroReciboEntrega', rotulo: 'Número do recibo (vazio = declaração mais recente)', exemplo: '24688', opcional: true }], procuracao: { codigo: '00103', nome: 'Acessar o sistema DCTFWeb' } },
  // GERARGUIAANDAMENTO313: exemplo oficial informado (versão 1.0). Resposta: dados = {"PDFByteArrayBase64": "..."}. O campo opcional idsSistemaOrigem (lista) não é usado aqui.
  dctfwebGuiaAndamento: { chave: 'dctfwebGuiaAndamento', descricao: 'DCTFWeb: gerar a guia (DARF) de declaração em andamento', idSistema: 'DCTFWEB', idServico: 'GERARGUIAANDAMENTO313', versaoSistema: '1.0', operacao: 'Emitir', campos: [{ nome: 'categoria', rotulo: 'Categoria (ex.: GERAL_MENSAL ou GERAL_13o_SALARIO)', exemplo: 'GERAL_MENSAL' }, { nome: 'anoPA', rotulo: 'Ano da apuração', exemplo: '2026' }, { nome: 'mesPA', rotulo: 'Mês da apuração (não use no 13º)', exemplo: '09', opcional: true }], procuracao: { codigo: '00103', nome: 'Acessar o sistema DCTFWeb', observacao: 'Este serviço não aparece na tabela do Serpro; presume-se a mesma procuração da DCTFWeb.' } },
  // TRANSDECLARACAO310 (Declarar, R$ 0,40): transmite a declaração em andamento assinada. Catálogo do Serpro confirma o tipo "Declarar". Não aparece na tabela de procurações; presume-se a 00103.
  dctfwebTransmitir: { chave: 'dctfwebTransmitir', descricao: 'DCTFWeb: transmitir a declaração em andamento (assinada)', idSistema: 'DCTFWEB', idServico: 'TRANSDECLARACAO310', versaoSistema: '1.0', operacao: 'Declarar', soFluxoSeguro: true, procuracao: { codigo: '00103', nome: 'Acessar o sistema DCTFWeb' } },
  // PARCSN (Parcelamento do Simples Nacional ordinário), páginas oficiais, versão 1.0, tipo Consultar. Procuração 00076 (Parcelamento de Débitos do Simples Nacional).
  parcsnPedidos: { chave: 'parcsnPedidos', descricao: 'Parcelamento Simples (ordinário): lista de pedidos', idSistema: 'PARCSN', idServico: 'PEDIDOSPARC163', versaoSistema: '1.0', operacao: 'Consultar', dadosVazio: true, procuracao: { codigo: '00076', nome: 'Parcelamento de Débitos do Simples Nacional' } },
  parcsnDetalhe: { chave: 'parcsnDetalhe', descricao: 'Parcelamento Simples (ordinário): detalhes de um parcelamento', idSistema: 'PARCSN', idServico: 'OBTERPARC164', versaoSistema: '1.0', operacao: 'Consultar', camposNumericos: ['numeroParcelamento'], campos: [{ nome: 'numeroParcelamento', rotulo: 'Número do parcelamento (veja na lista de pedidos)', exemplo: '1' }], procuracao: { codigo: '00076', nome: 'Parcelamento de Débitos do Simples Nacional' } },
  parcsnPagamento: { chave: 'parcsnPagamento', descricao: 'Parcelamento Simples (ordinário): pagamento de uma parcela', idSistema: 'PARCSN', idServico: 'DETPAGTOPARC165', versaoSistema: '1.0', operacao: 'Consultar', camposNumericos: ['numeroParcelamento', 'anoMesParcela'], campos: [{ nome: 'numeroParcelamento', rotulo: 'Número do parcelamento', exemplo: '1' }, { nome: 'anoMesParcela', rotulo: 'Mês da parcela paga (AAAAMM)', exemplo: '202609' }], procuracao: { codigo: '00076', nome: 'Parcelamento de Débitos do Simples Nacional' } },
  parcsnParcelas: { chave: 'parcsnParcelas', descricao: 'Parcelamento Simples (ordinário): parcelas disponíveis para emitir o DAS', idSistema: 'PARCSN', idServico: 'PARCELASPARAGERAR162', versaoSistema: '1.0', operacao: 'Consultar', dadosVazio: true, procuracao: { codigo: '00076', nome: 'Parcelamento de Débitos do Simples Nacional' } },
  // GERARDAS161 é do tipo Emitir (R$ 0,32): devolve o DAS em PDF (docArrecadacaoPdfB64).
  parcsnDas: { chave: 'parcsnDas', descricao: 'Parcelamento Simples (ordinário): emitir o DAS de uma parcela (PDF)', idSistema: 'PARCSN', idServico: 'GERARDAS161', versaoSistema: '1.0', operacao: 'Emitir', camposNumericos: ['parcelaParaEmitir'], campos: [{ nome: 'parcelaParaEmitir', rotulo: 'Parcela a emitir (AAAAMM, veja nas parcelas disponíveis)', exemplo: '202609' }], procuracao: { codigo: '00076', nome: 'Parcelamento de Débitos do Simples Nacional' } },
  // PARCMEI (Parcelamento do MEI convencional), páginas oficiais, versão 1.0. Procuração 00134. O PARCMEI-ESP (00133) entra quando as páginas dele forem conferidas.
  parcmeiPedidos: { chave: 'parcmeiPedidos', descricao: 'Parcelamento MEI: lista de pedidos', idSistema: 'PARCMEI', idServico: 'PEDIDOSPARC203', versaoSistema: '1.0', operacao: 'Consultar', dadosVazio: true, procuracao: { codigo: '00134', nome: 'Parcelamento - Microempreendedor Individual' } },
  parcmeiDetalhe: { chave: 'parcmeiDetalhe', descricao: 'Parcelamento MEI: detalhes de um parcelamento', idSistema: 'PARCMEI', idServico: 'OBTERPARC204', versaoSistema: '1.0', operacao: 'Consultar', camposNumericos: ['numeroParcelamento'], campos: [{ nome: 'numeroParcelamento', rotulo: 'Número do parcelamento (veja na lista de pedidos)', exemplo: '1' }], procuracao: { codigo: '00134', nome: 'Parcelamento - Microempreendedor Individual' } },
  parcmeiPagamento: { chave: 'parcmeiPagamento', descricao: 'Parcelamento MEI: pagamento de uma parcela', idSistema: 'PARCMEI', idServico: 'DETPAGTOPARC205', versaoSistema: '1.0', operacao: 'Consultar', camposNumericos: ['numeroParcelamento', 'anoMesParcela'], campos: [{ nome: 'numeroParcelamento', rotulo: 'Número do parcelamento', exemplo: '1' }, { nome: 'anoMesParcela', rotulo: 'Mês da parcela paga (AAAAMM)', exemplo: '202609' }], procuracao: { codigo: '00134', nome: 'Parcelamento - Microempreendedor Individual' } },
  parcmeiParcelas: { chave: 'parcmeiParcelas', descricao: 'Parcelamento MEI: parcelas disponíveis para emitir o DAS', idSistema: 'PARCMEI', idServico: 'PARCELASPARAGERAR202', versaoSistema: '1.0', operacao: 'Consultar', dadosVazio: true, procuracao: { codigo: '00134', nome: 'Parcelamento - Microempreendedor Individual' } },
  parcmeiDas: { chave: 'parcmeiDas', descricao: 'Parcelamento MEI: emitir o DAS de uma parcela (PDF)', idSistema: 'PARCMEI', idServico: 'GERARDAS201', versaoSistema: '1.0', operacao: 'Emitir', camposNumericos: ['parcelaParaEmitir'], campos: [{ nome: 'parcelaParaEmitir', rotulo: 'Parcela a emitir (AAAAMM, veja nas parcelas disponíveis)', exemplo: '202609' }], procuracao: { codigo: '00134', nome: 'Parcelamento - Microempreendedor Individual' } },
  // PERTMEI (PERT-MEI), páginas oficiais 22.1 a 22.5, versão 1.0. Procuração 00152.
  pertmeiPedidos: { chave: 'pertmeiPedidos', descricao: 'PERT-MEI: lista de pedidos', idSistema: 'PERTMEI', idServico: 'PEDIDOSPARC223', versaoSistema: '1.0', operacao: 'Consultar', dadosVazio: true, procuracao: { codigo: '00152', nome: 'Programa Especial de Regularização Tributária - PERT-MEI' } },
  pertmeiDetalhe: { chave: 'pertmeiDetalhe', descricao: 'PERT-MEI: detalhes de um parcelamento', idSistema: 'PERTMEI', idServico: 'OBTERPARC224', versaoSistema: '1.0', operacao: 'Consultar', camposNumericos: ['numeroParcelamento'], campos: [{ nome: 'numeroParcelamento', rotulo: 'Número do parcelamento (veja na lista de pedidos)', exemplo: '9001' }], procuracao: { codigo: '00152', nome: 'Programa Especial de Regularização Tributária - PERT-MEI' } },
  pertmeiPagamento: { chave: 'pertmeiPagamento', descricao: 'PERT-MEI: pagamento de uma parcela', idSistema: 'PERTMEI', idServico: 'DETPAGTOPARC225', versaoSistema: '1.0', operacao: 'Consultar', camposNumericos: ['numeroParcelamento', 'anoMesParcela'], campos: [{ nome: 'numeroParcelamento', rotulo: 'Número do parcelamento', exemplo: '9101' }, { nome: 'anoMesParcela', rotulo: 'Mês da parcela paga (AAAAMM)', exemplo: '201907' }], procuracao: { codigo: '00152', nome: 'Programa Especial de Regularização Tributária - PERT-MEI' } },
  pertmeiParcelas: { chave: 'pertmeiParcelas', descricao: 'PERT-MEI: parcelas disponíveis para emitir o DAS', idSistema: 'PERTMEI', idServico: 'PARCELASPARAGERAR222', versaoSistema: '1.0', operacao: 'Consultar', dadosVazio: true, procuracao: { codigo: '00152', nome: 'Programa Especial de Regularização Tributária - PERT-MEI' } },
  pertmeiDas: { chave: 'pertmeiDas', descricao: 'PERT-MEI: emitir o DAS de uma parcela (PDF)', idSistema: 'PERTMEI', idServico: 'GERARDAS221', versaoSistema: '1.0', operacao: 'Emitir', camposNumericos: ['parcelaParaEmitir'], campos: [{ nome: 'parcelaParaEmitir', rotulo: 'Parcela a emitir (AAAAMM, veja nas parcelas disponíveis)', exemplo: '202306' }], procuracao: { codigo: '00152', nome: 'Programa Especial de Regularização Tributária - PERT-MEI' } },
  // PARCSN-ESP (Parcelamento Especial do Simples Nacional), versão 1.0. Procuração 00125. Entram aqui só os serviços cujas páginas oficiais já foram conferidas.
  parcsnEspPedidos: { chave: 'parcsnEspPedidos', descricao: 'Parcelamento Simples (especial): lista de pedidos', idSistema: 'PARCSN-ESP', idServico: 'PEDIDOSPARC173', versaoSistema: '1.0', operacao: 'Consultar', dadosVazio: true, procuracao: { codigo: '00125', nome: 'Parcelamento Especial Simples Nacional' } },
  parcsnEspDetalhe: { chave: 'parcsnEspDetalhe', descricao: 'Parcelamento Simples (especial): detalhes de um parcelamento', idSistema: 'PARCSN-ESP', idServico: 'OBTERPARC174', versaoSistema: '1.0', operacao: 'Consultar', camposNumericos: ['numeroParcelamento'], campos: [{ nome: 'numeroParcelamento', rotulo: 'Número do parcelamento (veja na lista de pedidos)', exemplo: '9001' }], procuracao: { codigo: '00125', nome: 'Parcelamento Especial Simples Nacional' } },
  parcsnEspPagamento: { chave: 'parcsnEspPagamento', descricao: 'Parcelamento Simples (especial): pagamento de uma parcela', idSistema: 'PARCSN-ESP', idServico: 'DETPAGTOPARC175', versaoSistema: '1.0', operacao: 'Consultar', camposNumericos: ['numeroParcelamento', 'anoMesParcela'], campos: [{ nome: 'numeroParcelamento', rotulo: 'Número do parcelamento', exemplo: '9001' }, { nome: 'anoMesParcela', rotulo: 'Mês da parcela paga (AAAAMM)', exemplo: '202609' }], procuracao: { codigo: '00125', nome: 'Parcelamento Especial Simples Nacional' } },
  parcsnEspParcelas: { chave: 'parcsnEspParcelas', descricao: 'Parcelamento Simples (especial): parcelas disponíveis para emitir o DAS', idSistema: 'PARCSN-ESP', idServico: 'PARCELASPARAGERAR172', versaoSistema: '1.0', operacao: 'Consultar', dadosVazio: true, procuracao: { codigo: '00125', nome: 'Parcelamento Especial Simples Nacional' } },
  parcsnEspDas: { chave: 'parcsnEspDas', descricao: 'Parcelamento Simples (especial): emitir o DAS de uma parcela (PDF)', idSistema: 'PARCSN-ESP', idServico: 'GERARDAS171', versaoSistema: '1.0', operacao: 'Emitir', camposNumericos: ['parcelaParaEmitir'], campos: [{ nome: 'parcelaParaEmitir', rotulo: 'Parcela a emitir (AAAAMM, veja nas parcelas disponíveis)', exemplo: '202609' }], procuracao: { codigo: '00125', nome: 'Parcelamento Especial Simples Nacional' } },
  // CAIXAPOSTAL (páginas oficiais do Serpro, versão 1.0, tipo Consultar). Procuração 00006 (Caixa Postal - Mensagens).
  caixaPostalLista: { chave: 'caixaPostalLista', descricao: 'Caixa Postal: lista de mensagens da Receita', idSistema: 'CAIXAPOSTAL', idServico: 'MSGCONTRIBUINTE61', versaoSistema: '1.0', operacao: 'Consultar', campos: [{ nome: 'statusLeitura', rotulo: 'Mensagens (0 = todas, 1 = lidas, 2 = não lidas)', exemplo: '2' }, { nome: 'indicadorPagina', rotulo: 'Página (0 = mais recentes, 1 = página seguinte)', exemplo: '0' }, { nome: 'ponteiroPagina', rotulo: 'Ponteiro da página seguinte (só se a página for 1)', exemplo: '', opcional: true }], procuracao: { codigo: '00006', nome: 'Caixa Postal - Mensagens' } },
  // INNOVAMSG63 (tipo Monitorar no catálogo): sem campos de entrada, "dados":"". Resposta: indicadorMensagensNovas 0, 1 ou 2.
  caixaPostalNovas: { chave: 'caixaPostalNovas', descricao: 'Caixa Postal: há mensagens novas?', idSistema: 'CAIXAPOSTAL', idServico: 'INNOVAMSG63', versaoSistema: '1.0', operacao: 'Monitorar', dadosVazio: true, procuracao: { codigo: '00006', nome: 'Caixa Postal - Mensagens' } },
  // MSGDETALHAMENTO62: a execução caracteriza CIÊNCIA da intimação (art. 23, §2º, III, Decreto 70.235/1972), como abrir a mensagem no e-CAC.
  caixaPostalDetalhe: { chave: 'caixaPostalDetalhe', descricao: 'Caixa Postal: abrir uma mensagem (CONTA COMO CIÊNCIA da intimação)', idSistema: 'CAIXAPOSTAL', idServico: 'MSGDETALHAMENTO62', versaoSistema: '1.0', operacao: 'Consultar', daCiencia: true, campos: [{ nome: 'isn', rotulo: 'Identificador (ISN) da mensagem, da lista', exemplo: '0000082838' }], procuracao: { codigo: '00006', nome: 'Caixa Postal - Mensagens' } },
  dctfwebGuia: { chave: 'dctfwebGuia', descricao: 'DCTFWeb: gerar a guia de arrecadação (DARF)', idSistema: 'DCTFWEB', idServico: 'GERARGUIA31', versaoSistema: '1.0', operacao: 'Emitir', campos: [{ nome: 'categoria', rotulo: 'Categoria (ex.: GERAL_MENSAL ou GERAL_13o_SALARIO)', exemplo: 'GERAL_MENSAL' }, { nome: 'anoPA', rotulo: 'Ano da apuração', exemplo: '2026' }, { nome: 'mesPA', rotulo: 'Mês da apuração (não use no 13º)', exemplo: '09', opcional: true }], procuracao: { codigo: '00103', nome: 'Acessar o sistema DCTFWeb' } },
};

/** Domínio de categorias da DCTFWeb (página "Dados de domínio" do Serpro): nome e código aceitos. */
export const CATEGORIAS_DCTFWEB: Record<string, number> = { GERAL_MENSAL: 40, GERAL_13o_SALARIO: 41, AFERICAO: 44, ESPETACULO_DESPORTIVO: 45, RECLAMATORIA_TRABALHISTA: 46, PF_MENSAL: 50, PF_13o_SALARIO: 51 };

/** Confere categoria e período antes de gastar uma consulta paga. Devolve o texto do erro ou null se estiver certo. */
export function validarDadosDctfweb(dados: Record<string, string>): string | null {
  const cat = String(dados.categoria ?? '');
  const codigo = /^\d+$/.test(cat) ? Number(cat) : CATEGORIAS_DCTFWEB[cat];
  if (!codigo || !Object.values(CATEGORIAS_DCTFWEB).includes(codigo)) return `Categoria inválida. Use uma destas: ${Object.entries(CATEGORIAS_DCTFWEB).map(([n, c]) => `${n} (${c})`).join(', ')}.`;
  if (!/^20\d{2}$/.test(String(dados.anoPA ?? ''))) return 'Informe o ano da apuração com 4 dígitos.';
  const treze = codigo === 41 || codigo === 51;
  if (!treze && !/^(0[1-9]|1[0-2])$/.test(String(dados.mesPA ?? ''))) return 'Informe o mês da apuração com 2 dígitos (01 a 12). Só o 13º salário (categorias 41 e 51) não leva mês.';
  if (treze && dados.mesPA) return 'O 13º salário não leva mês de apuração: deixe o mês em branco.';
  return null;
}

/** Confere os dados do parcelamento do Simples antes de gastar uma consulta paga. Devolve o texto do erro ou null se estiver certo. */
export function validarDadosParcsn(idServico: string, dados: Record<string, string>): string | null {
  if (['PEDIDOSPARC163', 'PEDIDOSPARC173', 'PEDIDOSPARC203', 'PEDIDOSPARC223', 'PARCELASPARAGERAR162', 'PARCELASPARAGERAR172', 'PARCELASPARAGERAR202', 'PARCELASPARAGERAR222'].includes(idServico)) return null;
  if (['GERARDAS161', 'GERARDAS171', 'GERARDAS201', 'GERARDAS221'].includes(idServico)) return /^(19|20)\d{2}(0[1-9]|1[0-2])$/.test(String(dados.parcelaParaEmitir ?? '')) ? null : 'Informe a parcela como AAAAMM, por exemplo 202609 (veja nas parcelas disponíveis).';
  if (!/^\d{1,10}$/.test(String(dados.numeroParcelamento ?? ''))) return 'Informe o número do parcelamento: só números (veja na lista de pedidos).';
  if (['DETPAGTOPARC165', 'DETPAGTOPARC175', 'DETPAGTOPARC205', 'DETPAGTOPARC225'].includes(idServico) && !/^(19|20)\d{2}(0[1-9]|1[0-2])$/.test(String(dados.anoMesParcela ?? ''))) return 'Informe o mês da parcela como AAAAMM, por exemplo 202609.';
  return null;
}

/** Confere os dados da Caixa Postal antes de gastar uma consulta paga. Devolve o texto do erro ou null se estiver certo. */
export function validarDadosCaixaPostal(idServico: string, dados: Record<string, string>): string | null {
  if (idServico === 'INNOVAMSG63') return null;
  if (idServico === 'MSGDETALHAMENTO62') return /^\d{1,10}$/.test(String(dados.isn ?? '')) ? null : 'Informe o identificador (ISN) da mensagem: só números, até 10 dígitos.';
  if (!['0', '1', '2'].includes(String(dados.statusLeitura ?? ''))) return 'Escolha quais mensagens listar: 0 (todas), 1 (lidas) ou 2 (não lidas).';
  if (!['0', '1'].includes(String(dados.indicadorPagina ?? ''))) return 'Escolha a página: 0 (mais recentes) ou 1 (página seguinte).';
  if (dados.indicadorPagina === '1' && !/^\d{1,24}$/.test(String(dados.ponteiroPagina ?? ''))) return 'Para a página seguinte, informe o ponteiro devolvido pela lista anterior.';
  if (dados.indicadorPagina === '0' && dados.ponteiroPagina) return 'A página inicial não leva ponteiro: deixe-o em branco.';
  return null;
}

export interface PedidoIntegra {
  contratante: { numero: string; tipo: 2 };
  autorPedidoDados: { numero: string; tipo: 2 };
  contribuinte: { numero: string; tipo: 2 };
  pedidoDados: { idSistema: string; idServico: string; versaoSistema: string; dados: string };
}

function numerar(servico: ServicoIntegra, dados: Record<string, unknown>): Record<string, unknown> {
  if (!servico.camposNumericos?.length) return dados;
  const saida: Record<string, unknown> = { ...dados };
  for (const k of servico.camposNumericos) if (k in saida && /^\d+$/.test(String(saida[k]))) saida[k] = Number(saida[k]);
  return saida;
}

export function montarPedido(servico: ServicoIntegra, cnpjContratante: string, cnpjContribuinte: string, dados: Record<string, unknown> = {}): PedidoIntegra {
  const contratante = normalizarCnpj(cnpjContratante);
  const contribuinte = normalizarCnpj(cnpjContribuinte);
  if (!validarCnpj(contratante)) throw new Error('CNPJ do escritório (contratante) inválido.');
  if (!validarCnpj(contribuinte)) throw new Error('CNPJ do cliente inválido.');
  return {
    contratante: { numero: contratante, tipo: 2 },
    autorPedidoDados: { numero: contratante, tipo: 2 },
    contribuinte: { numero: contribuinte, tipo: 2 },
    pedidoDados: { idSistema: servico.idSistema, idServico: servico.idServico, versaoSistema: servico.versaoSistema, dados: servico.dadosVazio ? '' : JSON.stringify(numerar(servico, dados)) },
  };
}

/** Trava de custo: limite de consultas pagas por empresa e por dia, e interruptor geral. */
export class ControleCusto {
  private usos = new Map<string, number>();
  constructor(private limiteDiarioPorEmpresa: number, private habilitado: boolean, private agora: () => Date = () => new Date()) {}

  private chaveDia(cnpj: string): string {
    return `${this.agora().toISOString().slice(0, 10)}:${normalizarCnpj(cnpj)}`;
  }

  verificar(cnpj: string): { pode: boolean; motivo?: string; restantes: number } {
    if (!this.habilitado) return { pode: false, motivo: 'Consultas pagas desligadas (SERPRO_CONSULTAS_HABILITADAS não está "true").', restantes: 0 };
    const usadas = this.usos.get(this.chaveDia(cnpj)) ?? 0;
    const restantes = Math.max(0, this.limiteDiarioPorEmpresa - usadas);
    if (restantes <= 0) return { pode: false, motivo: `Limite diário de ${this.limiteDiarioPorEmpresa} consulta(s) paga(s) para esta empresa atingido.`, restantes: 0 };
    return { pode: true, restantes };
  }

  registrar(cnpj: string): void {
    const k = this.chaveDia(cnpj);
    this.usos.set(k, (this.usos.get(k) ?? 0) + 1);
    const hoje = this.agora().toISOString().slice(0, 10);
    for (const chave of this.usos.keys()) if (!chave.startsWith(hoje)) this.usos.delete(chave);
  }
}

export interface ProntidaoSerpro {
  pronto: boolean;
  itens: { chave: string; ok: boolean; descricao: string }[];
}

export function avaliarProntidao(env: Record<string, string | undefined>): ProntidaoSerpro {
  const tem = (n: string) => Boolean(env[n]?.trim());
  const cnpj = normalizarCnpj(env.SERPRO_CONTRATANTE_CNPJ ?? '');
  const itens = [
    { chave: 'consumer', ok: tem('SERPRO_PRODUCAO_CONSUMER_KEY') && tem('SERPRO_PRODUCAO_CONSUMER_SECRET'), descricao: 'Consumer Key e Secret de produção (Integra Contador)' },
    { chave: 'contratante', ok: validarCnpj(cnpj), descricao: 'SERPRO_CONTRATANTE_CNPJ: CNPJ do escritório contratante' },
    { chave: 'certificado', ok: tem('SERPRO_CERT_PFX_BASE64') && tem('SERPRO_CERT_PFX_SENHA'), descricao: 'Certificado e-CNPJ do escritório (SERPRO_CERT_PFX_BASE64 e SERPRO_CERT_PFX_SENHA)' },
    { chave: 'habilitado', ok: env.SERPRO_CONSULTAS_HABILITADAS === 'true', descricao: 'Interruptor de consultas pagas (SERPRO_CONSULTAS_HABILITADAS=true)' },
  ];
  return { pronto: itens.every(i => i.ok), itens };
}

export interface ResultadoOficial {
  fonte: 'SERPRO';
  consultadoEm: string;
  servico: string;
  /** Resposta bruta do SERPRO, guardada para auditoria e conferência */
  bruto: unknown;
}

export function compararComFiscal(oficial: { debitos?: number; guiasPagas?: number } | null, fiscal: { debitos?: number; guiasPagas?: number } | null) {
  if (!oficial) return { status: 'sem_dado_oficial' as const, divergencias: [] as string[] };
  const divergencias: string[] = [];
  if (fiscal && oficial.debitos !== undefined && fiscal.debitos !== undefined && oficial.debitos !== fiscal.debitos) {
    divergencias.push(`Débitos: oficial ${oficial.debitos} × Fiscal ${fiscal.debitos}`);
  }
  if (fiscal && oficial.guiasPagas !== undefined && fiscal.guiasPagas !== undefined && oficial.guiasPagas !== fiscal.guiasPagas) {
    divergencias.push(`Guias pagas: oficial ${oficial.guiasPagas} × Fiscal ${fiscal.guiasPagas}`);
  }
  return { status: divergencias.length ? ('divergente' as const) : ('conferido' as const), divergencias };
}
