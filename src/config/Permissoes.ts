import { UsuarioAuth } from '../types';

/**
 * 🔒 TIPOS DE USUÁRIO DO FISCOIA
 * - ADMIN: Murade (Diretoria / Administrador Master) -> Vê TUDO!
 * - CONTADOR: Cliente (Contabilidade / Escritório) -> Acesso restrito ao trabalho contábil.
 */
export const TIPOS_USUARIO = {
  ADMIN: 'ADMIN',
  CONTADOR: 'CONTADOR',
} as const;

export type TipoUsuario = typeof TIPOS_USUARIO[keyof typeof TIPOS_USUARIO];

// E-mails reconhecidos como Administrador Master (Murade)
export const EMAILS_ADMIN: string[] = [
  'seuemail@fiscoia.com.br',
  'admin@murade.com.br',
  'noslyneda.murad@gmail.com',
  'murade@fiscoia.com.br',
  'diretoria@murade.com.br'
];

/**
 * Verifica se um determinado e-mail ou usuário é Administrador Master (Murade)
 */
export function ehUsuarioAdmin(usuarioOuEmail?: Partial<UsuarioAuth> | string | null): boolean {
  if (!usuarioOuEmail) return false;

  if (typeof usuarioOuEmail === 'string') {
    const emailLimpo = usuarioOuEmail.toLowerCase().trim();
    return (
      EMAILS_ADMIN.some(e => e.toLowerCase() === emailLimpo) ||
      emailLimpo.includes('murade') ||
      emailLimpo.startsWith('admin@')
    );
  }

  if (usuarioOuEmail.ehAdmin === true || usuarioOuEmail.tipo === TIPOS_USUARIO.ADMIN) {
    return true;
  }

  const email = usuarioOuEmail.email?.toLowerCase().trim();
  return (
    EMAILS_ADMIN.some(e => e.toLowerCase() === email) ||
    (email ? email.includes('murade') || email.startsWith('admin@') : false)
  );
}

/**
 * Define o tipo de usuário no momento do login
 */
export function determinarTipoUsuario(email: string): TipoUsuario {
  return ehUsuarioAdmin(email) ? TIPOS_USUARIO.ADMIN : TIPOS_USUARIO.CONTADOR;
}

/**
 * Matriz de Permissões: o que cada perfil pode ver ou acessar
 */
export interface PermissaoModulo {
  id: string;
  nome: string;
  adminApenas: boolean;
  descricao: string;
}

export const MODULOS_SISTEMA: Record<string, PermissaoModulo> = {
  dashboard: {
    id: 'dashboard',
    nome: 'Início',
    adminApenas: false,
    descricao: 'Dashboard geral de compliance e alertas fiscais'
  },
  empresas: {
    id: 'empresas',
    nome: 'Empresas',
    adminApenas: false,
    descricao: 'Gestão de CNPJs cadastrados'
  },
  agenda: {
    id: 'agenda',
    nome: 'Fiscal - Agenda',
    adminApenas: false,
    descricao: 'Calendário de vencimento de obrigações fiscais'
  },
  dctfweb: {
    id: 'dctfweb',
    nome: 'Pessoal - DCTFWeb & Guias INSS',
    adminApenas: false,
    descricao: 'Consulta direta à Receita Federal e emissão de DARF INSS com encargos'
  },
  guias: {
    id: 'guias',
    nome: 'Guias Fiscais',
    adminApenas: false,
    descricao: 'Geração e cálculo de DAS, DARF e guias tributárias'
  },
  procuracao: {
    id: 'procuracao',
    nome: 'Fiscal - Procuração RFB',
    adminApenas: false,
    descricao: 'Procuração eletrônica Receita Federal e-CAC'
  },
  iaFiscal: {
    id: 'iaVoz',
    nome: 'IA Murad (Voz & Fiscal)',
    adminApenas: false,
    descricao: 'Consultoria e auditoria tributária com a IA Murad Voz Natural'
  },
  videoAulas: {
    id: 'videoAulas',
    nome: 'Vídeo Aulas',
    adminApenas: false,
    descricao: 'Treinamentos e tutoriais passo a passo em vídeo'
  },
  minhaConta: {
    id: 'minhaConta',
    nome: 'Minha Conta',
    adminApenas: false,
    descricao: 'Dados cadastrais do contador, CRC e segurança'
  },
  // 👑 RECURSOS EXCLUSIVOS MURADE (ADMINISTRADOR)
  admin: {
    id: 'admin',
    nome: 'Painel MURADE',
    adminApenas: true,
    descricao: 'Controle mestre de clientes, contadores e gestão do sistema'
  },
  faturamento: {
    id: 'faturamento',
    nome: 'Faturamento Murade',
    adminApenas: true,
    descricao: 'Relatórios de faturamento e recebimento de mensalidades'
  },
  bloqueio: {
    id: 'bloqueio',
    nome: 'Bloqueio de Inadimplentes',
    adminApenas: true,
    descricao: 'Suspensão e liberação de acessos de contadores'
  },
  precos: {
    id: 'precos',
    nome: 'Preços & Planos Murade',
    adminApenas: true,
    descricao: 'Configuração de valores de mensalidades e limites de CNPJ'
  },
  planos: {
    id: 'planos',
    nome: 'Controle de Assinaturas',
    adminApenas: true,
    descricao: 'Gestão executiva de planos de assinatura da plataforma'
  }
};

/**
 * Valida se um usuário pode acessar um módulo específico
 */
export function temPermissao(usuario: UsuarioAuth | null | undefined, moduloId: string): boolean {
  if (!usuario) return false;
  const isAdmin = ehUsuarioAdmin(usuario);
  if (isAdmin) return true; // Murade vê TUDO!

  const modulo = MODULOS_SISTEMA[moduloId];
  if (!modulo) return false;

  // Se for módulo exclusivo do admin, contador não pode ver
  return !modulo.adminApenas;
}

/**
 * 📋 Retorna a lista de nomes/módulos permitidos conforme o perfil do usuário
 * Murade (Admin): Vê tudo
 * Contador: Acesso restrito ao trabalho contábil
 */
export function obterMenuPermitido(tipoOuUsuario?: string | UsuarioAuth | null): string[] {
  const isAdmin = ehUsuarioAdmin(typeof tipoOuUsuario === 'string' ? { tipo: tipoOuUsuario as any } : tipoOuUsuario);
  
  if (isAdmin) {
    return [
      'Painel MURADE',
      'Faturamento',
      'Bloqueio de Inadimplentes',
      'Preços & Planos',
      'Início',
      'Empresas',
      'Fiscal (Agenda)',
      'CND / Certidões',
      'Guias DCTFWeb / Receita Federal',
      'Guias Fiscais',
      'Procuração RFB',
      'IA Fiscal',
      'Vídeo Aulas',
      'Minha Conta'
    ];
  }

  return [
    'Início',
    'Empresas',
    'Fiscal (Agenda)',
    'CND / Certidões',
    'Guias DCTFWeb / Receita Federal',
    'Guias Fiscais',
    'Procuração RFB',
    'IA Fiscal',
    'Vídeo Aulas',
    'Minha Conta'
  ];
}
