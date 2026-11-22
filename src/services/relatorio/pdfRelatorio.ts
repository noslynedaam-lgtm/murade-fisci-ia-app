/**
 * Gera o PDF do relatório para o cliente sem biblioteca externa: PDF 1.4 com as fontes padrão Helvetica (acentos pela codificação
 * WinAnsi), faixas coloridas e o logo do escritório em JPEG. A4, quebra de página automática e "Página X de Y" no rodapé.
 * Peça pura: recebe o relatório montado e devolve os bytes do PDF.
 */
import type { Cor, RelatorioCliente } from './relatorioCliente';
import { cnpjFormatado, dataBr } from './relatorioCliente';

// Larguras oficiais (AFM) da Helvetica e Helvetica-Bold, caracteres 32 a 126, em milésimos do tamanho da fonte.
const W_REG = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const W_BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];

const ESPECIAIS: Record<string, number> = { '€': 0x80, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97 };
/** Converte texto para bytes WinAnsi (o que não existe vira "?"). */
export function paraWinAnsi(t: string): number[] {
  const out: number[] = [];
  for (const ch of t.normalize('NFC')) {
    const c = ch.codePointAt(0)!;
    if (ESPECIAIS[ch] !== undefined) out.push(ESPECIAIS[ch]);
    else if ((c >= 32 && c <= 126) || (c >= 0xa0 && c <= 0xff)) out.push(c);
    else if (c === 9 || c === 10 || c === 13) out.push(32);
    else out.push(63);
  }
  return out;
}
function larguraByte(b: number, negrito: boolean): number {
  const tab = negrito ? W_BOLD : W_REG;
  if (b >= 32 && b <= 126) return tab[b - 32];
  if (b === 0x95) return 350;
  if (b === 0x96) return 556;
  if (b === 0x97) return 1000;
  if (b === 0x85) return 1000;
  if (b >= 0xc0) { // letra acentuada: largura da letra sem acento
    const base = String.fromCharCode(b).normalize('NFD').charCodeAt(0);
    if (base >= 32 && base <= 126) return tab[base - 32];
  }
  return 556;
}
export function larguraTexto(t: string, tamanho: number, negrito = false): number {
  return paraWinAnsi(t).reduce((s, b) => s + larguraByte(b, negrito), 0) * tamanho / 1000;
}
/** Quebra o texto em linhas que cabem na largura (pontos). */
export function quebrarLinhas(t: string, tamanho: number, largura: number, negrito = false): string[] {
  const linhas: string[] = [];
  for (const paragrafo of t.split('\n')) {
    let atual = '';
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (larguraTexto(tentativa, tamanho, negrito) <= largura) { atual = tentativa; continue; }
      if (atual) linhas.push(atual);
      // palavra maior que a linha: corta
      let resto = palavra;
      while (larguraTexto(resto, tamanho, negrito) > largura && resto.length > 1) {
        let n = resto.length - 1;
        while (n > 1 && larguraTexto(resto.slice(0, n), tamanho, negrito) > largura) n -= 1;
        linhas.push(resto.slice(0, n)); resto = resto.slice(n);
      }
      atual = resto;
    }
    linhas.push(atual);
  }
  return linhas;
}
const literal = (t: string) => `(${paraWinAnsi(t).map((b) => (b === 0x28 || b === 0x29 || b === 0x5c ? `\\${String.fromCharCode(b)}` : b < 32 || b > 126 ? `\\${b.toString(8).padStart(3, '0')}` : String.fromCharCode(b))).join('')})`;

/** Lê largura, altura e cores de um JPEG (marcador SOF). Nulo se não for JPEG utilizável. */
export function dimensoesJpeg(buf: Buffer): { largura: number; altura: number; componentes: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const m = buf[i + 1];
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    const tam = buf.readUInt16BE(i + 2);
    if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) {
      const altura = buf.readUInt16BE(i + 5); const largura = buf.readUInt16BE(i + 7); const componentes = buf[i + 9];
      if (!largura || !altura || (componentes !== 1 && componentes !== 3)) return null;
      return { largura, altura, componentes };
    }
    i += 2 + tam;
  }
  return null;
}

const RGB: Record<Cor | 'tinta' | 'suave' | 'marca' | 'branco', [number, number, number]> = {
  verde: [0.06, 0.6, 0.36], amarelo: [0.85, 0.55, 0.05], vermelho: [0.82, 0.16, 0.22], cinza: [0.55, 0.58, 0.62],
  tinta: [0.1, 0.12, 0.16], suave: [0.38, 0.42, 0.48], marca: [0.1, 0.14, 0.49], branco: [1, 1, 1],
};
const FUNDO: Record<Cor, [number, number, number]> = { verde: [0.9, 0.97, 0.93], amarelo: [1, 0.96, 0.86], vermelho: [0.99, 0.91, 0.92], cinza: [0.95, 0.96, 0.97] };
const ROTULO_COR: Record<Cor, string> = { verde: 'EM DIA', amarelo: 'ATENÇÃO', vermelho: 'PENDÊNCIA', cinza: 'SEM CONSULTA' };
const f = (n: number) => (Math.round(n * 100) / 100).toString();
const cor = (c: [number, number, number], fill = true) => `${c.map(f).join(' ')} ${fill ? 'rg' : 'RG'}`;

const LARG = 595.28; const ALT = 841.89; const MARGEM = 42; const UTIL = LARG - 2 * MARGEM;

class Paginador {
  paginas: string[][] = [];
  y = 0;
  constructor(private cabecalho: (p: Paginador) => void) { this.nova(); }
  get ops() { return this.paginas[this.paginas.length - 1]; }
  nova() { this.paginas.push([]); this.y = ALT - MARGEM; this.cabecalho(this); }
  garantir(altura: number) { if (this.y - altura < MARGEM + 30) this.nova(); }
  retangulo(x: number, y: number, w: number, h: number, c: [number, number, number]) { this.ops.push(`${cor(c)} ${f(x)} ${f(y)} ${f(w)} ${f(h)} re f`); }
  texto(x: number, y: number, t: string, tam: number, negrito = false, c: [number, number, number] = RGB.tinta) {
    this.ops.push(`BT ${cor(c)} /${negrito ? 'F2' : 'F1'} ${f(tam)} Tf ${f(x)} ${f(y)} Td ${literal(t)} Tj ET`);
  }
  /** Parágrafo com quebra de linha e de página. */
  paragrafo(t: string, tam: number, opc: { negrito?: boolean; cor?: [number, number, number]; x?: number; largura?: number; entre?: number } = {}) {
    const x = opc.x ?? MARGEM; const largura = opc.largura ?? UTIL; const alt = tam * 1.35;
    for (const l of quebrarLinhas(t, tam, largura, opc.negrito)) {
      this.garantir(alt);
      this.y -= alt;
      this.texto(x, this.y + tam * 0.3, l, tam, opc.negrito, opc.cor);
    }
    this.y -= opc.entre ?? 0;
  }
}

/** Monta o PDF. logoJpeg: bytes do logo do escritório em JPEG (opcional). */
export function gerarPdfRelatorio(r: RelatorioCliente, logoJpeg: Buffer | null = null): Buffer {
  const dimLogo = logoJpeg ? dimensoesJpeg(logoJpeg) : null;
  const logo = dimLogo && logoJpeg ? { bytes: logoJpeg, ...dimLogo } : null;

  const cab = (p: Paginador) => {
    // Faixa do topo com o logo e o nome do escritório.
    const h = 64;
    p.retangulo(0, ALT - h, LARG, h, RGB.marca);
    let x = MARGEM;
    if (logo) {
      const alturaLogo = 44; const larguraLogo = Math.min(140, (logo.largura / logo.altura) * alturaLogo);
      const alturaReal = larguraLogo === 140 ? (logo.altura / logo.largura) * 140 : alturaLogo;
      p.retangulo(x - 4, ALT - h + (h - alturaReal) / 2 - 4, larguraLogo + 8, alturaReal + 8, RGB.branco);
      p.ops.push(`q ${f(larguraLogo)} 0 0 ${f(alturaReal)} ${f(x)} ${f(ALT - h + (h - alturaReal) / 2)} cm /Im1 Do Q`);
      x += larguraLogo + 16;
    }
    const nome = quebrarLinhas(r.escritorio.nome, 15, LARG - x - MARGEM, true)[0] ?? '';
    p.texto(x, ALT - 30, nome, 15, true, RGB.branco);
    const contato = [r.escritorio.telefone, r.escritorio.email].filter(Boolean).join('  •  ');
    if (contato) p.texto(x, ALT - 47, quebrarLinhas(contato, 9, LARG - x - MARGEM)[0] ?? '', 9, false, RGB.branco);
    p.y = ALT - h - 18;
  };
  const p = new Paginador(cab);

  // Título e empresa
  p.paragrafo(r.titulo, 18, { negrito: true, cor: RGB.marca, entre: 2 });
  p.paragrafo(`${r.empresa.nome}`, 12, { negrito: true });
  p.paragrafo(`CNPJ ${cnpjFormatado(r.empresa.cnpj)}  •  Emitido em ${dataBr(r.hoje)}`, 9.5, { cor: RGB.suave, entre: 10 });

  // Quadro do resumo geral
  {
    const linhas = quebrarLinhas(r.geral.frase, 10.5, UTIL - 32);
    const h = 30 + linhas.length * 14;
    p.garantir(h + 10);
    p.retangulo(MARGEM, p.y - h, UTIL, h, FUNDO[r.geral.cor]);
    p.retangulo(MARGEM, p.y - h, 6, h, RGB[r.geral.cor]);
    p.texto(MARGEM + 18, p.y - 20, r.geral.titulo, 14, true, RGB[r.geral.cor]);
    linhas.forEach((l, i) => p.texto(MARGEM + 18, p.y - 36 - i * 14, l, 10.5));
    p.y -= h + 16;
  }

  // O que precisa de atenção
  const doCliente = r.pendencias.filter((x) => x.paraCliente);
  if (doCliente.length) {
    p.garantir(40);
    p.paragrafo('O que precisa de atenção', 12.5, { negrito: true, cor: RGB.marca, entre: 2 });
    for (const x of doCliente) {
      const c = x.gravidade === 'alta' ? RGB.vermelho : RGB.amarelo;
      const linhas = quebrarLinhas(x.texto, 10, UTIL - 20);
      p.garantir(linhas.length * 13.5 + 4);
      p.retangulo(MARGEM + 2, p.y - 10, 5, 5, c);
      linhas.forEach((l) => { p.y -= 13.5; p.texto(MARGEM + 16, p.y + 3, l, 10); });
      p.y -= 4;
    }
    p.y -= 8;
  }

  // Seções
  for (const s of r.secoes) {
    p.garantir(60);
    const yTopo = p.y;
    p.retangulo(MARGEM, yTopo - 22, UTIL, 22, FUNDO[s.cor]);
    p.retangulo(MARGEM, yTopo - 22, 4, 22, RGB[s.cor]);
    p.texto(MARGEM + 12, yTopo - 15, s.titulo, 11.5, true);
    const rot = ROTULO_COR[s.cor];
    const wr = larguraTexto(rot, 8, true) + 12;
    p.retangulo(MARGEM + UTIL - wr - 6, yTopo - 17, wr, 13, RGB[s.cor]);
    p.texto(MARGEM + UTIL - wr, yTopo - 13.5, rot, 8, true, RGB.branco);
    p.y = yTopo - 28;
    for (const l of s.linhas) p.paragrafo(l.texto, 10, { x: MARGEM + 12, largura: UTIL - 20, cor: l.cor === 'vermelho' ? RGB.vermelho : RGB.tinta, entre: 1 });
    p.paragrafo(s.explicacao, 8.5, { x: MARGEM + 12, largura: UTIL - 20, cor: RGB.suave, entre: 12 });
  }

  // Aviso e rodapé do escritório
  p.paragrafo(r.aviso, 8.5, { cor: RGB.suave, entre: 4 });
  if (r.escritorio.rodape) p.paragrafo(r.escritorio.rodape, 8.5, { cor: RGB.suave });

  // Rodapé de cada página
  const total = p.paginas.length;
  p.paginas.forEach((ops, i) => {
    ops.push(`${cor(RGB.cinza, false)} 0.5 w ${f(MARGEM)} ${f(MARGEM + 6)} m ${f(LARG - MARGEM)} ${f(MARGEM + 6)} l S`);
    ops.push(`BT ${cor(RGB.suave)} /F1 8 Tf ${f(MARGEM)} ${f(MARGEM - 6)} Td ${literal(`${r.escritorio.nome} — ${r.empresa.nome}`.slice(0, 110))} Tj ET`);
    const pag = `Página ${i + 1} de ${total}`;
    ops.push(`BT ${cor(RGB.suave)} /F1 8 Tf ${f(LARG - MARGEM - larguraTexto(pag, 8))} ${f(MARGEM - 6)} Td ${literal(pag)} Tj ET`);
  });

  // ---------------------------------------------------------------- Montagem dos objetos do PDF
  const objetos: Buffer[] = [];
  const add = (b: Buffer | string) => { objetos.push(typeof b === 'string' ? Buffer.from(b, 'latin1') : b); return objetos.length; };
  const idCatalogo = add(''); const idPaginas = add('');
  const idF1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const idF2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  let idImg = 0;
  if (logo) idImg = add(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${logo.largura} /Height ${logo.altura} /ColorSpace /${logo.componentes === 1 ? 'DeviceGray' : 'DeviceRGB'} /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>\nstream\n`, 'latin1'), logo.bytes, Buffer.from('\nendstream', 'latin1')]));
  const recursos = `<< /Font << /F1 ${idF1} 0 R /F2 ${idF2} 0 R >>${idImg ? ` /XObject << /Im1 ${idImg} 0 R >>` : ''} >>`;
  const idsPaginas: number[] = [];
  for (const ops of p.paginas) {
    const conteudo = Buffer.from(ops.join('\n'), 'latin1');
    const idConteudo = add(Buffer.concat([Buffer.from(`<< /Length ${conteudo.length} >>\nstream\n`, 'latin1'), conteudo, Buffer.from('\nendstream', 'latin1')]));
    idsPaginas.push(add(`<< /Type /Page /Parent ${idPaginas} 0 R /MediaBox [0 0 ${f(LARG)} ${f(ALT)}] /Resources ${recursos} /Contents ${idConteudo} 0 R >>`));
  }
  objetos[idCatalogo - 1] = Buffer.from(`<< /Type /Catalog /Pages ${idPaginas} 0 R >>`, 'latin1');
  objetos[idPaginas - 1] = Buffer.from(`<< /Type /Pages /Kids [${idsPaginas.map((i) => `${i} 0 R`).join(' ')}] /Count ${idsPaginas.length} >>`, 'latin1');
  const idInfo = add(`<< /Title ${literal(`${r.titulo} - ${r.empresa.nome}`)} /Producer (Murad Fisco IA) >>`);

  const partes: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  let pos = partes[0].length;
  const offsets: number[] = [];
  objetos.forEach((o, i) => {
    offsets.push(pos);
    const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), o, Buffer.from('\nendobj\n', 'latin1')]);
    partes.push(b); pos += b.length;
  });
  const xref = [`xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`, ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)].join('');
  partes.push(Buffer.from(`${xref}trailer\n<< /Size ${objetos.length + 1} /Root ${idCatalogo} 0 R /Info ${idInfo} 0 R >>\nstartxref\n${pos}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(partes);
}
