import { PlanoConfig } from '../types';

export const PLANOS: Record<string, PlanoConfig> = {
  BASICO: {
    id: 'basico',
    nome: 'Básico',
    maxCnpjs: 50,
    valorMensal: 199.90,
    valorAnual: 2038.98,
    descontoAnual: 15,
    funcionalidades: [
      'Cadastro e seleção local de empresas',
      'Agenda com lembretes manuais',
      'Importação manual de XML para conferência local',
      'Relatórios locais disponíveis'
    ],
    oQueEstaIncluido: [
      'Limite de referência: 50 CNPJs; não aplicado por serviço central',
      'Dashboard e registros fiscais locais',
      'Registro manual de guias; emissão oficial não conectada',
      'Registro manual de CND; consulta oficial não conectada',
      'Relatórios e exportações locais disponíveis'
    ]
  },
  PROFISSIONAL: {
    id: 'profissional',
    nome: 'Profissional',
    maxCnpjs: 100,
    valorMensal: 349.90,
    valorAnual: 3568.98,
    descontoAnual: 15,
    funcionalidades: [
      'Recursos locais do plano Básico',
      'Controle local de guias; DCTFWeb não conectada',
      'Registro de informações; parcelamentos não integrados',
      'Minuta local; e-CAC não conectado',
      'Assistente fiscal; fontes oficiais não integradas'
    ],
    oQueEstaIncluido: [
      'Limite de referência: 100 CNPJs; não aplicado por serviço central',
      'Recursos locais do plano Básico',
      'Registros locais de guias; consulta/transmissão DCTFWeb e eSocial não conectadas',
      'Parcelamentos não integrados',
      'Minuta local; concessão de procuração no e-CAC não conectada',
      'Assistente fiscal sem fontes oficiais conectadas'
    ]
  },
  EMPRESARIAL: {
    id: 'empresarial',
    nome: 'Empresarial',
    maxCnpjs: 500,
    valorMensal: 599.90,
    valorAnual: 6118.98,
    descontoAnual: 15,
    funcionalidades: [
      'Recursos locais do plano Profissional',
      'Controle local de guias; DCTFWeb não conectada',
      'Apuração e transmissão oficiais não conectadas',
      'Canal de suporte não configurado',
      'Pagamentos automáticos não integrados'
    ],
    oQueEstaIncluido: [
      'Limite de referência: 500 CNPJs; não aplicado por serviço central',
      'Recursos locais do plano Profissional',
      'Guias não são calculadas, emitidas ou consultadas oficialmente',
      'Transmissão automática RFB/e-CAC não conectada',
      'Pagamentos automáticos não integrados',
      'Suporte VIP não configurado'
    ]
  }
};

export const VERIFICA_PERMISSAO = (planoId: string, modulo: string): boolean => {
  const regras: Record<string, string[]> = {
    dctfweb: ['empresarial'],
    procuracao: ['profissional', 'empresarial'],
    dctfWeb: ['profissional', 'empresarial'],
    parcelamentos: ['profissional', 'empresarial'],
    iaFiscal: ['profissional', 'empresarial']
  };
  return regras[modulo]?.includes(planoId) ?? true;
};
