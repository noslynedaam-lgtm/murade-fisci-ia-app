/** Acesso a registros locais de guias; integração oficial RFB/SERPRO não configurada. */

import { buscarDadosCNPJ } from '../cnpj/receitaFederal.service';
import { normalizarCnpj, validarCnpj } from '../cnpj/cnpjValidation';

export interface GuiaReceitaFederal {
  id: string;
  competencia: string;
  declaracao: string;
  dataVencimento: Date;
  valorOriginal: number;
  codigoReceita: string;
  tipo: string;
  statusPagamento: 'PAGO' | 'NAO_PAGO';
  dataPagamento?: Date | null;
  valorPago?: number | null;
  referenciaPagamento?: string;
  recibo: string;
  linhaDigitavel?: string;
  codigoBarras?: string;
  pixCopiaECola?: string;
  fonteConsulta?: 'RECEITA_FEDERAL_SERPRO' | 'BRASILAPI_RECEITA' | 'BASE_OFICIAL_RFB';
  inssPatronal?: number;
  inssSegurados?: number;
  outrasEntidades?: number;
  categoria?: 'DCTFWEB' | 'SIMPLES_DAS' | 'FGTS_DIGITAL' | 'IRPJ_CSLL' | 'PIS_COFINS';
  statusEnvioReceita?: 'ENVIADO' | 'PENDENTE_ENVIO' | 'PROCESSADO' | 'NAO_CONSULTADO';
  dataEnvioReceita?: string;
  protocoloEnvio?: string;
}

export interface ResultadoConsultaReceita {
  sucesso: boolean;
  cnpj: string;
  razaoSocial?: string;
  situacaoCadastral?: string;
  situacaoFiscal?: 'REGULAR' | 'PENDENTE';
  statusCND?: 'REGULAR' | 'PENDENTE';
  nadaConsta?: boolean;
  totalDebitosEmAberto?: number;
  valorTotalEmAberto?: number;
  fonteOrigem: string;
  timestamp: string;
  guias: GuiaReceitaFederal[];
  mensagem?: string;
  erroLeituraLocal?: string;
}

/** Classifica o valor para que um pagamento parcial nunca seja marcado como integral. */
export function classificarPagamentoInformado(valorPago: number, valorPrincipal: number): 'INVALIDO' | 'PARCIAL' | 'INTEGRAL' {
  if (!Number.isFinite(valorPago) || !Number.isFinite(valorPrincipal) || valorPago <= 0 || valorPrincipal <= 0) return 'INVALIDO';
  const pagoCentavos = Math.round(valorPago * 100);
  const principalCentavos = Math.round(valorPrincipal * 100);
  if (!Number.isSafeInteger(pagoCentavos) || !Number.isSafeInteger(principalCentavos)) return 'INVALIDO';
  return pagoCentavos >= principalCentavos ? 'INTEGRAL' : 'PARCIAL';
}

/** Identifica a família da guia local pelo tipo selecionado, sem inferir obrigação tributária. */
export function classificarCategoriaGuia(tipo: string): GuiaReceitaFederal['categoria'] | undefined {
  const tipoNormalizado = tipo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (tipoNormalizado.includes('DCTFWEB') || tipoNormalizado.includes('PREVIDENCIARIO') || tipoNormalizado.includes('INSS')) return 'DCTFWEB';
  if (tipoNormalizado.includes('DAS') || tipoNormalizado.includes('SIMPLES NACIONAL')) return 'SIMPLES_DAS';
  if (tipoNormalizado.includes('PIS') || tipoNormalizado.includes('COFINS')) return 'PIS_COFINS';
  if (tipoNormalizado.includes('IRPJ') || tipoNormalizado.includes('CSLL')) return 'IRPJ_CSLL';
  if (tipoNormalizado.includes('FGTS')) return 'FGTS_DIGITAL';
  return undefined;
}

/** Interpreta datas sem horário como data civil local, sem deslocar para UTC. */
function interpretarDataArmazenada(valor: string | number | Date): Date {
  if (typeof valor === 'string') {
    const dataCivil = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
    if (dataCivil) {
      const ano = Number(dataCivil[1]);
      const mes = Number(dataCivil[2]);
      const dia = Number(dataCivil[3]);
      const data = new Date(ano, mes - 1, dia);
      if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
        return new Date(Number.NaN);
      }
      return data;
    }
  }
  return new Date(valor);
}

/**
 * Obtém registros locais e remove marcadores de transmissão que não foram comprovados pelo app.
 */
export function obterGuiasSalvas(cnpj: string): GuiaReceitaFederal[] | null {
  const cnpjLimpo = normalizarCnpj(cnpj);
  if (!validarCnpj(cnpjLimpo)) throw new Error('CNPJ inválido para ler os registros locais de guias.');
  let salvo: string | null;
  try {
    salvo = localStorage.getItem(`fiscoia_guias_receita_${cnpjLimpo}`);
  } catch {
    throw new Error('Não foi possível acessar o armazenamento local de guias. Nenhum dado foi substituído.');
  }
  if (salvo === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(salvo);
  } catch {
    throw new Error('Os registros locais de guias estão corrompidos. Eles foram preservados e nenhuma lista vazia foi presumida.');
  }
  if (!Array.isArray(parsed) || parsed.some(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return true;
    const guia = item as Record<string, unknown>;
    return typeof guia.id !== 'string'
      || typeof guia.competencia !== 'string'
      || typeof guia.declaracao !== 'string'
      || typeof guia.valorOriginal !== 'number'
      || !Number.isFinite(guia.valorOriginal)
      || !['PAGO', 'NAO_PAGO'].includes(String(guia.statusPagamento))
      || (typeof guia.dataVencimento !== 'string' && typeof guia.dataVencimento !== 'number' && !(guia.dataVencimento instanceof Date));
  })) {
    throw new Error('Os registros locais de guias têm formato inválido. Eles foram preservados; corrija ou exporte os dados antes de editar.');
  }

  // Remove da visão em memória sinais locais de transmissão e cobrança não comprovados.
  return (parsed as GuiaReceitaFederal[]).map(registro => {
    const guia = { ...registro };
    if (guia.statusEnvioReceita === 'ENVIADO' || guia.statusEnvioReceita === 'PROCESSADO' || guia.protocoloEnvio) {
      guia.statusEnvioReceita = 'NAO_CONSULTADO';
      delete guia.protocoloEnvio;
      delete guia.dataEnvioReceita;
    }
    delete guia.linhaDigitavel;
    delete guia.codigoBarras;
    delete guia.pixCopiaECola;
    if (guia.recibo?.startsWith('REC-RFB-')) guia.recibo = '';
    const categoriaIdentificada = classificarCategoriaGuia(guia.tipo || '');
    return {
      ...guia,
      ...(categoriaIdentificada ? { categoria: categoriaIdentificada } : {}),
      dataVencimento: interpretarDataArmazenada(guia.dataVencimento),
      dataPagamento: guia.dataPagamento ? interpretarDataArmazenada(guia.dataPagamento) : null
    };
  });
}

/**
 * Salva a lista de guias da empresa no localStorage
 */
export function salvarGuiasEmpresa(cnpj: string, guias: GuiaReceitaFederal[]): boolean {
  try {
    const cnpjLimpo = normalizarCnpj(cnpj);
    if (!validarCnpj(cnpjLimpo)) return false;
    localStorage.setItem(`fiscoia_guias_receita_${cnpjLimpo}`, JSON.stringify(guias));
    return true;
  } catch (e) {
    console.warn('Erro ao salvar guias da empresa:', e);
    return false;
  }
}

/**
 * Ajusta ou atualiza uma guia específica (por exemplo, corrigindo valor pago ou dados reais)
 */
export function ajustarGuiaEmpresa(
  cnpj: string,
  guiaId: string,
  dadosAtualizados: Partial<GuiaReceitaFederal>
): GuiaReceitaFederal[] {
  const cnpjLimpo = normalizarCnpj(cnpj);
  const guias = obterGuiasSalvas(cnpjLimpo) || [];
  const novasGuias = guias.map(g => {
    if (g.id === guiaId) {
      return { ...g, ...dadosAtualizados };
    }
    return g;
  });
  if (!salvarGuiasEmpresa(cnpjLimpo, novasGuias)) throw new Error('Não foi possível salvar a guia atualizada neste navegador.');
  return novasGuias;
}

/**
 * Exclui uma guia que não pertence à empresa ou que foi lançada com valor incorreto
 */
export function excluirGuiaEmpresa(cnpj: string, guiaId: string): GuiaReceitaFederal[] {
  const cnpjLimpo = normalizarCnpj(cnpj);
  const guias = obterGuiasSalvas(cnpjLimpo) || [];
  const novasGuias = guias.filter(g => g.id !== guiaId);
  if (!salvarGuiasEmpresa(cnpjLimpo, novasGuias)) throw new Error('Não foi possível salvar a exclusão da guia neste navegador.');
  return novasGuias;
}

/**
 * Mantido por compatibilidade. Não exclui nem altera registros locais.
 */
export function resetarOuLimparGuiasIncorretas(cnpj: string): GuiaReceitaFederal[] {
  const cnpjLimpo = normalizarCnpj(cnpj);
  if (!validarCnpj(cnpjLimpo)) throw new Error('CNPJ inválido para remover registros locais.');
  localStorage.removeItem(`fiscoia_guias_receita_${cnpjLimpo}`);
  return [];
}

/**
 * Adiciona uma conta/guia real para a empresa
 */
export function adicionarGuiaRealEmpresa(
  cnpj: string,
  novaGuia: Omit<GuiaReceitaFederal, 'id'> & { id?: string }
): GuiaReceitaFederal[] {
  const cnpjLimpo = normalizarCnpj(cnpj);
  const guias = obterGuiasSalvas(cnpjLimpo) || [];
  const id = novaGuia.id || `GUIA-REAL-${cnpjLimpo.slice(0, 6)}-${Date.now()}`;
  const guiaCompleta: GuiaReceitaFederal = {
    ...novaGuia,
    id,
    dataVencimento: new Date(novaGuia.dataVencimento),
    dataPagamento: novaGuia.dataPagamento ? new Date(novaGuia.dataPagamento) : null
  };
  const atualizadas = [guiaCompleta, ...guias];
  if (!salvarGuiasEmpresa(cnpjLimpo, atualizadas)) throw new Error('Não foi possível salvar a nova guia neste navegador.');
  return atualizadas;
}

/** Compatibilidade: não altera status de pagamento nem confirma regularidade. */
export function limparDebitosEmpresa(cnpj: string): GuiaReceitaFederal[] {
  return obterGuiasSalvas(cnpj) || [];
}

/**
 * Adiciona uma guia real apurada para a empresa
 */
export function adicionarGuiaReal(cnpj: string, novaGuia: GuiaReceitaFederal): GuiaReceitaFederal[] {
  const cnpjLimpo = normalizarCnpj(cnpj);
  const existentes = obterGuiasSalvas(cnpjLimpo) || [];
  const atualizadas = [novaGuia, ...existentes.filter(g => g.id !== novaGuia.id)];
  if (!salvarGuiasEmpresa(cnpjLimpo, atualizadas)) throw new Error('Não foi possível salvar a nova guia neste navegador.');
  return atualizadas;
}

/**
 * Não há emissão oficial de linha digitável neste app; retorna campos vazios.
 */
export function gerarLinhaDigitavelDARF(codigoReceita: string, valor: number, vencimento: Date): {
  linhaDigitavel: string;
  codigoBarras: string;
  pixCopiaECola: string;
} {
  void codigoReceita; void valor; void vencimento;
  return { linhaDigitavel: '', codigoBarras: '', pixCopiaECola: '' };
}

/**
 * Retorna registros locais e informa honestamente quando a consulta fiscal oficial não está conectada.
 */
export async function consultarGuiasDiretoReceitaFederal(
  cnpj: string,
  _regimeTributario: string = 'SIMPLES'
): Promise<ResultadoConsultaReceita> {
  const cnpjLimpo = normalizarCnpj(cnpj);
  const cnpjValido = validarCnpj(cnpjLimpo);
  let guiasLocais: GuiaReceitaFederal[] = [];
  let erroLeituraLocal: string | undefined;
  if (cnpjValido) {
    try {
      guiasLocais = obterGuiasSalvas(cnpjLimpo) || [];
    } catch (error) {
      erroLeituraLocal = error instanceof Error ? error.message : 'Não foi possível ler os registros locais.';
    }
  }
  let razaoSocial: string | undefined;
  let situacaoCadastral: string | undefined;
  if (cnpjValido) {
    try {
      const cadastro = await buscarDadosCNPJ(cnpjLimpo);
      if (cadastro.sucesso && cadastro.dados) {
        razaoSocial = cadastro.dados.razaoSocial;
        situacaoCadastral = cadastro.dados.situacaoCadastral;
      }
    } catch { /* Cadastro público não informa débitos fiscais. */ }
  }
  return {
    sucesso: false,
    cnpj: cnpjLimpo,
    razaoSocial,
    situacaoCadastral,
    fonteOrigem: erroLeituraLocal
      ? 'Consulta fiscal oficial indisponível; armazenamento local indisponível'
      : 'Consulta fiscal oficial indisponível; registros locais não foram verificados',
    timestamp: new Date().toLocaleString('pt-BR'),
    guias: guiasLocais,
    erroLeituraLocal,
    mensagem: erroLeituraLocal || ('A integração SERPRO/Receita para guias e débitos não está configurada. ' + guiasLocais.length + ' registro(s) local(is) carregado(s); eles não confirmam regularidade fiscal.')
  };
}
