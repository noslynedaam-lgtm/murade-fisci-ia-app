// ==================================================
// 🔒 MURADE — DESVINCULAR + OCULTAR INTEGRAÇÕES
// ✅ MESMO CÓDIGO PRA FISCO IA / FISCAL / DP-CONTÁBIL
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
      continuaFuncionando: boolean;   // ✅ CONTINUA TROCANDO DADOS POR BAIXO
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

  // Permite override salvo no localStorage para testes entre os 3 sistemas
  try {
    const salvo = localStorage.getItem('murade_sistema_ativo') || localStorage.getItem('murade_sistema_simulado');
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
  acao: 'DESVINCULAR_OCULTAR',

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
      continuaFuncionando: true,   // ✅ CONTINUA TROCANDO DADOS POR BAIXO
      adminVisaTudo: true
    }
  },

  // Permite selecionar o sistema ativo no ambiente
  setSistema(novo: SistemaMurade) {
    this.sistemaAtual = novo;
    try {
      localStorage.setItem('murade_sistema_ativo', novo);
      localStorage.setItem('murade_sistema_simulado', novo);
    } catch (e) {
      // fallback
    }
    this.aplicar();
  },

  // Helper para componentes verificarem se devem ocultar integrações
  deveOcultarIntegracoes(ehAdmin?: boolean) {
    // Se o usuário é Admin e a configuração ativa o adminVisaTudo, ele vê tudo
    const sistema = this.sistemaAtual === 'DESCONHECIDO' ? 'FISCO_IA' : this.sistemaAtual;
    const cfg = this.config[sistema];

    if (ehAdmin && cfg.adminVisaTudo) {
      return false; // Não oculta do admin
    }

    // Para clientes comuns, oculta se configurado mostraIntegracoesCliente: false
    return !cfg.mostraIntegracoesCliente;
  },

  // ==============================================
  // 🚀 APLICA AUTOMATICAMENTE
  // ==============================================
  aplicar(ehAdminParam?: boolean) {
    const sistema = this.sistemaAtual === 'DESCONHECIDO' ? 'FISCO_IA' : this.sistemaAtual;
    const cfg = this.config[sistema];

    console.log('='.repeat(50));
    console.log(`🔒 APLICANDO CONFIG — ${sistema}`);
    console.log('='.repeat(50));

    if (sistema === 'FISCO_IA') {
      console.log('❌ FISCO IA → DESCONECTADO DO FISCAL');
      console.log('✅ FISCO IA → INDEPENDENTE — BUSCA SÓ NO GOVERNO');
    }
    if (sistema === 'FISCAL') {
      console.log('❌ FISCAL → DESCONECTADO DO FISCO IA');
      console.log('🔒 FISCAL → CONEXÕES DP/CONTÁBIL OCULTAS DO CLIENTE');
    }
    if (sistema === 'DP_CONTABIL') {
      console.log('🔒 DP/CONTÁBIL → CONEXÕES OCULTAS DO CLIENTE');
      console.log('✅ INTEGRAÇÃO CONTINUA FUNCIONANDO — SÓ ADMIN VÊ');
    }

    // Identifica se é admin via sessão ou parâmetro
    let usuarioAdmin = ehAdminParam;
    if (usuarioAdmin === undefined && typeof window !== 'undefined') {
      try {
        const sessao = localStorage.getItem('fiscoia_sessao_usuario');
        if (sessao) {
          const u = JSON.parse(sessao);
          usuarioAdmin = Boolean(u.ehAdmin || u.tipo === 'ADMIN');
        }
      } catch (e) {
        // fallback
      }
    }

    // OCULTA ELEMENTOS DE INTEGRAÇÃO DA TELA DO CLIENTE
    if (typeof document !== 'undefined') {
      setTimeout(() => {
        const elementosOcultar = [
          '.integracao', '.conexao', '.sincronizacao',
          '.fiscoia-link', '.dp-link', '.contabil-link',
          '[data-integracao]', '#aba-integracoes'
        ];

        // Se for admin e adminVisaTudo for verdadeiro, mantém visível
        const ocultar = !usuarioAdmin && !cfg.mostraIntegracoesCliente;

        elementosOcultar.forEach(seletor => {
          document.querySelectorAll(seletor).forEach(el => {
            (el as HTMLElement).style.display = ocultar ? 'none' : '';
          });
        });

        if (ocultar) {
          console.log('✅ Elementos de integração ocultos da tela do cliente!');
        } else {
          console.log('👁️ Modo Administrador — Exibindo todas as conexões (adminVisaTudo: true)');
        }

        // Notifica componentes React que a configuração de ocultação foi aplicada
        window.dispatchEvent(new CustomEvent('murade_config_atualizado', {
          detail: { sistema, cfg, ocultar, usuarioAdmin }
        }));
      }, 300);
    }

    return { sistema, cfg, aplicado: true };
  }
};

// Registra globalmente no objeto window
if (typeof window !== 'undefined') {
  window.MURADE_CONFIG = MURADE_CONFIG;

  // 🚀 EXECUTA AUTOMATICAMENTE AO CARREGAR
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      MURADE_CONFIG.aplicar();
    });
  } else {
    MURADE_CONFIG.aplicar();
  }

  // Monitora alterações de histórico e login
  window.addEventListener('popstate', () => MURADE_CONFIG.aplicar());
  window.addEventListener('storage', (e) => {
    if (e.key === 'fiscoia_sessao_usuario' || e.key === 'murade_sistema_simulado') {
      MURADE_CONFIG.aplicar();
    }
  });
}

export default MURADE_CONFIG;
