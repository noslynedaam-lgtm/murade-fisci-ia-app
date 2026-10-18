// ==========================================================
// 🇧🇷 FISCOIA — FISCAL COMPLETO CORRIGIDO
// ==========================================================
// ✅ NFe SAÍDA • NFe ENTRADA • BAIXA • APURAÇÃO
// ✅ SIMPLES NACIONAL • LUCRO PRESUMIDO • LUCRO REAL
// ✅ 🧮 CALCULADORA FISCAL NA BARRA LATERAL
// ==========================================================

export type UF = 
  | 'AC' | 'AL' | 'AM' | 'AP' | 'BA' | 'CE' | 'DF' | 'ES' | 'GO' | 'MA' | 'MG' 
  | 'MS' | 'MT' | 'PA' | 'PB' | 'PE' | 'PI' | 'PR' | 'RJ' | 'RN' | 'RO' | 'RR' 
  | 'RS' | 'SC' | 'SE' | 'SP' | 'TO';

export type RegimeTributario = 'PRESUMIDO' | 'REAL' | 'SIMPLES';

export interface NotaFiscalItem {
  chave: string;
  cfop?: string;
  origemArquivo?: string;
  origemVerificada?: boolean;
  numero: string;
  serie: string;
  dataEmissao: string;
  dataVencimento?: string;
  clienteOuFornecedor: string;
  cnpjParceiro: string;
  tipo: 'SAIDA' | 'ENTRADA';
  valorProdutos: number;
  valorTotal: number;
  ufOrigem: UF;
  ufDestino: UF;
  regime: RegimeTributario;
  status: 'PENDENTE' | 'PAGA' | 'PAGA_INFORMADA' | 'PAGAMENTO_PARCIAL_INFORMADO' | 'VENCIDA';
  ICMS_aliq: number;
  ICMS_valor: number;
  ICMS_cst: string;
  PIS_aliq: number;
  PIS_valor: number;
  COFINS_aliq: number;
  COFINS_valor: number;
  DAS_valor: number;
  dataPagamento?: string;
  valorPago?: number;
  pagamentosInformados?: Array<{ valor: number; data: string }>;
  /** Campos indisponíveis ou não extraídos; valores substitutos não devem ser tratados como apuração. */
  camposNumericosIndisponiveis?: Array<'VPROD' | 'VNF' | 'ICMS' | 'PIS' | 'COFINS' | 'DAS' | 'ICMS_ALIQUOTA' | 'PIS_ALIQUOTA' | 'COFINS_ALIQUOTA'>;
}

export interface NotasFiscaisEmpresa {
  saidas: NotaFiscalItem[];
  entradas: NotaFiscalItem[];
}

export type SituacaoVencimentoInformado = 'VENCIDA' | 'PROXIMA' | null;

/** Classifica somente datas de vencimento que já foram informadas no registro local. */
export function classificarVencimentoInformado(
  dataVencimento: string | undefined,
  dataReferencia: Date = new Date(),
  diasAlerta = 7
): SituacaoVencimentoInformado {
  if (!dataVencimento || !Number.isInteger(diasAlerta) || diasAlerta < 0) return null;
  const data = dataVencimento.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const [ano, mes, dia] = data.split('-').map(Number);
  const vencimento = new Date(ano, mes - 1, dia);
  if (vencimento.getFullYear() !== ano || vencimento.getMonth() !== mes - 1 || vencimento.getDate() !== dia) return null;
  const referencia = new Date(dataReferencia);
  vencimento.setHours(0, 0, 0, 0);
  referencia.setHours(0, 0, 0, 0);
  if (Number.isNaN(vencimento.getTime()) || Number.isNaN(referencia.getTime())) return null;
  if (vencimento < referencia) return 'VENCIDA';
  const limite = new Date(referencia);
  limite.setDate(limite.getDate() + diasAlerta);
  return vencimento <= limite ? 'PROXIMA' : null;
}

export function vencimentoInformadoPassou(dataVencimento: string | undefined, dataReferencia: Date = new Date()): boolean {
  return classificarVencimentoInformado(dataVencimento, dataReferencia, 0) === 'VENCIDA';
}

function valorMonetarioLocalSeguro(valor: number): boolean {
  return Number.isFinite(valor) && valor >= 0 && valor <= Number.MAX_SAFE_INTEGER / 100
    && Number.isSafeInteger(Math.round(valor * 100));
}

function dataCivilLocalValida(valor: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!match) return false;
  const ano = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
}

/** Total manual acumulado; o registro não consulta nem comprova pagamento bancário. */
export function obterValorPagoInformado(nota: NotaFiscalItem): number {
  if (typeof nota.valorPago === 'number' && Number.isFinite(nota.valorPago)) return nota.valorPago;
  return nota.pagamentosInformados?.reduce((total, pagamento) => total + pagamento.valor, 0) ?? 0;
}

/** Anexa um pagamento informado pelo usuário, preservando valores legados sem data. */
export function registrarPagamentoInformado(nota: NotaFiscalItem, valor: number, data: string): NotaFiscalItem {
  if (!valorMonetarioLocalSeguro(valor) || valor <= 0) throw new Error('Informe um valor positivo dentro da faixa monetária segura.');
  if (!dataCivilLocalValida(data)) throw new Error('Informe uma data de pagamento válida.');
  if (!valorMonetarioLocalSeguro(nota.valorTotal) || nota.valorTotal <= 0) throw new Error('O total da nota está fora da faixa monetária segura.');

  const jaInformado = obterValorPagoInformado(nota);
  if (!valorMonetarioLocalSeguro(jaInformado)) throw new Error('O total de pagamentos anterior está fora da faixa segura.');
  const valorAcumulado = Math.round((jaInformado + valor + Number.EPSILON) * 100) / 100;
  if (!valorMonetarioLocalSeguro(valorAcumulado)) throw new Error('O total acumulado excede a faixa monetária segura.');
  if (valorAcumulado > nota.valorTotal + 0.009) throw new Error('O valor informado excede o saldo local da nota.');

  return {
    ...nota,
    status: valorAcumulado + 0.009 >= nota.valorTotal ? 'PAGA_INFORMADA' : 'PAGAMENTO_PARCIAL_INFORMADO',
    valorPago: valorAcumulado,
    dataPagamento: data,
    pagamentosInformados: [...(nota.pagamentosInformados ?? []), { valor, data }]
  };
}

const chaveNotasFiscais = (empresaId: string) => `fiscoia_notas_fiscais_${empresaId}`;
export const EVENTO_DADOS_FISCAIS_ATUALIZADOS = 'fiscoia_dados_fiscais_atualizados';

export function notificarAtualizacaoDadosFiscais(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_DADOS_FISCAIS_ATUALIZADOS));
}

export type ResultadoLeituraNotasFiscais =
  | { ok: true; notas: NotasFiscaisEmpresa }
  | { ok: false; erro: string };

function validarNotaFiscalLocal(valor: unknown, indice: number): valor is NotaFiscalItem {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error(`registro ${indice + 1} não é um objeto`);
  const nota = valor as Record<string, unknown>;
  const textos = ['chave', 'numero', 'serie', 'dataEmissao', 'clienteOuFornecedor', 'cnpjParceiro', 'ufOrigem', 'ufDestino', 'regime', 'status', 'ICMS_cst'];
  const numeros = ['valorProdutos', 'valorTotal', 'ICMS_aliq', 'ICMS_valor', 'PIS_aliq', 'PIS_valor', 'COFINS_aliq', 'COFINS_valor', 'DAS_valor'];
  const estados = new Set(['PENDENTE', 'PAGA', 'PAGA_INFORMADA', 'PAGAMENTO_PARCIAL_INFORMADO', 'VENCIDA']);
  if (textos.some(campo => typeof nota[campo] !== 'string')) throw new Error(`registro ${indice + 1} tem campos de texto inválidos`);
  if (nota.tipo !== 'SAIDA' && nota.tipo !== 'ENTRADA') throw new Error(`registro ${indice + 1} tem direção inválida`);
  if (!estados.has(String(nota.status))) throw new Error(`registro ${indice + 1} tem status inválido`);
  if (numeros.some(campo => typeof nota[campo] !== 'number' || !Number.isFinite(nota[campo]))) throw new Error(`registro ${indice + 1} tem valores numéricos inválidos`);
  if (['valorPago', 'dataVencimento', 'dataPagamento', 'origemArquivo', 'cfop'].some(campo =>
    nota[campo] !== undefined && typeof nota[campo] !== (campo === 'valorPago' ? 'number' : 'string'))
  ) throw new Error(`registro ${indice + 1} tem dados complementares inválidos`);
  if (nota.valorPago !== undefined && !valorMonetarioLocalSeguro(nota.valorPago as number)) {
    throw new Error(`registro ${indice + 1} tem valor pago inválido`);
  }
  if (nota.pagamentosInformados !== undefined && (!Array.isArray(nota.pagamentosInformados) || nota.pagamentosInformados.some(pagamento =>
    !pagamento || typeof pagamento !== 'object' || Array.isArray(pagamento)
    || typeof (pagamento as Record<string, unknown>).valor !== 'number'
    || !valorMonetarioLocalSeguro((pagamento as Record<string, unknown>).valor as number)
    || ((pagamento as Record<string, unknown>).valor as number) <= 0
    || typeof (pagamento as Record<string, unknown>).data !== 'string'
    || !dataCivilLocalValida((pagamento as Record<string, unknown>).data as string)
  ))) throw new Error(`registro ${indice + 1} tem histórico de pagamento inválido`);
  if (nota.pagamentosInformados !== undefined) {
    const pagamentos = nota.pagamentosInformados as Array<{ valor: number; data: string }>;
    const totalHistorico = pagamentos.reduce((total, pagamento) => total + pagamento.valor, 0);
    if (!valorMonetarioLocalSeguro(totalHistorico) || totalHistorico > (nota.valorTotal as number) + 0.009
      || (nota.valorPago !== undefined && Math.abs(totalHistorico - (nota.valorPago as number)) > 0.009)) {
      throw new Error(`registro ${indice + 1} tem histórico de pagamentos incompatível com o total informado`);
    }
  }
  if (nota.camposNumericosIndisponiveis !== undefined && (!Array.isArray(nota.camposNumericosIndisponiveis)
    || nota.camposNumericosIndisponiveis.some(campo => !['VPROD', 'VNF', 'ICMS', 'PIS', 'COFINS', 'DAS', 'ICMS_ALIQUOTA', 'PIS_ALIQUOTA', 'COFINS_ALIQUOTA'].includes(String(campo))))) {
    throw new Error(`registro ${indice + 1} tem marcadores numéricos inválidos`);
  }
  if (nota.valorPago !== undefined && (nota.valorPago as number) > (nota.valorTotal as number) + 0.009) {
    throw new Error(`registro ${indice + 1} tem pagamento informado acima do total da nota`);
  }
  if (nota.status === 'PAGA_INFORMADA' && (typeof nota.valorPago !== 'number'
    || Math.abs(nota.valorPago - (nota.valorTotal as number)) > 0.009)) {
    throw new Error(`registro ${indice + 1} está marcado como pago, mas o valor informado não cobre o total`);
  }
  if (nota.status === 'PAGAMENTO_PARCIAL_INFORMADO' && (typeof nota.valorPago !== 'number' || nota.valorPago <= 0 || nota.valorPago + 0.009 >= (nota.valorTotal as number))) {
    throw new Error(`registro ${indice + 1} tem status parcial incompatível com o valor informado`);
  }
  return true;
}

/** Lê o livro sem transformar erro de armazenamento em uma lista vazia. */
export function lerNotasFiscaisEmpresa(empresaId: string): ResultadoLeituraNotasFiscais {
  try {
    const raw = localStorage.getItem(chaveNotasFiscais(empresaId));
    if (!raw) return { ok: true, notas: { saidas: [], entradas: [] } };
    const dados: unknown = JSON.parse(raw);
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) throw new Error('formato do livro inválido');
    const livro = dados as Partial<NotasFiscaisEmpresa>;
    if (!Array.isArray(livro.saidas) || !Array.isArray(livro.entradas)) throw new Error('listas de entradas/saídas inválidas');
    [...livro.saidas, ...livro.entradas].forEach(validarNotaFiscalLocal);
    return { ok: true, notas: { saidas: livro.saidas, entradas: livro.entradas } };
  } catch (error) {
    return { ok: false, erro: error instanceof Error ? error.message : 'falha ao ler o livro fiscal local' };
  }
}

export function obterNotasFiscaisEmpresa(empresaId: string): NotasFiscaisEmpresa {
  const resultado = lerNotasFiscaisEmpresa(empresaId);
  if ('notas' in resultado) return resultado.notas;
  console.error('Não foi possível carregar as notas locais da empresa:', resultado.erro);
  return { saidas: [], entradas: [] };
}

export function salvarNotasFiscaisEmpresa(empresaId: string, notas: NotasFiscaisEmpresa): boolean {
  try {
    if (!empresaId.trim() || !notas || typeof notas !== 'object'
      || !Array.isArray(notas.saidas) || !Array.isArray(notas.entradas)) return false;
    for (const nota of notas.saidas) {
      validarNotaFiscalLocal(nota, 0);
      if (nota.tipo !== 'SAIDA') return false;
    }
    for (const nota of notas.entradas) {
      validarNotaFiscalLocal(nota, 0);
      if (nota.tipo !== 'ENTRADA') return false;
    }
    const xmlSemAutenticacao = [...notas.saidas, ...notas.entradas].some(nota => Boolean(nota.origemArquivo));
    if (xmlSemAutenticacao) {
      console.error('O livro fiscal não aceita registros provenientes de XML local sem autenticação oficial.');
      return false;
    }
    localStorage.setItem(chaveNotasFiscais(empresaId), JSON.stringify(notas));
    notificarAtualizacaoDadosFiscais();
    return true;
  } catch (error) {
    console.error('Não foi possível salvar as notas locais da empresa:', error);
    return false;
  }
}

export interface ResumoTributosInformados {
  periodo: string;
  totalSaida: {
    ICMS: number;
    PIS: number;
    COFINS: number;
    DAS: number;
  };
  totalEntrada: {
    ICMS: number;
    PIS: number;
    COFINS: number;
  };
  camposInvalidos: number;
  status: string;
}

export const FISCOIA_FISCAL = {
  NOME: "MURADE FISCAL — ROTINAS LOCAIS",
  VERSAO: "3.2.1 — CORRIGIDO",
  ATIVO: true,

  UFS: ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'] as UF[],

  REGIMES: {
    PRESUMIDO: { nome: "Lucro Presumido" },
    REAL: { nome: "Lucro Real" },
    SIMPLES: { nome: "Simples Nacional" }
  },

  // ==========================================================
  // Resumo de campos de tributos informados nos XMLs locais; não faz apuração legal.
  // ==========================================================
  resumirTributosInformados(
    notasSaida: NotaFiscalItem[],
    notasEntrada: NotaFiscalItem[] = [],
    mes: string = String(new Date().getMonth() + 1).padStart(2, '0'),
    ano: string = String(new Date().getFullYear())
  ): ResumoTributosInformados {
    let camposInvalidos = 0;
    const campoOrigem: Record<keyof Pick<NotaFiscalItem, 'ICMS_valor' | 'PIS_valor' | 'COFINS_valor' | 'DAS_valor'>, 'ICMS' | 'PIS' | 'COFINS' | 'DAS'> = {
      ICMS_valor: 'ICMS', PIS_valor: 'PIS', COFINS_valor: 'COFINS', DAS_valor: 'DAS'
    };
    const somar = (notas: NotaFiscalItem[], campo: keyof typeof campoOrigem) =>
      notas.reduce((total, nota) => {
        if (nota.camposNumericosIndisponiveis?.includes(campoOrigem[campo])) {
          camposInvalidos += 1;
          return total;
        }
        const valor: unknown = nota[campo];
        if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) {
          camposInvalidos += 1;
          return total;
        }
        const acumulado = total + valor;
        if (!Number.isFinite(acumulado) || acumulado > Number.MAX_SAFE_INTEGER / 100 || !Number.isSafeInteger(Math.round(acumulado * 100))) {
          camposInvalidos += 1;
          return total;
        }
        return acumulado;
      }, 0);

    const totalSaida = {
      ICMS: somar(notasSaida, 'ICMS_valor'),
      PIS: somar(notasSaida, 'PIS_valor'),
      COFINS: somar(notasSaida, 'COFINS_valor'),
      DAS: somar(notasSaida, 'DAS_valor')
    };

    const totalEntrada = {
      ICMS: somar(notasEntrada, 'ICMS_valor'),
      PIS: somar(notasEntrada, 'PIS_valor'),
      COFINS: somar(notasEntrada, 'COFINS_valor')
    };

    return {
      periodo: `${mes}/${ano}`, 
      totalSaida, 
      totalEntrada,
      camposInvalidos,
      status: camposInvalidos
        ? `RESUMO PARCIAL: ${camposInvalidos} campo(s) numérico(s) inválido(s) ou fora da faixa segura foram omitidos; sem compensação ou apuração legal.`
        : "RESUMO DOS CAMPOS NUMÉRICOS INFORMADOS — SEM COMPENSAÇÃO OU APURAÇÃO LEGAL"
    };
  },

  // ==========================================================
  // Conferência local de vencimentos informados nas notas
  // ==========================================================
  BAIXA_NOTAS: {
    verificarVencidas(notas: NotaFiscalItem[], dataReferencia: Date = new Date()) {
      return notas.filter(nf => {
        // PAGA é um estado legado sem prova da origem. Só o registro manual atual
        // deve retirar a nota da lista de vencimentos locais.
        return vencimentoInformadoPassou(nf.dataVencimento, dataReferencia) && nf.status !== "PAGA_INFORMADA";
      });
    },
    verificarVencimentosProximos(notas: NotaFiscalItem[], dataReferencia: Date = new Date(), diasAlerta = 7) {
      return notas.filter(nf =>
        classificarVencimentoInformado(nf.dataVencimento, dataReferencia, diasAlerta) === 'PROXIMA'
        && nf.status !== 'PAGA_INFORMADA'
      );
    }
  },

  // ==========================================================
  // 🧮 CALCULADORA FISCAL — MOTOR DE CÁLCULOS
  // ==========================================================
  CALCULADORA_FISCAL: {
    NOME: "🧮 CALCULADORA FISCAL — FISCOIA",

    calcularICMS(valorSaida: number, valorEntrada: number, aliqICMS: number) {
      const debito = (valorSaida * aliqICMS) / 100;
      const credito = (valorEntrada * aliqICMS) / 100;
      return { 
        tipo: "ICMS", 
        aliquota: `${aliqICMS}%`, 
        debito, 
        credito, 
        aPagar: Math.max(0, debito - credito) 
      };
    },

    calcularPisCofins(valorBase: number, aliqPIS: number, aliqCOFINS: number, regime: RegimeTributario = "PRESUMIDO") {
      const PIS = (valorBase * aliqPIS) / 100;
      const COFINS = (valorBase * aliqCOFINS) / 100;
      return { 
        tipo: "PIS/COFINS", 
        regime, 
        valorBase,
        aliqPIS,
        aliqCOFINS,
        PIS, 
        COFINS,
        total: PIS + COFINS
      };
    },

    calcularSimples(baseMensal: number, aliquotaEfetiva: number) {
      const DAS_Mensal = baseMensal * (aliquotaEfetiva / 100);
      return { 
        tipo: "Estimativa manual do DAS",
        baseMensal,
        aliquota: `${aliquotaEfetiva}%`,
        DAS_Mensal 
      };
    },

    calcularIBS_CBS(valorBase: number, aliquotaIBS: number, aliquotaCBS: number) {
      const IBS = valorBase * (aliquotaIBS / 100);
      const CBS = valorBase * (aliquotaCBS / 100);
      return { 
        tipo: "Estimativa manual de IBS + CBS",
        valorBase, 
        aliquotaIBS,
        aliquotaCBS,
        IBS, 
        CBS, 
        total: IBS + CBS 
      };
    }
  },

  // ==========================================================
  // 📦 BANCO DE NOTAS EM MEMÓRIA / STORAGE
  // ==========================================================
  obterNotasIniciais(): { saidas: NotaFiscalItem[]; entradas: NotaFiscalItem[] } {
    // Não semear notas de exemplo como se fossem dados de clientes.
    return { saidas: [], entradas: [] };
  }
};
