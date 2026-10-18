export interface ConfigSerpro {
  ambiente: 'homologacao' | 'producao';
  consumerKey: string;
  consumerSecret: string;
  tokenBearer?: string;
  tokenExpiracao?: string;
  formaPagamento: 'pos_pago_boleto' | 'pre_pago_creditos' | 'debito_conta';
  planoSerpro: 'integra_contador_basico' | 'integra_contador_pro' | 'integra_contador_master';
  certificadoA1: {
    instalado: boolean;
    nomeArquivo?: string;
    validade?: string;
    emissor?: string;
    senha?: string;
    cnpj?: string;
  };
  etapasHomologacao: {
    passo1_cadastroLoja: boolean;
    passo2_credenciaisOAuth: boolean;
    passo3_certificadoA1: boolean;
    passo4_testeSandbox: boolean;
    passo5_contratacaoPlano: boolean;
    passo6_producaoLiberada: boolean;
  };
  consumoMensal: {
    consultasRealizadas: number;
    limiteMensal: number;
    custoEstimado: number;
  };
}

export interface LogConexaoSerpro {
  id: string;
  timestamp: string;
  endpoint: string;
  metodo: string;
  statusHttp: number;
  tempoRespostaMs: number;
  mensagem: string;
  sucesso: boolean;
}

const STORAGE_KEY_SERPRO = '@fiscoia:config_serpro_2026';
const STORAGE_KEY_LOGS = '@fiscoia:logs_serpro_2026';
let erroLeituraConfigSerpro: string | null = null;

const CONFIG_PADRAO: ConfigSerpro = {
  ambiente: 'homologacao',
  consumerKey: '',
  consumerSecret: '',
  tokenBearer: '',
  tokenExpiracao: '',
  formaPagamento: 'pos_pago_boleto',
  planoSerpro: 'integra_contador_pro',
  certificadoA1: {
    instalado: false,
    nomeArquivo: '',
    validade: '',
    emissor: ''
  },
  etapasHomologacao: {
    passo1_cadastroLoja: false,
    passo2_credenciaisOAuth: false,
    passo3_certificadoA1: false,
    passo4_testeSandbox: false,
    passo5_contratacaoPlano: false,
    passo6_producaoLiberada: false
  },
  consumoMensal: {
    consultasRealizadas: 0,
    limiteMensal: 0,
    custoEstimado: 0
  }
};

export function obterConfigSerpro(): ConfigSerpro {
  let salvo: string | null;
  try {
    salvo = localStorage.getItem(STORAGE_KEY_SERPRO);
  } catch {
    erroLeituraConfigSerpro = 'O navegador bloqueou a leitura da configuração SERPRO. Nenhum dado foi substituído.';
    return { ...CONFIG_PADRAO, certificadoA1: { ...CONFIG_PADRAO.certificadoA1 }, etapasHomologacao: { ...CONFIG_PADRAO.etapasHomologacao }, consumoMensal: { ...CONFIG_PADRAO.consumoMensal } };
  }
  if (salvo === null) {
    erroLeituraConfigSerpro = null;
    return { ...CONFIG_PADRAO, certificadoA1: { ...CONFIG_PADRAO.certificadoA1 }, etapasHomologacao: { ...CONFIG_PADRAO.etapasHomologacao }, consumoMensal: { ...CONFIG_PADRAO.consumoMensal } };
  }

  let anterior: Partial<ConfigSerpro>;
  try {
    const parseado: unknown = JSON.parse(salvo);
    if (!parseado || typeof parseado !== 'object' || Array.isArray(parseado)) throw new Error('formato inválido');
    anterior = parseado as Partial<ConfigSerpro>;
  } catch {
    // Preserva o original para recuperação manual; não substitui corrupção por padrão vazio.
    erroLeituraConfigSerpro = 'A configuração SERPRO local está inválida e foi preservada. Nenhuma lista vazia foi gravada.';
    return { ...CONFIG_PADRAO, certificadoA1: { ...CONFIG_PADRAO.certificadoA1 }, etapasHomologacao: { ...CONFIG_PADRAO.etapasHomologacao }, consumoMensal: { ...CONFIG_PADRAO.consumoMensal } };
  }

  const etapas = anterior.etapasHomologacao && typeof anterior.etapasHomologacao === 'object'
    ? anterior.etapasHomologacao
    : {};
  const segura: ConfigSerpro = {
    ...CONFIG_PADRAO,
    ambiente: anterior.ambiente === 'producao' ? 'producao' : 'homologacao',
    certificadoA1: { ...CONFIG_PADRAO.certificadoA1 },
    etapasHomologacao: Object.fromEntries(
      Object.keys(CONFIG_PADRAO.etapasHomologacao).map(chave => [chave, etapas[chave as keyof ConfigSerpro['etapasHomologacao']] === true])
    ) as ConfigSerpro['etapasHomologacao'],
    consumoMensal: { ...CONFIG_PADRAO.consumoMensal }
  };
  // Remove credenciais legadas somente quando a gravação segura for confirmada.
  if (salvarConfigSerpro(segura)) erroLeituraConfigSerpro = null;
  else erroLeituraConfigSerpro = 'As credenciais SERPRO legadas não puderam ser removidas do armazenamento local; a tela não as carregou. Libere o armazenamento e tente novamente.';
  return segura;
}

export function obterErroLeituraConfigSerpro(): string | null {
  return erroLeituraConfigSerpro;
}

/** Reinicia somente a preferência local SERPRO quando a tela recebe autorização explícita. */
export function redefinirConfigSerproLocal(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY_SERPRO);
  } catch {
    erroLeituraConfigSerpro = 'O navegador não permitiu remover a configuração SERPRO local.';
    return false;
  }
  erroLeituraConfigSerpro = null;
  return salvarConfigSerpro(CONFIG_PADRAO);
}

export function salvarConfigSerpro(config: ConfigSerpro): boolean {
  let atual: string | null;
  try {
    atual = localStorage.getItem(STORAGE_KEY_SERPRO);
  } catch {
    erroLeituraConfigSerpro = 'Não foi possível ler o armazenamento SERPRO local. Nenhuma configuração foi sobrescrita.';
    return false;
  }
  if (atual !== null) {
    try {
      const parseado: unknown = JSON.parse(atual);
      if (!parseado || typeof parseado !== 'object' || Array.isArray(parseado)) {
        erroLeituraConfigSerpro = 'A configuração SERPRO local está inválida e foi preservada. Recupere ou remova esse registro antes de salvar alterações.';
        return false;
      }
    } catch {
      erroLeituraConfigSerpro = 'A configuração SERPRO local está inválida e foi preservada. Recupere ou remova esse registro antes de salvar alterações.';
      return false;
    }
  }

  try {
    // Browser storage is not a secure vault. Persist only harmless UI preferences.
    const segura: ConfigSerpro = {
      ...CONFIG_PADRAO,
      ambiente: config.ambiente === 'producao' ? 'producao' : 'homologacao',
      consumerKey: '',
      consumerSecret: '',
      tokenBearer: '',
      tokenExpiracao: '',
      certificadoA1: { instalado: false, nomeArquivo: '', validade: '', emissor: '', cnpj: '', senha: '' },
      etapasHomologacao: { ...config.etapasHomologacao },
      consumoMensal: { ...CONFIG_PADRAO.consumoMensal }
    };
    localStorage.setItem(STORAGE_KEY_SERPRO, JSON.stringify(segura));
    erroLeituraConfigSerpro = null;
    return true;
  } catch (e) {
    console.error('Erro ao salvar config SERPRO:', e);
    erroLeituraConfigSerpro = 'Não foi possível salvar a configuração local SERPRO. O estado da tela não foi confirmado.';
    return false;
  }
}

export function obterLogsSerpro(): LogConexaoSerpro[] {
  // Logs antigos não comprovam chamadas reais e podem guardar mensagens sensíveis.
  try { localStorage.removeItem(STORAGE_KEY_LOGS); } catch { /* a lista em memória continua vazia */ }
  return [];
}

export function adicionarLogSerpro(log: Omit<LogConexaoSerpro, 'id'>): void {
  // O teste OAuth do gateway não é uma chamada de API fiscal; não registrar sucessos/logs simulados.
  void log;
}

/**
 * Executa teste de conectividade com a infraestrutura do SERPRO
 */
export async function testarConexaoGatewaySerpro(ambiente: 'homologacao' | 'producao', credenciais: { key: string; secret: string }): Promise<{
  testado: boolean;
  sucesso: boolean;
  tempoMs: number;
  gateway: string;
  servicos: Array<{ nome: string; status: 'ONLINE' | 'OFFLINE'; latenciaMs: number; versao: string }>;
  detalhes: string;
}> {
  const gatewayUrl = ambiente === 'producao'
    ? 'https://gateway.apiserpro.serpro.gov.br'
    : 'https://gateway-val.apiserpro.serpro.gov.br';
  const inicio = Date.now();
  void credenciais; // Segredos nunca são aceitos nem enviados pelo navegador.
  try {
    const response = await fetch('/api/serpro/token-check', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ambiente }),
    });
    const result = await response.json().catch(() => null) as {
      testado?: boolean;
      autenticado?: boolean;
      expiraEmSegundos?: number;
      statusGateway?: number;
      mensagem?: string;
    } | null;
    return {
      testado: result?.testado === true,
      sucesso: result?.autenticado === true,
      tempoMs: Date.now() - inicio,
      gateway: gatewayUrl,
      servicos: [],
      detalhes: result?.mensagem || `O servidor respondeu HTTP ${response.status}; não foi possível confirmar o gateway SERPRO.`,
    };
  } catch {
    return {
      testado: false,
      sucesso: false,
      tempoMs: Date.now() - inicio,
      gateway: gatewayUrl,
      servicos: [],
      detalhes: 'Não foi possível chamar o endpoint protegido do servidor. Nenhuma credencial foi enviada pelo navegador.',
    };
  }
}
