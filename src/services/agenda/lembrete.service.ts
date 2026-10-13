import { format, differenceInDays } from 'date-fns';
import { ItemAgendaFiscal, StatusVencimento, ConfigLembretes } from '../../types';

// 🔧 Ajusta vencimento se cair fim de semana (antecipa para dia útil anterior)
export function ajustarFimDeSemana(dataOriginal: Date): Date {
  const data = new Date(dataOriginal);
  const dia = data.getDay();
  if (dia === 0) data.setDate(data.getDate() - 2); // Domingo → Sexta-feira
  if (dia === 6) data.setDate(data.getDate() - 1); // Sábado → Sexta-feira
  return data;
}

// 📅 TIPOS DE OBRIGAÇÕES E VENCIMENTOS
export const TIPOS_OBRIGACOES: Record<string, {
  nome: string;
  vencimento: (param: any) => Date;
  alertas: number[];
}> = {
  DARF_PREVIDENCIARIO: {
    nome: 'DARF Previdenciário (INSS)',
    vencimento: (competencia: Date) => {
      const data = new Date(competencia);
      data.setMonth(data.getMonth() + 1);
      data.setDate(20);
      return ajustarFimDeSemana(data);
    },
    alertas: [10, 5, 2, 1] // ⏰ Avisar com quantos dias antes
  },
  FGTS_DIGITAL: {
    nome: 'FGTS Digital',
    vencimento: (competencia: Date) => {
      const data = new Date(competencia);
      data.setMonth(data.getMonth() + 1);
      data.setDate(20);
      return ajustarFimDeSemana(data);
    },
    alertas: [10, 5, 2, 1]
  },
  DAS_SIMPLES: {
    nome: 'DAS — Simples Nacional',
    vencimento: (competencia: Date) => {
      const data = new Date(competencia);
      data.setMonth(data.getMonth() + 1);
      data.setDate(20);
      return ajustarFimDeSemana(data);
    },
    alertas: [10, 5, 2]
  },
  PIS_COFINS: {
    nome: 'PIS / COFINS (Faturamento)',
    vencimento: (competencia: Date) => {
      const data = new Date(competencia);
      data.setMonth(data.getMonth() + 1);
      data.setDate(25);
      return ajustarFimDeSemana(data);
    },
    alertas: [10, 5, 2]
  },
  IRPJ_CSLL_PRESUMIDO: {
    nome: 'IRPJ / CSLL — Lucro Presumido / Real',
    vencimento: (competencia: Date) => {
      const data = new Date(competencia);
      data.setMonth(data.getMonth() + 1);
      data.setDate(30);
      return ajustarFimDeSemana(data);
    },
    alertas: [15, 7, 3, 1]
  },
  EFD_REINF: {
    nome: 'EFD-Reinf (Retenções)',
    vencimento: (competencia: Date) => {
      const data = new Date(competencia);
      data.setMonth(data.getMonth() + 1);
      data.setDate(15);
      return ajustarFimDeSemana(data);
    },
    alertas: [10, 5, 2]
  },
  DCTFWEB: {
    nome: 'DCTFWeb (Transmissão)',
    vencimento: (competencia: Date) => {
      const data = new Date(competencia);
      data.setMonth(data.getMonth() + 1);
      data.setDate(20);
      return ajustarFimDeSemana(data);
    },
    alertas: [15, 7, 3, 1]
  },
  VENCIMENTO_PROCURACAO: {
    nome: 'Validade Procuração',
    vencimento: (dataValidade: string | Date) => new Date(dataValidade),
    alertas: [30, 15, 7, 1]
  },
  VENCIMENTO_CND: {
    nome: 'Validade CND',
    vencimento: (dataValidade: string | Date) => new Date(dataValidade),
    alertas: [15, 7, 2]
  }
};

// 🟢🟡🔴 Status do vencimento
export function getStatus(dataVencimento: Date): StatusVencimento {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataAlvo = new Date(dataVencimento);
  dataAlvo.setHours(0, 0, 0, 0);

  const dias = differenceInDays(dataAlvo, hoje);
  
  if (dias < 0) return { texto: 'VENCIDO', cor: '#d32f2f', icone: '❌' };
  if (dias === 0) return { texto: 'HOJE', cor: '#d32f2f', icone: '🔴' };
  if (dias <= 3) return { texto: 'URGENTE', cor: '#f57c00', icone: '⚠️' };
  if (dias <= 10) return { texto: 'ATENÇÃO', cor: '#fbc02d', icone: '🟡' };
  return { texto: 'NO PRAZO', cor: '#388e3c', icone: '✅' };
}

export interface EmpresaAgenda {
  razaoSocial: string;
  cnpj: string;
  procuracaoValidade?: string;
  cndValidade?: string;
}

// 📅 Gerar agenda do mês
export function gerarAgenda(mes: Date, empresas: EmpresaAgenda[] = []): ItemAgendaFiscal[] {
  const agenda: ItemAgendaFiscal[] = [];
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  empresas.forEach(empresa => {
    Object.entries(TIPOS_OBRIGACOES).forEach(([chave, tipo]) => {
      let dataVenc: Date;
      
      // Trata vencimentos com data específica
      if (chave === 'VENCIMENTO_PROCURACAO' && empresa.procuracaoValidade) {
        dataVenc = tipo.vencimento(empresa.procuracaoValidade);
      } else if (chave === 'VENCIMENTO_CND' && empresa.cndValidade) {
        dataVenc = tipo.vencimento(empresa.cndValidade);
      } else if (chave !== 'VENCIMENTO_PROCURACAO' && chave !== 'VENCIMENTO_CND') {
        dataVenc = tipo.vencimento(mes);
      } else {
        return; // Pula se não tiver data
      }

      const targetZero = new Date(dataVenc);
      targetZero.setHours(0, 0, 0, 0);
      const dias = differenceInDays(targetZero, hoje);

      agenda.push({
        id: `${empresa.cnpj}_${chave}_${format(mes, 'MMyyyy')}`,
        empresa: empresa.razaoSocial,
        cnpj: empresa.cnpj,
        tipo: tipo.nome,
        dataVencimento: dataVenc,
        diasParaVencer: dias,
        status: getStatus(dataVenc),
        alertas: tipo.alertas
      });
    });
  });

  return agenda.sort((a, b) => a.dataVencimento.getTime() - b.dataVencimento.getTime());
}

// 🔔 Verifica quais lembretes disparar HOJE
export function verificarLembretesDoDia(agenda: ItemAgendaFiscal[]): ItemAgendaFiscal[] {
  return agenda.filter(item => {
    // Dispara se for exatamente dia de alerta ou se vence hoje ou se está vencido recente
    return item.alertas.includes(item.diasParaVencer) || item.diasParaVencer === 0 || (item.diasParaVencer <= 3 && item.diasParaVencer > 0);
  });
}

// ⚙️ Configuração padrão dos lembretes
export const configLembretes: ConfigLembretes = {
  notificacaoApp: true,
  email: true,
  whatsapp: false,
  horaLembrete: '08:00'
};
