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
      'Dashboard e Alertas',
      'Simples Nacional (DAS)',
      'Consulta CND',
      'Relatórios e Exportação'
    ],
    oQueEstaIncluido: [
      'Suporta até 50 CNPJs ativos',
      'Dashboard e Alertas Fiscais',
      'Simples Nacional (Geração de DAS)',
      'Consulta Automatizada de CND',
      'Relatórios e Exportação em PDF/Excel'
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
      'Tudo do Básico',
      'DCTFWeb',
      'Parcelamentos (PERT/RELP)',
      'Procuração Eletrônica',
      'Assistente IA Fiscal'
    ],
    oQueEstaIncluido: [
      'Tudo do Plano Básico incluso',
      'Suporta até 100 CNPJs ativos',
      'DCTFWeb e Fechamento eSocial',
      'Parcelamentos Ativos (PERT/RELP)',
      'Procuração Eletrônica e-CAC RFB',
      'Assistente IA Fiscal 24/7'
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
      'Tudo do Profissional',
      'DCTFWeb Completa',
      'Apuração e Transmissão DCTFWeb',
      'Prioridade no Suporte',
      'Requerimento de Pagamento Automático'
    ],
    oQueEstaIncluido: [
      'Tudo do Plano Profissional incluso',
      'Suporta até 500 CNPJs ativos',
      'DCTFWeb Completa e Geração de DARF Previdenciário (vencimento dia 20)',
      'Transmissão Automática RFB e-CAC',
      'Requerimento de Pagamento Automático',
      'Atendimento e Suporte VIP MURADE'
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
