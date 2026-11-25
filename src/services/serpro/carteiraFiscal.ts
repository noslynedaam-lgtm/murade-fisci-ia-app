/**
 * Carteira fiscal: o que guardar de cada consulta ao Integra Contador JÁ FEITA e como mostrar a situação da carteira.
 * Peças puras (sem rede e sem banco). Nada aqui consulta o Serpro nem inventa situação: quando não dá para ter certeza,
 * a resposta é "a conferir" e a pessoa confere no PDF oficial.
 */
import { inflateSync, constants as zc } from 'node:zlib';
import { CATALOGO_SERVICOS } from './integraContador';
import { acharPdfBase64, lerIndicadorNovasCaixaPostal, lerListaCaixaPostal, lerPedidosParcsn, lerDetalheParcsn, lerParcelasParaGerarParcsn, lerDasMei, lerDividaAtivaMei } from './resultadoSerpro';

export type TipoResultado = 'situacao_fiscal' | 'caixa_postal_lista' | 'caixa_postal_novas' | 'parcelamento_pedidos' | 'parcelamento_detalhe' | 'parcelamento_parcelas' | 'guia_das_mei' | 'divida_ativa_mei';
export type SituacaoFiscal = 'regular' | 'pendente' | 'a_conferir';
export type OrigemSituacao = 'lida_do_pdf' | 'marcada_pela_pessoa' | 'sem_leitura';

/** Serviços cujo resultado é guardado e a qual "tipo" da carteira pertencem. */
export function tipoDoServico(chave: string): { tipo: TipoResultado; modalidade: string | null } | null {
  const s = CATALOGO_SERVICOS[chave];
  if (!s) return null;
  if (chave === 'situacaoFiscal') return { tipo: 'situacao_fiscal', modalidade: null };
  if (chave === 'caixaPostalLista') return { tipo: 'caixa_postal_lista', modalidade: null };
  if (chave === 'caixaPostalNovas') return { tipo: 'caixa_postal_novas', modalidade: null };
  // Guia do DAS do MEI e dívida ativa do MEI: guardadas para virar pré-lançamento no Contábil (Fisco IA → Contábil).
  if (chave === 'pgmeiDasPdf' || chave === 'pgmeiDasCodigoBarras') return { tipo: 'guia_das_mei', modalidade: 'PGMEI' };
  if (chave === 'pgmeiDividaAtiva') return { tipo: 'divida_ativa_mei', modalidade: 'PGMEI' };
  const parcelamento = ['PARCSN', 'PARCSN-ESP', 'PARCMEI', 'PARCMEI-ESP', 'PERTMEI', 'PERTSN', 'RELPSN'].includes(s.idSistema);
  if (!parcelamento) return null;
  if (chave.endsWith('Pedidos')) return { tipo: 'parcelamento_pedidos', modalidade: s.idSistema };
  if (chave.endsWith('Detalhe')) return { tipo: 'parcelamento_detalhe', modalidade: s.idSistema };
  if (chave.endsWith('Parcelas')) return { tipo: 'parcelamento_parcelas', modalidade: s.idSistema };
  return null;
}

/** Nome legível da modalidade de parcelamento (para tela e Agente). */
export const NOME_MODALIDADE: Record<string, string> = {
  PARCSN: 'Parcelamento do Simples (ordinário)', 'PARCSN-ESP': 'Parcelamento do Simples (especial)', PARCMEI: 'Parcelamento do MEI',
  'PARCMEI-ESP': 'Parcelamento do MEI (especial)', PERTMEI: 'PERT-MEI', PERTSN: 'PERT-SN', RELPSN: 'RELP do Simples',
};

// ------------------------------------------------------------------ Leitura do texto do PDF (relatório de situação fiscal)
function decodificarLiteral(s: string): string {
  return s.replace(/\\([nrtbf()\\]|[0-7]{1,3}|\r?\n)/g, (_t, g: string) => {
    if (/^[0-7]+$/.test(g)) return String.fromCharCode(parseInt(g, 8));
    return ({ n: '\n', r: '\r', t: '\t', b: '', f: '', '(': '(', ')': ')', '\\': '\\' } as Record<string, string>)[g] ?? '';
  });
}
/** Junta as cadeias de texto dos operadores Tj/TJ/'/" de um conteúdo de página. */
function textoDosOperadores(conteudo: string): string {
  const saida: string[] = [];
  const re = /\((?:\\.|[^\\)])*\)/gs;
  let m: RegExpExecArray | null;
  while ((m = re.exec(conteudo))) saida.push(decodificarLiteral(m[0].slice(1, -1)));
  return saida.join('');
}
/**
 * Extrai o texto legível de um PDF (fluxos comprimidos com Flate ou sem compressão). Quando a fonte usa códigos próprios
 * (texto não legível), o resultado simplesmente não contém as frases procuradas e a leitura fica "a conferir".
 */
export function textoDoPdf(pdf: Buffer): string {
  const bin = pdf.toString('latin1');
  const partes: string[] = [];
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  let guarda = 0;
  while ((m = re.exec(bin)) && guarda < 5000) {
    guarda += 1;
    const ini = m.index + m[0].length;
    const fim = bin.indexOf('endstream', ini);
    if (fim < 0) break;
    const bytes = pdf.subarray(ini, fim);
    let conteudo: string | null = null;
    try { conteudo = inflateSync(bytes, { finishFlush: zc.Z_SYNC_FLUSH }).toString('latin1'); } catch { conteudo = null; }
    if (conteudo === null) {
      // Fluxo sem filtro de compressão: o dicionário do objeto (logo antes de "stream") não traz /Filter.
      const antes = bin.slice(Math.max(0, m.index - 600), m.index);
      const dicionario = antes.slice(Math.max(0, antes.lastIndexOf(' obj')));
      if (!/\/Filter/.test(dicionario)) conteudo = bin.slice(ini, fim);
    }
    if (conteudo && /\bT[Jj]\b|'|"/.test(conteudo)) partes.push(textoDosOperadores(conteudo));
    re.lastIndex = fim + 9;
  }
  return partes.join(' ');
}
const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '');

/**
 * Classifica o relatório de situação fiscal pelo texto do PDF.
 *  - "pendente": o relatório traz alguma seção "Pendência - ..." (ex.: "Pendência - Débito (SIEF)").
 *  - "regular": não traz nenhuma seção de pendência E traz a frase "Não foram detectadas pendências".
 *  - "a_conferir": qualquer outro caso (texto ilegível, formato diferente): a pessoa abre o PDF e marca.
 * Leitura automática do PDF, nunca uma certidão: a tela sempre diz "lida do PDF — confira".
 */
export function classificarSituacaoFiscal(texto: string): { situacao: SituacaoFiscal; origem: OrigemSituacao } {
  const t = normalizar(texto);
  if (t.length < 40) return { situacao: 'a_conferir', origem: 'sem_leitura' };
  if (/pendencias?-/.test(t)) return { situacao: 'pendente', origem: 'lida_do_pdf' };
  if (t.includes('naoforamdetectadaspendencias')) return { situacao: 'regular', origem: 'lida_do_pdf' };
  return { situacao: 'a_conferir', origem: 'sem_leitura' };
}

// ------------------------------------------------------------------ O que guardar de cada resposta
export interface ResultadoParaGuardar {
  tipo: TipoResultado; modalidade: string | null; resumo: Record<string, unknown>;
  situacao: SituacaoFiscal | null; situacaoOrigem: OrigemSituacao | null; novasMensagens: 0 | 1 | 2 | null; pdf: Buffer | null;
}
const LIMITE_PDF = 10 * 1024 * 1024;

/** Monta o registro a guardar. Nulo quando o serviço não é guardado ou a resposta não veio no formato oficial (nada é inventado). */
export function resultadoParaGuardar(chave: string, dados: Record<string, string>, bruto: unknown, relatorio: unknown): ResultadoParaGuardar | null {
  const t = tipoDoServico(chave);
  if (!t) return null;
  const base = { tipo: t.tipo, modalidade: t.modalidade, situacao: null, situacaoOrigem: null, novasMensagens: null, pdf: null } as const;
  switch (t.tipo) {
    case 'situacao_fiscal': {
      const b64 = acharPdfBase64(relatorio);
      if (!b64) return null;
      const pdf = Buffer.from(b64, 'base64');
      if (!pdf.length || pdf.length > LIMITE_PDF || pdf.subarray(0, 4).toString('latin1') !== '%PDF') return null;
      let leitura: { situacao: SituacaoFiscal; origem: OrigemSituacao };
      try { leitura = classificarSituacaoFiscal(textoDoPdf(pdf)); } catch { leitura = { situacao: 'a_conferir', origem: 'sem_leitura' }; }
      return { ...base, resumo: { tamanhoPdf: pdf.length }, situacao: leitura.situacao, situacaoOrigem: leitura.origem, pdf };
    }
    case 'caixa_postal_novas': {
      const ind = lerIndicadorNovasCaixaPostal(bruto);
      if (ind === null) return null;
      return { ...base, resumo: { indicador: ind }, novasMensagens: ind };
    }
    case 'caixa_postal_lista': {
      const l = lerListaCaixaPostal(bruto);
      if (!l) return null;
      const naoLidas = l.mensagens.filter((m) => m.lida === false).length;
      return { ...base, resumo: { filtro: dados.statusLeitura ?? null, pagina: dados.indicadorPagina ?? null, quantidade: l.quantidade, naoLidas, ultimaPagina: l.ultimaPagina,
        mensagens: l.mensagens.slice(0, 60).map((m) => ({ isn: m.isn, enviadaEm: m.enviadaEm, assunto: m.assunto.slice(0, 300), lida: m.lida, cienciaEm: m.cienciaEm, origem: m.origem.slice(0, 120), relevante: m.relevante, validade: m.validade })) } };
    }
    case 'parcelamento_pedidos': {
      const p = lerPedidosParcsn(bruto);
      return p ? { ...base, resumo: { pedidos: p.slice(0, 100) } } : null;
    }
    case 'parcelamento_detalhe': {
      const d = lerDetalheParcsn(bruto);
      return d ? { ...base, resumo: { detalhe: d } } : null;
    }
    case 'parcelamento_parcelas': {
      const p = lerParcelasParaGerarParcsn(bruto);
      return p ? { ...base, resumo: { parcelas: p.slice(0, 400) } } : null;
    }
    case 'guia_das_mei': {
      const d = lerDasMei(bruto);
      return d && d.length ? { ...base, resumo: { das: d.slice(0, 24).map((x) => ({ periodo: x.periodo, documento: x.documento, vencimento: x.vencimento, principal: x.principal, multa: x.multa, juros: x.juros, total: x.total })) } } : null;
    }
    case 'divida_ativa_mei': {
      const d = lerDividaAtivaMei(bruto);
      return d ? { ...base, resumo: { debitos: d.slice(0, 200) } } : null;
    }
  }
}

// ------------------------------------------------------------------ Painel e alertas (só o que já foi guardado)
/** Mês corrente AAAAMM no fuso de Brasília. */
export function mesAtualBrasilia(agora = new Date()): string {
  const [a, m] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(agora).split('-');
  return `${a}${m}`;
}
/**
 * Parcelas de meses ANTERIORES ao mês atual que ainda aparecem como "disponíveis para emitir o DAS" na última consulta guardada:
 * indício de parcela em atraso (a pessoa confere no portal). Parcela do mês atual não entra (pode ainda estar no prazo).
 */
export function parcelasAtrasadas(parcelas: unknown, mesAtual: string): { parcela: string; valor: number | null }[] {
  if (!Array.isArray(parcelas)) return [];
  return parcelas.filter((p): p is { parcela: string; valor: number | null } => !!p && typeof (p as any).parcela === 'string' && /^(0[1-9]|1[0-2])\/\d{4}$/.test((p as any).parcela))
    .filter((p) => `${p.parcela.slice(3)}${p.parcela.slice(0, 2)}` < mesAtual)
    .map((p) => ({ parcela: p.parcela, valor: typeof p.valor === 'number' && Number.isFinite(p.valor) ? p.valor : null }));
}

export type SituacaoGeral = 'pendente' | 'atencao' | 'regular' | 'sem_consulta';
/** Cor da linha do painel: vermelho (pendente), amarelo (atenção), verde (regular) ou cinza (sem consulta guardada). */
export function situacaoGeral(p: { situacaoFiscal: SituacaoFiscal | null; novasMensagens: number | null; atrasadas: number }): SituacaoGeral {
  if (p.situacaoFiscal === 'pendente' || p.atrasadas > 0) return 'pendente';
  if (p.situacaoFiscal === 'a_conferir' || (p.novasMensagens ?? 0) > 0) return 'atencao';
  if (p.situacaoFiscal === 'regular') return 'regular';
  return 'sem_consulta';
}

/** Dias entre hoje (AAAA-MM-DD) e a data (AAAA-MM-DD). */
export function diasAte(hoje: string, data: string): number {
  return Math.round((Date.parse(`${data}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000);
}
/** Faixa de aviso do certificado A1: vencido, 7, 15 ou 30 dias; nulo se falta mais de 30 dias. */
export function faixaCertificado(hoje: string, validade: string | null): { faixa: 'vencido' | '7' | '15' | '30'; dias: number } | null {
  if (!validade || !/^\d{4}-\d{2}-\d{2}$/.test(validade)) return null;
  const dias = diasAte(hoje, validade);
  if (dias < 0) return { faixa: 'vencido', dias };
  if (dias <= 7) return { faixa: '7', dias };
  if (dias <= 15) return { faixa: '15', dias };
  if (dias <= 30) return { faixa: '30', dias };
  return null;
}
export function textoFaixaCertificado(f: { faixa: string; dias: number }): string {
  if (f.faixa === 'vencido') return `venceu há ${Math.abs(f.dias)} dia(s)`;
  if (f.dias === 0) return 'vence hoje';
  return `vence em ${f.dias} dia(s)`;
}
