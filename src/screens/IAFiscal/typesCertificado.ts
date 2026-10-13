export interface CertificadoDigitalDados {
  tipo: 'A1' | 'A3';
  nomeArquivo?: string;
  senha?: string;
  cnpj: string;
  razao: string;
  dataCadastro: string;
  validade: string;
  emissor: string;
  uf: string;
  valido: boolean;
}

export interface NotaFiscalEmitida {
  numero: string;
  serie: string;
  dataEmissao: string;
  tipo: 'nfe' | 'nfse';
  razaoSocial: string;
  documento: string;
  ie?: string;
  endereco: string;
  cfop: string;
  uf: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
  aliquotaIcms: number;
  aliquotaIpi: number;
  aliquotaIss: number;
  baseCalculo: number;
  valorIcms: number;
  informacoesAdicionais?: string;
  assinaturaDigital: string;
  chaveAcessoSefaz: string;
}
