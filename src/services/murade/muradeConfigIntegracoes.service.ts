// ==================================================
// Módulos independentes. Integrações entre sistemas ainda não estão implementadas.
// ==================================================

export type SistemaMurade = 'FISCO_IA' | 'FISCAL' | 'DP_CONTABIL' | 'DESCONHECIDO';

export interface ConfigPorSistema {
  conectaComFiscal?: boolean;
  conectaComDP?: boolean;
  conectaComContabil?: boolean;
  modo?: string;
  buscarApenasGov?: boolean;
  recebeFiscoIa?: boolean;
  enviaParaFiscoIa?: boolean;
  mostraIntegracoesCliente: boolean;
  continuaFuncionando?: boolean;
  adminVisaTudo: boolean;
}

export interface MuradeConfigType {
  versao: string;
  acao: string;
  sistemaAtual: SistemaMurade;
  config: {
    FISCO_IA: {
      conectaComFiscal: boolean;      // ❌ DESLIGADO
      conectaComDP: boolean;          // ❌ DESLIGADO
      conectaComContabil: boolean;    // ❌ DESLIGADO
      modo: 'INDEPENDENTE';           // ✅ SÓ BUSCA NO GOVERNO
      buscarApenasGov: boolean;
      mostraIntegracoesCliente: boolean;
      adminVisaTudo: boolean;
    };
    FISCAL: {
      recebeFiscoIa: boolean;         // ❌ NÃO RECEBE FISCO IA
      enviaParaFiscoIa: boolean;      // ❌ NÃO MANDA PRO FISCO IA
      mostraIntegracoesCliente: boolean; // 🔒 OCULTA DO CLIENTE
      adminVisaTudo: boolean;           // ✅ VOCÊ VÊ TUDO
    };
    DP_CONTABIL: {
      mostraIntegracoesCliente: boolean; // 🔒 OCULTA CONEXÃO COM FISCAL
      continuaFuncionando: boolean;
      adminVisaTudo: boolean;
    };
  };
  setSistema: (sistema: SistemaMurade) => void;
  deveOcultarIntegracoes: (ehAdmin?: boolean) => boolean;
  aplicar: (ehAdminParam?: boolean) => { sistema: SistemaMurade; cfg: any; aplicado: boolean };
}

// Declaração de tipo global no Window
declare global {
  interface Window {
    MURADE_CONFIG?: MuradeConfigType;
  }
}

// Detecta qual sistema está rodando através de URL, parâmetros ou storage
function detectarSistema(): SistemaMurade {
  if (typeof window === 'undefined') return 'DESCONHECIDO';

  // O seletor identifica a tela configurada; não inicia integrações entre sistemas.
  try {
    const salvo = localStorage.getItem('murade_sistema_ativo');
    if (salvo === 'FISCO_IA' || salvo === 'FISCAL' || salvo === 'DP_CONTABIL') {
      return salvo as SistemaMurade;
    }
  } catch (e) {
    // fallback
  }

  const url = window.location.href.toLowerCase();
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();

  if (url.includes('fisco-ia') || url.includes('fiscoia') || path.includes('fiscoia') || hash.includes('fiscoia')) {
    return 'FISCO_IA';
  }
  if (url.includes('fiscal') || path.includes('fiscal') || hash.includes('fiscal')) {
    return 'FISCAL';
  }
  if (url.includes('dp') || url.includes('pessoal') || url.includes('contabil') || path.includes('dp') || hash.includes('dp')) {
    return 'DP_CONTABIL';
  }

  // Padrão no applet do Fisco IA Central
  return 'FISCO_IA';
}

export const MURADE_CONFIG: MuradeConfigType = {
  versao: '1.0.0',
  acao: 'MÓDULOS INDEPENDENTES — INTEGRAÇÕES NÃO CONFIGURADAS',

  // DETECTA QUAL SISTEMA ESTÁ RODANDO
  sistemaAtual: detectarSistema(),

  // ==============================================
  // ⚙️ CONFIGURAÇÕES POR SISTEMA
  // ==============================================
  config: {
    FISCO_IA: {
      conectaComFiscal: false,      // ❌ DESLIGADO
      conectaComDP: false,          // ❌ DESLIGADO
      conectaComContabil: false,    // ❌ DESLIGADO
      modo: 'INDEPENDENTE',         // ✅ SÓ BUSCA NO GOVERNO
      buscarApenasGov: true,
      mostraIntegracoesCliente: false,
      adminVisaTudo: true
    },
    FISCAL: {
      recebeFiscoIa: false,         // ❌ NÃO RECEBE FISCO IA
      enviaParaFiscoIa: false,      // ❌ NÃO MANDA PRO FISCO IA
      mostraIntegracoesCliente: false, // 🔒 OCULTA DO CLIENTE
      adminVisaTudo: true           // ✅ VOCÊ VÊ TUDO
    },
    DP_CONTABIL: {
      mostraIntegracoesCliente: false, // 🔒 OCULTA CONEXÃO COM FISCAL
      continuaFuncionando: false,
      adminVisaTudo: true
    }
  },

  // Permite selecionar o sistema ativo no ambiente
  setSistema(novo: SistemaMurade) {
    this.sistemaAtual = novo;
    try {
      localStorage.setItem('murade_sistema_ativo', novo);
    } catch (e) {
      // fallback
    }
    this.aplicar();
  },

  // Os módulos não devem ocultar menus nem executar integrações por baixo.
  deveOcultarIntegracoes(_ehAdmin?: boolean) { return false; },

  // ==============================================
  // 🚀 APLICA AUTOMATICAMENTE
  // ==============================================
  aplicar(_ehAdminParam?: boolean) {
    const sistema = this.sistemaAtual === 'DESCONHECIDO' ? 'FISCO_IA' : this.sistemaAtual;
    const cfg = this.config[sistema];
    return { sistema, cfg, aplicado: true };
  }
};

// Registra globalmente no objeto window
if (typeof window !== 'undefined') {
  window.MURADE_CONFIG = MURADE_CONFIG;

}

export default MURADE_CONFIG;
