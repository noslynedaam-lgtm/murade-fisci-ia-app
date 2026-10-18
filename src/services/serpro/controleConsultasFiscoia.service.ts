/**
 * Consulta oficial ainda indisponível: este app não tem autenticação SERPRO,
 * APIs dos módulos Fiscal/DP nem processamento de cobrança implementados.
 * Esses métodos preservam a interface antiga sem inventar dados ou registrar custos.
 */

export interface RegistroConsultaExtra {
  dataHora: string;
  tipo: string;
  valor: number;
  descricao: string;
}

export interface ClienteControleFiscoia {
  cnpj: string;
  nome: string;
  proximaAtualizacaoSemanal: string;
  ultimoCache: string | null;
  consultasExtrasMes: RegistroConsultaExtra[];
  totalACobrarMes: number;
  dadosUltimaConsulta?: unknown;
}

export interface VerificacaoConsulta {
  pode: boolean;
  gratuito: boolean;
  mensagem: string;
  aviso?: string;
  custo: number;
  proximaAtualizacao: string;
  diasRestantes?: number;
  horasRestantes?: number;
  botaoConfirmar?: string;
  botaoCancelar?: string;
}

export interface ResultadoConsultaControlada {
  sucesso: boolean;
  mensagem: string;
  valorCobrado: number;
  totalAcumulado: number;
  gratuito?: boolean;
  dados: unknown;
}

const indisponivel = 'Consulta não realizada: autenticação SERPRO e integrações oficiais ainda não estão configuradas. Nenhuma cobrança foi registrada.';

export const FISCOIA_CONTROLE_CONSULTAS = {
  NOME: 'FiscoIA — consultas oficiais',
  VERSAO: 'Indisponível até configurar integrações',
  VALORES: { CONSULTA_ANTECIPADA: 0, MOEDA: 'R$' },
  CLIENTES: {} as Record<string, ClienteControleFiscoia>,
  salvar(): void {},
  definirProximaSegunda(): Date { return new Date(Number.NaN); },
  podeBuscarAgora(_cnpj: string, _nome = 'Cliente'): VerificacaoConsulta {
    return { pode: false, gratuito: false, mensagem: indisponivel, custo: 0, proximaAtualizacao: 'Indisponível' };
  },
  async confirmarEBuscar(_cnpj: string, _tipo = 'Conferir Agora'): Promise<ResultadoConsultaControlada> {
    return { sucesso: false, mensagem: indisponivel, valorCobrado: 0, totalAcumulado: 0, gratuito: false, dados: null };
  },
  obterDadosSalvos(_cnpj: string): any { return null; },
  async buscarDadosReais(_cnpj: string, _tipo: string, _forcar = false): Promise<null> { return null; },
  compararDados(_serpro: unknown, _fiscal: unknown, _dp: unknown) {
    return { tudoCerto: false, divergencias: [], mensagem: indisponivel, detalhesComparacao: null };
  },
  async irNaSerpro(_cnpj: string, _tipo: string): Promise<null> { return null; },
  async buscarNoFiscal(_cnpj: string, _tipo: string): Promise<null> { return null; },
  async buscarNoDP(_cnpj: string, _tipo: string): Promise<null> { return null; },
  relatorioCliente(_cnpj: string): any { return { erro: indisponivel, totalConsultasExtras: 0, totalACobrar: 'R$ 0,00', totalACobrarNumero: 0, proximaAtualizacaoGratis: 'Indisponível', detalheConsultas: [] }; },
  relatorioGeral() { return { totalClientes: 0, totalConsultasGeral: 0, totalACobrarGeral: 'R$ 0,00', totalACobrarGeralNumero: 0, detalhesPorCliente: [] }; },
  fecharMesFaturamento() { return { sucesso: false, mensagem: 'Não há módulo de cobrança configurado.' }; }
};
