import { DadosProcuracao } from '../../types';

export interface CertificadoHomologado {
  tipo: 'E_CNPJ_A1' | 'E_CNPJ_A3' | 'E_CPF_A1' | 'E_CPF_A3';
  titular: string;
  documento: string; // CNPJ ou CPF
  autoridadeCertificadora: string; // AC Serpro, AC Certisign, AC Soluti, AC Valid, AC Safeweb, etc.
  emissao: string;
  validade: string;
  status: 'HOMOLOGADO_VALIDO' | 'REVOGADO' | 'EXPIRADO';
  numeroSerie: string;
  padraoIcpBrasil: boolean;
}

export interface DadosEntradaProcuracao {
  outorgante: {
    razaoSocial: string;
    cnpj: string;
    representante: string;
    cpfRepresentante: string;
    cargo?: string;
  };
  outorgado: {
    nome: string;
    cpf: string;
    crc: string;
    telefone: string;
    email: string;
  };
  poderes?: string[];
  validade?: string;
  certificadoDigital?: CertificadoHomologado;
}

export const PODERES_DISPONIVEIS = [
  { id: 'DCTFWEB', label: 'DCTFWeb / DARF Previdenciário e Fazendário', desc: 'Escopo pretendido na minuta; disponibilidade e efeito dependem do serviço oficial e da concessão expressa do outorgante.' },
  { id: 'CONSULTA_CND', label: 'Certidão Negativa de Débitos (CND RFB/PGFN)', desc: 'Escopo pretendido na minuta; disponibilidade e efeito dependem do serviço oficial e da concessão expressa do outorgante.' },
  { id: 'APURACAO_TRIBUTOS', label: 'Apuração e Cálculo Fiscal Oficial', desc: 'Escopo pretendido na minuta; disponibilidade e efeito dependem do serviço oficial e da concessão expressa do outorgante.' },
  { id: 'ENTREGA_DECLARACOES', label: 'Transmissão e Entrega de Declarações (SPED / eSocial)', desc: 'Escopo pretendido na minuta; disponibilidade e efeito dependem do serviço oficial e da concessão expressa do outorgante.' },
  { id: 'SIMPLES_NACIONAL', label: 'PGDAS-D, DEFIS e Simples Nacional', desc: 'Escopo pretendido na minuta; disponibilidade e efeito dependem do serviço oficial e da concessão expressa do outorgante.' },
  { id: 'FGTS_DIGITAL', label: 'FGTS Digital e Conectividade Caixa', desc: 'Escopo pretendido na minuta; disponibilidade e efeito dependem do serviço oficial e da concessão expressa do outorgante.' },
  { id: 'PARCELAMENTOS', label: 'Parcelamentos e Transação Tributária PGFN', desc: 'Escopo pretendido na minuta; disponibilidade e efeito dependem do serviço oficial e da concessão expressa do outorgante.' },
  { id: 'CAIXA_POSTAL', label: 'Caixa Postal e Mensagens Oficiais e-CAC', desc: 'Escopo pretendido na minuta; disponibilidade e efeito dependem do serviço oficial e da concessão expressa do outorgante.' },
  { id: 'PROCESSOS_DIGITAIS', label: 'Processos Digitais RFB / e-AssinaRFB', desc: 'Escopo pretendido na minuta; disponibilidade e efeito dependem do serviço oficial e da concessão expressa do outorgante.' }
];

export const gerarProcuração = (dados: DadosEntradaProcuracao) => {
  const { outorgante, outorgado, poderes = [], validade = '' } = dados;
  const procuracao: DadosProcuracao = {
    numero: 'RASCUNHO-' + Date.now(),
    dataEmissao: new Date().toLocaleDateString('pt-BR'),
    outorgante: { razaoSocial: outorgante.razaoSocial, cnpj: outorgante.cnpj, representante: outorgante.representante, cpfRepresentante: outorgante.cpfRepresentante, cargo: outorgante.cargo || '' },
    outorgado: { nome: outorgado.nome, cpf: outorgado.cpf, crc: outorgado.crc, telefone: outorgado.telefone, email: outorgado.email },
    poderes, validade, status: 'PENDENTE_ASSINATURA'
  };
  return { sucesso: true, procuracao, documentoTexto: formatarTermoProcuracao(procuracao) };
};

export const verificarStatusProcuração = async (_cnpj: string) => ({
  status: 'NÃO CONSULTADO', homologadoGoverno: false, padraoIcpBrasil: false,
  dataValidade: '', dataConsulta: '',
  orgao: 'Receita Federal', sistemaHomologador: 'Integração não configurada',
  protocoloHomologacao: '', codigoValidacao: '', normativa: '', certificadoEmissor: '',
  mensagem: 'A consulta de procurações no e-CAC não está conectada. Nenhum status foi consultado.'
});

export const formatarTermoProcuracao = (p: DadosProcuracao): string => [
  'MINUTA LOCAL DE PROCURAÇÃO — NÃO REGISTRADA NO GOVERNO',
  'Este documento é apenas um rascunho para revisão. Não substitui assinatura nem cadastro no portal oficial.',
  '', 'Número interno: ' + p.numero, 'Data de criação: ' + p.dataEmissao, 'Validade pretendida: ' + (p.validade || 'não informada'), 'Status: PENDENTE DE ASSINATURA E REGISTRO',
  '', 'OUTORGANTE', 'Razão social: ' + p.outorgante.razaoSocial, 'CNPJ: ' + p.outorgante.cnpj, 'Representante: ' + p.outorgante.representante, 'CPF do representante: ' + p.outorgante.cpfRepresentante, 'Cargo: ' + p.outorgante.cargo,
  '', 'OUTORGADO', 'Nome: ' + p.outorgado.nome, 'CPF: ' + p.outorgado.cpf, 'CRC: ' + p.outorgado.crc, 'Telefone: ' + p.outorgado.telefone, 'E-mail: ' + p.outorgado.email,
  '', 'PODERES SELECIONADOS (para revisão):', ...p.poderes.map((poder, i) => (i + 1) + '. ' + poder),
  '', 'A minuta não foi assinada, transmitida ou homologada pela Receita Federal. Para conceder poderes, use o serviço oficial e valide o registro diretamente no e-CAC.'
].join('\n');
