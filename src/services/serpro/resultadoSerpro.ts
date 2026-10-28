/** Transforma a resposta bruta do SERPRO (PGDAS-D, declarações do ano) em linhas legíveis. Sem rede; nada é inventado. */
export interface LinhaDeclaracao {
  periodo: string;       // 06/2026
  numero: string;        // número da declaração
  tipo: string;          // Original / Retificadora
  transmitidoEm: string; // dd/mm/aaaa hh:mm
  malha: string;
  das: string;           // número do DAS ou —
  dasPago: boolean | null;
}

function dataHora(v: unknown): string {
  const s = String(v ?? '');
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?$/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : s || '—';
}
function periodo(v: unknown): string {
  const s = String(v ?? '');
  return /^\d{6}$/.test(s) ? `${s.slice(4)}/${s.slice(0, 4)}` : s || '—';
}

export function lerDeclaracoes(bruto: unknown): LinhaDeclaracao[] | null {
  let dados: unknown = (bruto as { dados?: unknown } | null)?.dados;
  if (typeof dados === 'string') { try { dados = JSON.parse(dados); } catch { return null; } }
  if (dados === undefined || dados === null || dados === '') return null;
  const anos = Array.isArray(dados) ? dados : [dados];
  const linhas: LinhaDeclaracao[] = [];
  for (const ano of anos as Record<string, unknown>[]) {
    const periodos = Array.isArray(ano?.periodos) ? ano.periodos as Record<string, unknown>[] : null;
    if (!periodos) return null;
    for (const p of periodos) {
      const operacoes = Array.isArray(p.operacoes) ? p.operacoes as Record<string, unknown>[] : [];
      for (const op of operacoes) {
        const idx = (op.indiceDeclaracao ?? {}) as Record<string, unknown>;
        const das = idx.indiceDas as Record<string, unknown> | null | undefined;
        linhas.push({
          periodo: periodo(p.periodoApuracao),
          numero: String(idx.numeroDeclaracao ?? '—'),
          tipo: String(op.tipoOperacao ?? '—'),
          transmitidoEm: dataHora(idx.dataHoraTransmissao),
          malha: String(idx.malha ?? '').trim(),
          das: das ? String(das.numeroDas ?? das.numero ?? 'Emitido') : '—',
          dasPago: das && typeof das.dasPago === 'boolean' ? das.dasPago : null,
        });
      }
    }
  }
  return linhas;
}

const aspas = (v: string) => `"${v.replace(/"/g, '""')}"`;
/** CSV com ponto e vírgula e BOM, para abrir direto no Excel brasileiro. */
export function declaracoesParaCsv(linhas: LinhaDeclaracao[]): string {
  const cab = ['Período', 'Nº da declaração', 'Tipo', 'Transmitida em', 'Malha', 'DAS', 'DAS pago'];
  const corpo = linhas.map(l => [l.periodo, l.numero, l.tipo, l.transmitidoEm, l.malha || '—', l.das, l.dasPago === null ? '—' : l.dasPago ? 'Sim' : 'Não']);
  return '﻿' + [cab, ...corpo].map(r => r.map(aspas).join(';')).join('\r\n');
}

function dadosComoObjeto(bruto: unknown): unknown {
  let d: unknown = (bruto as { dados?: unknown } | null)?.dados;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return null; } }
  return d;
}

/** Situação fiscal (SITFIS), etapa 1: o SERPRO devolve um protocolo e o tempo de espera em ms. */
export function lerProtocoloSitfis(bruto: unknown): { protocolo: string; esperaMs: number } | null {
  const d = dadosComoObjeto(bruto) as { protocoloRelatorio?: unknown; tempoEspera?: unknown } | null;
  if (!d || typeof d.protocoloRelatorio !== 'string' || !d.protocoloRelatorio) return null;
  const t = Number(d.tempoEspera);
  return { protocolo: d.protocoloRelatorio, esperaMs: Number.isFinite(t) && t > 0 ? t : 4000 };
}

/** Procura em qualquer ponto da resposta um PDF em base64 (começa com "JVBERi"). */
export function acharPdfBase64(valor: unknown, nivel = 0): string | null {
  if (nivel > 6 || valor === null || valor === undefined) return null;
  if (typeof valor === 'string') {
    if (/^JVBERi[A-Za-z0-9+/=\s]{100,}$/.test(valor)) return valor.replace(/\s/g, '');
    if (valor.startsWith('{') || valor.startsWith('[')) { try { return acharPdfBase64(JSON.parse(valor), nivel + 1); } catch { return null; } }
    return null;
  }
  if (Array.isArray(valor)) { for (const v of valor) { const r = acharPdfBase64(v, nivel + 1); if (r) return r; } return null; }
  if (typeof valor === 'object') { for (const v of Object.values(valor as Record<string, unknown>)) { const r = acharPdfBase64(v, nivel + 1); if (r) return r; } }
  return null;
}

/** CONSXMLDECLARACAO38: dados = {"XMLStringBase64": "..."}. Devolve o XML em texto (UTF-8) ou null. */
export function lerXmlDeclaracao(bruto: unknown): string | null {
  const d = dadosComoObjeto(bruto) as { XMLStringBase64?: unknown } | null;
  if (!d || typeof d.XMLStringBase64 !== 'string' || !d.XMLStringBase64) return null;
  const xml = Buffer.from(d.XMLStringBase64.replace(/\s/g, ''), 'base64').toString('utf8');
  return xml.includes('<ProcDctf') ? xml : null;
}

/** TRANSDECLARACAO310: dados = {"NumeroRecibo": 24781}. */
export function lerReciboTransmissao(bruto: unknown): string | null {
  const d = dadosComoObjeto(bruto) as { NumeroRecibo?: unknown } | null;
  return d && (typeof d.NumeroRecibo === 'number' || typeof d.NumeroRecibo === 'string') && String(d.NumeroRecibo) ? String(d.NumeroRecibo) : null;
}

// ---------------------------------------------------------------- Caixa Postal (CAIXAPOSTAL, páginas oficiais do Serpro)
export interface MensagemCaixaPostal {
  isn: string; numeroControle: string; enviadaEm: string; assunto: string; lida: boolean | null; dataLeitura: string; cienciaEm: string;
  origem: string; relevante: boolean | null; validade: string; codigoModelo: string;
}
export interface ListaCaixaPostal { quantidade: number; ultimaPagina: boolean; proximaPagina: string | null; mensagens: MensagemCaixaPostal[] }
export interface DetalheCaixaPostal extends MensagemCaixaPostal { corpo: string }

function dadosDoGateway(bruto: unknown): Record<string, unknown> | null {
  let dados: unknown = (bruto as { dados?: unknown } | null)?.dados;
  if (typeof dados === 'string') { try { dados = JSON.parse(dados); } catch { return null; } }
  return dados && typeof dados === 'object' && !Array.isArray(dados) ? dados as Record<string, unknown> : null;
}
function data8(v: unknown): string { const s = String(v ?? ''); const m = /^(\d{4})(\d{2})(\d{2})$/.exec(s); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; }
function hora6(v: unknown): string { const s = String(v ?? '').padStart(6, '0'); return /^\d{6}$/.test(s) ? `${s.slice(0, 2)}:${s.slice(2, 4)}` : ''; }
/** O assunto traz ++VARIAVEL++ no lugar do valorParametroAssunto (regra da página do Serpro). */
export function assuntoCaixaPostal(assuntoModelo: unknown, valorParametro: unknown): string {
  return String(assuntoModelo ?? '').replace(/\+\+VARIAVEL\+\+/g, String(valorParametro ?? '')).trim();
}
/** O corpo traz ++1++, ++2++… no lugar das variáveis, na ordem do array (regra da página do Serpro). */
export function corpoCaixaPostal(corpoModelo: unknown, variaveis: unknown): string {
  const lista = Array.isArray(variaveis) ? variaveis.map(String) : [];
  return String(corpoModelo ?? '').replace(/\+\+(\d{1,2})\+\+/g, (todo, n) => lista[Number(n) - 1] ?? todo);
}
function mensagem(m: Record<string, unknown>): MensagemCaixaPostal {
  const env = data8(m.dataEnvio); const hora = hora6(m.horaEnvio);
  // Na página do Serpro o domínio "0 – Não lida / 1 – Lida" aparece na linha do favorito; a leitura só é afirmada quando o indicador é 0 ou 1.
  const ind = String(m.indicadorLeitura ?? '');
  return {
    isn: String(m.isn ?? ''), numeroControle: String(m.numeroControle ?? ''), enviadaEm: env ? `${env}${hora ? ` ${hora}` : ''}` : '—',
    assunto: assuntoCaixaPostal(m.assuntoModelo, m.valorParametroAssunto) || '—', lida: ind === '1' ? true : ind === '0' ? false : null,
    dataLeitura: data8(m.dataLeitura), cienciaEm: data8(m.dataCiencia), origem: String(m.descricaoOrigem ?? '').trim(),
    relevante: String(m.relevancia ?? '') === '2' ? true : String(m.relevancia ?? '') === '1' ? false : null, validade: data8(m.dataValidade ?? m.dataExpiracao), codigoModelo: String(m.codigoModelo ?? ''),
  };
}
export function lerListaCaixaPostal(bruto: unknown): ListaCaixaPostal | null {
  const d = dadosDoGateway(bruto); if (!d || !Array.isArray(d.listaMensagens)) return null;
  const mensagens = (d.listaMensagens as Record<string, unknown>[]).filter(m => m && typeof m === 'object').map(mensagem);
  const prox = String(d.ponteiroProximaPagina ?? '').trim();
  return { quantidade: mensagens.length, ultimaPagina: String(d.indicadorUltimaPagina ?? '') !== 'N', proximaPagina: /^\d+$/.test(prox) && prox !== '0' ? prox : null, mensagens };
}
export function lerDetalheCaixaPostal(bruto: unknown): DetalheCaixaPostal | null {
  const d = dadosDoGateway(bruto); if (!d || !Array.isArray(d.conteudo) || !d.conteudo[0] || typeof d.conteudo[0] !== 'object') return null;
  const m = d.conteudo[0] as Record<string, unknown>;
  return { ...mensagem(m), corpo: corpoCaixaPostal(m.corpoModelo, m.variaveis) };
}
/** 0 = nenhuma, 1 = uma, 2 = várias; null se a resposta não vier no formato do Serpro. */
export function lerIndicadorNovasCaixaPostal(bruto: unknown): 0 | 1 | 2 | null {
  const d = dadosDoGateway(bruto); const v = String(d?.indicadorMensagensNovas ?? '');
  return v === '0' ? 0 : v === '1' ? 1 : v === '2' ? 2 : null;
}

// ---------------------------------------------------------------- Parcelamento do Simples Nacional ordinário (PARCSN, páginas oficiais)
const dia8 = (v: unknown) => { const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(v ?? '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
const mes6 = (v: unknown) => { const m = /^(\d{4})(\d{2})$/.exec(String(v ?? '')); return m ? `${m[2]}/${m[1]}` : ''; };
const dh14 = (v: unknown) => { const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(String(v ?? '')); return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : ''; };
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export interface PedidoParcsn { numero: string; pedidoEm: string; situacao: string; situacaoEm: string }
export function lerPedidosParcsn(bruto: unknown): PedidoParcsn[] | null {
  const d = dadosDoGateway(bruto); if (!d || !Array.isArray(d.parcelamentos)) return null;
  return (d.parcelamentos as Record<string, unknown>[]).filter(p => p && typeof p === 'object').map(p => ({ numero: String(p.numero ?? ''), pedidoEm: dia8(p.dataDoPedido) || '—', situacao: String(p.situacao ?? '—'), situacaoEm: dia8(p.dataDaSituacao) }));
}

export interface PagamentoParcsn { mes: string; vencimentoDas: string; arrecadadoEm: string; valorPago: number | null }
export interface DetalheParcsn {
  numero: string; pedidoEm: string; situacao: string; situacaoEm: string;
  consolidacao: { valorTotal: number | null; quantidadeParcelas: number | null; primeiraParcela: number | null; parcelaBasica: number | null; em: string; entrada?: { valorEntrada: number | null; parcelasEntrada: number | null; parcelaEntrada: number | null; valorDivida: number | null }; debitos: { periodo: string; vencimento: string; processo: string; saldoOriginal: number | null; valorAtualizado: number | null }[] } | null;
  alteracoesDivida: number; restanteDivida?: number; pagamentos: PagamentoParcsn[];
}
export function lerDetalheParcsn(bruto: unknown): DetalheParcsn | null {
  const d = dadosDoGateway(bruto); if (!d || d.numero === undefined) return null;
  const c = d.consolidacaoOriginal && typeof d.consolidacaoOriginal === 'object' ? d.consolidacaoOriginal as Record<string, unknown> : null;
  return {
    numero: String(d.numero), pedidoEm: dia8(d.dataDoPedido) || '—', situacao: String(d.situacao ?? '—'), situacaoEm: dia8(d.dataDaSituacao),
    consolidacao: c ? {
      valorTotal: num(c.valorTotalConsolidado), quantidadeParcelas: num(c.quantidadeParcelas), primeiraParcela: num(c.primeiraParcela), parcelaBasica: num(c.parcelaBasica), em: dh14(c.dataConsolidacao),
      // PERTMEI (OBTERPARC224) e RELPSN (OBTERPARC194): a consolidação traz entrada e dívida em campos próprios
      ...(c.valorTotalConsolidadoDaEntrada !== undefined || c.valorTotalConsolidadoDaDivida !== undefined || c.valorConsolidadoDivida !== undefined ? { entrada: { valorEntrada: num(c.valorTotalConsolidadoDaEntrada), parcelasEntrada: num(c.quantidadeParcelasDaEntrada ?? c.quantidadeParcelasDeEntrada), parcelaEntrada: num(c.parcelaBasicaDaEntrada ?? c.parcelaDeEntrada), valorDivida: num(c.valorTotalConsolidadoDaDivida ?? c.valorConsolidadoDivida) } } : {}),
      debitos: (Array.isArray(c.detalhesConsolidacao) ? c.detalhesConsolidacao as Record<string, unknown>[] : []).map(x => ({ periodo: mes6(x.periodoApuracao), vencimento: dia8(x.vencimento), processo: String(x.numeroProcesso ?? ''), saldoOriginal: num(x.saldoDevedorOriginal), valorAtualizado: num(x.valorAtualizado) })),
    } : null,
    alteracoesDivida: Array.isArray(d.alteracoesDivida) ? d.alteracoesDivida.length : 0,
    ...(Array.isArray(d.consolidacoesRestanteDivida) ? { restanteDivida: d.consolidacoesRestanteDivida.length } : {}),
    pagamentos: (Array.isArray(d.demonstrativoPagamentos) ? d.demonstrativoPagamentos as Record<string, unknown>[] : []).map(x => ({ mes: mes6(x.mesDaParcela), vencimentoDas: dia8(x.vencimentoDoDas), arrecadadoEm: dia8(x.dataDeArrecadacao), valorPago: num(x.valorPago) })),
  };
}

export interface DebitoPagoParcsn { periodo: string; processo: string; itens: { tributo: string; principal: number | null; multa: number | null; juros: number | null; total: number | null; ente: string }[] }
export interface PagamentoDetalhadoParcsn { numeroDas: string; vencimento: string; paDas: string; geradoEm: string; parcelamento: string; parcela: string; limiteAcolhimento: string; pagoEm: string; bancoAgencia: string; valorArrecadado: number | null; debitos: DebitoPagoParcsn[] }
export function lerPagamentoParcsn(bruto: unknown): PagamentoDetalhadoParcsn | null {
  const d = dadosDoGateway(bruto); if (!d || (d.numeroDas === undefined && d.numeroParcela === undefined)) return null;
  return {
    numeroDas: String(d.numeroDas ?? ''), vencimento: dia8(d.dataVencimento), paDas: mes6(d.paDasGerado), geradoEm: dh14(d.geradoEm), parcelamento: String(d.numeroParcelamento ?? ''), parcela: String(d.numeroParcela ?? ''),
    limiteAcolhimento: dia8(d.dataLimiteAcolhimento), pagoEm: dia8(d.dataPagamento), bancoAgencia: String(d.bancoAgencia ?? ''), valorArrecadado: num(d.valorPagoArrecadacao),
    debitos: (Array.isArray(d.pagamentoDebitos) ? d.pagamentoDebitos as Record<string, unknown>[] : []).map(x => ({ periodo: mes6(x.paDebito), processo: String(x.processo ?? ''),
      itens: (Array.isArray(x.discriminacoesDebito) ? x.discriminacoesDebito as Record<string, unknown>[] : []).map(i => ({ tributo: String(i.tributo ?? ''), principal: num(i.principal), multa: num(i.multa), juros: num(i.juros), total: num(i.total), ente: String(i.enteFederadoDestino ?? '') })) })),
  };
}

export interface ParcelaParaGerar { parcela: string; valor: number | null }
/** PARCELASPARAGERAR162: dados = {"listaParcela":[{"parcela":AAAAMM,"valor":n}]}. */
export function lerParcelasParaGerarParcsn(bruto: unknown): ParcelaParaGerar[] | null {
  const d = dadosDoGateway(bruto); if (!d || !Array.isArray(d.listaParcela)) return null;
  return (d.listaParcela as Record<string, unknown>[]).filter(p => p && typeof p === 'object').map(p => ({ parcela: mes6(p.parcela) || String(p.parcela ?? ''), valor: num(p.valor) }));
}
