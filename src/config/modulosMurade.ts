export interface ModuloMurade {
  id: 'fiscal' | 'contabil' | 'dp';
  nome: string;
  descricao: string;
  url: string;
  healthPath: string;
}

const limparUrl = (url: string) => url.trim().replace(/\/$/, '');

export const MODULOS_MURADE: ModuloMurade[] = [
  {
    id: 'fiscal',
    nome: 'Murade Fiscal',
    descricao: 'Notas fiscais, escrituração e apuração.',
    url: limparUrl(import.meta.env.VITE_MURADE_FISCAL_URL || 'https://murade-fiscal-1.onrender.com'),
    healthPath: '/health',
  },
  {
    id: 'contabil',
    nome: 'Murade Contábil',
    descricao: 'Lançamentos, plano de contas e relatórios contábeis.',
    url: limparUrl(import.meta.env.VITE_MURADE_CONTABIL_URL || 'https://murade-contabil.onrender.com'),
    healthPath: '/api/health',
  },
  {
    id: 'dp',
    nome: 'Murade Departamento Pessoal',
    descricao: 'Funcionários, folha e rotinas de DP.',
    url: limparUrl(import.meta.env.VITE_MURADE_DP_URL || 'https://murade-dp.onrender.com'),
    healthPath: '/api/health',
  },
];
