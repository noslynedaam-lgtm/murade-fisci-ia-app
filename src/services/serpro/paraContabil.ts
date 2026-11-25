/**
 * Fisco IA → Contábil (mesmo padrão do Fiscal → Contábil: contrato versão 1 de "apurações", só valores já oficiais).
 * Transforma o resultado GUARDADO de uma consulta feita por clique no Integra Contador em itens para o Contábil virar pré-lançamento:
 *  - guia do DAS do MEI (PGMEI): FIA_DEBITO (principal do período) e FIA_MULTA_JUROS (multa + juros da guia emitida em atraso);
 *  - dívida ativa do MEI: FIA_DIVIDA_ATIVA (por período e tributo);
 *  - detalhe do parcelamento (PARCSN, PARCMEI, PERT, RELP): FIA_PARC_CONSOLIDACAO (valor consolidado na data da consolidação)
 *    e FIA_PARC_PARCELA_PAGA (cada pagamento do demonstrativo, na data da arrecadação).
 * Peça pura: sem rede e sem banco. Valor que não veio no formato oficial não vira item (nada é inventado).
 */
export interface ItemContabil { tributo: string; competencia: string; referencia: string; valorCentavos: number; baseCentavos: number | null; situacao: 'confirmado'; versaoOrigem: string }
export const TIPOS_PARA_CONTABIL = ['parcelamento_detalhe', 'guia_das_mei', 'divida_ativa_mei'] as const;

const centavos = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(Number((v * 100).toPrecision(15))) : null);
/** "dd/mm/aaaa" (com ou sem hora) → "aaaa-mm-dd", só se for data possível. */
export function isoDeDataBr(t: unknown): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(t ?? ''));
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}
/** "mm/aaaa" → "aaaa-mm". */
export function competenciaDeMesBr(t: unknown): string | null {
  const m = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(String(t ?? '').trim());
  return m ? `${m[2]}-${m[1]}` : null;
}
const ultimoDia = (comp: string) => { const [a, m] = comp.split('-').map(Number); return `${comp}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0')}`; };
const slug = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'TRIBUTO';
const item = (tributo: string, data: string, referencia: string, c: number): ItemContabil =>
  ({ tributo, competencia: data.slice(0, 7), referencia: referencia.slice(0, 160), valorCentavos: c, baseCentavos: null, situacao: 'confirmado', versaoOrigem: `data:${data}:${c}`.slice(0, 64) });

export function itensParaContabil(tipo: string, modalidade: string | null, resumo: any): ItemContabil[] {
  const saida: ItemContabil[] = [];
  if (!resumo || typeof resumo !== 'object') return saida;
  if (tipo === 'guia_das_mei' && Array.isArray(resumo.das)) {
    for (const d of resumo.das) {
      const pa = competenciaDeMesBr(d?.periodo);
      if (!pa) continue;
      const principal = centavos(d?.principal);
      if (principal) saida.push(item('FIA_DEBITO', ultimoDia(pa), `FIA:DAS-MEI:${pa}`, principal));
      const encargos = (centavos(d?.multa) ?? 0) + (centavos(d?.juros) ?? 0);
      const venc = isoDeDataBr(d?.vencimento);
      if (encargos > 0 && venc) saida.push(item('FIA_MULTA_JUROS', venc, `FIA:DAS-MEI:${pa}:ENC`, encargos));
    }
  }
  if (tipo === 'divida_ativa_mei' && Array.isArray(resumo.debitos)) {
    for (const d of resumo.debitos) {
      const pa = competenciaDeMesBr(d?.periodo); const v = centavos(d?.valor);
      if (pa && v) saida.push(item('FIA_DIVIDA_ATIVA', ultimoDia(pa), `FIA:DA:MEI:${pa}:${slug(String(d?.tributo ?? ''))}`, v));
    }
  }
  if (tipo === 'parcelamento_detalhe' && resumo.detalhe && typeof resumo.detalhe === 'object') {
    const det = resumo.detalhe; const mod = String(modalidade || 'PARC').replace(/[^A-Z0-9-]/g, '').slice(0, 20); const num = String(det.numero ?? '').replace(/[^0-9A-Za-z]/g, '').slice(0, 30);
    if (num) {
      const c = centavos(det.consolidacao?.valorTotal); const em = isoDeDataBr(det.consolidacao?.em);
      if (c && em) saida.push(item('FIA_PARC_CONSOLIDACAO', em, `FIA:PARC:${mod}:${num}:consolidacao`, c));
      for (const p of Array.isArray(det.pagamentos) ? det.pagamentos : []) {
        const v = centavos(p?.valorPago); const data = isoDeDataBr(p?.arrecadadoEm); const mes = competenciaDeMesBr(p?.mes);
        if (v && data) saida.push(item('FIA_PARC_PARCELA_PAGA', data, `FIA:PARC:${mod}:${num}:pago:${mes ?? data.slice(0, 7)}`, v));
      }
    }
  }
  // Uma referência por item (o Contábil recusa lote com referência repetida): a última leitura vale.
  const unicos = new Map<string, ItemContabil>();
  for (const i of saida) unicos.set(`${i.tributo}|${i.competencia}|${i.referencia}`, i);
  return [...unicos.values()];
}

export type SituacaoEnvio = 'enviado' | 'erro' | 'sem_itens' | 'sem_contabil';
/** Manda os itens ao Contábil (rota autenticada servidor a servidor). Lotes de até 200; nunca lança exceção. */
export async function enviarItensAoContabil(cnpj: string, itens: ItemContabil[], cfg: { url: string; token: string | undefined }, buscar: typeof fetch = fetch): Promise<{ situacao: SituacaoEnvio; mensagem: string; itens: number }> {
  if (!itens.length) return { situacao: 'sem_itens', mensagem: 'A consulta não trouxe valor para lançar (guia, dívida ou parcelamento).', itens: 0 };
  if (!cfg.token) return { situacao: 'erro', mensagem: 'Integração entre sistemas (MURADE_INTEGRATION_TOKEN) não configurada.', itens: itens.length };
  let criados = 0;
  for (let i = 0; i < itens.length; i += 200) {
    try {
      const r = await buscar(`${cfg.url.replace(/\/$/, '')}/api/integracao/fiscoia/apuracoes`, { method: 'POST', headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ cnpj, versaoContrato: 1, apuracoes: itens.slice(i, i + 200) }), signal: AbortSignal.timeout(30_000) });
      const j: any = await r.json().catch(() => ({}));
      if (r.status === 403) return { situacao: 'sem_contabil', mensagem: 'A empresa ainda não está cadastrada no Murad Contábil; o robô tenta de novo depois.', itens: itens.length };
      if (!r.ok || j?.sucesso !== true) return { situacao: 'erro', mensagem: `O Contábil não confirmou (HTTP ${r.status}): ${String(j?.motivo || 'sem motivo').slice(0, 200)}`, itens: itens.length };
      criados += Number(j?.rascunhosContabeis?.criados) || 0;
    } catch (e: any) { return { situacao: 'erro', mensagem: `Não foi possível falar com o Contábil agora (${String(e?.message || e).slice(0, 120)}).`, itens: itens.length }; }
  }
  return { situacao: 'enviado', mensagem: `${itens.length} item(ns) entregue(s) ao Contábil${criados ? `; ${criados} pré-lançamento(s) novo(s)` : '; os pré-lançamentos saem quando as contas da origem estiverem mapeadas'}.`, itens: itens.length };
}

export function resumoEnvioContabil(c: { enviados: number; erros: number; semContabil: number; pendentes: number }): { texto: string; alerta: boolean } {
  if (!c.enviados && !c.erros && !c.semContabil && !c.pendentes) return { texto: 'Nada a enviar ao Contábil: nenhuma guia, dívida ativa ou parcelamento consultado esperando envio.', alerta: false };
  const texto = `Envio ao Contábil: ${c.enviados} enviado(s), ${c.semContabil} de empresa ainda fora do Contábil, ${c.pendentes} pendente(s) e ${c.erros} com erro.`;
  return c.erros ? { texto: `ATENÇÃO: ${texto} O robô tenta de novo de 2 em 2 horas; nenhuma consulta ao Serpro é refeita.`, alerta: true } : { texto, alerta: false };
}
