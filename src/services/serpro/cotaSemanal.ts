/**
 * Regra de consultas oficiais (SERPRO) por EMPRESA:
 *  - 1 consulta gratuita por semana (semana começa na segunda, fuso America/Sao_Paulo);
 *  - não acumula: a semana não usada se perde;
 *  - da 2ª consulta da mesma semana em diante, é cobrada à parte e exige confirmação.
 */
export const LIMITE_GRATIS_SEMANAL = 1;

export interface OrigemConsulta { id: string; nome: string }
export interface RegistroConsulta { em: string; semana: string; cobrada: boolean; servico: string; escritorio?: OrigemConsulta; operacao?: 'Consultar' | 'Emitir' | 'Apoiar' | 'Declarar' | 'Monitorar' }
export interface CotaEmpresa { consultas: RegistroConsulta[] }

/** Segunda-feira (AAAA-MM-DD) da semana da data, no fuso de Brasília. */
export function semanaDe(data: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(data);
  const [a, m, d] = partes.split('-').map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d));
  const deslocamento = (dia.getUTCDay() + 6) % 7; // segunda = 0
  dia.setUTCDate(dia.getUTCDate() - deslocamento);
  return dia.toISOString().slice(0, 10);
}

export function proximaSemana(semana: string): string {
  const d = new Date(`${semana}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

export interface StatusCota {
  semana: string;
  limiteGratis: number;
  consultasNaSemana: number;
  gratisUsadas: number;
  cobradasNaSemana: number;
  gratisRestante: number;
  proximaConsultaCobrada: boolean;
  novaGratisEm: string;
  totalHistorico: number;
  mensagem: string;
}

export function avaliarCota(cota: CotaEmpresa | null | undefined, agora = new Date()): StatusCota {
  const semana = semanaDe(agora);
  const lista = cota?.consultas ?? [];
  const daSemana = lista.filter(c => c.semana === semana);
  const gratisUsadas = daSemana.filter(c => !c.cobrada).length;
  const gratisRestante = Math.max(0, LIMITE_GRATIS_SEMANAL - gratisUsadas);
  const proximaConsultaCobrada = gratisRestante === 0;
  return {
    semana,
    limiteGratis: LIMITE_GRATIS_SEMANAL,
    consultasNaSemana: daSemana.length,
    gratisUsadas,
    cobradasNaSemana: daSemana.filter(c => c.cobrada).length,
    gratisRestante,
    proximaConsultaCobrada,
    novaGratisEm: proximaSemana(semana),
    totalHistorico: lista.length,
    mensagem: proximaConsultaCobrada
      ? 'A consulta gratuita desta semana já foi usada. Nova consulta será cobrada à parte, conforme o custo real do SERPRO.'
      : 'Esta empresa ainda tem a consulta gratuita da semana.',
  };
}

export type DecisaoCota =
  | { liberada: true; cobrada: boolean }
  | { liberada: false; motivo: 'confirmar_custo'; mensagem: string };

export function decidirConsulta(cota: CotaEmpresa | null | undefined, confirmouCusto: boolean, agora = new Date()): DecisaoCota {
  const st = avaliarCota(cota, agora);
  if (!st.proximaConsultaCobrada) return { liberada: true, cobrada: false };
  if (!confirmouCusto) {
    return { liberada: false, motivo: 'confirmar_custo', mensagem: 'Limite gratuito da semana atingido para esta empresa. Uma nova consulta é cobrada à parte. Confirme para prosseguir.' };
  }
  return { liberada: true, cobrada: true };
}

export function registrarConsulta(cota: CotaEmpresa | null | undefined, cobrada: boolean, servico: string, agora = new Date(), escritorio?: OrigemConsulta, operacao?: RegistroConsulta['operacao']): CotaEmpresa {
  const semana = semanaDe(agora);
  const manter = (cota?.consultas ?? []).slice(-200);
  return { consultas: [...manter, { em: agora.toISOString(), semana, cobrada, servico, ...(escritorio ? { escritorio } : {}), ...(operacao ? { operacao } : {}) }] };
}
