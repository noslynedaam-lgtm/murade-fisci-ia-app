export interface PlanoConfig {
  id: 'basico' | 'profissional' | 'empresarial';
  nome: string;
  maxCnpjs: number;
  valorMensal: number;
  valorAnual: number;
  descontoAnual: number;
  funcionalidades: string[];
  oQueEstaIncluido?: string[];
}

export interface FuncionarioFolha {
  id?: string;
  matricula: string;
  nome: string;
  cpf: string;
  remuneracao: number;
  baseINSS?: number;
  fgts?: number;
}

export interface EmpresaDados {
  id?: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  fpas?: string;
  codRecolhimento?: string;
  regimeTributario?: 'SIMPLES' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL' | 'MEI';
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  cnaePrincipal?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  numero?: string;
  cep?: string;
  responsavelLegal?: string;
  cpfResponsavel?: string;
  nomeContador?: string;
  crcContador?: string;
  cpfContador?: string;
  telefoneContador?: string;
  emailContador?: string;
  statusCND?: 'REGULAR' | 'PENDENCIA' | 'VENCIDA';
  envioDadosMes?: 'ENVIADO' | 'NAO_ENVIADO';
  dataEnvioDados?: string;
  envioDCTFWeb?: 'ENVIADO' | 'NAO_ENVIADO';
  dataEnvioDCTFWeb?: string;
  reciboDCTFWeb?: string;
  motivoPendenciaCND?: string;
  procuracaoAtiva?: boolean;
  certificado?: {
    tipo: 'A1' | 'A3';
    nomeArquivo?: string;
    senha?: string;
    validade?: string;
    emissor?: string;
    ativo?: boolean;
    dataCadastro?: string;
  };
}

export interface StatusComplianceEmpresa {
  empresaId: string;
  cnpj: string;
  competencia: string;
  dadosMesEnviados: boolean;
  dataEnvioDados?: string;
  dctfwebEnviada: boolean;
  dataEnvioDCTFWeb?: string;
  reciboDCTFWeb?: string;
  cndEmitida: boolean;
  motivoCndNaoSaiu?: string;
  observacoes?: string;
  ultimaAtualizacao?: string;
}

export interface GuiaFiscal {
  id: string;
  tipo: string;
  sigla: string;
  descricao?: string;
  valorBase: number;
  aliquota: number;
  valorImposto: number;
  vencimento: Date | string;
  referencia: string;
  codigoBarra: string;
}

export interface RespostaApuracaoFolha {
  sucesso: boolean;
  nomeArquivo: string;
  conteudo: string;
  dados: {
    identificacao: {
      cnpj: string;
      razaoSocial: string;
      competencia: string;
      fpas: string;
      codRecolhimento: string;
      tipoFolha: string;
    };
    funcionarios: Array<{
      matricula: string;
      nome: string;
      cpf: string;
      remuneracao: number;
      baseINSS: number;
      fgts: number;
    }>;
    totalizadores: {
      totalRemuneracao: number;
      totalBaseINSS: number;
      totalFGTS: number;
    };
    dataGeracao: string;
  };
  darf?: RespostaGuiaPrevidenciaria;
}

export interface RespostaGuiaPrevidenciaria {
  valorINSS: number;
  valorRAT: number;
  valorTerceiros: number;
  valorTotalGPS: number;
  codigoBarras: string;
  linhaDigitavel?: string;
  vencimento: string;
}

export interface DadosProcuracao {
  numero: string;
  dataEmissao: string;
  outorgante: {
    razaoSocial: string;
    cnpj: string;
    representante: string;
    cpfRepresentante: string;
    cargo: string;
  };
  outorgado: {
    nome: string;
    cpf: string;
    crc: string;
    telefone: string;
    email: string;
  };
  poderes: string[];
  validade: string;
  status: 'ATIVA' | 'PENDENTE_ASSINATURA' | 'VENCIDA';
  homologacaoGoverno?: {
    statusHomologacao: 'HOMOLOGADO_RFB_OFICIAL' | 'PENDENTE' | 'PROCESSANDO';
    orgao: string;
    protocoloProtocolado: string;
    dataHomologacao: string;
    certificadoUtilizado: {
      tipo: string;
      titular: string;
      documento: string;
      autoridadeCertificadora: string;
      emissao: string;
      validade: string;
      status: string;
      numeroSerie: string;
      padraoIcpBrasil: boolean;
    };
    hashIntegridade: string;
    normativaLegal: string;
    urlValidacaoGov: string;
  };
}

export interface DadosViaCep {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge?: string;
  gia?: string;
  ddd?: string;
  siafi?: string;
}

export interface StatusVencimento {
  texto: 'VENCIDO' | 'HOJE' | 'URGENTE' | 'ATENÇÃO' | 'NO PRAZO';
  cor: string;
  icone: string;
}

export interface ItemAgendaFiscal {
  id: string;
  empresa: string;
  cnpj: string;
  tipo: string;
  dataVencimento: Date;
  diasParaVencer: number;
  status: StatusVencimento;
  alertas: number[];
}

export interface ConfigLembretes {
  notificacaoApp: boolean;
  email: boolean;
  whatsapp: boolean;
  horaLembrete: string;
}

export interface UsuarioAuth {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  cpfCnpj?: string;
  crc?: string;
  idPlano: 'basico' | 'profissional' | 'empresarial';
  nomePlano: string;
  dataVencimento: string;
  primeiroAcesso: boolean;
  ativo: boolean;
  ehAdmin?: boolean;
  tipo?: 'ADMIN' | 'CONTADOR';
}

export interface DadosCadastroContador {
  nome: string;
  email: string;
  telefone: string;
  cpfCnpj: string;
  crc: string;
  idPlano: 'basico' | 'profissional' | 'empresarial';
  nomePlano?: string;
  dataVencimento: string;
}
