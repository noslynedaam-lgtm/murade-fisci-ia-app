import type { NotaFiscalItem, UF, RegimeTributario } from './fiscoiaFiscal.service';
import { normalizarCnpj, validarCnpj, validarCpf } from '../cnpj/cnpjValidation';
import { chaveNfeTemDigitoValido } from './chaveNfe.service';

export type SeveridadeRadar = 'ERRO' | 'ATENCAO';
export interface OcorrenciaRadar {
  severidade: SeveridadeRadar;
  codigo: string;
  mensagem: string;
}
export interface NotaRadar extends NotaFiscalItem {
  modeloDocumento?: '55' | '65';
  cfop?: string;
  tipoDocumentoParceiro?: 'CNPJ' | 'CPF';
  origemArquivo: string;
  /** Identificador do XML original guardado somente neste navegador. */
  xmlLocalId?: string;
  origemVerificada: false;
  situacaoProtocolo: 'PROTOCOLO_DECLARADO_NO_XML' | 'SEM_PROTOCOLO' | 'RESPOSTA_NAO_AUTORIZADA_NO_XML' | 'AUTORIZADA_NO_XML' | 'NAO_AUTORIZADA_NO_XML';
  codigoProtocolo?: string;
  numeroProtocolo?: string;
  ocorrencias: OcorrenciaRadar[];
}

const CODIGOS_CONFERENCIA_ESTRUTURAL = new Set([
  'SOMA_ITENS_DIVERGENTE', 'SOMA_ITENS_INDISPONIVEL', 'TOTAL_ITENS_INCOMPLETO', 'COMPARACAO_ITENS_INDISPONIVEL'
]);

/** Merges only server structural findings; preserves all locally entered/classified note fields. */
export function mesclarRevisaoEstrutural(
  nota: NotaRadar,
  revisao: { findings?: Array<{ code?: unknown; severity?: unknown; message?: unknown }> } | null | undefined
): NotaRadar {
  if (!revisao || !Array.isArray(revisao.findings)) return nota;
  const remotos: OcorrenciaRadar[] = revisao.findings.flatMap(item => {
    if (!item || typeof item.code !== 'string' || typeof item.message !== 'string'
      || (item.severity !== 'ERRO' && item.severity !== 'ATENCAO')
      || !CODIGOS_CONFERENCIA_ESTRUTURAL.has(item.code)) return [];
    const codigo = item.code === 'TOTAL_ITENS_INCOMPLETO' || item.code === 'COMPARACAO_ITENS_INDISPONIVEL'
      ? 'SOMA_ITENS_INDISPONIVEL' : item.code;
    return [{ codigo, severidade: item.severity, mensagem: item.message }];
  });
  const mescladas = new Map<string, OcorrenciaRadar>();
  // Preserve older/local findings; this synchronization only adds corroborating server evidence.
  for (const ocorrencia of [...(nota.ocorrencias ?? []), ...remotos]) {
    mescladas.set(`${ocorrencia.codigo}:${ocorrencia.mensagem}`, ocorrencia);
  }
  const ocorrencias = [...mescladas.values()];
  if (JSON.stringify(ocorrencias) === JSON.stringify(nota.ocorrencias ?? [])) return nota;
  return { ...nota, ocorrencias };
}

/** Valida o mínimo estrutural antes de exibir, auditar ou substituir o Radar local. */
export function validarListaNotasRadar(dados: unknown): NotaRadar[] {
  if (!Array.isArray(dados)) throw new Error('a lista do Radar não é um vetor');
  const stringsObrigatorias = ['numero', 'serie', 'dataEmissao', 'clienteOuFornecedor', 'cnpjParceiro', 'tipo', 'ufOrigem', 'ufDestino', 'regime', 'status', 'ICMS_cst', 'origemArquivo'];
  const numerosObrigatorios = ['valorProdutos', 'valorTotal', 'ICMS_aliq', 'ICMS_valor', 'PIS_aliq', 'PIS_valor', 'COFINS_aliq', 'COFINS_valor', 'DAS_valor'];
  const protocolos = new Set(['PROTOCOLO_DECLARADO_NO_XML', 'SEM_PROTOCOLO', 'RESPOSTA_NAO_AUTORIZADA_NO_XML', 'AUTORIZADA_NO_XML', 'NAO_AUTORIZADA_NO_XML']);
  const severidades = new Set(['ERRO', 'ATENCAO']);
  const camposNumericos = new Set(['VPROD', 'VNF', 'ICMS', 'PIS', 'COFINS', 'DAS', 'ICMS_ALIQUOTA', 'PIS_ALIQUOTA', 'COFINS_ALIQUOTA']);

  for (const [indice, item] of dados.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`registro ${indice + 1} do Radar não é um objeto`);
    const nota = item as Record<string, unknown>;
    if (typeof nota.chave !== 'string' || stringsObrigatorias.some(campo => typeof nota[campo] !== 'string')) {
      throw new Error(`registro ${indice + 1} do Radar tem campos de texto inválidos`);
    }
    if (nota.tipo !== 'SAIDA' && nota.tipo !== 'ENTRADA') throw new Error(`registro ${indice + 1} tem direção inválida`);
    if (numerosObrigatorios.some(campo => typeof nota[campo] !== 'number' || !Number.isFinite(nota[campo]))) {
      throw new Error(`registro ${indice + 1} do Radar tem valores numéricos inválidos`);
    }
    if (nota.situacaoProtocolo !== undefined && !protocolos.has(String(nota.situacaoProtocolo))) {
      throw new Error(`registro ${indice + 1} do Radar tem situação de protocolo inválida`);
    }
    if (nota.camposNumericosIndisponiveis !== undefined && (!Array.isArray(nota.camposNumericosIndisponiveis)
      || nota.camposNumericosIndisponiveis.some(campo => typeof campo !== 'string' || !camposNumericos.has(campo)))) {
      throw new Error(`registro ${indice + 1} do Radar tem marcadores numéricos inválidos`);
    }
    if ((nota.cfop !== undefined && typeof nota.cfop !== 'string')
      || (nota.modeloDocumento !== undefined && nota.modeloDocumento !== '55' && nota.modeloDocumento !== '65')
      || (nota.tipoDocumentoParceiro !== undefined && nota.tipoDocumentoParceiro !== 'CNPJ' && nota.tipoDocumentoParceiro !== 'CPF')
      || (nota.xmlLocalId !== undefined && typeof nota.xmlLocalId !== 'string')
      || (nota.codigoProtocolo !== undefined && typeof nota.codigoProtocolo !== 'string')
      || (nota.numeroProtocolo !== undefined && typeof nota.numeroProtocolo !== 'string')) {
      throw new Error(`registro ${indice + 1} do Radar tem metadados inválidos`);
    }
    if (nota.ocorrencias !== undefined && (!Array.isArray(nota.ocorrencias) || nota.ocorrencias.some(ocorrencia =>
      !ocorrencia || typeof ocorrencia !== 'object' || Array.isArray(ocorrencia)
      || !severidades.has(String((ocorrencia as Record<string, unknown>).severidade))
      || typeof (ocorrencia as Record<string, unknown>).codigo !== 'string'
      || typeof (ocorrencia as Record<string, unknown>).mensagem !== 'string'
    ))) throw new Error(`registro ${indice + 1} do Radar tem ocorrências inválidas`);
  }
  // Esses campos vieram de arquivos/armazenamento local. Não são prova de
  // origem autenticada; normalize até quando um XML legado declarar o oposto.
  return dados.map(item => {
    const nota = item as NotaRadar;
    const situacaoProtocolo = nota.situacaoProtocolo ?? (nota.codigoProtocolo || nota.numeroProtocolo
      ? 'PROTOCOLO_DECLARADO_NO_XML'
      : 'SEM_PROTOCOLO');
    const camposIndisponiveis = new Set(nota.camposNumericosIndisponiveis ?? []);
    // O leitor nunca extraiu alíquotas consolidadas do XML; zeros antigos são
    // apenas valores de compatibilidade e não podem parecer taxas verificadas.
    if (nota.origemArquivo) {
      camposIndisponiveis.add('ICMS_ALIQUOTA');
      camposIndisponiveis.add('PIS_ALIQUOTA');
      camposIndisponiveis.add('COFINS_ALIQUOTA');
    }
    return {
      ...nota,
      origemVerificada: false,
      camposNumericosIndisponiveis: [...camposIndisponiveis],
      situacaoProtocolo,
      ocorrencias: Array.isArray(nota.ocorrencias) ? nota.ocorrencias : []
    };
  });
}

const elemento = (node: ParentNode, tag: string): Element | null =>
  Array.from(node.querySelectorAll('*')).find(el => el.localName === tag) ?? null;
const texto = (node: ParentNode, tag: string) => elemento(node, tag)?.textContent?.trim() ?? '';
const numero = (value: string): number | null => {
  if (!/^-?\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

function centavos(raw: string): bigint | null {
  if (!/^(?:0|[1-9]\d{0,13})(?:\.\d{1,2})?$/.test(raw.trim())) return null;
  const [inteiro, fracao = ''] = raw.trim().split('.');
  return BigInt(inteiro) * 100n + BigInt(fracao.padEnd(2, '0'));
}

function formatarCentavos(valor: bigint): string {
  const sinal = valor < 0n ? '-' : '';
  const absoluto = valor < 0n ? -valor : valor;
  return `${sinal}${absoluto / 100n},${String(absoluto % 100n).padStart(2, '0')}`;
}

/** Compares invoice product item amounts with the declared product total, using integer cents. */
export function conferirSomaProdutos(vProdTotal: string, valoresItens: string[]): OcorrenciaRadar[] {
  const total = centavos(vProdTotal);
  if (total === null || !valoresItens.length) {
    return [{ severidade: 'ATENCAO', codigo: 'SOMA_ITENS_INDISPONIVEL', mensagem: 'O XML não trouxe itens e total de produtos suficientes para comparar a soma.' }];
  }
  const itens = valoresItens.map(centavos);
  if (itens.some(valor => valor === null)) {
    return [{ severidade: 'ATENCAO', codigo: 'SOMA_ITENS_INDISPONIVEL', mensagem: 'Não foi possível ler o vProd de todos os itens para comparar com o total de produtos.' }];
  }
  const soma = itens.reduce<bigint>((acumulado, valor) => acumulado + valor!, 0n);
  if (soma === total) return [];
  const diferenca = soma - total;
  return [{
    severidade: 'ERRO', codigo: 'SOMA_ITENS_DIVERGENTE',
    mensagem: `A soma de vProd dos ${itens.length} itens diverge do total de produtos do XML: itens R$ ${formatarCentavos(soma)}; total R$ ${formatarCentavos(total)}; diferença R$ ${formatarCentavos(diferenca)}.`
  }];
}

function dataIsoValida(valor: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!match) return false;
  const ano = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}
export function chaveNfeValida(chave: string) {
  return chaveNfeTemDigitoValido(chave);
}

/** Confere se os campos básicos do XML correspondem à chave declarada no próprio arquivo. */
export function conferirIdentidadeChaveNfe(
  chave: string,
  cnpjEmitente: string,
  modelo: string,
  serie: string,
  numero: string,
  dataEmissao: string
): OcorrenciaRadar[] {
  if (!chaveNfeValida(chave)) return [];
  const ocorrencias: OcorrenciaRadar[] = [];
  const cnpjChave = chave.slice(6, 20);
  const cnpjXml = normalizarCnpj(cnpjEmitente);
  if (cnpjXml && cnpjChave !== cnpjXml) {
    ocorrencias.push({ severidade: 'ERRO', codigo: 'CHAVE_CNPJ_DIVERGENTE', mensagem: 'O CNPJ do emitente não corresponde ao CNPJ embutido na chave de acesso.' });
  }
  if (modelo && chave.slice(20, 22) !== modelo) {
    ocorrencias.push({ severidade: 'ERRO', codigo: 'CHAVE_MODELO_DIVERGENTE', mensagem: 'O modelo do documento não corresponde ao modelo embutido na chave de acesso.' });
  }
  const serieNumerica = /^\d{1,3}$/.test(serie) ? serie.padStart(3, '0') : null;
  if (serieNumerica && chave.slice(22, 25) !== serieNumerica) {
    ocorrencias.push({ severidade: 'ERRO', codigo: 'CHAVE_SERIE_DIVERGENTE', mensagem: 'A série informada no XML não corresponde à série embutida na chave de acesso.' });
  }
  const numeroNumerico = /^\d{1,9}$/.test(numero) ? numero.padStart(9, '0') : null;
  if (numeroNumerico && chave.slice(25, 34) !== numeroNumerico) {
    ocorrencias.push({ severidade: 'ERRO', codigo: 'CHAVE_NUMERO_DIVERGENTE', mensagem: 'O número da NF-e não corresponde ao número embutido na chave de acesso.' });
  }
  if (dataIsoValida(dataEmissao) && chave.slice(2, 6) !== `${dataEmissao.slice(2, 4)}${dataEmissao.slice(5, 7)}`) {
    ocorrencias.push({ severidade: 'ERRO', codigo: 'CHAVE_DATA_DIVERGENTE', mensagem: 'O mês e o ano de emissão do XML não correspondem à data embutida na chave de acesso.' });
  }
  return ocorrencias;
}

export function importarXmlNfe(xml: string, nomeArquivo: string, cnpjEmpresa: string, regime: RegimeTributario, ufEmpresa: UF): NotaRadar {
  if (xml.length > 25 * 1024 * 1024) throw new Error('XML acima do limite local de 25 MB; não foi analisado nem salvo.');
  // NF-e não precisa de DTD. Recuse declarações externas/expansões antes do parser.
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('XML com DTD ou declaração de entidade não suportada; o arquivo não foi analisado.');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('O arquivo não é um XML válido.');
  const inf = elemento(doc, 'infNFe');
  if (!inf) throw new Error('XML sem o elemento infNFe. Importe NF-e modelo 55 ou NFC-e modelo 65.');
  const ide = elemento(inf, 'ide');
  const emit = elemento(inf, 'emit');
  const dest = elemento(inf, 'dest');
  const total = elemento(inf, 'ICMSTot');
  if (!ide || !emit || !total) throw new Error('XML incompleto: faltam identificação, emitente ou totais.');
  const modelo = texto(ide, 'mod');
  if (modelo !== '55' && modelo !== '65') throw new Error(`Modelo ${modelo || 'não identificado'} não suportado. Este Radar aceita NF-e 55 e NFC-e 65; outros documentos fiscais precisam de leitores próprios.`);
  const infProt = elemento(doc, 'infProt');
  const codigoProtocolo = texto(infProt ?? doc, 'cStat');
  const numeroProtocolo = texto(infProt ?? doc, 'nProt');
  const chaveId = (inf.getAttribute('Id') ?? '').replace(/^NFe/, '');
  const chaveProtocolo = texto(infProt ?? doc, 'chNFe');
  const situacaoProtocolo: NotaRadar['situacaoProtocolo'] =
    ['100', '150'].includes(codigoProtocolo) && Boolean(numeroProtocolo)
      ? 'PROTOCOLO_DECLARADO_NO_XML'
      : infProt ? 'RESPOSTA_NAO_AUTORIZADA_NO_XML' : 'SEM_PROTOCOLO';
  const chave = (chaveId || chaveProtocolo).toUpperCase();
  const numeroNfe = texto(ide, 'nNF');
  const serieNfe = texto(ide, 'serie');
  const cnpjEmit = texto(emit, 'CNPJ');
  const documentoDest = dest ? texto(dest, 'CNPJ') || texto(dest, 'CPF') : '';
  const cnpjEmitNormalizado = normalizarCnpj(cnpjEmit);
  const documentoDestNormalizado = normalizarCnpj(documentoDest);
  const cnpjLocal = normalizarCnpj(cnpjEmpresa);
  if (!validarCnpj(cnpjLocal)) throw new Error('Cadastre um CNPJ válido para a empresa ativa antes de importar XML.');
  if (cnpjEmitNormalizado !== cnpjLocal && documentoDestNormalizado !== cnpjLocal) {
    throw new Error('O CNPJ da empresa ativa não consta como emitente nem destinatário deste XML.');
  }
  const tipo: NotaFiscalItem['tipo'] = cnpjEmitNormalizado === cnpjLocal ? 'SAIDA' : 'ENTRADA';
  const parceiro = tipo === 'SAIDA' ? dest : emit;
  const cnpjParceiro = parceiro ? texto(parceiro, 'CNPJ') : '';
  const cpfParceiro = parceiro ? texto(parceiro, 'CPF') : '';
  const documentoParceiro = cnpjParceiro || cpfParceiro;
  const tipoDocumentoParceiro = cnpjParceiro ? 'CNPJ' : cpfParceiro ? 'CPF' : undefined;
  const dataRaw = texto(ide, 'dhEmi') || texto(ide, 'dEmi');
  const dataEmissao = dataRaw.includes('T') ? dataRaw.slice(0, 10) : dataRaw;
  const ufParceiro = parceiro ? texto(parceiro, 'UF') : '';
  const uf = /^[A-Z]{2}$/.test(ufParceiro) ? ufParceiro as UF : ufEmpresa;
  const vProdRaw = texto(total, 'vProd');
  const vNfRaw = texto(total, 'vNF');
  const valorProdutos = numero(vProdRaw) ?? 0;
  const valorTotal = numero(vNfRaw) ?? 0;
  const detalhes = Array.from(inf.querySelectorAll('*')).filter(el => el.localName === 'det');
  const primeiroDet = detalhes[0] ?? null;
  const cfop = texto(primeiroDet ?? inf, 'CFOP');
  const cfops = [...new Set(detalhes.map(det => texto(det, 'CFOP')).filter(Boolean))];
  const impostos = elemento(inf, 'ICMSTot');
  const icmsRaw = texto(impostos ?? doc, 'vICMS');
  const pisRaw = texto(impostos ?? doc, 'vPIS');
  const cofinsRaw = texto(impostos ?? doc, 'vCOFINS');
  const icms = numero(icmsRaw);
  const pis = numero(pisRaw);
  const cofins = numero(cofinsRaw);
  const camposNumericosIndisponiveis: NonNullable<NotaFiscalItem['camposNumericosIndisponiveis']> = [];
  if (numero(vProdRaw) === null) camposNumericosIndisponiveis.push('VPROD');
  if (numero(vNfRaw) === null) camposNumericosIndisponiveis.push('VNF');
  if (!icmsRaw || icms === null) camposNumericosIndisponiveis.push('ICMS');
  if (!pisRaw || pis === null) camposNumericosIndisponiveis.push('PIS');
  if (!cofinsRaw || cofins === null) camposNumericosIndisponiveis.push('COFINS');
  // Alíquotas são por item e regime; este leitor não as interpreta nem agrega.
  camposNumericosIndisponiveis.push('ICMS_ALIQUOTA', 'PIS_ALIQUOTA', 'COFINS_ALIQUOTA');
  // NF-e não traz a apuração do DAS da empresa; zero não significa DAS calculado.
  camposNumericosIndisponiveis.push('DAS');
  const ocorrencias: OcorrenciaRadar[] = [];
  if (!chaveNfeValida(chave)) ocorrencias.push({ severidade: 'ERRO', codigo: 'CHAVE_INVALIDA', mensagem: 'Chave de acesso ausente ou com formato/dígito verificador inválido.' });
  ocorrencias.push(...conferirIdentidadeChaveNfe(chave, cnpjEmit, modelo, serieNfe, numeroNfe, dataEmissao));
  if (chaveId && chaveProtocolo && chaveId !== chaveProtocolo) ocorrencias.push({ severidade: 'ERRO', codigo: 'CHAVE_XML_PROTOCOLO_DIVERGENTE', mensagem: 'A chave em infNFe diverge da chave informada em protNFe. O documento foi mantido somente para revisão.' });
  if (cnpjEmpresa && !validarCnpj(cnpjEmpresa)) ocorrencias.push({ severidade: 'ERRO', codigo: 'CNPJ_EMPRESA_INVALIDO', mensagem: 'O CNPJ da empresa ativa não passou na validação dos dígitos verificadores.' });
  if (!cnpjEmit || !documentoDest) ocorrencias.push({ severidade: 'ATENCAO', codigo: 'DOCUMENTO_PARTICIPANTE_AUSENTE', mensagem: 'O XML não informa CNPJ/CPF do emitente ou destinatário.' });
  if ((cnpjParceiro && !validarCnpj(cnpjParceiro)) || (cpfParceiro && !validarCpf(cpfParceiro))) {
    ocorrencias.push({ severidade: 'ERRO', codigo: 'DOCUMENTO_PARCEIRO_INVALIDO', mensagem: 'O CNPJ/CPF do participante tem formato ou dígitos verificadores inválidos.' });
  }
  if (!dataIsoValida(dataEmissao)) ocorrencias.push({ severidade: 'ERRO', codigo: 'DATA_INVALIDA', mensagem: 'Data de emissão ausente ou inexistente no calendário.' });
  if (!cfop) ocorrencias.push({ severidade: 'ATENCAO', codigo: 'CFOP_AUSENTE', mensagem: 'Não foi encontrado CFOP nos itens do XML.' });
  if (cfops.length > 1) ocorrencias.push({ severidade: 'ATENCAO', codigo: 'MULTIPLOS_CFOP', mensagem: `O XML contém ${cfops.length} CFOPs (${cfops.join(', ')}); a listagem resume apenas o primeiro e não substitui a análise por item.` });
  if (situacaoProtocolo === 'SEM_PROTOCOLO') ocorrencias.push({ severidade: 'ATENCAO', codigo: 'PROTOCOLO_AUSENTE', mensagem: 'XML sem protocolo de autorização; mantido no Radar para revisão e não encaminhado ao livro fiscal.' });
  if (situacaoProtocolo === 'PROTOCOLO_DECLARADO_NO_XML') ocorrencias.push({ severidade: 'ATENCAO', codigo: 'PROTOCOLO_NAO_VERIFICADO', mensagem: `O arquivo declara cStat ${codigoProtocolo} e nProt, mas assinatura e autenticidade não foram verificadas; não encaminhado ao livro fiscal.` });
  if (situacaoProtocolo === 'RESPOSTA_NAO_AUTORIZADA_NO_XML') ocorrencias.push({ severidade: 'ERRO', codigo: 'AUTORIZACAO_NAO_CONFIRMADA_NO_XML', mensagem: `A resposta presente no arquivo não indica autorização (cStat ${codigoProtocolo || 'ausente'}); não encaminhado ao livro fiscal.` });
  ocorrencias.push(...conferirSomaProdutos(vProdRaw, detalhes.map(det => texto(det, 'vProd'))));
  if (numero(vProdRaw) === null) ocorrencias.push({ severidade: 'ERRO', codigo: 'VPROD_INVALIDO', mensagem: 'Total de produtos ausente ou em formato numérico inválido.' });
  if (numero(vNfRaw) === null) ocorrencias.push({ severidade: 'ERRO', codigo: 'VNF_INVALIDO', mensagem: 'Valor total da NF-e ausente ou em formato numérico inválido.' });
  if (valorProdutos < 0 || valorTotal < 0 || [icms, pis, cofins].some(valor => valor !== null && valor < 0)) ocorrencias.push({ severidade: 'ERRO', codigo: 'VALOR_NEGATIVO', mensagem: 'O XML contém total ou imposto negativo.' });
  for (const [campo, raw, valor] of [['ICMS', icmsRaw, icms], ['PIS', pisRaw, pis], ['COFINS', cofinsRaw, cofins]] as const) {
    if (!raw) ocorrencias.push({ severidade: 'ATENCAO', codigo: `${campo}_AUSENTE`, mensagem: `O XML não informa o total de ${campo}; o resumo local não pode tratá-lo como zero confirmado.` });
    else if (valor === null) ocorrencias.push({ severidade: 'ERRO', codigo: `${campo}_INVALIDO`, mensagem: `O valor de ${campo} no total do XML está em formato numérico inválido.` });
  }
  if (!cnpjLocal) ocorrencias.push({ severidade: 'ATENCAO', codigo: 'EMPRESA_SEM_CNPJ', mensagem: 'Sem CNPJ ativo, a direção da operação foi inferida como entrada.' });
  return {
    chave, modeloDocumento: modelo as '55' | '65', numero: numeroNfe, serie: serieNfe, dataEmissao,
    clienteOuFornecedor: parceiro ? texto(parceiro, 'xNome') || 'Participante não informado' : 'Participante não informado',
    cnpjParceiro: documentoParceiro, tipoDocumentoParceiro, tipo,
    valorProdutos, valorTotal, camposNumericosIndisponiveis, ufOrigem: tipo === 'SAIDA' ? ufEmpresa : uf,
    ufDestino: tipo === 'SAIDA' ? uf : ufEmpresa, regime, status: 'PENDENTE',
    ICMS_aliq: 0, ICMS_valor: icms ?? 0, ICMS_cst: texto(primeiroDet ?? inf, 'CST') || texto(primeiroDet ?? inf, 'CSOSN'),
    PIS_aliq: 0, PIS_valor: pis ?? 0, COFINS_aliq: 0, COFINS_valor: cofins ?? 0,
    DAS_valor: 0, cfop, origemArquivo: nomeArquivo, origemVerificada: false,
    situacaoProtocolo, codigoProtocolo: codigoProtocolo || undefined,
    numeroProtocolo: numeroProtocolo || undefined, ocorrencias
  };
}

export function conferirNotasRadar(notas: NotaRadar[]): Map<string, OcorrenciaRadar[]> {
  const chaves = new Map<string, number>();
  for (const n of notas) if (n.chave) chaves.set(n.chave, (chaves.get(n.chave) ?? 0) + 1);
  return new Map(notas.map(n => {
    const ocorrencias = Array.isArray(n.ocorrencias) ? [...n.ocorrencias] : [];
    if ((n.situacaoProtocolo === 'AUTORIZADA_NO_XML' || n.situacaoProtocolo === 'PROTOCOLO_DECLARADO_NO_XML') && !ocorrencias.some(i => i.codigo === 'PROTOCOLO_NAO_VERIFICADO')) ocorrencias.push({ severidade: 'ATENCAO', codigo: 'PROTOCOLO_NAO_VERIFICADO', mensagem: 'O XML declara um protocolo, mas assinatura e autenticidade não foram verificadas nesta aplicação.' });
    if (!chaveNfeValida(n.chave) && !ocorrencias.some(i => i.codigo === 'CHAVE_INVALIDA')) ocorrencias.push({ severidade: 'ERRO', codigo: 'CHAVE_INVALIDA', mensagem: 'Chave de acesso ausente ou com formato/dígito verificador inválido.' });
    if (n.chave && (chaves.get(n.chave) ?? 0) > 1) ocorrencias.push({ severidade: 'ERRO', codigo: 'CHAVE_DUPLICADA', mensagem: 'A mesma chave de acesso aparece mais de uma vez nesta empresa.' });
    if (['ICMS_ALIQUOTA', 'PIS_ALIQUOTA', 'COFINS_ALIQUOTA'].some(campo => n.camposNumericosIndisponiveis?.includes(campo as NonNullable<NotaFiscalItem['camposNumericosIndisponiveis']>[number]))
      && !ocorrencias.some(i => i.codigo === 'ALIQUOTAS_NAO_EXTRAIDAS')) {
      ocorrencias.push({ severidade: 'ATENCAO', codigo: 'ALIQUOTAS_NAO_EXTRAIDAS', mensagem: 'Este leitor não extrai as alíquotas por item; os zeros internos não representam alíquotas confirmadas.' });
    }
    // Valor ausente é marcado separadamente como VNF inválido. Não o reporte
    // também como um zero real, pois o zero aqui é apenas o fallback interno.
    if (!n.camposNumericosIndisponiveis?.includes('VNF') && n.valorTotal === 0) {
      ocorrencias.push({ severidade: 'ATENCAO', codigo: 'TOTAL_ZERO', mensagem: 'Valor total zerado no registro; confira se o XML está completo.' });
    }
    if (!n.cnpjParceiro) ocorrencias.push({ severidade: 'ATENCAO', codigo: 'PARCEIRO_AUSENTE', mensagem: 'CNPJ/CPF do parceiro não informado.' });
    return [n.chave || `${n.origemArquivo}-${n.numero}`, ocorrencias];
  }));
}

export function exportarRelatorioRadarCsv(notas: NotaRadar[], ocorrencias: Map<string, OcorrenciaRadar[]>) {
  const esc = (s: unknown) => {
    const valor = String(s ?? '');
    // Evita que campos do XML sejam executados como fórmulas ao abrir o CSV em planilhas.
    const seguro = /^[\u0000-\u0020]*[=+@-]/.test(valor) ? `'${valor}` : valor;
    return `"${seguro.replace(/"/g, '""')}"`;
  };
  const linhas = [['Chave','Modelo','Número','Série','Emissão','Direção','Parceiro','Tipo de documento','Documento do parceiro','CFOP','Valor total','Arquivo','Origem autenticada pelo Murade?','Consulta SEFAZ realizada?','Protocolo no XML','Conferência local','Ocorrências locais'], ...notas.map(n => {
    const issues = ocorrencias.get(n.chave || `${n.origemArquivo}-${n.numero}`) ?? [];
    const protocoloNoArquivo = n.situacaoProtocolo === 'PROTOCOLO_DECLARADO_NO_XML' || n.situacaoProtocolo === 'AUTORIZADA_NO_XML'
      ? `Declarado no XML (cStat ${n.codigoProtocolo || 'ausente'}); não autenticado`
      : n.situacaoProtocolo === 'RESPOSTA_NAO_AUTORIZADA_NO_XML' || n.situacaoProtocolo === 'NAO_AUTORIZADA_NO_XML'
        ? `Resposta sem autorização (cStat ${n.codigoProtocolo || 'ausente'})`
        : 'Sem protocolo no arquivo';
    const valorTotal = n.camposNumericosIndisponiveis?.includes('VNF') ? 'Não disponível' : n.valorTotal;
    return [n.chave,n.modeloDocumento || 'Não informado',n.numero,n.serie,n.dataEmissao,n.tipo,n.clienteOuFornecedor,n.tipoDocumentoParceiro || 'Não informado',n.cnpjParceiro,n.cfop,valorTotal,n.origemArquivo,'Não — XML local não autenticado','Não realizada',protocoloNoArquivo,issues.length ? 'Revisar' : 'Sem alerta estrutural',issues.map(i => `${i.codigo}: ${i.mensagem}`).join(' | ')];
  })];
  return '\uFEFF' + linhas.map(row => row.map(esc).join(';')).join('\r\n');
}
