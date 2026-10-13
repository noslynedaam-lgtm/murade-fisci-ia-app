export interface StatusCancelamento {
  podeCancelar: boolean;
  diasRestantes: number;
  diasPassados: number;
  dataContratacao: Date;
  dataLiberacao: Date;
  mensagem: string;
}

export const FIDELIDADE = {
  DIAS: 60,
  TEXTO_CONTRATACAO: {
    titulo: '🔒 Compromisso de Fidelidade de 60 Dias',
    item1: '1. O plano contratado possui período mínimo de permanência de 60 (sessenta) dias.',
    item2: '2. Durante este período, o cancelamento da assinatura fica temporariamente bloqueado.',
    item3: '3. Após os 60 dias, o cancelamento poderá ser solicitado a qualquer momento sem custos adicionais.',
    item4: '4. Todos os recursos fiscais, emissão de guias e suporte MURADE permanecem 100% ativos.',
    item5: '5. A renovação das mensalidades ocorre de acordo com o ciclo contratado (mensal ou anual).'
  }
};

const CHAVE_STORAGE_CONTRATACAO = 'fiscoia_data_contratacao';
const CHAVE_STORAGE_PLANO = 'fiscoia_plano_contratado';

export function salvarContratacao(planoId: string = 'empresarial'): { dataContratacao: Date; dataLiberacao: Date } {
  const dataContratacao = new Date();
  const dataLiberacao = new Date(dataContratacao.getTime() + FIDELIDADE.DIAS * 24 * 60 * 60 * 1000);

  localStorage.setItem(CHAVE_STORAGE_CONTRATACAO, dataContratacao.toISOString());
  localStorage.setItem(CHAVE_STORAGE_PLANO, planoId);

  return { dataContratacao, dataLiberacao };
}

export function obterDataContratacao(): Date {
  const salva = localStorage.getItem(CHAVE_STORAGE_CONTRATACAO);
  if (salva) {
    const d = new Date(salva);
    if (!isNaN(d.getTime())) {
      return d;
    }
  }
  // Data padrão para novos clientes (caso ainda não tenha data salva explicitamente)
  const padrao = new Date();
  localStorage.setItem(CHAVE_STORAGE_CONTRATACAO, padrao.toISOString());
  return padrao;
}

export function verificarCancelamento(dataContratacaoEntrada?: Date | string | null): StatusCancelamento {
  let dataContratacao: Date;

  if (!dataContratacaoEntrada) {
    dataContratacao = obterDataContratacao();
  } else if (typeof dataContratacaoEntrada === 'string') {
    dataContratacao = new Date(dataContratacaoEntrada);
  } else {
    dataContratacao = dataContratacaoEntrada;
  }

  if (isNaN(dataContratacao.getTime())) {
    dataContratacao = new Date();
  }

  const agora = new Date();
  const diferencaMs = agora.getTime() - dataContratacao.getTime();
  const diasPassados = Math.max(0, Math.floor(diferencaMs / (1000 * 60 * 60 * 24)));
  const diasRestantes = Math.max(0, FIDELIDADE.DIAS - diasPassados);
  const dataLiberacao = new Date(dataContratacao.getTime() + FIDELIDADE.DIAS * 24 * 60 * 60 * 1000);

  const podeCancelar = diasPassados >= FIDELIDADE.DIAS;

  const mensagem = podeCancelar
    ? 'Seu período de fidelidade de 60 dias foi concluído. O cancelamento pode ser efetuado a qualquer momento.'
    : `Período de fidelidade em vigor (${FIDELIDADE.DIAS} dias). Faltam ${diasRestantes} dia(s) para a liberação do cancelamento (em ${dataLiberacao.toLocaleDateString('pt-BR')}).`;

  return {
    podeCancelar,
    diasRestantes,
    diasPassados,
    dataContratacao,
    dataLiberacao,
    mensagem
  };
}
