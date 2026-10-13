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
  status: 'PENDENTE' | 'PAGA' | 'VENCIDA';
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
}

export interface NotaBaixada {
  chaveAcesso: string;
  dataPagamento: string;
  valorPago: number;
  status: string;
  dataBaixa: string;
}

export interface ResultadoApuracao {
  periodo: string;
  uf: UF;
  regime: RegimeTributario;
  ICMS_A_PAGAR: number;
  PIS_A_PAGAR: number;
  COFINS_A_PAGAR: number;
  DAS_A_PAGAR: number;
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
  status: string;
}

export const FISCOIA_FISCAL = {
  NOME: "FISCOIA — MÓDULO FISCAL COMPLETO",
  VERSAO: "3.2.1 — CORRIGIDO",
  ATIVO: true,

  // ==========================================================
  // 🇧🇷 ALÍQUOTAS — BRASIL INTEIRO (27 UFs)
  // ==========================================================
  ALIQ_ICMS: {
    AC: 17, AL: 18, AM: 18, AP: 18, BA: 18, CE: 18, DF: 18, ES: 17, GO: 17, MA: 18, MG: 18,
    MS: 17, MT: 17, PA: 17, PB: 18, PE: 18, PI: 17, PR: 18, RJ: 18, RN: 18, RO: 17.5,
    RR: 17, RS: 17, SC: 17, SE: 18, SP: 18, TO: 18, interestadual: 12
  } as Record<UF | 'interestadual', number>,

  REGIMES: {
    PRESUMIDO: { nome: "Lucro Presumido", PIS: 0.65, COFINS: 3.00, IRPJ: 15, CSLL: 9 },
    REAL:      { nome: "Lucro Real",      PIS: 1.65, COFINS: 7.60, IRPJ: 15, CSLL: 9 },
    SIMPLES:   { nome: "Simples Nacional", PIS: 0,    COFINS: 0,    DAS: true }
  },

  SIMPLES: {
    ANEXOS: {
      I:   { desc: "Comércio" },
      II:  { desc: "Indústria" },
      III: { desc: "Serviços" },
      IV:  { desc: "Transp/Comun" },
      V:   { desc: "Profissão" }
    },
    FAIXAS_DAS: [
      { lim: 180000,  alq: 6.0 },
      { lim: 360000,  alq: 8.4 },
      { lim: 720000,  alq: 10.2 },
      { lim: 1800000, alq: 11.4 },
      { lim: 3600000, alq: 14.5 },
      { lim: 4800000, alq: 16.0 }
    ],
    CST_ICMS: "90",
    CREDITO_ICMS: false
  },

  REFORMA_TRIBUTARIA: { 
    IBS: 12.0, 
    CBS: 9.0 
  },

  // ==========================================================
  // 📤 CALCULAR IMPOSTOS DA NFE
  // ==========================================================
  calcularImpostos(
    nf: Partial<NotaFiscalItem>, 
    uf: UF = 'GO', 
    regime: RegimeTributario = "PRESUMIDO", 
    anexoSimples: string | null = null
  ): NotaFiscalItem {
    const valor = Number(nf.valorProdutos) || 0;
    const ufDest = (nf.ufDestino as UF) || uf;
    const aliqICMS = ufDest === uf ? this.ALIQ_ICMS[uf] : this.ALIQ_ICMS.interestadual;
    const reg = this.REGIMES[regime];
    let ICMS_valor = 0, PIS_valor = 0, COFINS_valor = 0, DAS_valor = 0;
    let CST_ICMS = ufDest === uf ? "00" : "10";

    if (regime === "SIMPLES") {
      CST_ICMS = this.SIMPLES.CST_ICMS;
      if (anexoSimples) {
        DAS_valor = valor * (this.SIMPLES.FAIXAS_DAS[0].alq / 100);
      } else {
        DAS_valor = valor * 0.06;
      }
    } else {
      ICMS_valor = (valor * aliqICMS) / 100;
      PIS_valor = (valor * reg.PIS) / 100;
      COFINS_valor = (valor * reg.COFINS) / 100;
    }

    return {
      chave: nf.chave || `NFE-${Math.floor(100000000 + Math.random() * 900000000)}`,
      numero: nf.numero || String(Math.floor(1000 + Math.random() * 9000)),
      serie: nf.serie || "1",
      dataEmissao: nf.dataEmissao || new Date().toISOString().split('T')[0],
      dataVencimento: nf.dataVencimento || new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      clienteOuFornecedor: nf.clienteOuFornecedor || 'Cliente / Fornecedor Padrão',
      cnpjParceiro: nf.cnpjParceiro || '00.000.000/0001-00',
      tipo: nf.tipo || 'SAIDA',
      valorProdutos: valor,
      valorTotal: Number(nf.valorTotal) || valor,
      status: nf.status || 'PENDENTE',
      ICMS_aliq: aliqICMS,
      ICMS_valor,
      ICMS_cst: CST_ICMS,
      PIS_aliq: reg.PIS,
      PIS_valor,
      COFINS_aliq: reg.COFINS,
      COFINS_valor,
      DAS_valor,
      regime,
      ufOrigem: uf,
      ufDestino: ufDest
    };
  },

  // ==========================================================
  // ⚖️ APURAÇÃO — SAÍDA - ENTRADA = VALOR A PAGAR
  // ==========================================================
  apurar(
    notasSaida: NotaFiscalItem[], 
    notasEntrada: NotaFiscalItem[] = [], 
    uf: UF = 'GO', 
    mes: string = '09', 
    ano: string = '2026', 
    regime: RegimeTributario = "PRESUMIDO"
  ): ResultadoApuracao {
    const totalSaida = { 
      ICMS: notasSaida.reduce((s, n) => s + (n.ICMS_valor || 0), 0), 
      PIS: notasSaida.reduce((s, n) => s + (n.PIS_valor || 0), 0), 
      COFINS: notasSaida.reduce((s, n) => s + (n.COFINS_valor || 0), 0),
      DAS: notasSaida.reduce((s, n) => s + (n.DAS_valor || 0), 0) 
    };
    
    const totalEntrada = regime === "SIMPLES" 
      ? { ICMS: 0, PIS: 0, COFINS: 0 } 
      : { 
          ICMS: notasEntrada.reduce((s, n) => s + (n.ICMS_valor || 0), 0), 
          PIS: notasEntrada.reduce((s, n) => s + (n.PIS_valor || 0), 0), 
          COFINS: notasEntrada.reduce((s, n) => s + (n.COFINS_valor || 0), 0) 
        };

    return {
      periodo: `${mes}/${ano}`, 
      uf, 
      regime,
      ICMS_A_PAGAR: regime === "SIMPLES" ? 0 : Math.max(0, totalSaida.ICMS - totalEntrada.ICMS),
      PIS_A_PAGAR: regime === "SIMPLES" ? 0 : Math.max(0, totalSaida.PIS - totalEntrada.PIS),
      COFINS_A_PAGAR: regime === "SIMPLES" ? 0 : Math.max(0, totalSaida.COFINS - totalEntrada.COFINS),
      DAS_A_PAGAR: totalSaida.DAS,
      totalSaida, 
      totalEntrada,
      status: "✅ APURADO — FISCOIA"
    };
  },

  // ==========================================================
  // ✅ BAIXA DE NOTAS — MARCAR PAGAS / VENCIDAS
  // ==========================================================
  BAIXA_NOTAS: {
    STORAGE_KEY: 'fiscoia_notas_baixadas',

    obterBaixadas(): NotaBaixada[] {
      try {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {
        console.error('Erro ao ler baixas do storage:', e);
      }
      return [
        {
          chaveAcesso: '52260912345678000190550010000012541009876543',
          dataPagamento: '10/09/2026',
          valorPago: 4580.00,
          status: 'PAGA',
          dataBaixa: '10/09/2026'
        }
      ];
    },

    registrarBaixa(chaveAcesso: string, dataPagamento: string, valorPago: number, status: string = "PAGA") {
      const baixadas = this.obterBaixadas();
      const novoRegistro: NotaBaixada = {
        chaveAcesso, 
        dataPagamento, 
        valorPago, 
        status,
        dataBaixa: new Date().toLocaleDateString('pt-BR')
      };
      
      const atualizadas = baixadas.filter(b => b.chaveAcesso !== chaveAcesso);
      atualizadas.unshift(novoRegistro);
      
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(atualizadas));
      } catch (e) {
        console.error('Erro ao salvar baixa:', e);
      }

      return { sucesso: true, mensagem: `✅ Nota ${chaveAcesso} baixada com sucesso!` };
    },

    verificarVencidas(notas: NotaFiscalItem[], dataReferencia: Date = new Date()) {
      return notas.filter(nf => {
        if (!nf.dataVencimento) return false;
        const vencimento = new Date(nf.dataVencimento);
        return vencimento < dataReferencia && nf.status !== "PAGA";
      });
    }
  },

  // ==========================================================
  // 🧮 CALCULADORA FISCAL — MOTOR DE CÁLCULOS
  // ==========================================================
  CALCULADORA_FISCAL: {
    NOME: "🧮 CALCULADORA FISCAL — FISCOIA",

    calcularICMS(valorSaida: number, valorEntrada: number, aliqICMS: number = 18) {
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

    calcularPisCofins(valorBase: number, regime: RegimeTributario = "PRESUMIDO") {
      const aliqPIS = regime === "REAL" ? 1.65 : 0.65;
      const aliqCOFINS = regime === "REAL" ? 7.60 : 3.00;
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

    calcularSimples(faturamentoAnual: number) {
      const FAIXAS = [
        { lim: 180000,  alq: 6.0 },
        { lim: 360000,  alq: 8.4 },
        { lim: 720000,  alq: 10.2 },
        { lim: 1800000, alq: 11.4 },
        { lim: 3600000, alq: 14.5 },
        { lim: 4800000, alq: 16.0 }
      ];
      const faixa = FAIXAS.find(f => faturamentoAnual <= f.lim) || FAIXAS[FAIXAS.length - 1];
      const DAS_Mensal = (faturamentoAnual * (faixa.alq / 100)) / 12;
      return { 
        tipo: "Simples Nacional", 
        faturamentoAnual, 
        aliquota: `${faixa.alq}%`, 
        limiteFaixa: faixa.lim,
        DAS_Mensal 
      };
    },

    calcularIBS_CBS(valorBase: number) {
      const IBS = valorBase * 0.12;
      const CBS = valorBase * 0.09;
      return { 
        tipo: "IBS + CBS (Reforma Tributária)", 
        valorBase, 
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
    const saidas: NotaFiscalItem[] = [
      {
        chave: "52260912345678000190550010000012451001234567",
        numero: "1245",
        serie: "1",
        dataEmissao: "2026-09-12",
        dataVencimento: "2026-09-27",
        clienteOuFornecedor: "Varejo Centro-Oeste Distribuidora",
        cnpjParceiro: "12.345.678/0001-90",
        tipo: "SAIDA",
        valorProdutos: 15400.00,
        valorTotal: 15400.00,
        ufOrigem: "GO",
        ufDestino: "GO",
        regime: "PRESUMIDO",
        status: "PENDENTE",
        ICMS_aliq: 17,
        ICMS_valor: 2618.00,
        ICMS_cst: "00",
        PIS_aliq: 0.65,
        PIS_valor: 100.10,
        COFINS_aliq: 3.00,
        COFINS_valor: 462.00,
        DAS_valor: 0
      },
      {
        chave: "52260912345678000190550010000012461002345678",
        numero: "1246",
        serie: "1",
        dataEmissao: "2026-09-11",
        dataVencimento: "2026-09-26",
        clienteOuFornecedor: "Supermercados Estrela do Sul SP",
        cnpjParceiro: "23.456.789/0001-01",
        tipo: "SAIDA",
        valorProdutos: 28900.00,
        valorTotal: 28900.00,
        ufOrigem: "GO",
        ufDestino: "SP",
        regime: "PRESUMIDO",
        status: "PAGA",
        ICMS_aliq: 12,
        ICMS_valor: 3468.00,
        ICMS_cst: "10",
        PIS_aliq: 0.65,
        PIS_valor: 187.85,
        COFINS_aliq: 3.00,
        COFINS_valor: 867.00,
        DAS_valor: 0
      },
      {
        chave: "52260912345678000190550010000012471003456789",
        numero: "1247",
        serie: "1",
        dataEmissao: "2026-09-08",
        dataVencimento: "2026-09-01",
        clienteOuFornecedor: "Comercial de Embalagens Brasil",
        cnpjParceiro: "34.567.890/0001-12",
        tipo: "SAIDA",
        valorProdutos: 6200.00,
        valorTotal: 6200.00,
        ufOrigem: "GO",
        ufDestino: "DF",
        regime: "PRESUMIDO",
        status: "VENCIDA",
        ICMS_aliq: 12,
        ICMS_valor: 744.00,
        ICMS_cst: "10",
        PIS_aliq: 0.65,
        PIS_valor: 40.30,
        COFINS_aliq: 3.00,
        COFINS_valor: 186.00,
        DAS_valor: 0
      }
    ];

    const entradas: NotaFiscalItem[] = [
      {
        chave: "35260998765432000188550010000045801004567890",
        numero: "4580",
        serie: "1",
        dataEmissao: "2026-09-10",
        dataVencimento: "2026-09-25",
        clienteOuFornecedor: "Indústria de Insumos Paulista LTDA",
        cnpjParceiro: "98.765.432/0001-88",
        tipo: "ENTRADA",
        valorProdutos: 12500.00,
        valorTotal: 12500.00,
        ufOrigem: "SP",
        ufDestino: "GO",
        regime: "PRESUMIDO",
        status: "PAGA",
        ICMS_aliq: 12,
        ICMS_valor: 1500.00,
        ICMS_cst: "10",
        PIS_aliq: 0.65,
        PIS_valor: 81.25,
        COFINS_aliq: 3.00,
        COFINS_valor: 375.00,
        DAS_valor: 0
      },
      {
        chave: "52260987654321000177550010000078901005678901",
        numero: "7890",
        serie: "2",
        dataEmissao: "2026-09-09",
        dataVencimento: "2026-09-24",
        clienteOuFornecedor: "Agro Insumos Cerrado Goiano",
        cnpjParceiro: "87.654.321/0001-77",
        tipo: "ENTRADA",
        valorProdutos: 8400.00,
        valorTotal: 8400.00,
        ufOrigem: "GO",
        ufDestino: "GO",
        regime: "PRESUMIDO",
        status: "PENDENTE",
        ICMS_aliq: 17,
        ICMS_valor: 1428.00,
        ICMS_cst: "00",
        PIS_aliq: 0.65,
        PIS_valor: 54.60,
        COFINS_aliq: 3.00,
        COFINS_valor: 252.00,
        DAS_valor: 0
      }
    ];

    return { saidas, entradas };
  }
};
