// Regra de decisão da automação do DAS / PGDAS-D (Simples Nacional).
// Módulo puro (sem rede, sem Serpro): só decide O QUE fazer com cada empresa.
//  - Empresa SEM movimento no mês  -> pode transmitir zerada sozinha (se o escritório ligou essa opção).
//  - Empresa COM movimento         -> nunca transmite sozinha: pede autorização do contador (WhatsApp/app).
//  - Qualquer dúvida (dado faltando, valor divergente) -> não transmite e avisa.
// Isto NÃO faz chamada paga ao Serpro. Quem chamar o Serpro precisa respeitar o interruptor e a confirmação de custo.

export interface DadosMesEmpresa {
  cnpj: string;
  competencia: string; // AAAAMM
  regime: 'simples' | 'mei' | 'outro';
  // Totais do mês vindos do Fiscal. null = o Fiscal ainda não fechou/não informou (NÃO é o mesmo que zero).
  receitaBrutaCentavos: number | null;
  notasSaidaNoMes: number | null;
  notasEntradaNoMes: number | null;
  jaTransmitida?: boolean;
  procuracaoOk?: boolean;
}

export interface OpcoesEscritorio {
  transmitirZeradasAutomatico: boolean; // escolha do escritório (manual continua sempre disponível)
  prazoAutorizacaoHoras: number;
}

export type Decisao =
  | { acao: 'ignorar'; motivo: string }
  | { acao: 'transmitir_zerada'; motivo: string }
  | { acao: 'pedir_autorizacao'; motivo: string; receitaBrutaCentavos: number }
  | { acao: 'avisar_pendencia'; motivo: string };

export function decidirDas(d: DadosMesEmpresa, o: OpcoesEscritorio): Decisao {
  if (d.regime === 'outro') return { acao: 'ignorar', motivo: 'Empresa fora do Simples Nacional/MEI.' };
  if (d.jaTransmitida) return { acao: 'ignorar', motivo: 'A declaração deste mês já foi transmitida.' };
  if (d.procuracaoOk === false) return { acao: 'avisar_pendencia', motivo: 'Falta a procuração no e-CAC (código 00146 - PGDAS-D). Nada foi feito.' };
  if (d.receitaBrutaCentavos === null || d.notasSaidaNoMes === null || d.notasEntradaNoMes === null) {
    return { acao: 'avisar_pendencia', motivo: 'O Fiscal ainda não fechou os dados do mês desta empresa. Não vou transmitir como zerada sem ter certeza.' };
  }
  const semMovimento = d.receitaBrutaCentavos === 0 && d.notasSaidaNoMes === 0;
  if (!semMovimento) return { acao: 'pedir_autorizacao', motivo: 'Empresa com movimento: precisa da autorização do contador.', receitaBrutaCentavos: d.receitaBrutaCentavos };
  if (d.notasEntradaNoMes > 0) return { acao: 'pedir_autorizacao', motivo: 'Sem receita, mas há notas de entrada no mês: o contador confere antes.', receitaBrutaCentavos: 0 };
  if (!o.transmitirZeradasAutomatico) return { acao: 'pedir_autorizacao', motivo: 'Empresa zerada, mas o escritório deixou a transmissão automática desligada.', receitaBrutaCentavos: 0 };
  return { acao: 'transmitir_zerada', motivo: 'Sem receita, sem notas de saída nem de entrada no mês.' };
}

export type EstadoAutorizacao = 'aguardando' | 'autorizada' | 'recusada' | 'expirada';

export function estadoDaAutorizacao(criadaEm: Date, agora: Date, prazoHoras: number, resposta?: 'sim' | 'nao'): EstadoAutorizacao {
  if (resposta === 'sim') return 'autorizada';
  if (resposta === 'nao') return 'recusada';
  return agora.getTime() - criadaEm.getTime() > prazoHoras * 3_600_000 ? 'expirada' : 'aguardando';
}

// Só aceita resposta clara por WhatsApp; qualquer outra coisa não autoriza nada.
export function interpretarRespostaWhatsApp(texto: string): 'sim' | 'nao' | null {
  const t = texto.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, '').trim();
  if (['sim', 'autorizo', 'pode transmitir', 'autorizado'].includes(t)) return 'sim';
  if (['nao', 'nao autorizo', 'cancela', 'cancelar'].includes(t)) return 'nao';
  return null;
}

// Vencimento do DAS: dia 20 do mês seguinte; se cair em sábado/domingo, vai para o próximo dia útil (feriados: confira no calendário do escritório).
export function vencimentoDas(competenciaAAAAMM: string): string {
  const ano = Number(competenciaAAAAMM.slice(0, 4)); const mes = Number(competenciaAAAAMM.slice(4, 6));
  const d = new Date(Date.UTC(ano, mes, 20)); // mês seguinte (mes é 1-12; Date usa 0-11)
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
