import { obterConfigSerpro } from './serpro.service';
import { lerEmpresas } from '../empresas/empresas.service';
import { normalizarCnpj } from '../cnpj/cnpjValidation';
import { EmpresaDados } from '../../types';

export interface EtapaSincronizacao {
  id: string;
  titulo: string;
  descricao: string;
  status: 'pendente' | 'em_progresso' | 'concluido' | 'erro';
  detalhe?: string;
}

export interface ResultadoSincronizacaoSerpro {
  sucesso: boolean;
  timestamp: string;
  empresaSincronizada?: EmpresaDados;
  totalGuiasSincronizadas: number;
  situacaoCadastral: string;
  statusCND: string;
  procuracaoAtiva: boolean;
  certificadoVinculado: {
    arquivo: string;
    validade: string;
    emissor: string;
    cnpj: string;
  };
  etapas: EtapaSincronizacao[];
  mensagem: string;
}

export function obterUltimaSincronizacaoSerpro(): {
  dataHora: string;
  cnpj: string;
  razaoSocial: string;
  totalGuias: number;
} | null {
  // Não ler a marcação legada: ela era gravada mesmo quando não havia consulta SERPRO real.
  return null;
}

export function verificarStatusIntegracaoSerpro(): {
  integrado: boolean;
  ambiente: 'homologacao' | 'producao';
  certificadoAtivo: boolean;
  tokenAtivo: boolean;
  cnpjCertificado: string;
  arquivoCertificado: string;
  validadeCertificado: string;
  emissorCertificado: string;
  servicosConectados: number;
  totalServicos: number;
  ultimaSincronizacao: string | null;
  empresaVinculada: EmpresaDados | null;
  erroLeituraEmpresas?: string;
} {
  const config = obterConfigSerpro();
  const cert = config.certificadoA1;
  const certificadoAtivo = false;
  const tokenAtivo = false;
  const integrado = false;

  // Busca se há empresa cadastrada com o CNPJ do certificado
  const leituraEmpresas = lerEmpresas();
  const empresas = 'erro' in leituraEmpresas ? [] : leituraEmpresas.empresas;
  const cnpjCertLimpo = normalizarCnpj(cert?.cnpj || '');
  const empresaVinculada = cnpjCertLimpo
    ? empresas.find(e => normalizarCnpj(e.cnpj || '') === cnpjCertLimpo) || null
    : null;

  return {
    integrado,
    ambiente: config.ambiente,
    certificadoAtivo,
    tokenAtivo,
    cnpjCertificado: cert?.cnpj || '',
    arquivoCertificado: cert?.nomeArquivo || '',
    validadeCertificado: cert?.validade || '',
    emissorCertificado: cert?.emissor || '',
    servicosConectados: integrado ? 5 : 0,
    totalServicos: 5,
    ultimaSincronizacao: null,
    empresaVinculada,
    ...('erro' in leituraEmpresas ? { erroLeituraEmpresas: leituraEmpresas.erro } : {})
  };
}

/** Relata a ausência da integração; não executa chamadas nem grava dados. */
export function relatarIndisponibilidadeSerpro(): ResultadoSincronizacaoSerpro {
  const motivo = 'Integração SERPRO de produção ainda não está implementada/configurada neste servidor. Nenhuma consulta, transmissão, guia, CND, procuração ou certificado foi validado.';
  const etapas: EtapaSincronizacao[] = [
    { id: '1', titulo: 'Autenticação mTLS', descricao: 'Certificado A1 e acesso contratados', status: 'erro', detalhe: motivo },
    { id: '2', titulo: 'Token OAuth2 SERPRO', descricao: 'Credenciais oficiais do gateway', status: 'pendente' },
    { id: '3', titulo: 'Consulta cadastral RFB', descricao: 'Consulta autenticada do CNPJ', status: 'pendente' },
    { id: '4', titulo: 'Atualização cadastral', descricao: 'Dados retornados pela fonte oficial', status: 'pendente' },
    { id: '5', titulo: 'DCTFWeb e guias', descricao: 'Consulta autorizada de declarações e guias', status: 'pendente' },
    { id: '6', titulo: 'CND e procuração e-CAC', descricao: 'Verificação oficial de certidões e poderes', status: 'pendente' },
  ];
  return {
    sucesso: false,
    timestamp: new Date().toISOString(),
    totalGuiasSincronizadas: 0,
    situacaoCadastral: 'Não consultada',
    statusCND: 'Não consultada',
    procuracaoAtiva: false,
    certificadoVinculado: { arquivo: '', validade: '', emissor: '', cnpj: '' },
    etapas,
    mensagem: motivo,
  };
}
