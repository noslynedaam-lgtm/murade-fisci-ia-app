// Leitura do PDF de certidão que a PESSOA baixou no portal do órgão (fluxo semiautomático).
//
// O sistema não entra no portal no lugar da pessoa: os portais da SEFAZ-GO, da Prefeitura de Goiânia, da Caixa (CRF) e do TST (CNDT)
// não têm API oficial aberta e pedem verificação humana (captcha) ou bloqueiam acesso automatizado. A pessoa emite lá, solta o PDF aqui,
// e este módulo lê o texto do PDF e PROPÕE número, situação (negativa / positiva com efeito de negativa / positiva), emissão e validade.
// Nada é guardado sem a pessoa confirmar na tela. O que não for lido com segurança volta vazio para a pessoa preencher.
import { inflateSync, constants as zc } from 'node:zlib';
import type { ResultadoCertidao, TipoCertidao } from './certidoes';

// ------------------------------------------------------------------------------------------------------------------------------
// 1) Texto do PDF: fluxos Flate ou sem compressão, cadeias literais e hexadecimais, fontes com ToUnicode e objetos comprimidos (ObjStm)
// ------------------------------------------------------------------------------------------------------------------------------
interface ObjetoPdf { dicionario: string; fluxo: Buffer | null }

function inflar(b: Buffer): Buffer | null {
  try { return inflateSync(b, { finishFlush: zc.Z_SYNC_FLUSH }); } catch { return null; }
}

function objetosDoPdf(pdf: Buffer): Map<number, ObjetoPdf> {
  const bin = pdf.toString('latin1');
  const objs = new Map<number, ObjetoPdf>();
  const re = /(\d+)\s+\d+\s+obj\b/g;
  let m: RegExpExecArray | null;
  let guarda = 0;
  while ((m = re.exec(bin)) && guarda < 20000) {
    guarda += 1;
    const num = Number(m[1]);
    const ini = m.index + m[0].length;
    const fimObj = bin.indexOf('endobj', ini);
    const corpo = bin.slice(ini, fimObj < 0 ? bin.length : fimObj);
    const st = /stream\r?\n/.exec(corpo);
    if (!st) { objs.set(num, { dicionario: corpo, fluxo: null }); if (fimObj > 0) re.lastIndex = fimObj; continue; }
    const dicionario = corpo.slice(0, st.index);
    const iniFluxo = ini + st.index + st[0].length;
    const tam = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dicionario);
    let fimFluxo = tam ? iniFluxo + Number(tam[1]) : -1;
    if (fimFluxo < 0 || fimFluxo > bin.length || !/^\s*endstream/.test(bin.slice(fimFluxo, fimFluxo + 20))) fimFluxo = bin.indexOf('endstream', iniFluxo);
    if (fimFluxo < 0) break;
    const bruto = pdf.subarray(iniFluxo, fimFluxo);
    let fluxo: Buffer | null = null;
    if (/\/FlateDecode/.test(dicionario)) fluxo = inflar(bruto);
    else if (!/\/Filter/.test(dicionario)) fluxo = bruto;
    objs.set(num, { dicionario, fluxo });
    const prox = bin.indexOf('endobj', fimFluxo);
    re.lastIndex = prox > 0 ? prox : fimFluxo;
  }
  // Objetos guardados dentro de fluxos de objetos (PDF 1.5+): as fontes costumam ficar aqui.
  for (const o of [...objs.values()]) {
    if (!o.fluxo || !/\/Type\s*\/ObjStm/.test(o.dicionario)) continue;
    const n = Number(/\/N\s+(\d+)/.exec(o.dicionario)?.[1] ?? 0); const first = Number(/\/First\s+(\d+)/.exec(o.dicionario)?.[1] ?? 0);
    const txt = o.fluxo.toString('latin1');
    const nums = txt.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i < n && i * 2 + 1 < nums.length; i += 1) {
      const a = first + nums[i * 2 + 1]; const b = i + 1 < n ? first + nums[(i + 1) * 2 + 1] : txt.length;
      if (!objs.has(nums[i * 2])) objs.set(nums[i * 2], { dicionario: txt.slice(a, b), fluxo: null });
    }
  }
  return objs;
}

const utf16be = (hex: string): string => {
  if (hex.length <= 2) return hex ? String.fromCharCode(parseInt(hex, 16)) : '';
  let s = '';
  for (let i = 0; i + 4 <= hex.length; i += 4) s += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  return s;
};

interface MapaFonte { bytes: 1 | 2; mapa: Map<number, string> }

/** Lê um CMap ToUnicode (bfchar e bfrange). */
export function lerCMap(cmap: string): MapaFonte {
  const mapa = new Map<number, string>();
  let bytes: 1 | 2 = 1;
  const cs = /begincodespacerange\s*<([0-9a-fA-F]+)>/.exec(cmap);
  if (cs && cs[1].length >= 4) bytes = 2;
  for (const bloco of cmap.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? []) {
    for (const p of bloco.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) {
      if (p[1].length >= 4) bytes = 2;
      mapa.set(parseInt(p[1], 16), utf16be(p[2]));
    }
  }
  for (const bloco of cmap.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? []) {
    for (const p of bloco.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]*>|\[[^\]]*\])/g)) {
      if (p[1].length >= 4) bytes = 2;
      const lo = parseInt(p[1], 16); const hi = Math.min(parseInt(p[2], 16), lo + 65535);
      if (p[3].startsWith('[')) {
        const lista = [...p[3].matchAll(/<([0-9a-fA-F]*)>/g)].map((x) => x[1]);
        for (let c = lo; c <= hi && c - lo < lista.length; c += 1) mapa.set(c, utf16be(lista[c - lo]));
      } else {
        const base = p[3].slice(1, -1);
        const ini = parseInt(base.slice(-4) || '0', 16); const prefixo = base.length > 4 ? utf16be(base.slice(0, -4)) : '';
        for (let c = lo; c <= hi; c += 1) mapa.set(c, prefixo + String.fromCharCode(ini + (c - lo)));
      }
    }
  }
  return { bytes, mapa };
}

/** Nome do recurso de fonte (/F1) → mapa ToUnicode, ou null quando a fonte não tem (texto lido como Latin-1/WinAnsi). */
function fontesDoPdf(objs: Map<number, ObjetoPdf>): Map<string, MapaFonte | null> {
  const porObjeto = new Map<number, MapaFonte | null>();
  for (const [num, o] of objs) {
    if (!/\/Type\s*\/Font\b/.test(o.dicionario)) continue;
    const tu = /\/ToUnicode\s+(\d+)\s+\d+\s+R/.exec(o.dicionario);
    const cm = tu ? objs.get(Number(tu[1]))?.fluxo : null;
    // Fonte composta (Type0/Identity-H) sem ToUnicode: os códigos são índices de desenho, ilegíveis; fica de fora.
    if (cm) porObjeto.set(num, lerCMap(cm.toString('latin1')));
    else porObjeto.set(num, /\/Subtype\s*\/Type0/.test(o.dicionario) ? { bytes: 2, mapa: new Map() } : null);
  }
  const porNome = new Map<string, MapaFonte | null>();
  const dicionariosFonte: string[] = [];
  for (const o of objs.values()) {
    for (const m of o.dicionario.matchAll(/\/Font\s*<<([\s\S]*?)>>/g)) dicionariosFonte.push(m[1]);
    const ind = /\/Font\s+(\d+)\s+\d+\s+R/.exec(o.dicionario);
    if (ind) { const d = objs.get(Number(ind[1])); if (d) dicionariosFonte.push(d.dicionario); }
  }
  for (const d of dicionariosFonte) for (const m of d.matchAll(/\/([^\s/<>[\]()]+)\s+(\d+)\s+\d+\s+R/g)) {
    const f = porObjeto.get(Number(m[2]));
    if (f !== undefined) porNome.set(m[1], f);
  }
  return porNome;
}

function decodificarCadeia(bytes: number[], fonte: MapaFonte | null | undefined): string {
  if (!fonte) return String.fromCharCode(...bytes);
  let s = '';
  for (let i = 0; i < bytes.length; i += fonte.bytes) {
    const cod = fonte.bytes === 2 ? (bytes[i] << 8) | (bytes[i + 1] ?? 0) : bytes[i];
    const u = fonte.mapa.get(cod);
    s += u !== undefined ? u : fonte.bytes === 1 ? String.fromCharCode(cod) : '';
  }
  return s;
}

/** Percorre um fluxo de conteúdo e devolve o texto dos operadores de texto, com a fonte corrente aplicada. */
function textoDoConteudo(c: string, fontes: Map<string, MapaFonte | null>): string {
  const saida: string[] = [];
  type Item = { t: 'str'; b: number[] } | { t: 'num'; v: number } | { t: 'nome'; v: string } | { t: 'arr'; itens: Array<{ t: 'str'; b: number[] } | { t: 'num'; v: number }> };
  const pilha: Item[] = [];
  let arr: Array<{ t: 'str'; b: number[] } | { t: 'num'; v: number }> | null = null;
  const empilhar = (x: Item) => { if (arr && (x.t === 'str' || x.t === 'num')) arr.push(x); else pilha.push(x); };
  let fonte: MapaFonte | null | undefined;
  let i = 0; const n = c.length;
  const lerLiteral = (): number[] => {
    const b: number[] = []; let nivel = 1; i += 1;
    while (i < n && nivel > 0) {
      const ch = c[i];
      if (ch === '\\') {
        const nx = c[i + 1];
        if (/[0-7]/.test(nx)) { let o = ''; let k = i + 1; while (k < n && o.length < 3 && /[0-7]/.test(c[k])) { o += c[k]; k += 1; } b.push(parseInt(o, 8) & 255); i = k; continue; }
        const esc: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12, '(': 40, ')': 41, '\\': 92 };
        if (nx === '\r' || nx === '\n') { i += nx === '\r' && c[i + 2] === '\n' ? 3 : 2; continue; }
        if (esc[nx] !== undefined) b.push(esc[nx]);
        i += 2; continue;
      }
      if (ch === '(') nivel += 1;
      if (ch === ')') { nivel -= 1; if (nivel === 0) { i += 1; break; } }
      b.push(ch.charCodeAt(0) & 255); i += 1;
    }
    return b;
  };
  const lerHex = (): number[] => {
    const fim = c.indexOf('>', i); const h = c.slice(i + 1, fim < 0 ? n : fim).replace(/[^0-9a-fA-F]/g, '');
    i = fim < 0 ? n : fim + 1;
    const b: number[] = []; for (let k = 0; k < h.length; k += 2) b.push(parseInt((h.slice(k, k + 2) + '0').slice(0, 2), 16));
    return b;
  };
  while (i < n) {
    const ch = c[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (ch === '%') { while (i < n && c[i] !== '\n' && c[i] !== '\r') i += 1; continue; }
    if (ch === '(') { empilhar({ t: 'str', b: lerLiteral() }); continue; }
    if (ch === '<' && c[i + 1] === '<') { i += 2; continue; }
    if (ch === '>' && c[i + 1] === '>') { i += 2; continue; }
    if (ch === '<') { empilhar({ t: 'str', b: lerHex() }); continue; }
    if (ch === '[') { arr = []; i += 1; continue; }
    if (ch === ']') { pilha.push({ t: 'arr', itens: arr ?? [] }); arr = null; i += 1; continue; }
    if (ch === '/') { let k = i + 1; while (k < n && !/[\s/<>[\]()%{}]/.test(c[k])) k += 1; pilha.push({ t: 'nome', v: c.slice(i + 1, k) }); i = k; continue; }
    if (/[-+.\d]/.test(ch)) { let k = i + 1; while (k < n && /[-+.\d]/.test(c[k])) k += 1; empilhar({ t: 'num', v: Number(c.slice(i, k)) || 0 }); i = k; continue; }
    let k = i; while (k < n && /[A-Za-z'"*]/.test(c[k])) k += 1;
    const op = c.slice(i, Math.max(k, i + 1)); i = Math.max(k, i + 1);
    if (op === 'BI') { const fim = c.indexOf('EI', i); i = fim < 0 ? n : fim + 2; pilha.length = 0; continue; }
    if (op === 'Tf') { const nome = [...pilha].reverse().find((x) => x.t === 'nome') as { v: string } | undefined; if (nome) fonte = fontes.get(nome.v); }
    else if (op === 'Tj' || op === "'" || op === '"') { const s = [...pilha].reverse().find((x) => x.t === 'str') as { b: number[] } | undefined; if (op !== 'Tj') saida.push('\n'); if (s) saida.push(decodificarCadeia(s.b, fonte)); }
    else if (op === 'TJ') {
      const a = [...pilha].reverse().find((x) => x.t === 'arr') as { itens: Array<{ t: 'str'; b: number[] } | { t: 'num'; v: number }> } | undefined;
      for (const it of a?.itens ?? []) { if (it.t === 'str') saida.push(decodificarCadeia(it.b, fonte)); else if (it.v < -180) saida.push(' '); }
    }
    else if (op === 'Td' || op === 'TD') { const ty = pilha.length && pilha[pilha.length - 1].t === 'num' ? (pilha[pilha.length - 1] as { v: number }).v : 0; saida.push(Math.abs(ty) > 0.5 ? '\n' : ' '); }
    else if (op === 'T*' || op === 'Tm' || op === 'ET') saida.push(op === 'T*' ? '\n' : ' ');
    pilha.length = 0;
  }
  return saida.join('');
}

/** Extrai o texto legível do PDF. PDF digitalizado (só imagem) devolve texto vazio: a pessoa preenche. */
export function textoDoPdfCertidao(pdf: Buffer): string {
  if (!Buffer.isBuffer(pdf) || pdf.subarray(0, 5).toString('latin1') !== '%PDF-') return '';
  const objs = objetosDoPdf(pdf);
  const fontes = fontesDoPdf(objs);
  const partes: string[] = [];
  for (const o of objs.values()) {
    if (!o.fluxo || /\/Type\s*\/(ObjStm|XRef)|\/Subtype\s*\/Image/.test(o.dicionario)) continue;
    const c = o.fluxo.toString('latin1');
    if (!/\bBT\b/.test(c) || c.includes('begincmap')) continue;
    partes.push(textoDoConteudo(c, fontes));
  }
  return partes.join('\n').replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').trim();
}

// ------------------------------------------------------------------------------------------------------------------------------
// 2) Do texto aos campos da certidão
// ------------------------------------------------------------------------------------------------------------------------------
export { ROTULO_RESULTADO, ehResultadoCertidao, type ResultadoCertidao } from './certidoes';

/**
 * Prazos fixados em norma, usados SÓ quando o PDF não traz a validade escrita (a pessoa confirma):
 *  - CNDT: 180 dias da expedição — CLT art. 642-A, § 4º (Lei 12.440/2011).
 *  - Certidão de débito inscrito em dívida ativa de Goiás: 60 dias da expedição — IN 405/99-GSF, art. 1º, § 1º, II (redação da IN 1.173/13-GSF).
 * CRF do FGTS e CND de Goiânia: sem prazo fixo confirmado em norma; a validade é a impressa no documento.
 */
export const PRAZO_LEGAL: Partial<Record<TipoCertidao, { dias: number; uf?: string; fonte: string }>> = {
  trabalhista: { dias: 180, fonte: 'CLT, art. 642-A, § 4º (Lei 12.440/2011)' },
  estadual: { dias: 60, uf: 'GO', fonte: 'IN 405/99-GSF, art. 1º, § 1º, II (redação da IN 1.173/13-GSF)' },
};

export interface LeituraCertidao {
  textoLido: boolean;
  tipoDetectado: TipoCertidao | null;
  resultado: ResultadoCertidao | null;
  numero: string | null;
  emissao: string | null;
  validade: string | null;
  validadeOrigem: 'lida_do_pdf' | 'calculada_pela_norma' | null;
  fonteValidade: string | null;
  cnpjsNoPdf: string[];
  cnpjConfere: 'sim' | 'mesma_raiz' | 'nao' | 'nao_encontrado';
  avisos: string[];
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const DATA_BR = String.raw`(\d{2})\s*[/.-]\s*(\d{2})\s*[/.-]\s*(\d{4})`;
function iso(d: string, m: string, a: string): string | null {
  const t = new Date(Date.UTC(+a, +m - 1, +d));
  return t.getUTCFullYear() === +a && t.getUTCMonth() === +m - 1 && t.getUTCDate() === +d ? `${a}-${m}-${d}` : null;
}
function somarDias(isoData: string, dias: number): string {
  const t = new Date(Date.UTC(+isoData.slice(0, 4), +isoData.slice(5, 7) - 1, +isoData.slice(8, 10)) + dias * 86_400_000);
  return t.toISOString().slice(0, 10);
}

/** Qual certidão o PDF parece ser (para avisar quando a pessoa soltou o PDF na linha errada). */
export function tipoDoTexto(t: string): TipoCertidao | null {
  const s = semAcento(t).toLowerCase().replace(/\s+/g, ' ');
  if (/debitos trabalhistas|banco nacional de devedores trabalhistas/.test(s)) return 'trabalhista';
  if (/regularidade do fgts|fundo de garantia do tempo de servico/.test(s)) return 'fgts';
  if (/receita federal|procuradoria-geral da fazenda nacional|divida ativa da uniao/.test(s)) return 'federal';
  if (/prefeitura|municipio de goiania|secretaria municipal|fazenda municipal|tributos municipais/.test(s)) return 'municipal';
  if (/secretaria de estado|secretaria da economia|secretaria da fazenda|estado de goias|sefaz|divida ativa|procuradoria-geral do estado/.test(s)) return 'estadual';
  return null;
}

/** Situação pela PRIMEIRA expressão que aparece (o título vem antes das observações do rodapé). */
export function resultadoDoTexto(t: string, tipo: TipoCertidao): ResultadoCertidao | null {
  const s = semAcento(t).toLowerCase().replace(/\s+/g, ' ');
  const achados: Array<{ r: ResultadoCertidao; i: number }> = [];
  const procurar = (re: RegExp, r: ResultadoCertidao) => { const m = re.exec(s); if (m) achados.push({ r, i: m.index }); };
  // "Positiva ... com efeito(s) de negativa" (às vezes com "de débitos trabalhistas" no meio) é diferente de "positiva".
  const PCEN = /^positiva(?: de debitos(?: [a-z]+){0,3})?,? com efeitos? de negativa/;
  for (const m of s.matchAll(/(certidao )?positiva/g)) {
    const resto = s.slice(m.index + (m[1] ? m[1].length : 0));
    if (PCEN.test(resto)) { achados.push({ r: 'positiva_efeito_negativa', i: m.index }); break; }
    if (m[1] || /^positiva de debitos/.test(resto)) { achados.push({ r: 'positiva', i: m.index }); break; }
  }
  procurar(/certidao negativa|negativa de debitos|nao constam? (?:debitos|pendencias|registros?)|nao (?:ha|existem?) debitos/, 'negativa');
  if (tipo === 'fgts') procurar(/encontra-se em situacao regular|situacao regular perante o fundo/, 'negativa');
  if (achados.length === 0) return null;
  achados.sort((a, b) => a.i - b.i);
  return achados[0].r;
}

export function lerCertidaoDoTexto(tipo: TipoCertidao, texto: string, opcoes: { cnpjEsperado?: string; uf?: string | null } = {}): LeituraCertidao {
  const avisos: string[] = [];
  const t = semAcento(texto).replace(/\s+/g, ' ');
  const textoLido = t.replace(/[^A-Za-z0-9]/g, '').length >= 40;
  if (!textoLido) {
    return { textoLido: false, tipoDetectado: null, resultado: null, numero: null, emissao: null, validade: null, validadeOrigem: null, fonteValidade: null, cnpjsNoPdf: [], cnpjConfere: 'nao_encontrado', avisos: ['Não consegui ler o texto deste PDF (pode ser imagem digitalizada). Preencha número, situação e validade olhando o documento.'] };
  }
  const tipoDetectado = tipoDoTexto(t);
  if (tipoDetectado && tipoDetectado !== tipo) avisos.push(`Este PDF parece ser outra certidão (${tipoDetectado}), não a que você escolheu (${tipo}). Confira antes de guardar.`);
  const resultado = resultadoDoTexto(t, tipo);
  if (!resultado) avisos.push('Não achei no texto se é negativa ou positiva. Escolha olhando o documento.');

  // Validade: "Validade: 10/11/2026 a 09/12/2026" (CRF) → fim do período; "válida até", "Validade:" etc.
  let validade: string | null = null; let validadeOrigem: LeituraCertidao['validadeOrigem'] = null; let fonteValidade: string | null = null;
  const periodo = new RegExp(String.raw`validade\s*:?\s*(?:de\s*)?${DATA_BR}\s*(?:a|ate|-)\s*${DATA_BR}`, 'i').exec(t);
  if (periodo) validade = iso(periodo[4], periodo[5], periodo[6]);
  if (!validade) {
    const v = new RegExp(String.raw`(?:valida\s+ate(?:\s+o\s+dia)?|validade\s*(?:ate|:)?|data\s+de\s+validade\s*:?|vencimento\s*:?|valido\s+ate)\s*:?\s*${DATA_BR}`, 'i').exec(t);
    if (v) validade = iso(v[1], v[2], v[3]);
  }
  if (validade) validadeOrigem = 'lida_do_pdf';

  // Emissão / expedição.
  let emissao: string | null = null;
  const e = new RegExp(String.raw`(?:expedicao|emitida\s+(?:em|no\s+dia)|emissao|data\s+da\s+emissao|informacao\s+obtida\s+em|emitida\s+as\s+[\d:h]+\s+(?:horas\s+)?do\s+dia|gerada\s+em|data\s*:)\s*:?\s*${DATA_BR}`, 'i').exec(t);
  if (e) emissao = iso(e[1], e[2], e[3]);
  if (!emissao && periodo) emissao = null; // o início do período do CRF não é a data de emissão: não inventa.

  if (!validade) {
    const p = PRAZO_LEGAL[tipo];
    if (p && emissao && (!p.uf || (opcoes.uf ?? '').toUpperCase() === p.uf)) {
      validade = somarDias(emissao, p.dias); validadeOrigem = 'calculada_pela_norma'; fonteValidade = p.fonte;
      avisos.push(`A validade não está escrita no texto lido; calculei ${p.dias} dias da emissão (${p.fonte}). Confira no documento.`);
    } else avisos.push('Não achei a validade no texto. Preencha olhando o documento.');
  }
  if (validade && emissao && validade < emissao) { avisos.push('A validade lida ficou antes da emissão; confira as duas datas.'); }

  // Número / código de controle.
  const padroes: RegExp[] = [];
  if (tipo === 'fgts') padroes.push(/certificacao\s+(?:numero|n[º°o.]*)\s*:?\s*([0-9]{8,30})/i);
  if (tipo === 'trabalhista') padroes.push(/certidao\s+n[º°o.]*\s*:?\s*([0-9][0-9./-]{4,30})/i);
  padroes.push(
    /(?:numero\s+da\s+certidao|n[º°o.]*\s+da\s+certidao|certidao\s+(?:numero|n[º°o.]+))\s*:?\s*([A-Za-z0-9][A-Za-z0-9./-]{3,40})/i,
    /(?:codigo\s+de\s+(?:controle|autenticidade|autenticacao|validacao|verificacao)(?:\s+da\s+certidao)?)\s*:?\s*([A-Za-z0-9][A-Za-z0-9.\/-]{3,60})/i,
    /(?:protocolo|numero)\s*:\s*([A-Za-z0-9][A-Za-z0-9./-]{3,40})/i,
  );
  let numero: string | null = null;
  for (const re of padroes) { const m = re.exec(t); if (m) { numero = m[1].replace(/[.\-/]+$/, ''); break; } }
  if (!numero) avisos.push('Não achei o número/código de controle. Preencha olhando o documento.');

  // CNPJ do documento × CNPJ da empresa.
  const cnpjsNoPdf = [...new Set([...t.matchAll(/\b(\d{2})\.?(\d{3})\.?(\d{3})\s*\/?\s*(\d{4})\s*-?\s*(\d{2})\b/g)].map((m) => m.slice(1, 6).join('')))];
  let cnpjConfere: LeituraCertidao['cnpjConfere'] = 'nao_encontrado';
  const esperado = (opcoes.cnpjEsperado ?? '').replace(/\D/g, '');
  if (esperado.length === 14 && cnpjsNoPdf.length) {
    if (cnpjsNoPdf.includes(esperado)) cnpjConfere = 'sim';
    else if (cnpjsNoPdf.some((c) => c.slice(0, 8) === esperado.slice(0, 8))) { cnpjConfere = 'mesma_raiz'; avisos.push('O CNPJ do PDF é de outro estabelecimento da mesma empresa (mesma raiz). Confira se é o certo.'); }
    else { cnpjConfere = 'nao'; avisos.push('O CNPJ que está no PDF NÃO é o desta empresa. Confira se baixou a certidão da empresa certa.'); }
  } else if (esperado.length === 14) avisos.push('Não achei o CNPJ no texto do PDF; confira se é da empresa certa.');

  return { textoLido, tipoDetectado, resultado, numero, emissao, validade, validadeOrigem, fonteValidade, cnpjsNoPdf, cnpjConfere, avisos };
}

/** Atalho: PDF → leitura. Tamanho máximo igual ao da tabela (3 MB). */
export const PDF_MAX_BYTES = 3_145_728;
export function lerCertidaoDoPdf(tipo: TipoCertidao, pdf: Buffer, opcoes: { cnpjEsperado?: string; uf?: string | null } = {}): LeituraCertidao {
  return lerCertidaoDoTexto(tipo, textoDoPdfCertidao(pdf), opcoes);
}
