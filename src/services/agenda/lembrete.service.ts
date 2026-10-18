import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ItemAgendaFiscal, StatusVencimento } from '../../types';

const STORAGE_KEY = 'murade_agenda_lembretes_locais_v1';
export const EVENTO_LEMBRETES_FISCAIS_ATUALIZADOS = 'murade_lembretes_fiscais_atualizados';

/** Lembrete manual; não representa uma obrigação consultada ou validada em órgão oficial. */
export interface LembreteFiscalLocal {
  id: string;
  empresaId: string;
  empresa: string;
  cnpj: string;
  titulo: string;
  dataVencimento: string;
  alertas: number[];
  concluido: boolean;
  criadoEm: string;
}

export type ResultadoLeituraLembretes =
  | { ok: true; lembretes: LembreteFiscalLocal[] }
  | { ok: false; erro: string };

function dataLocalValida(valor: unknown): valor is string {
  if (typeof valor !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!match) return false;
  const data = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return data.getUTCFullYear() === Number(match[1])
    && data.getUTCMonth() === Number(match[2]) - 1
    && data.getUTCDate() === Number(match[3]);
}

function lembreteValido(item: unknown): item is LembreteFiscalLocal {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const lembrete = item as Record<string, unknown>;
  return typeof lembrete.id === 'string' && Boolean(lembrete.id.trim())
    && typeof lembrete.empresaId === 'string' && Boolean(lembrete.empresaId.trim())
    && typeof lembrete.empresa === 'string'
    && typeof lembrete.cnpj === 'string'
    && typeof lembrete.titulo === 'string' && Boolean(lembrete.titulo.trim()) && lembrete.titulo.length <= 100
    && dataLocalValida(lembrete.dataVencimento)
    && Array.isArray(lembrete.alertas)
    && lembrete.alertas.every(dia => typeof dia === 'number' && Number.isInteger(dia) && dia >= 0 && dia <= 365)
    && typeof lembrete.concluido === 'boolean'
    && typeof lembrete.criadoEm === 'string' && Number.isFinite(Date.parse(lembrete.criadoEm));
}

export function listarLembretesFiscais(): ResultadoLeituraLembretes {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { ok: true, lembretes: [] };
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.every(lembreteValido)
      || new Set(parsed.map(item => (item as LembreteFiscalLocal).id)).size !== parsed.length) {
      return { ok: false, erro: 'A agenda contém dados inválidos. Os registros foram preservados e nenhuma lista vazia foi presumida.' };
    }
    return { ok: true, lembretes: parsed as LembreteFiscalLocal[] };
  } catch (error) {
    console.error('Não foi possível carregar os lembretes locais:', error);
    return { ok: false, erro: 'Não foi possível ler a agenda local. Os dados armazenados foram preservados.' };
  }
}

export function salvarLembretesFiscais(lembretes: LembreteFiscalLocal[]): boolean {
  try {
    if (!Array.isArray(lembretes) || !lembretes.every(lembreteValido)
      || new Set(lembretes.map(lembrete => lembrete.id)).size !== lembretes.length) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lembretes));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_LEMBRETES_FISCAIS_ATUALIZADOS));
    return true;
  } catch (error) {
    console.error('Não foi possível salvar os lembretes locais:', error);
    return false;
  }
}

export function getStatus(dataVencimento: Date, concluido = false): StatusVencimento {
  if (concluido) return { texto: 'CONCLUÍDO', cor: '#475569', icone: '✓' };
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = differenceInCalendarDays(dataVencimento, hoje);
  if (dias < 0) return { texto: 'VENCIDO', cor: '#d32f2f', icone: '!' };
  if (dias === 0) return { texto: 'HOJE', cor: '#d32f2f', icone: '!' };
  if (dias <= 3) return { texto: 'URGENTE', cor: '#f57c00', icone: '!' };
  if (dias <= 10) return { texto: 'ATENÇÃO', cor: '#fbc02d', icone: '!' };
  return { texto: 'NO PRAZO', cor: '#388e3c', icone: '•' };
}

export function gerarAgenda(lembretes: LembreteFiscalLocal[]): ItemAgendaFiscal[] {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return lembretes
    .map(lembrete => {
      const dataVencimento = parseISO(lembrete.dataVencimento);
      if (Number.isNaN(dataVencimento.getTime())) return null;
      dataVencimento.setHours(0, 0, 0, 0);
      return {
        id: lembrete.id,
        empresa: lembrete.empresa,
        cnpj: lembrete.cnpj,
        tipo: lembrete.titulo,
        dataVencimento,
        diasParaVencer: differenceInCalendarDays(dataVencimento, hoje),
        status: getStatus(dataVencimento, lembrete.concluido),
        alertas: lembrete.alertas
      } satisfies ItemAgendaFiscal;
    })
    .filter((item): item is ItemAgendaFiscal => item !== null)
    .sort((a, b) => a.dataVencimento.getTime() - b.dataVencimento.getTime());
}

/** Encontra lembretes manuais que devem chamar atenção hoje; não envia mensagens externas. */
export function verificarLembretesDoDia(agenda: ItemAgendaFiscal[]): ItemAgendaFiscal[] {
  return agenda.filter(item => item.status.texto !== 'CONCLUÍDO' &&
    (item.alertas.includes(item.diasParaVencer) || item.diasParaVencer <= 0));
}

export function chaveNotificacaoLembrete(id: string, data = new Date()): string {
  return `murade_agenda_notificado_${id}_${format(data, 'yyyy-MM-dd')}`;
}
